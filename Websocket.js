const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const sequelize = require('./config/database');   
const { consumePendingCode } = require('./device/device.service');
const onlineAgents = new Map();  
const frontendClients = new Map(); // ← ADDED

function setupWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {  // ← 'req' added
        
        // ==================== FRONTEND CONNECTION HANDLING ====================
        if (req.url && req.url.startsWith('/terminal/')) {
            const deviceId = req.url.split('/terminal/')[1];
            ws.isFrontend = true;
            ws.deviceId = deviceId;
            frontendClients.set(deviceId, ws);
            console.log(`→ Frontend connected for device: ${deviceId}`);

            ws.on('message', (msg) => {
                const deviceWs = onlineAgents.get(deviceId);
                if (deviceWs && deviceWs.readyState === deviceWs.OPEN) {
                    deviceWs.send(msg);
                }
            });

            ws.on('close', () => {
                frontendClients.delete(deviceId);
                console.log(`→ Frontend disconnected for device: ${deviceId}`);
            });

            return; // stop here, don't run device logic
        }
        // ==================== END FRONTEND HANDLING ====================

        console.log('→ New WebSocket connection (likely agent)');

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'reconnect') {
                    const { deviceId, token } = data;

                    if (!deviceId) {
                        ws.send(JSON.stringify({ type: 'error', message: 'deviceId is required for reconnect' }));
                        ws.close();
                        return;
                    }

                    // Check if this device exists in database
                    const device = await sequelize.models.Device.findOne({
                        where: { device_id: deviceId }
                    });

                    if (!device) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Device not found. Please register again.' }));
                        ws.close();
                        return;
                    }

                    // Mark as online
                    await device.update({
                        is_online: true,
                        last_connected: new Date()
                    });

                    // Store connection
                    onlineAgents.set(deviceId, ws);

                    // Attach device info to socket
                    ws.device = { id: device.id, deviceId, userId: device.user_id };

                    console.log(`🔄 Device reconnected: ${deviceId} (${device.name})`);

                    ws.send(JSON.stringify({
                        type: 'reconnected',
                        deviceId: device.device_id,
                        message: 'Reconnected successfully'
                    }));

                    ws.send(JSON.stringify({
                        type: "shell_started",
                        deviceId: deviceId,
                        message: "Shell session has started"
                    }));

                    return;
                }

                // ==================== HANDLE TERMINAL OUTPUT FROM AGENT ====================
                if (data.type === 'terminal_output') {
                    const output = data.data || '';
                    console.log(`[Terminal Output] From ${ws.device?.deviceId || 'unknown'}:`);
                    console.log(output); 

                    // Forward output to frontend
                    const frontendWs = frontendClients.get(ws.device?.deviceId);
                    if (frontendWs && frontendWs.readyState === frontendWs.OPEN) {
                        frontendWs.send(JSON.stringify({
                            type: 'terminal_output',
                            data: output
                        }));
                    }
                    return;   
                }

                if (data.type === 'terminal_exit') {
                    console.log(`[Terminal Exit] From ${ws.device?.deviceId || 'unknown'} with code ${data.code}`);

                    // Forward to frontend
                    const frontendWs = frontendClients.get(ws.device?.deviceId);
                    if (frontendWs && frontendWs.readyState === frontendWs.OPEN) {
                        frontendWs.send(JSON.stringify({
                            type: 'terminal_exit',
                            code: data.code
                        }));
                    }
                    return;
                }

                if (data.type === 'register') {
                    const codeInfo = consumePendingCode(data.code);

                    if (!codeInfo) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Invalid, expired or already used code'
                        }));
                        ws.close();
                        return;
                    }

                    const userId = codeInfo.userId;
                    const pairingCode = data.code;

                    // Get data sent by agent
                    const {
                        os = null,
                        node: hostname = null,
                        agent_version = '0.1.0',
                        mac_address = null,
                        ip_address = null,
                        cpu_serial = null
                    } = data;

                    try {
                        // Find the device that was created during code generation
                        const device = await sequelize.models.Device.findOne({
                            where: {
                                pairing_code: pairingCode,
                                user_id: userId
                            }
                        });

                        if (!device) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Device not found for this code' }));
                            ws.close();
                            return;
                        }

                        // Generate permanent device_id (only once)
                        const deviceId = 'dev-' + crypto.randomBytes(8).toString('hex');

                        // Update the existing device with agent info + device_id
                        await device.update({
                            device_id: deviceId,
                            hostname,
                            os,
                            agent_version,
                            mac_address,
                            ip_address,
                            cpu_serial,
                            last_connected: new Date(),
                            is_online: true
                        });

                        console.log(`✅ Agent connected to existing device: ${deviceId} | Name: ${device.name}`);

                        // Send success response with token for future reconnect
                        const token = crypto.randomBytes(32).toString('hex');

                        ws.send(JSON.stringify({
                            type: "registered",
                            deviceId: deviceId,
                            token: token,
                            deviceDbId: device.id,
                            message: "Agent connected and registered!"
                        }));

                        onlineAgents.set(deviceId, ws);
                        ws.device = { id: device.id, deviceId, userId };

                    } catch (err) {
                        console.error('Failed to link device:', err);
                        ws.send(JSON.stringify({ 
                            type: 'error',
                            message: 'Server error during registration'
                        }));
                        ws.close();
                    }
                } 

                else if (data.type === 'ping') {
                    ws.isAlive = true;
                }

            } catch (err) {
                console.error('Invalid WS message:', err);
            }
        });

        ws.on('close', async () => {
            for (const [devId, client] of onlineAgents.entries()) {
                if (client === ws) {
                    onlineAgents.delete(devId);

                    try {
                        if (ws.device?.deviceId) {
                            await sequelize.models.Device.update(
                                { is_online: false },
                                { where: { device_id: ws.device.deviceId } }
                            );
                            console.log(`Device went offline: ${devId}`);
                        }
                    } catch (err) {
                        console.error('Failed to mark device offline:', err);
                    }

                    break;
                }
            }
        });
    });

    // Optional: heartbeat to detect dead connections
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    // Cleanup on server close
    server.on('close', () => clearInterval(interval));
}

module.exports = { setupWebSocket, onlineAgents };