// ============================================
// MESSAGE SERVICE
// Handle message storage and retrieval
// ============================================

const Message = require('../models/Message');

/**
 * Extract chat display name from message
 * @param {Object} msg - Baileys message object
 * @returns {string|null} - Display name or null
 */
const extractChatName = (msg) => {
  try {
    // For groups: extract group subject/name
    if (msg.key.remoteJid.endsWith('@g.us')) {
      // Group chat - try to get group name from message metadata
      return msg.pushName || null;
    }
    
    // For personal chats: use push name (contact name in sender's phone)
    return msg.pushName || null;
  } catch (error) {
    return null;
  }
};

/**
 * Store a WhatsApp message in database
 * @param {string} userId - User ID
 * @param {Object} msg - Baileys message object
 * @returns {Promise<Object|null>} - Saved message or null
 */
const storeMessage = async (userId, msg) => {
  try {
    // Extract message data
    const chatId = msg.key.remoteJid;
    const messageId = msg.key.id;
    const sender = msg.key.participant?.split('@')[0] || chatId.split('@')[0];
    
    // Extract chat display name
    const chatName = extractChatName(msg);
    
    // Extract text content
    const content = 
      msg.message?.conversation || 
      msg.message?.extendedTextMessage?.text ||
      null;
    
    // Only store text messages
    if (!content) {
      return null;
    }
    
    const timestamp = msg.messageTimestamp;
    
    // Check if message already exists (prevent duplicates)
    const existingMessage = await Message.findOne({ messageId });
    if (existingMessage) {
      return null;
    }
    
    // Create new message with chat name
    const newMessage = new Message({
      userId,
      chatId,
      chatName, // NEW: Store display name
      messageId,
      sender,
      content,
      timestamp,
      // expiresAt will be auto-set by Message model (24 hours from now)
    });
    
    await newMessage.save();
    
    return newMessage;
  } catch (error) {
    // Ignore duplicate key errors (messageId is unique)
    if (error.code !== 11000) {
      console.error('Error storing message:', error);
    }
    return null;
  }
};

/**
 * Get messages for a specific chat
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 * @param {number} limit - Max messages to return
 * @returns {Promise<Array>} - Array of messages
 */
const getChatMessages = async (userId, chatId, limit = 100) => {
  try {
    return await Message.getChatMessages(userId, chatId, limit);
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
};

/**
 * Get all chats for a user with message counts
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of {chatId, messageCount, lastMessage}
 */
const getUserChats = async (userId) => {
  try {
    return await Message.getUserChats(userId);
  } catch (error) {
    console.error('Error getting user chats:', error);
    return [];
  }
};

/**
 * Search chats by name
 * @param {string} userId - User ID
 * @param {string} searchTerm - Search query
 * @returns {Promise<Array>} - Matching chats
 */
const searchChats = async (userId, searchTerm) => {
  try {
    return await Message.searchChats(userId, searchTerm);
  } catch (error) {
    console.error('Error searching chats:', error);
    return [];
  }
};

/**
 * Get user statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Stats object
 */
const getUserStats = async (userId) => {
  try {
    const chats = await getUserChats(userId);
    const totalMessages = await Message.getUserMessageCount(userId);
    
    return {
      totalChats: chats.length,
      totalMessages,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      totalChats: 0,
      totalMessages: 0,
    };
  }
};

/**
 * Delete all messages for a user
 * (Useful for testing or user account deletion)
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of deleted messages
 */
const deleteUserMessages = async (userId) => {
  try {
    const result = await Message.deleteMany({ userId });
    return result.deletedCount;
  } catch (error) {
    console.error('Error deleting user messages:', error);
    return 0;
  }
};

module.exports = {
  storeMessage,
  getChatMessages,
  getUserChats,
  searchChats,
  getUserStats,
  deleteUserMessages,
};