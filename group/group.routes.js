const express = require('express');
const router = express.Router();
const {protect} = require('../middleware/auth');
const groupController = require('./group.controller');

router.get('/', protect, groupController.getAllGroups);

router.post('/create', protect, groupController.createGroup);

router.delete('/:id', protect, groupController.deleteGroup);

router.put('/:id', protect, groupController.updateGroup);     

module.exports = router;