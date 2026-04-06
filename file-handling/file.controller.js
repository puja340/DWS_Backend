const fs = require('fs');
const path = require('path');

// Create New Folder
exports.createFolder = async (req, res) => {
  try {
    const { folderName } = req.body;

    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Folder name is required"
      });
    }

    // Sanitize folder name (remove dangerous characters)
    const sanitizedFolder = folderName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const folderPath = path.join('uploads', sanitizedFolder);

    if (fs.existsSync(folderPath)) {
      return res.status(400).json({
        success: false,
        message: "Folder already exists"
      });
    }

    fs.mkdirSync(folderPath, { recursive: true });

    res.status(201).json({
      success: true,
      message: "Folder created successfully",
      folderName: sanitizedFolder,
      path: `uploads/${sanitizedFolder}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error creating folder",
      error: error.message
    });
  }
};

// ====================== Upload File(s) ======================
exports.uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded"
      });
    }

    const folder = req.body.folder || 'general';
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      fileName: file.filename,
      size: file.size,
      path: `uploads/${folder}/${file.filename}`,
      url: `http://localhost:5000/uploads/${folder}/${file.filename}`
    }));

    res.status(200).json({
      success: true,
      message: `${req.files.length} file(s) uploaded successfully`,
      folder: folder,
      files: uploadedFiles
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error uploading files",
      error: error.message
    });
  }
};


// ====================== List Files & Folders ======================
exports.listFiles = async (req, res) => {
  try {
    const folderName = req.query.folder || '';   // e.g. ?folder=images
    const basePath = path.join('uploads', folderName);

    // If folder doesn't exist, return empty
    if (!fs.existsSync(basePath)) {
      return res.status(200).json({
        success: true,
        folder: folderName || 'root',
        folders: [],
        files: []
      });
    }

    const items = fs.readdirSync(basePath, { withFileTypes: true });

    const folders = items
      .filter(item => item.isDirectory())
      .map(folder => ({
        name: folder.name,
        type: 'folder',
        path: path.join(folderName, folder.name).replace(/\\/g, '/')
      }));

    const files = items
      .filter(item => item.isFile())
      .map(file => {
        const filePath = path.join(basePath, file.name);
        const stats = fs.statSync(filePath);
        
        return {
          name: file.name,
          originalName: file.name.split('-').slice(2).join('-') || file.name, // rough attempt to show original
          size: stats.size,
          uploadDate: stats.mtime,
          type: 'file',
          path: path.join(folderName, file.name).replace(/\\/g, '/'),
          url: `http://localhost:5000/uploads/${folderName ? folderName + '/' : ''}${file.name}`
        };
      });

    res.status(200).json({
      success: true,
      folder: folderName || 'root',
      folders: folders,
      files: files,
      totalFiles: files.length,
      totalFolders: folders.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error listing files",
      error: error.message
    });
  }
};

// ====================== Delete File ======================
exports.deleteFile = async (req, res) => {
  try {
    const { filePath } = req.body;   // e.g. "images/abc1234567890-file.jpg"

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: "filePath is required"
      });
    }

    const fullPath = path.join('uploads', filePath);

    // Security check: prevent deleting outside uploads folder
    if (!fullPath.startsWith(path.join('uploads'))) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: "File not found"
      });
    }

    fs.unlinkSync(fullPath);

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
      deletedPath: filePath
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error deleting file",
      error: error.message
    });
  }
};