// ============================================
// WHATSAPP CONTROLLER
// Handle WhatsApp connection requests
// ============================================

const whatsappService = require('../services/whatsappService');
const messageService = require('../services/messageService');

/**
 * CONNECT - Initialize WhatsApp connection
 * POST /api/whatsapp/connect
 * Requires authentication
 */
const connect = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Check if already connected
    if (whatsappService.isConnected(userId)) {
      return res.status(200).json({
        success: true,
        message: 'Already connected to WhatsApp',
        connected: true,
      });
    }
    
    // Check if connection exists but not yet connected (QR pending)
    const existingConnection = whatsappService.getConnection(userId);
    if (existingConnection) {
      return res.status(200).json({
        success: true,
        message: 'Connection pending. Please scan QR code.',
        connected: false,
        qrCode: existingConnection.qrCode,
      });
    }
    
    // Initialize new connection
    const result = await whatsappService.initConnection(userId);
    
    res.status(200).json({
      success: true,
      message: 'WhatsApp connection initialized. Scan QR code to continue.',
      connected: result.connected,
      qrCode: result.qrCode,
    });
    
  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error connecting to WhatsApp',
    });
  }
};

/**
 * GET QR CODE - Get current QR code for scanning
 * GET /api/whatsapp/qr
 * Requires authentication
 */
const getQR = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Check if connected
    if (whatsappService.isConnected(userId)) {
      return res.status(200).json({
        success: true,
        connected: true,
        message: 'Already connected',
      });
    }
    
    // Get QR code
    const qrCode = whatsappService.getQRCode(userId);
    
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'No QR code available. Please connect first.',
      });
    }
    
    res.status(200).json({
      success: true,
      connected: false,
      qrCode,
    });
    
  } catch (error) {
    console.error('Get QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting QR code',
    });
  }
};

/**
 * CONNECTION STATUS - Check WhatsApp connection status
 * GET /api/whatsapp/status
 * Requires authentication
 */
const getStatus = async (req, res) => {
  try {
    const userId = req.userId;
    
    const connected = whatsappService.isConnected(userId);
    const stats = await messageService.getUserStats(userId);
    
    res.status(200).json({
      success: true,
      connected,
      stats: {
        totalChats: stats.totalChats,
        totalMessages: stats.totalMessages,
      },
    });
    
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting status',
    });
  }
};

/**
 * DISCONNECT - Disconnect from WhatsApp
 * POST /api/whatsapp/disconnect
 * Requires authentication
 */
const disconnect = async (req, res) => {
  try {
    const userId = req.userId;
    
    const success = await whatsappService.disconnect(userId);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Disconnected from WhatsApp successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Not connected to WhatsApp',
      });
    }
    
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error disconnecting from WhatsApp',
    });
  }
};

module.exports = {
  connect,
  getQR,
  getStatus,
  disconnect,
};