// middleware/auth.js
const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
  try {
    // Get token from Authorization header: Bearer xxx.yyy.zzz
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - no token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Put user data into req.user
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email
      // add more fields if your JWT contains them
    };

    next(); // continue to controller

  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized - invalid token'
    });
  }
};

module.exports = { protect };