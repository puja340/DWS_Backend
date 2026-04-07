const fs = require('fs');
const path = require('path');


// ====================== Upload File To Device ======================
exports.uploadFile = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Get destinationPath from Postman (form-data). Support both camelCase and lowercase
    let destinationPath = req.body.destinationPath || req.body.destinationpath || '/home/pi/files/';

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const file = req.file;

    console.log(`📤 [FILE UPLOAD] Received file "${file.originalname}" (${file.size} bytes) for device ${deviceId}`);
    console.log(`📍 Destination path requested: ${destinationPath}`);

    // Get WebSocket connection
    const { onlineAgents } = require('../Websocket');
    const socket = onlineAgents.get(deviceId);

    if (!socket) {
      return res.status(404).json({
        success: false,
        message: `Device ${deviceId} is not connected or offline`
      });
    }

    // Prepare data to send to Python device
    const fileData = {
      type: 'file_handling',           // Changed to 'receiveFile' - clearer for device side
      filename: file.originalname,
      destinationPath: destinationPath,
      command: 'upload',           
      size: file.size,
      mimeType: file.mimetype || 'application/octet-stream'
    };

    // Send binary file to device
    socket.send(JSON.stringify(fileData), Buffer.from(file.buffer));

    console.log(`🚀 [FILE UPLOAD] File "${file.originalname}" successfully sent to device ${deviceId} at path: ${destinationPath}`);

    res.status(200).json({
      success: true,
      message: `File "${file.originalname}" is being sent to device ${deviceId}`,
      filename: file.originalname,
      deviceId: deviceId,
      destinationPath: destinationPath
    });

  } catch (error) {
    console.error("Upload to device error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send file to device",
      error: error.message
    });
  }
};


// Keep Create Folder for local use (if needed later)
exports.createFolder = async (req, res) => {
  // You can keep or remove this later. For now keeping minimal
  res.status(200).json({ success: true, message: "Create folder not used in device upload flow" });
};

exports.listFiles = async (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: "List API not used in device file push flow" 
  });
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
    const { filePath } = req.body;   // Full path of file on the device

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

    console.log(`⬇️ [DOWNLOAD REQUEST] Device: ${deviceId} | File: ${filePath}`);

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
    const downloadData = {
      type: 'file_handling',
      command: 'download',
      filePath: filePath,
      timestamp: Date.now()
    };

    // Send command to device (device will send file back via websocket)
    socket.send(JSON.stringify(downloadData));

    console.log(`🚀 [DOWNLOAD] Command sent to device ${deviceId} for file: ${filePath}`);

    res.status(200).json({
      success: true,
      message: `Download command sent to device ${deviceId}. File will be streamed back.`,
      filePath: filePath
    });

  } catch (error) {
    console.error("Download command error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send download command to device",
      error: error.message
    });
  }
};