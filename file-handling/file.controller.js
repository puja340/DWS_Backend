const fs = require('fs');
const { type } = require('os');
const path = require('path');


// ====================== Upload File To Device ======================
exports.uploadFile = async (req, res) => {
  try {
    const { deviceId } = req.params;
    let destinationPath = req.body.destinationPath || req.body.destinationpath || '/home/pi/files/';

    // Ensure path starts with '/'
    if (!destinationPath.startsWith('/')) {
      destinationPath = '/' + destinationPath;
    }

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const file = req.file;

    console.log(`📤 [FILE UPLOAD] Received "${file.originalname}" (${file.size} bytes) → ${destinationPath}`);

    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({ success: false, message: `Device ${deviceId} is offline` });
    }

    const filename = file.originalname;

    // STEP 1: Send Upload Init
    socket.send(JSON.stringify({
      type: 'file_handling',
      command: 'upload',
      filename: filename,
      destinationPath: destinationPath,
      size: file.size
    }));

    console.log(`🚀 [UPLOAD INIT] Sent for ${filename}`);

    // STEP 2: Send file in chunks (base64)
    const chunkSize = 16 * 1024; // 16KB chunks
    const buffer = file.buffer;
    let offset = 0;

    while (offset < buffer.length) {
      const chunk = buffer.slice(offset, offset + chunkSize);
      const base64Chunk = chunk.toString('base64');

      socket.send(JSON.stringify({
        type: 'file_chunk',
        filename: filename,
        destinationPath: destinationPath,
        data: base64Chunk
      }));

      offset += chunkSize;
      // Small delay to prevent overwhelming the connection
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    // STEP 3: Send Complete
    socket.send(JSON.stringify({
      type: 'file_complete',
      filename: filename,
      destinationPath: destinationPath
    }));

    console.log(`✅ [UPLOAD COMPLETE] Sent for ${filename} (${file.size} bytes)`);

    res.status(200).json({
      success: true,
      message: `File "${filename}" is being sent to device ${deviceId}`,
      filename: filename,
      deviceId: deviceId,
      destinationPath: destinationPath,
      size: file.size
    });

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send file to device",
      error: error.message
    });
  }
};


// ====================== Delete File/Folder on Device ======================
exports.deleteFile = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { filePath, isFolder = false } = req.body;   // filePath = full path on device

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required"
      });
    }

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: "filePath is required"
      });
    }

    console.log(`🗑️ [DELETE REQUEST] Device: ${deviceId} | Path: ${filePath} | IsFolder: ${isFolder}`);

    // Get WebSocket connection
    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({
        success: false,
        message: `Device ${deviceId} is not connected or offline`
      });
    }

    // Prepare command to send to device
    const deleteData = {
      type: 'file_handling',
      command: 'delete',
      filePath: filePath,
      isFolder: isFolder,
      timestamp: Date.now()
    };

    // Send command to device
    socket.send(JSON.stringify(deleteData));

    console.log(`🚀 [DELETE] Command sent to device ${deviceId} for path: ${filePath}`);

    res.status(200).json({
      success: true,
      message: `Delete command sent to device ${deviceId}`,
      filePath: filePath,
      isFolder: isFolder
    });

  } catch (error) {
    console.error("Delete command error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send delete command to device",
      error: error.message
    });
  }
};

// ====================== Rename File/Folder on Device ======================
exports.renameFile = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { oldPath, newPath } = req.body;   // Both should be full paths on the device

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required"
      });
    }

    if (!oldPath || !newPath) {
      return res.status(400).json({
        success: false,
        message: "Both oldPath and newPath are required"
      });
    }

    if (oldPath === newPath) {
      return res.status(400).json({
        success: false,
        message: "oldPath and newPath cannot be the same"
      });
    }

    console.log(`🔄 [RENAME REQUEST] Device: ${deviceId} | Old: ${oldPath} → New: ${newPath}`);

    // Get WebSocket connection
    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({
        success: false,
        message: `Device ${deviceId} is not connected or offline`
      });
    }

    // Prepare command to send to device
    const renameData = {
      type: 'file_handling',
      command: 'rename',
      oldPath: oldPath,
      newPath: newPath,
      timestamp: Date.now()
    };

    // Send command to device
    socket.send(JSON.stringify(renameData));

    console.log(`🚀 [RENAME] Command sent to device ${deviceId} | ${oldPath} → ${newPath}`);

    res.status(200).json({
      success: true,
      message: `Rename command sent to device ${deviceId}`,
      oldPath: oldPath,
      newPath: newPath
    });

  } catch (error) {
    console.error("Rename command error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send rename command to device",
      error: error.message
    });
  }
};

// ====================== Create Folder on Device ======================
exports.createFolder = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { folderPath } = req.body;   // Full path where folder should be created

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required"
      });
    }

    if (!folderPath) {
      return res.status(400).json({
        success: false,
        message: "folderPath is required"
      });
    }

    console.log(`📁 [CREATE FOLDER REQUEST] Device: ${deviceId} | Path: ${folderPath}`);

    // Get WebSocket connection
    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({
        success: false,
        message: `Device ${deviceId} is not connected or offline`
      });
    }

    // Prepare command to send to device
    const createData = {
      type: 'file_handling',
      command: 'create_folder',
      folderPath: folderPath,
      timestamp: Date.now()
    };

    // Send command to device
    socket.send(JSON.stringify(createData));

    console.log(`🚀 [CREATE FOLDER] Command sent to device ${deviceId} for path: ${folderPath}`);

    res.status(200).json({
      success: true,
      message: `Create folder command sent to device ${deviceId}`,
      folderPath: folderPath
    });

  } catch (error) {
    console.error("Create folder command error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send create folder command to device",
      error: error.message
    });
  }
};

// ====================== Download File from Device ======================
exports.downloadFile = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { filePath } = req.body;

    if (!deviceId) return res.status(400).json({ success: false, message: "deviceId is required" });
    if (!filePath) return res.status(400).json({ success: false, message: "filePath is required" });

    console.log(`⬇️ [DOWNLOAD REQUEST] Device: ${deviceId} | File: ${filePath}`);

    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({ success: false, message: `Device ${deviceId} is not connected` });
    }

    let fileBuffer = Buffer.alloc(0);
    let filename = path.basename(filePath);
    let isComplete = false;

    const messageHandler = (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "file_start") {
          filename = data.filename || filename;
          console.log(`📋 [DOWNLOAD START] ${filename}`);
        } 
        else if (data.type === "file_chunk") {
          const chunk = Buffer.from(data.data, "base64");
          fileBuffer = Buffer.concat([fileBuffer, chunk]);
        } 
        else if (data.type === "file_complete") {
          console.log(`✅ [DOWNLOAD COMPLETE] ${filename} (${fileBuffer.length} bytes)`);

          socket.removeListener('message', messageHandler);

          isComplete = true;

          // ✅ Proper way to send binary download
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Length', fileBuffer.length);

          return res.end(fileBuffer);   // Use res.end for binary
        }
      } catch (err) {
        console.error("Download parse error:", err);
      }
    };

    socket.on('message', messageHandler);

    // Send command to device
    socket.send(JSON.stringify({
      type: 'file_handling',
      command: 'download',
      filePath: filePath,
      timestamp: Date.now()
    }));

    // Timeout
    setTimeout(() => {
      if (!isComplete && !res.headersSent) {
        socket.removeListener('message', messageHandler);
        res.status(408).json({ success: false, message: "Download timeout" });
      }
    }, 60000);

  } catch (error) {
    console.error("Download error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to download file" });
    }
  }
};

// ====================== List Files and Folders on Device ======================
exports.listFiles = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { path = '/home/pi/files/', recursive = false } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required"
      });
    }

    console.log(`📋 [LIST FILES REQUEST] Device: ${deviceId} | Path: ${path} | Recursive: ${recursive}`);

    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({
        success: false,
        message: `Device ${deviceId} is not connected or offline`
      });
    }

    // Prepare command to send to Python
    const listData = {
      type: 'file_handling',
      command: 'list',
      path: path,
      recursive: recursive,
      timestamp: Date.now()
    };

    console.log(`🚀 [LIST FILES] Sending to Python:`, listData);

    let responseReceived = false;

    const messageHandler = (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Log every response for debugging
        console.log(`📨 [LIST RESPONSE RECEIVED] Type: "${data.type}", Command: "${data.command || 'N/A'}"`);

        // ✅ Match Python's actual response format
        if (data.type === 'file_list' || data.type === 'file_list_response') {

          responseReceived = true;
          socket.removeListener('message', messageHandler);

          const fileCount = data.files?.length || 0;
          console.log(`✅ [LIST FILES] Successfully received ${fileCount} items from device ${deviceId}`);

          return res.status(200).json({
            success: true,
            message: `Files and folders listed successfully from device ${deviceId}`,
            deviceId: deviceId,
            path: path,
            recursive: recursive,
            totalItems: fileCount,
            data: data
          });
        }
      } catch (err) {
        console.error("List files parse error:", err.message);
      }
    };

    // Attach listener BEFORE sending the command
    socket.on('message', messageHandler);

    // Send the list command
    socket.send(JSON.stringify(listData));

    console.log(`✅ [LIST FILES] Command sent to device ${deviceId}`);

    // Timeout protection
    setTimeout(() => {
      if (!responseReceived && !res.headersSent) {
        socket.removeListener('message', messageHandler);
        console.log(`⏰ [LIST FILES] Timeout - No response received from device ${deviceId}`);
        res.status(408).json({
          success: false,
          message: "List files request timeout - device did not respond"
        });
      }
    }, 25000); // 25 seconds

  } catch (error) {
    console.error("List files command error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to process list files request",
        error: error.message
      });
    }
  }
};

// This will hold the latest resources data per device (in-memory for now)
const latestResources = new Map();   

// ====================== Send Resources Event (opened/closed) ======================
exports.handleResourcesEvent = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action } = req.body;

    if (!deviceId || !["opened", "closed"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid deviceId or action" });
    }

    console.log(`🔄 [RESOURCES EVENT] Device: ${deviceId} | Action: ${action}`);

    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({ success: false, message: `Device ${deviceId} is offline` });
    }

    const command = {
      type: 'resources',
      command: action,
      timestamp: Date.now()
    };

    socket.send(JSON.stringify(command));

    console.log(`🚀 [RESOURCES] ${action} command sent to device ${deviceId}`);

    res.status(200).json({
      success: true,
      message: `Resources ${action} event sent successfully`,
      deviceId,
      action
    });

  } catch (error) {
    console.error("Resources event error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ====================== Get Latest Resources (for Frontend polling) ======================
exports.getLatestResources = async (req, res) => {
  const { deviceId } = req.params;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: "deviceId is required" });
  }

  const data = latestResources.get(deviceId);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: `No resources data available for device ${deviceId} yet`
    });
  }

  res.status(200).json({
    success: true,
    deviceId,
    timestamp: Date.now(),
    data: data
  });
};

exports.latestResources = latestResources;

