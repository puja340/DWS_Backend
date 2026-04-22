const { WebSocket, WebSocketServer } = require('ws');
const net = require('net');
const crypto = require('crypto');
const sequelize = require('./config/database');
const { consumePendingCode } = require('./device/device.service');

const onlineAgents = new Map();
const frontendClients = new Map();

// ==================== VNC PROXY CONFIG ====================
const VNC_TARGET_HOST = process.env.VNC_TARGET_HOST || "192.168.1.50";
const VNC_TARGET_PORT = Number(process.env.VNC_TARGET_PORT || 5900);
const SOCKET_IDLE_TIMEOUT_MS = Number(process.env.SOCKET_IDLE_TIMEOUT_MS || 0);
// ==================== END VNC CONFIG ====================

function setupWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {

        // ==================== VNC PROXY (noVNC) ====================
    if (req.url && req.url.startsWith('/vnc')) {
        console.log(`[vnc-proxy] VNC path detected: ${req.url} (from ${req.socket.remoteAddress || 'unknown'})`);
        return handleVncConnection(ws, req);   // Note: ws and req (not browserSocket/request)
    }
    // ==================== END VNC PROXY ====================

        // ==================== FRONTEND CONNECTION HANDLING ====================
        if (req.url && req.url.startsWith('/terminal/')) {
            const deviceId = req.url.split('/terminal/')[1];
            ws.isFrontend = true;
            ws.deviceId = deviceId;

            // Important: frontend sockets must also participate in heartbeat,
            // otherwise the global heartbeat will terminate them.
            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });

            frontendClients.set(deviceId, ws);
            console.log(`→ Frontend connected for device: ${deviceId}`);

            ws.on('message', (msg) => {
                try {
                    const data = JSON.parse(msg.toString());
                    console.log(`→ Frontend message for ${deviceId}:`, data?.type || 'unknown');
                } catch (err) {
                    console.log(`→ Frontend raw message for ${deviceId}`);
                }

                const deviceWs = onlineAgents.get(deviceId);
                if (deviceWs && deviceWs.readyState === deviceWs.OPEN) {
                    deviceWs.send(msg);
                } else {
                    console.log(`→ No online agent socket found for device: ${deviceId}`);
                }
            });

            ws.on('close', (code, reason) => {
                frontendClients.delete(deviceId);
                console.log(`→ Frontend disconnected for device: ${deviceId} code=${code} reason=${reason?.toString?.() || ''}`);
            });

            ws.on('error', (err) => {
                console.error(`→ Frontend socket error for device: ${deviceId}`, err);
            });

            return;
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
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'deviceId is required for reconnect'
                        }));
                        ws.close();
                        return;
                    }

                    const device = await sequelize.models.Device.findOne({
                        where: { device_id: deviceId }
                    });

                    if (!device) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Device not found. Please register again.'
                        }));
                        ws.close();
                        return;
                    }

                    await device.update({
                        is_online: true,
                        last_connected: new Date()
                    });

                    onlineAgents.set(deviceId, ws);
                    ws.device = { id: device.id, deviceId, userId: device.user_id };

                    console.log(`🔄 Device reconnected: ${deviceId} (${device.name})`);

                    ws.send(JSON.stringify({
                        type: 'reconnected',
                        deviceId: device.device_id,
                        message: 'Reconnected successfully'
                    }));

                    ws.send(JSON.stringify({
                        type: 'shell_started',
                        deviceId: deviceId,
                        message: 'Shell session has started'
                    }));

                    return;
                }

                // ==================== HANDLE TERMINAL OUTPUT FROM AGENT ====================
                if (data.type === 'terminal_output') {
                    const output = data.data || '';
                    console.log(`[Terminal Output] From ${ws.device?.deviceId || 'unknown'}:`);
                    console.log(output);

                    const frontendWs = frontendClients.get(ws.device?.deviceId);
                    if (frontendWs && frontendWs.readyState === frontendWs.OPEN) {
                        frontendWs.send(JSON.stringify({
                            type: 'terminal_output',
                            data: output
                        }));
                    } else {
                        console.log(`[Terminal Output] No frontend socket ready for ${ws.device?.deviceId || 'unknown'}`);
                    }
                    return;
                }

                if (data.type === 'terminal_exit') {
                    console.log(`[Terminal Exit] From ${ws.device?.deviceId || 'unknown'} with code ${data.code}`);

                    const frontendWs = frontendClients.get(ws.device?.deviceId);
                    if (frontendWs && frontendWs.readyState === frontendWs.OPEN) {
                        frontendWs.send(JSON.stringify({
                            type: 'terminal_exit',
                            code: data.code
                        }));
                    } else {
                        console.log(`[Terminal Exit] No frontend socket ready for ${ws.device?.deviceId || 'unknown'}`);
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

                    const {
                        os = null,
                        node: hostname = null,
                        agent_version = '0.1.0',
                        mac_address = null,
                        ip_address = null,
                        cpu_serial = null
                    } = data;

                    try {
                        const device = await sequelize.models.Device.findOne({
                            where: {
                                pairing_code: pairingCode,
                                user_id: userId
                            }
                        });

                        if (!device) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'Device not found for this code'
                            }));
                            ws.close();
                            return;
                        }

                        const deviceId = 'dev-' + crypto.randomBytes(8).toString('hex');

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

                        const token = crypto.randomBytes(32).toString('hex');

                        ws.send(JSON.stringify({
                            type: 'registered',
                            deviceId: deviceId,
                            token: token,
                            deviceDbId: device.id,
                            message: 'Agent connected and registered!'
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

                    return;
                }

                                // ==================== HANDLE RESOURCES DATA FROM PYTHON DEVICE ====================
                        
                if (data.type === 'resource' || data.type === 'resources') {
                    const deviceId = ws.device?.deviceId || 'unknown';

                    console.log(`📊 [RESOURCES DATA RECEIVED] From device: ${deviceId}`);

                    // Use the actual data (Python is sending flat object, not nested under "data")
                    const resourcesData = data;   // No need for data.data anymore

                    try {
                        // Correct path to file.controller.js
                        const fileController = require('./file-handling/file.controller');

                        if (fileController && fileController.latestResources) {
                            fileController.latestResources.set(deviceId, resourcesData);
                            console.log(`💾 [RESOURCES] Latest data saved for device ${deviceId}`);
                        } else {
                            console.error(`❌ [RESOURCES] latestResources not exported properly from file.controller`);
                        }
                    } catch (err) {
                        console.error(`❌ [RESOURCES] Failed to load file.controller:`, err.message);
                    }

                    // Optional: Forward live update to frontend
                    const frontendWs = frontendClients.get(deviceId);
                    if (frontendWs && frontendWs.readyState === frontendWs.OPEN) {
                        frontendWs.send(JSON.stringify({
                            type: 'resources_update',
                            deviceId: deviceId,
                            data: resourcesData
                        }));
                    }

                    return;
                }


                if (data.type === 'ping') {
                    ws.isAlive = true;
                    return;
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

    // Heartbeat
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log(`→ Terminating stale websocket ${ws.isFrontend ? '(frontend)' : '(agent)'} ${ws.deviceId || ws.device?.deviceId || ''}`);
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    server.on('close', () => clearInterval(interval));
}

// ==================== VNC PROXY HANDLER (noVNC) ====================
// ==================== VNC PROXY HANDLER (noVNC) - Fixed Heartbeat + Detailed Logging ====================
function handleVncConnection(browserSocket, request) {
    const clientAddress = request.socket.remoteAddress || "unknown";
    const connectionId = `VNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    console.info(`[vnc-proxy] [${connectionId}] Browser connected from ${clientAddress} | Path: ${request.url}`);

    // === IMPORTANT: Disable heartbeat termination for VNC sockets ===
    browserSocket.isAlive = true;           // Prevent immediate termination
    browserSocket.isVncConnection = true;   // Mark it as VNC so we can skip in heartbeat if needed

    console.log(`[vnc-proxy] [${connectionId}] Opening TCP tunnel to ${VNC_TARGET_HOST}:${VNC_TARGET_PORT}`);

    const vncSocket = net.createConnection({
        host: VNC_TARGET_HOST,
        port: VNC_TARGET_PORT
    });

    if (SOCKET_IDLE_TIMEOUT_MS > 0) {
        console.log(`[vnc-proxy] [${connectionId}] Idle timeout enabled: ${SOCKET_IDLE_TIMEOUT_MS}ms`);
        vncSocket.setTimeout(SOCKET_IDLE_TIMEOUT_MS, () => {
            console.warn(`[vnc-proxy] [${connectionId}] Idle timeout triggered`);
            vncSocket.end();
        });
    }

    vncSocket.on("connect", () => {
        console.info(`[vnc-proxy] [${connectionId}] ✅ SUCCESS: Connected to VNC server ${VNC_TARGET_HOST}:${VNC_TARGET_PORT}`);
    });

    vncSocket.on("data", (chunk) => {
        const bytes = chunk.length;
        console.log(`[vnc-proxy] [${connectionId}] ← VNC Server sent ${bytes} bytes`);

        if (browserSocket.readyState === WebSocket.OPEN) {
            browserSocket.send(chunk, { binary: true });
            console.log(`[vnc-proxy] [${connectionId}] → Forwarded ${bytes} bytes to browser`);
        }
    });

    vncSocket.on("error", (error) => {
        console.error(`[vnc-proxy] [${connectionId}] ❌ VNC Server ERROR: ${error.message}`);
        if (browserSocket.readyState === WebSocket.OPEN || browserSocket.readyState === WebSocket.CONNECTING) {
            browserSocket.close(1011, "VNC upstream error");
        }
    });

    vncSocket.on("close", (hadError) => {
        console.info(`[vnc-proxy] [${connectionId}] VNC TCP closed (hadError: ${hadError})`);
        if (browserSocket.readyState === WebSocket.OPEN || browserSocket.readyState === WebSocket.CONNECTING) {
            browserSocket.close(1000, "VNC connection closed");
        }
    });

    // Browser → VNC
    browserSocket.on("message", (message) => {
        const bytes = Buffer.isBuffer(message) ? message.length : (message.byteLength || 0);
        if (!vncSocket.destroyed && vncSocket.writable) {
            vncSocket.write(message);
            console.log(`[vnc-proxy] [${connectionId}] ← Browser sent ${bytes} bytes to VNC`);
        }
    });

    // Heartbeat support for VNC socket
    browserSocket.on("pong", () => {
        browserSocket.isAlive = true;
        console.log(`[vnc-proxy] [${connectionId}] Received pong from browser`);
    });

    browserSocket.on("close", (code, reasonBuffer) => {
        const reason = reasonBuffer ? reasonBuffer.toString() : "no reason";
        console.info(`[vnc-proxy] [${connectionId}] Browser WebSocket closed | Code: ${code} | Reason: ${reason}`);

        if (!vncSocket.destroyed) {
            vncSocket.end();
        }
    });

    browserSocket.on("error", (error) => {
        console.error(`[vnc-proxy] [${connectionId}] ❌ Browser WebSocket ERROR: ${error.message}`);
        if (!vncSocket.destroyed) vncSocket.destroy();
    });

    vncSocket.on("end", () => {
        console.log(`[vnc-proxy] [${connectionId}] VNC socket received FIN`);
    });
}
// ==================== END VNC PROXY HANDLER ====================

module.exports = { setupWebSocket, onlineAgents };
