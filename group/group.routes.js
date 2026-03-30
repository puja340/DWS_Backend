const express = require('express');
const router = express.Router();

const groupController = require('./group.controller');

router.get('/', groupController.getAllGroups);

module.exports = router;