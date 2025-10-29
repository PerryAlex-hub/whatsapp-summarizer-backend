// ============================================
// AUTH ROUTES
// Defines authentication API endpoints
// ============================================

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  signup,
  login,
  getCurrentUser,
  updatePhoneNumber,
  logout,
} = require('../controllers/authController');

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 * @body    { username, password, phoneNumber? }
 */
router.post('/signup', signup);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get token
 * @access  Public
 * @body    { username, password }
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private (requires token)
 */
router.get('/me', auth, getCurrentUser);

/**
 * @route   PUT /api/auth/phone
 * @desc    Update user's phone number
 * @access  Private (requires token)
 * @body    { phoneNumber }
 */
router.put('/phone', auth, updatePhoneNumber);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (mainly client-side with JWT)
 * @access  Private (requires token)
 */
router.post('/logout', auth, logout);

module.exports = router;