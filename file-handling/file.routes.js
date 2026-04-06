const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const {createFolder, uploadFiles, listFiles, deleteFile} = require('./file.controller');

router.post('/create-folder', createFolder);

// Upload Single or Multiple Files
router.post('/upload', upload.array('files', 10), uploadFiles);   

// List Files & Folders
router.get('/list', listFiles);


router.delete('/delete', deleteFile);     

module.exports = router;