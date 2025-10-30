// ============================================
// WHATSAPP SERVICE - FIXED VERSION
// ============================================

const { 
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const User = require('../models/User');
const WhatsAppAuth = require('../models/WhatsAppAuth');
const messageService = require('./messageService');

const activeConnections = new Map();

/**
 * Create auth state for connections
 * FIXED: Properly handles undefined creds for fresh connections
 */
const createAuthState = async (userId) => {
  let authDoc = await WhatsAppAuth.findOne({ userId });
  
  // If no auth or corrupted, create fresh
  if (!authDoc || !authDoc.authState?.creds?.noiseKey?.public) {
    console.log(`🆕 Creating fresh auth for ${userId}`);
    await WhatsAppAuth.findOneAndDelete({ userId });
    
    // CRITICAL FIX: Return undefined creds for fresh connections
    // This allows Baileys to generate new credentials
    const saveState = async (newState) => {
      await WhatsAppAuth.findOneAndUpdate(
        { userId },
        { 
          authState: newState,
          lastConnected: new Date(),
        },
        { upsert: true }
      );
    };
    
    return {
      state: {
        creds: undefined, // Let Baileys generate fresh creds
        keys: makeCacheableSignalKeyStore({}, pino({ level: 'silent' })),
      },
      saveCreds: async (creds) => {
        const currentState = { creds, keys: {} };
        await saveState(currentState);
      },
    };
  }
  
  // Existing auth found
  const state = authDoc.authState;
  
  const saveState = async (newState) => {
    await WhatsAppAuth.findOneAndUpdate(
      { userId },
      { 
        authState: newState,
        lastConnected: new Date(),
      },
      { upsert: true }
    );
  };
  
  return {
    state: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys || {}, pino({ level: 'silent' })),
    },
    saveCreds: async (creds) => {
      state.creds = creds;
      await saveState(state);
    },
  };
};

/**
 * Initialize WhatsApp connection
 */
const initConnection = async (userId) => {
  try {
    console.log(`🔄 Initializing WhatsApp for user: ${userId}`);
    
    const { state, saveCreds } = await createAuthState(userId);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['WhatsApp Summarizer', 'Chrome', '10.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      // ADDED: Prevents undefined errors
      getMessage: async (key) => {
        return { conversation: '' };
      },
    });
    
    let qrCode = null;
    let connected = false;
    
    activeConnections.set(userId, { sock, qrCode, connected });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        try {
          qrCode = await QRCode.toDataURL(qr);
          const conn = activeConnections.get(userId);
          if (conn) conn.qrCode = qrCode;
          console.log(`📱 QR generated for ${userId}`);
        } catch (error) {
          console.error('❌ QR error:', error);
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
        
        console.log(`❌ Disconnected: ${userId}`);
        console.log(`Error: ${lastDisconnect?.error?.message || 'Unknown'}`);
        console.log(`Status: ${statusCode}`);
        
        await User.findByIdAndUpdate(userId, { whatsappConnected: false });
        
        if (shouldReconnect && statusCode !== 401) {
          console.log(`🔄 Reconnecting ${userId} in 5s...`);
          setTimeout(() => initConnection(userId), 5000);
        } else {
          // Delete corrupted auth
          await WhatsAppAuth.findOneAndDelete({ userId });
          activeConnections.delete(userId);
          console.log(`⛔ Logged out / Auth cleared: ${userId}`);
        }
      }
    });
    
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          try {
            const saved = await messageService.storeMessage(userId, msg);
            if (saved) {
              console.log(`💾 Saved: ${saved.chatId.substring(0, 15)}...`);
            }
          } catch (error) {
            console.error('❌ Save error:', error.message);
          }
        }
      }
    });
    
    return { success: true, qrCode, connected };
    
  } catch (error) {
    console.error(`❌ Connection error for ${userId}:`, error.message);
    console.error(error.stack);
    
    // Clean up corrupted auth
    await WhatsAppAuth.findOneAndDelete({ userId });
    activeConnections.delete(userId);
    
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
      try {
        await connection.sock.logout();
      } catch (e) {
        console.log('Logout error (expected):', e.message);
      }
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
    
    // Don't auto-restore on startup (causes issues)
    // Users need to reconnect manually
    
    console.log('✅ Restoration skipped (manual reconnect required)');
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