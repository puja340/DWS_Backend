const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const { 
  uploadFile, 
  deleteFile, 
  renameFile, 
  createFolder, 
  downloadFile, 
  listFiles, 
  handleResourcesEvent,
  getLatestResources     
} = require('./file.controller');

// Existing routes
router.post('/:deviceId/upload-file', upload.single('file'), uploadFile);
router.delete('/:deviceId/delete', deleteFile);
router.put('/:deviceId/rename', renameFile);    
router.post('/:deviceId/create-folder', createFolder);
router.post('/:deviceId/download', downloadFile);
router.post('/:deviceId/list-files', listFiles);  
router.post('/:deviceId/resources', handleResourcesEvent);  

// NEW: Get latest resources data (for frontend to fetch)
router.get('/:deviceId/resources', getLatestResources);

module.exports = router;