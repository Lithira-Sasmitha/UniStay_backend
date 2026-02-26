const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @desc    Protect middleware: Verifies the Access Token
 */
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header (Bearer <token>)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      // Attach user to req (excluding password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User no longer exists' });
      }

      return next();
    } catch (error) {
      console.error('Auth Error:', error.message);
      
      // Handle Specific JWT Errors
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
      }
      
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

/**
 * @desc    Authorize middleware: Checks user role
 * @param   {Array} roles - Allowed roles e.g. ['superadmin', 'student']
 */
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user?.role || 'Guest'}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
