// ============================================
// WHATSAPP SERVICE - WORKING VERSION
// Simple in-memory storage with MongoDB persistence
// ============================================

const { 
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const User = require('../models/User');
const WhatsAppAuth = require('../models/WhatsAppAuth');
const messageService = require('./messageService');

// Store active connections in memory
const activeConnections = new Map();

/**
 * Simple auth state that works with Baileys
 */
const useSimpleAuthState = async (userId) => {
  // Try to load from MongoDB
  let authDoc = await WhatsAppAuth.findOne({ userId });
  
  let state = {
    creds: authDoc?.authState?.creds || undefined,
    keys: authDoc?.authState?.keys || {},
  };
  
  const saveCreds = async (newCreds) => {
    state.creds = newCreds;
    await WhatsAppAuth.findOneAndUpdate(
      { userId },
      { 
        authState: state,
        lastConnected: new Date(),
      },
      { upsert: true }
    );
  };
  
  return { state, saveCreds };
};

/**
 * Initialize WhatsApp connection
 */
const initConnection = async (userId) => {
  try {
    console.log(`🔄 Initializing WhatsApp for user: ${userId}`);
    
    const { state, saveCreds } = await useSimpleAuthState(userId);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['WhatsApp Summarizer', 'Chrome', '10.0'],
      syncFullHistory: false,
    });
    
    let qrCode = null;
    let connected = false;
    
    activeConnections.set(userId, { sock, qrCode, connected });
    
    // Save credentials
    sock.ev.on('creds.update', saveCreds);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        try {
          qrCode = await QRCode.toDataURL(qr);
          const conn = activeConnections.get(userId);
          if (conn) conn.qrCode = qrCode;
          console.log(`📱 QR generated for ${userId}`);
        } catch (error) {
          console.error('QR error:', error);
        }
      }
      
      if (connection === 'open') {
        connected = true;
        const conn = activeConnections.get(userId);
        if (conn) {
          conn.connected = true;
          conn.qrCode = null;
        }
        
        await WhatsAppAuth.findOneAndUpdate(
          { userId },
          { connected: true, lastConnected: new Date() },
          { upsert: true }
        );
        
        await User.findByIdAndUpdate(userId, { whatsappConnected: true });
        
        console.log(`✅ WhatsApp connected: ${userId}`);
      }
      
      if (connection === 'close') {
        connected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`❌ Disconnected: ${userId}, reason: ${lastDisconnect?.error?.message}`);
        
        await User.findByIdAndUpdate(userId, { whatsappConnected: false });
        
        if (shouldReconnect) {
          console.log(`🔄 Reconnecting ${userId}...`);
          setTimeout(() => initConnection(userId), 5000);
        } else {
          await WhatsAppAuth.findOneAndDelete({ userId });
          activeConnections.delete(userId);
          console.log(`⛔ Logged out: ${userId}`);
        }
      }
    });
    
    // Store incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          try {
            const saved = await messageService.storeMessage(userId, msg);
            if (saved) {
              console.log(`💾 Message saved for ${userId}: ${saved.chatId}`);
            }
          } catch (error) {
            console.error('Message save error:', error);
          }
        }
      }
    });
    
    return { success: true, qrCode, connected };
    
  } catch (error) {
    console.error('❌ Connection error:', error);
    throw error;
  }
};

const getConnection = (userId) => {
  return activeConnections.get(userId) || null;
};

const disconnect = async (userId) => {
  try {
    const connection = activeConnections.get(userId);
    
    if (connection?.sock) {
      await connection.sock.logout();
    }
    
    activeConnections.delete(userId);
    await WhatsAppAuth.findOneAndDelete({ userId });
    await User.findByIdAndUpdate(userId, { whatsappConnected: false });
    
    console.log(`👋 Disconnected: ${userId}`);
    return true;
  } catch (error) {
    console.error('Disconnect error:', error);
    return false;
  }
};

const getQRCode = (userId) => {
  const connection = activeConnections.get(userId);
  return connection?.qrCode || null;
};

const isConnected = (userId) => {
  const connection = activeConnections.get(userId);
  return connection?.connected || false;
};

const getActiveConnectionsCount = () => {
  return activeConnections.size;
};

const restoreConnections = async () => {
  try {
    console.log('🔄 Restoring connections...');
    
    const activeSessions = await WhatsAppAuth.find({ connected: true });
    
    console.log(`Found ${activeSessions.length} active sessions`);
    
    for (const session of activeSessions) {
      try {
        await initConnection(session.userId.toString());
      } catch (error) {
        console.error(`Failed to restore ${session.userId}:`, error);
      }
    }
    
    console.log('✅ Restoration complete');
  } catch (error) {
    console.error('Restore error:', error);
  }
};

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
  getSocket,
};