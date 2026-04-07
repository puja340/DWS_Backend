const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const {createFolder, uploadFiles, listFiles, deleteFile} = require('./file.controller');

// create folder
router.post('/create-folder', createFolder);

// Upload Single or Multiple Files
router.post('/upload', upload.array('files', 10), uploadFiles);   

// List Files & Folders
router.get('/list', listFiles);

// delete file or folder
router.delete('/delete', deleteFile);     

module.exports = router;