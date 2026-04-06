const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = req.body.folder || 'general';   // Default folder = "general"
    
    // Sanitize folder name
    folder = folder.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    const uploadPath = path.join('uploads', folder);

    // Create folder if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Unique filename: timestamp + random + original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Allow ALL file types
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 100 * 1024 * 1024   // Max 100 MB per file
  }
});

module.exports = upload;