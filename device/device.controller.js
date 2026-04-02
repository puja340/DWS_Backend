
const sequelize = require('../config/database');   
const DeviceFactory = require('./device.model');   

const { createPendingCode } = require('./device.service');
const { onlineAgents } = require('../Websocket');

const registerDevice = async (req, res) => {
  try {
    const { name, os, mac_address, ownerId } = req.body;

    const device = await Device.create({ name, os, mac_address , ownerId });
    res.status(201).json({ message: 'Device registered successfully', deviceId: device.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Device registration failed' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { deviceId, status } = req.body;

    const device = await Device.findByPk(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    device.status = status;
    await device.save();

    res.json({ message: 'Device status updated', deviceId: device.id, status: device.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating device status' });
  }
};

const listDevices = async (req, res) => {
  try {
    const { ownerId } = req.query;

    const devices = await Device.findAll({ where: { ownerId } });

    const all = devices;
    const available = devices.filter(d => d.status === 'online');
    const unavailable = devices.filter(d => d.status === 'offline');
    const disabled = devices.filter(d => d.status === 'disabled');
    const toInstall = devices.filter(d => d.status === 'pending');

    res.json({ all, available, unavailable, disabled, toInstall });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching devices' });
  }
};

const updateDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { name, group, description } = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: "deviceId is required"
            });
        }

        // Lazy load model
        const DeviceFactory = require('./device.model');
        const Device = DeviceFactory(sequelize, require('sequelize').DataTypes);

        const device = await Device.findByPk(deviceId);

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "Device not found"
            });
        }

        // Update only allowed fields
        await device.update({
            name: name || device.name,
            group: group !== undefined ? group : device.group,
            description: description !== undefined ? description : device.description
        });

        // Return updated device
        const updatedDevice = await Device.findByPk(deviceId);

        return res.json({
            success: true,
            message: "Device updated successfully",
            device: {
                id: updatedDevice.id,
                device_id: updatedDevice.device_id,
                name: updatedDevice.name,
                group: updatedDevice.group,
                description: updatedDevice.description,
                hostname: updatedDevice.hostname,
                is_online: updatedDevice.is_online
            }
        });

    } catch (err) {
        console.error("Error in updateDevice:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update device",
            error: err.message
        });
    }
};

const generateCode = async (req, res) => {
  try {
    const userId = req.user?.id || 1;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const { deviceName, group, description } = req.body;

    if (!deviceName) {
      return res.status(400).json({
        success: false,
        message: 'deviceName is required'
      });
    }

    // Generate code
    const code = createPendingCode(userId, deviceName, group, description);

    // Lazy load model
    const DeviceFactory = require('./device.model');
    const Device = DeviceFactory(sequelize, require('sequelize').DataTypes);

    // Create device record immediately
    const newDevice = await Device.create({
      user_id: userId,
      name: deviceName,
      group: group || null,
      description: description || null,
      pairing_code: code,
      is_online: false,
      // device_id will be filled later when agent connects
    });

    return res.status(200).json({
      success: true,
      code,
      deviceDbId: newDevice.id,
      deviceName: deviceName,
      group: group || '',
      description: description || '',
      message: 'Code generated successfully. Enter it in the agent.'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

const listMyDevices = async (req, res) => {
    try {
        // 1. Get current authenticated user
        const userId = 1;   // ← hard-coded for now

        const DeviceFactory = require('./device.model');
        const Device = DeviceFactory(sequelize, require('sequelize').DataTypes);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated"
            });
        }

        // 2. Find all devices belonging to this user (from database)
        const allDevices = await Device.findAll({
            where: { user_id: userId },
            attributes: [
                'id',
                'device_id',
                'name',
                'group',          
                'description',    
                'hostname',
                'os',
                'mac_address',
                'ip_address',
                'cpu_serial',
                'last_connected',
                'is_online',
                'created_at'
            ],
            order: [['last_connected', 'DESC']]   // newest first
        });

        // 3. We will classify them in the next step
        // for now just return all
        return res.json({
            success: true,
            total: allDevices.length,
            all: allDevices,
            available: [],
            unavailable: []
        });

    } catch (err) {
        console.error("Error in listMyDevices:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message   // only in dev – remove in production
        });
    }
};

const sendCommand = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { command, isRawKey = false } = req.body;

        if (!deviceId || !command) {
            return res.status(400).json({
                success: false,
                message: "deviceId and command are required"
            });
        }

        const ws = onlineAgents.get(deviceId);

        if (!ws || ws.readyState !== ws.OPEN) {
            return res.status(404).json({
                success: false,
                message: "Device is not connected"
            });
        }

        const message = {
            type: isRawKey ? "terminal_input" : "execute_command",
            command: command,
        };

        ws.send(JSON.stringify(message));

        console.log(`[Terminal] Sent "${command}" to ${deviceId}`);

        // Collect output for a short time
        const output = await new Promise((resolve) => {
            let buffer = "";

            const timeout = setTimeout(() => {
                resolve(buffer || "No output received");
            }, 4000); // 6 seconds is enough for most commands

            const handler = (responseMsg) => {
                try {
                    const data = JSON.parse(responseMsg.toString());

                    if (data.type === 'terminal_output') {
                        buffer += (data.data || data.output || "");
                    }
                } catch (e) {}
            };

            ws.on('message', handler);

            // Clean up listener after timeout
            setTimeout(() => {
                ws.removeListener('message', handler);
            }, 6500);
        });

        return res.json({
            success: true,
            deviceId,
            command,
            output: output,
            type: "terminal_output"
        });

    } catch (err) {
        console.error("Error in sendCommand:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to execute command",
            error: err.message
        });
    }
};

const searchDevices = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Search query (q) is required"
            });
        }

        const searchTerm = `%${q.trim()}%`;

        // Lazy load Device model
        const DeviceFactory = require('./device.model');
        const Device = DeviceFactory(sequelize, require('sequelize').DataTypes);

        const userId = 1;   // hard-coded for now

        const devices = await Device.findAll({
            where: {
                user_id: userId,
                [require('sequelize').Op.or]: [
                    { name:     { [require('sequelize').Op.iLike]: searchTerm } },
                    { hostname: { [require('sequelize').Op.iLike]: searchTerm } }
                    // You can add more fields later when columns exist
                ]
            },
            attributes: [
                'id',
                'device_id',
                'name',
                'hostname',
                'os',
                'mac_address',
                'ip_address',
                'cpu_serial',
                'last_connected',
                'is_online',
                'created_at'
            ],
            order: [['last_connected', 'DESC']]
        });

        return res.json({
            success: true,
            total: devices.length,
            query: q.trim(),
            devices: devices
        });

    } catch (err) {
        console.error("Error in searchDevices:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while searching",
            error: err.message
        });
    }
};

const toggleDisableDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action } = req.body; // "disable" or "enable"

    if (!deviceId || !action) {
      return res.status(400).json({
        success: false,
        message: "deviceId and action are required"
      });
    }

    // Lazy load Device model
    const DeviceFactory = require('./device.model');
    const Device = DeviceFactory(sequelize, require('sequelize').DataTypes);

    const device = await Device.findByPk(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    let commandToSend = null;
    let logMessage = "";

    if (action === "disable") {
      device.is_disabled = true;
      device.is_online = false;
      commandToSend = "disable_agent";
      logMessage = `Disabling device ${deviceId} (${device.name})`;
    } 
    else if (action === "enable") {
      device.is_disabled = false;
      commandToSend = "enable_agent";
      logMessage = `Enabling device ${deviceId} (${device.name})`;
    } 
    else {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use 'disable' or 'enable'."
      });
    }

    // Save changes to database
    await device.save();

    console.log(`[Disable/Enable] ${logMessage}`);

    // Send command to Python agent if it is currently connected
    const ws = onlineAgents.get(device.device_id);   // Use device_id as key

    if (ws && ws.readyState === ws.OPEN && commandToSend) {
      ws.send(JSON.stringify({
        type: commandToSend,
        deviceId: device.device_id,
        message: `Device has been ${action}d from server`
      }));

      console.log(`[Disable/Enable] Sent ${commandToSend} command to device: ${device.device_id}`);
    } else {
      console.log(`[Disable/Enable] Device ${deviceId} is not online. Command not sent to agent.`);
    }

    return res.json({
      success: true,
      message: `Device ${action}d successfully`,
      deviceId: device.id,
      is_disabled: device.is_disabled,
      is_online: device.is_online
    });

  } catch (err) {
    console.error("Error in toggleDisableDevice:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

const deleteDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: "deviceId is required"
            });
        }

        // Lazy load the model
        const DeviceFactory = require('./device.model');
        const Device = DeviceFactory(sequelize, require('sequelize').DataTypes);

        // Find the device first
        const device = await Device.findByPk(deviceId);

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "Device not found"
            });
        }

        // Step 1: If device is online, notify the Python agent to clean up
        const ws = onlineAgents.get(device.device_id);   // device_id is the key in onlineAgents

        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                command: "delete_agent",
                deviceId: device.device_id,
                message: "This device is being deleted from the server"
            }));

            console.log(`[Delete] Sent delete_agent command to device: ${device.device_id}`);
            
            // Optional: Give a small delay so agent can process before we delete
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Step 2: Permanently delete the record from database
        await device.destroy();

        // Step 3: Remove from onlineAgents if it was connected
        if (onlineAgents.has(device.device_id)) {
            onlineAgents.delete(device.device_id);
        }

        return res.json({
            success: true,
            message: "Device deleted successfully",
            deletedDeviceId: deviceId
        });

    } catch (err) {
        console.error("Error in deleteDevice:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete device",
            error: err.message
        });
    }
};

const rebootAgent = async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: "deviceId is required"
            });
        }

        // Find the WebSocket connection
        const ws = onlineAgents.get(deviceId);

        if (!ws || ws.readyState !== ws.OPEN) {
            return res.status(404).json({
                success: false,
                message: "Device is not connected"
            });
        }

        // Send reboot command to agent
        const message = {
            type: "reboot_agent",
            requestedAt: new Date().toISOString()
        };

        ws.send(JSON.stringify(message));

        console.log(`[Reboot Agent] Sent reboot command to device: ${deviceId}`);

        return res.json({
            success: true,
            message: "Reboot command sent to agent",
            deviceId,
            command: "reboot_agent"
        });

    } catch (err) {
        console.error("Error in rebootAgent:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to send reboot command",
            error: err.message
        });
    }
};

const rebootOS = async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: "deviceId is required"
            });
        }

        // Find the WebSocket connection
        const ws = onlineAgents.get(deviceId);

        if (!ws || ws.readyState !== ws.OPEN) {
            return res.status(404).json({
                success: false,
                message: "Device is not connected"
            });
        }

        // Send reboot OS command to agent
        const message = {
            type: "reboot_os",
            requestedAt: new Date().toISOString()
        };

        ws.send(JSON.stringify(message));

        console.log(`[Reboot OS] Sent reboot OS command to device: ${deviceId}`);

        return res.json({
            success: true,
            message: "Reboot OS command sent to device",
            deviceId,
            command: "reboot_os"
        });

    } catch (err) {
        console.error("Error in rebootOS:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to send reboot OS command",
            error: err.message
        });
    }
};

module.exports = {
  registerDevice,
  updateStatus,
  listDevices,
  listMyDevices,
  updateDevice,
  generateCode,
  sendCommand,
  searchDevices,
  toggleDisableDevice,
  deleteDevice,
  rebootAgent,
  rebootOS
};

