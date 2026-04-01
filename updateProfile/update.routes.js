// update/update.routes.js

const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');

const updateController = require('./update.controller');
const { protect } = require('../middleware/auth');

// Protected route - only logged in users can update profile
router.put('/profile', protect, updateController.updateProfile);

router.put('/email', protect, updateController.updateEmail);

module.exports = router;