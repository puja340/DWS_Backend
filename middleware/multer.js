const multer = require('multer');

// Use memory storage (files stay in RAM temporarily)
const storage = multer.memoryStorage();

// Allow ALL file types + set reasonable size limit
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024   // Max 50 MB per file (you can increase later)
  },
  fileFilter: (req, file, cb) => {
    cb(null, true); // Accept all file types
  }
});

module.exports = upload;