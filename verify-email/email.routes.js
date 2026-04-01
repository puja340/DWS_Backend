const express = require('express');
const router = express.Router();

const emailController = require('./email.controller');
const { protect } = require('../middleware/auth');

// Send OTP for email change
router.post('/send-otp', protect, emailController.sendEmailChangeOTP);

// Verify OTP and update email
router.post('/verify-otp', protect, emailController.verifyEmailOTP);

module.exports = router;