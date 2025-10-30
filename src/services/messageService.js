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
      console.log(`⏭️  Skipped non-text message from ${chatId}`);
      return null;
    }
    
    const timestamp = msg.messageTimestamp;
    
    // Check if message already exists (prevent duplicates)
    const existingMessage = await Message.findOne({ messageId });
    if (existingMessage) {
      console.log(`⏭️  Message already exists: ${messageId}`);
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
    
    const saved = await newMessage.save();
    console.log(`✅ Message saved: ${chatId} - "${content.substring(0, 30)}..."`);
    
    return saved;
  } catch (error) {
    // Ignore duplicate key errors (messageId is unique)
    if (error.code !== 11000) {
      console.error('❌ Error storing message:', error);
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
 * Get all chats for a user with message counts and display names
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of {chatId, chatName, messageCount, lastMessage, preview}
 */
const getUserChats = async (userId) => {
  try {
    const chats = await Message.aggregate([
      // Match user's messages
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      
      // Sort by timestamp to get latest message
      { $sort: { timestamp: -1 } },
      
      // Group by chatId and get details
      {
        $group: {
          _id: '$chatId',
          chatName: { $first: '$chatName' }, // Get first non-null chat name
          messageCount: { $sum: 1 },
          lastMessage: { $max: '$timestamp' },
          lastMessageContent: { $first: '$content' }, // Preview of last message
        },
      },
      
      // Format output
      {
        $project: {
          chatId: '$_id',
          chatName: {
            $ifNull: [
              '$chatName',
              { $arrayElemAt: [{ $split: ['$_id', '@'] }, 0] } // Fallback to phone number
            ]
          },
          messageCount: 1,
          lastMessage: 1,
          preview: { $substr: ['$lastMessageContent', 0, 50] }, // First 50 chars
          _id: 0,
        },
      },
      
      // Sort by message count (most active first)
      { $sort: { messageCount: -1 } },
    ]);
    
    return chats;
  } catch (error) {
    console.error('Error getting user chats:', error);
    return [];
  }
};

/**
 * Search chats by name (works with display names)
 * @param {string} userId - User ID
 * @param {string} searchTerm - Search query
 * @returns {Promise<Array>} - Matching chats
 */
const searchChats = async (userId, searchTerm) => {
  try {
    const regex = new RegExp(searchTerm, 'i'); // Case-insensitive
    
    const chats = await Message.aggregate([
      {
        $match: {
          userId: new require('mongoose').Types.ObjectId(userId),
          $or: [
            { chatName: regex }, // Search by display name
            { chatId: regex },   // Search by phone number/ID
          ]
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$chatId',
          chatName: { $first: '$chatName' },
          messageCount: { $sum: 1 },
          lastMessage: { $max: '$timestamp' },
          lastMessageContent: { $first: '$content' },
        },
      },
      {
        $project: {
          chatId: '$_id',
          chatName: {
            $ifNull: [
              '$chatName',
              { $arrayElemAt: [{ $split: ['$_id', '@'] }, 0] }
            ]
          },
          messageCount: 1,
          lastMessage: 1,
          preview: { $substr: ['$lastMessageContent', 0, 50] },
          _id: 0,
        },
      },
      { $sort: { messageCount: -1 } },
      { $limit: 10 }, // Return top 10 matches
    ]);
    
    return chats;
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

/**
 * Get recent/most active chats (for dashboard)
 * @param {string} userId - User ID
 * @param {number} limit - Number of chats to return (default: 10)
 * @returns {Promise<Array>} - Top chats
 */
const getRecentChats = async (userId, limit = 10) => {
  try {
    const chats = await getUserChats(userId);
    return chats.slice(0, limit); // Return top N chats
  } catch (error) {
    console.error('Error getting recent chats:', error);
    return [];
  }
};

module.exports = {
  storeMessage,
  getChatMessages,
  getUserChats,
  getRecentChats, // NEW
  searchChats,
  getUserStats,
  deleteUserMessages,
};