// ============================================
// WHATSAPP ROUTES
// Defines WhatsApp connection API endpoints
// ============================================

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  connect,
  getQR,
  getStatus,
  disconnect,
} = require('../controllers/whatsappController');

/**
 * @route   POST /api/whatsapp/connect
 * @desc    Initialize WhatsApp connection and get QR code
 * @access  Private (requires token)
 */
router.post('/connect', auth, connect);

/**
 * @route   GET /api/whatsapp/qr
 * @desc    Get current QR code for scanning
 * @access  Private (requires token)
 */
router.get('/qr', auth, getQR);

/**
 * @route   GET /api/whatsapp/status
 * @desc    Get connection status and message stats
 * @access  Private (requires token)
 */
router.get('/status', auth, getStatus);

/**
 * @route   POST /api/whatsapp/disconnect
 * @desc    Disconnect from WhatsApp
 * @access  Private (requires token)
 */
router.post('/disconnect', auth, disconnect);

module.exports = router;