// ============================================
// WHATSAPP CONNECTION SERVICE (MONGODB AUTH)
// Stores auth in MongoDB instead of files
// ============================================

const { 
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  BufferJSON,
  initAuthCreds,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const User = require('../models/User');
const WhatsAppAuth = require('../models/WhatsAppAuth');
const messageService = require('./messageService');

// Store active connections in memory
const activeConnections = new Map();

/**
 * MongoDB-based auth state handler
 */
const useMongoDBAuthState = async (userId) => {
  // Load auth from MongoDB
  let authDoc = await WhatsAppAuth.findOne({ userId });
  
  if (!authDoc) {
    // Create new auth document with initial credentials
    const creds = initAuthCreds();
    authDoc = await WhatsAppAuth.create({
      userId,
      authState: { creds },
    });
  }
  
  const state = authDoc.authState || { creds: initAuthCreds() };
  
  const saveState = async () => {
    await WhatsAppAuth.findOneAndUpdate(
      { userId },
      { 
        authState: state,
        lastConnected: new Date(),
      },
      { upsert: true }
    );
  };
  
  return {
    state: {
      creds: state.creds || initAuthCreds(),
      keys: state.keys || {},
    },
    saveCreds: async () => {
      state.creds = arguments[0] || state.creds;
      await saveState();
    },
    saveKeys: async () => {
      state.keys = arguments[0] || state.keys;
      await saveState();
    },
  };
};

/**
 * Initialize WhatsApp connection for a user
 */
const initConnection = async (userId) => {
  try {
    console.log(`🔄 Initializing WhatsApp connection for user: ${userId}`);
    
    // Use MongoDB auth state
    const { state, saveCreds } = await useMongoDBAuthState(userId);
    
    // Get latest WhatsApp version
    const { version } = await fetchLatestBaileysVersion();
    
    // Create WhatsApp socket
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      browser: ['WhatsApp Summarizer', 'Chrome', '10.0'],
      syncFullHistory: false,
      getMessage: async (key) => {
        return { conversation: '' };
      },
    });
    
    let qrCode = null;
    let connected = false;
    
    // Store connection info
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
          console.log(`📱 QR code generated for user: ${userId}`);
        } catch (error) {
          console.error('QR code generation error:', error);
        }
      }
      
      if (connection === 'open') {
        connected = true;
        const conn = activeConnections.get(userId);
        if (conn) {
          conn.connected = true;
          conn.qrCode = null;
        }
        
        // Update MongoDB
        await WhatsAppAuth.findOneAndUpdate(
          { userId },
          { connected: true, lastConnected: new Date() }
        );
        
        await User.findByIdAndUpdate(userId, { whatsappConnected: true });
        
        console.log(`✅ WhatsApp connected for user: ${userId}`);
      }
      
      if (connection === 'close') {
        connected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`❌ WhatsApp disconnected for user: ${userId}`);
        console.log(`Reason: ${lastDisconnect?.error?.message || 'Unknown'}`);
        
        // Update MongoDB
        await WhatsAppAuth.findOneAndUpdate(
          { userId },
          { connected: false }
        );
        
        await User.findByIdAndUpdate(userId, { whatsappConnected: false });
        
        if (shouldReconnect) {
          console.log(`🔄 Will reconnect user ${userId} in 5 seconds...`);
          setTimeout(() => initConnection(userId), 5000);
        } else {
          // Logged out - delete auth
          await WhatsAppAuth.findOneAndDelete({ userId });
          activeConnections.delete(userId);
          console.log(`⛔ User ${userId} logged out from WhatsApp`);
        }
      }
    });
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          try {
            await messageService.storeMessage(userId, msg);
            console.log(`💾 Message stored for user ${userId}`);
          } catch (error) {
            console.error('Error storing message:', error);
          }
        }
      }
    });
    
    return { success: true, qrCode, connected };
    
  } catch (error) {
    console.error('❌ WhatsApp connection error:', error);
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
    
    console.log(`👋 User ${userId} disconnected from WhatsApp`);
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
    console.log('🔄 Restoring WhatsApp connections from MongoDB...');
    
    // Find all users with active auth sessions
    const activeSessions = await WhatsAppAuth.find({ connected: true });
    
    console.log(`Found ${activeSessions.length} sessions to restore`);
    
    for (const session of activeSessions) {
      try {
        await initConnection(session.userId.toString());
      } catch (error) {
        console.error(`Failed to restore session for ${session.userId}:`, error);
      }
    }
    
    console.log('✅ Connection restoration complete');
  } catch (error) {
    console.error('Error restoring connections:', error);
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