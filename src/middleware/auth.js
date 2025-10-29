// ============================================
// AUTHENTICATION MIDDLEWARE
// Verifies JWT tokens and protects routes
// ============================================

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');

/**
 * Protect routes - verify JWT token
 * Adds user object to req.user if token is valid
 * 
 * Usage in routes:
 *   router.get('/protected', auth, controller)
 */
const auth = async (req, res, next) => {
  try {
    // 1. Get token from Authorization header
    // Expected format: "Bearer <token>"
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login.',
      });
    }
    
    // Extract token (remove "Bearer " prefix)
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.',
      });
    }
    
    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
      });
    }
    
    // 3. Find user from token payload
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.',
      });
    }
    
    // 4. Attach user to request object
    // Controllers can now access req.user
    req.user = user;
    req.userId = user._id.toString();
    
    // 5. Continue to next middleware/controller
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

/**
 * Optional auth - doesn't fail if no token
 * Useful for routes that work differently for logged in/out users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, but that's okay - continue without user
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }
    
    // Try to verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user) {
        req.user = user;
        req.userId = user._id.toString();
      }
    } catch (error) {
      // Token invalid, but we don't fail - just continue
      console.log('Optional auth: Invalid token, continuing without user');
    }
    
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue even on error
  }
};

/**
 * Generate JWT token for a user
 * @param {string} userId - User's MongoDB _id
 * @returns {string} - JWT token
 */
const generateToken = (userId) => {
  const payload = {
    userId: userId,
  };
  
  const options = {
    expiresIn: '7d', // Token valid for 7 days
  };
  
  return jwt.sign(payload, JWT_SECRET, options);
};

module.exports = {
  auth,
  optionalAuth,
  generateToken,
};