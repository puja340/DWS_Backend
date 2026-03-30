const express = require('express');
const router = express.Router();
const loginController = require('./login.controller');
const { protect } = require('../middleware/auth');

// Login route
router.post('/login', loginController.login);

router.get('/info', protect, loginController.getUserInfo);

router.post('/logout', protect, loginController.logout);   

module.exports = router;
