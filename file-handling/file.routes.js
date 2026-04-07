const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const { uploadFile, deleteFile, renameFile, createFolder, downloadFile} = require('./file.controller');

// Upload file to specific device - Keeping /api/files base
router.post('/:deviceId/upload-file', upload.single('file'), uploadFile);

router.delete('/:deviceId/delete', deleteFile);

router.put('/:deviceId/rename', renameFile);     // or router.patch if you prefer

router.post('/:deviceId/create-folder', createFolder);

router.post('/:deviceId/download', downloadFile);

module.exports = router;