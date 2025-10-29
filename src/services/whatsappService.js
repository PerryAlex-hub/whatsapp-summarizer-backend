// ============================================
// WHATSAPP CONNECTION SERVICE
// Manages WhatsApp connections for all users
// ============================================

const { 
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const messageService = require('./messageService');

/**
 * Store active WhatsApp connections
 * Map of userId -> { sock, qrCode, connected }
 */
const activeConnections = new Map();

/**
 * Create auth directory for a user
 * @param {string} userId - User ID
 * @returns {string} - Path to auth directory
 */
const getAuthPath = (userId) => {
  const authPath = path.join(process.cwd(), 'auth', userId);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }
  
  return authPath;
};

/**
 * Initialize WhatsApp connection for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Connection info
 */
const initConnection = async (userId) => {
  try {
    console.log(`🔄 Initializing WhatsApp connection for user: ${userId}`);
    
    // Get auth directory path
    const authPath = getAuthPath(userId);
    
    // Load or create auth state
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    
    // Get latest WhatsApp version
    const { version } = await fetchLatestBaileysVersion();
    
    // Create WhatsApp socket
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }), // Quiet logging
      printQRInTerminal: false,
      
      // Connection options
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      
      // Browser info
      browser: ['WhatsApp Summarizer', 'Chrome', '10.0'],
      
      // Sync options
      syncFullHistory: false,
      
      // Message handler
      getMessage: async (key) => {
        return { conversation: '' };
      },
    });
    
    // Connection state
    let qrCode = null;
    let connected = false;
    
    // Store connection info
    activeConnections.set(userId, { 
      sock, 
      qrCode, 
      connected,
      authPath 
    });
    
    // ============ EVENT LISTENERS ============
    
    /**
     * Save credentials when they update
     */
    sock.ev.on('creds.update', saveCreds);
    
    /**
     * Handle connection status updates
     */
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // QR CODE GENERATED
      if (qr) {
        try {
          // Generate QR code as data URL (base64 image)
          qrCode = await QRCode.toDataURL(qr);
          
          // Update stored connection
          const conn = activeConnections.get(userId);
          if (conn) {
            conn.qrCode = qrCode;
          }
          
          console.log(`📱 QR code generated for user: ${userId}`);
        } catch (error) {
          console.error('QR code generation error:', error);
        }
      }
      
      // CONNECTION OPENED
      if (connection === 'open') {
        connected = true;
        
        // Update stored connection
        const conn = activeConnections.get(userId);
        if (conn) {
          conn.connected = true;
          conn.qrCode = null; // Clear QR after successful connection
        }
        
        // Update user's WhatsApp status in database
        await User.findByIdAndUpdate(userId, {
          whatsappConnected: true,
        });
        
        console.log(`✅ WhatsApp connected for user: ${userId}`);
      }
      
      // CONNECTION CLOSED
      if (connection === 'close') {
        connected = false;
        
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`❌ WhatsApp disconnected for user: ${userId}`);
        console.log(`Reason: ${lastDisconnect?.error?.message || 'Unknown'}`);
        console.log(`Should reconnect: ${shouldReconnect}`);
        
        // Update database
        await User.findByIdAndUpdate(userId, {
          whatsappConnected: false,
        });
        
        if (shouldReconnect) {
          // Reconnect after 5 seconds
          console.log(`🔄 Will reconnect user ${userId} in 5 seconds...`);
          setTimeout(() => initConnection(userId), 5000);
        } else {
          // Logged out - remove from active connections
          activeConnections.delete(userId);
          console.log(`⛔ User ${userId} logged out from WhatsApp`);
        }
      }
    });
    
    /**
     * Handle incoming messages
     */
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        // Process each new message
        for (const msg of messages) {
          try {
            // Store message in database
            await messageService.storeMessage(userId, msg);
          } catch (error) {
            console.error('Error storing message:', error);
          }
        }
      }
    });
    
    return {
      success: true,
      qrCode,
      connected,
    };
    
  } catch (error) {
    console.error('WhatsApp connection error:', error);
    throw error;
  }
};

/**
 * Get connection info for a user
 * @param {string} userId - User ID
 * @returns {Object|null} - Connection info or null
 */
const getConnection = (userId) => {
  return activeConnections.get(userId) || null;
};

/**
 * Disconnect WhatsApp for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
const disconnect = async (userId) => {
  try {
    const connection = activeConnections.get(userId);
    
    if (!connection) {
      return false;
    }
    
    // Close socket
    if (connection.sock) {
      await connection.sock.logout();
    }
    
    // Remove from active connections
    activeConnections.delete(userId);
    
    // Update database
    await User.findByIdAndUpdate(userId, {
      whatsappConnected: false,
    });
    
    // Delete auth files
    if (connection.authPath && fs.existsSync(connection.authPath)) {
      fs.rmSync(connection.authPath, { recursive: true, force: true });
    }
    
    console.log(`👋 User ${userId} disconnected from WhatsApp`);
    
    return true;
  } catch (error) {
    console.error('Disconnect error:', error);
    return false;
  }
};

/**
 * Get QR code for a user
 * @param {string} userId - User ID
 * @returns {string|null} - QR code data URL or null
 */
const getQRCode = (userId) => {
  const connection = activeConnections.get(userId);
  return connection?.qrCode || null;
};

/**
 * Check if user is connected
 * @param {string} userId - User ID
 * @returns {boolean} - Connected status
 */
const isConnected = (userId) => {
  const connection = activeConnections.get(userId);
  return connection?.connected || false;
};

/**
 * Get all active connections count
 * @returns {number} - Number of active connections
 */
const getActiveConnectionsCount = () => {
  return activeConnections.size;
};

/**
 * Restore connections on server restart
 * (Re-connect all users who were previously connected)
 * @returns {Promise<void>}
 */
const restoreConnections = async () => {
  try {
    console.log('🔄 Restoring WhatsApp connections...');
    
    // Find all users who were connected
    const connectedUsers = await User.find({ whatsappConnected: true });
    
    console.log(`Found ${connectedUsers.length} users to reconnect`);
    
    // Reconnect each user
    for (const user of connectedUsers) {
      try {
        await initConnection(user._id.toString());
      } catch (error) {
        console.error(`Failed to restore connection for user ${user.username}:`, error);
      }
    }
    
    console.log('✅ Connection restoration complete');
  } catch (error) {
    console.error('Error restoring connections:', error);
  }
};

/**
 * Get socket for a user (for advanced operations)
 * @param {string} userId - User ID
 * @returns {Object|null} - WhatsApp socket or null
 */
const getSocket = (userId) => {
  const connection = activeConnections.get(userId);
  return connection?.sock || null;
};

module.exports = {
  initConnection,
  getConnection,
  disconnect,
  getQRCode,
  isConnected,
  getActiveConnectionsCount,
  restoreConnections,
  getSocket, // NEW
};