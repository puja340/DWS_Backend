const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const LoginModel = require('./login.model');
const User = require('../models/User'); 

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await LoginModel.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Login failed' });
  }
};

exports.getUserInfo = async (req, res) => {
  try {
    const userFromToken = req.user;

    if (!userFromToken || !userFromToken.id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Fetch full user from DB using ID
    const user = await User.findByPk(userFromToken.id, {
      attributes: ['id', 'username', 'email']  // only what we need
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const firstLetter = user.username && user.username.trim().length > 0
      ? user.username.trim()[0].toUpperCase()
      : "?";

    return res.json({
      success: true,
      data: {
        username: user.username,
        email: user.email,
        firstLetter
      }
    });

  } catch (err) {
    console.error("Error in getUserInfo:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


exports.logout = async (req, res) => {
    try {
        // Optional: You can log the logout event here if you want
        console.log(`User ${req.user?.id || 'unknown'} logged out`);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (err) {
        console.error("Logout error:", err);
        return res.status(500).json({
            success: false,
            message: "Logout failed"
        });
    }
};



