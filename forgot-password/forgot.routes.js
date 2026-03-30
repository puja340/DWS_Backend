const express = require('express');
const router = express.Router();
const forgotController = require('./forgot.controller');

// Request reset link
router.post('/forgot-password', forgotController.requestReset);

// Reset password
router.post('/reset-password', forgotController.resetPassword);

module.exports = router;
