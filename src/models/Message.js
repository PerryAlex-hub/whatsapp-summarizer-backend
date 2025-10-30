// ============================================
// MESSAGE MODEL
// Stores WhatsApp messages with 24-hour TTL
// ============================================

const mongoose = require('mongoose');
const { MESSAGE_TTL_HOURS } = require('../config/env');

/**
 * Message Schema
 * Stores WhatsApp messages temporarily (auto-deletes after 24h)
 */
const messageSchema = new mongoose.Schema(
  {
    // User who owns this message
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Fast lookups by user
    },
    
    // Chat identifier (e.g., "1234567890@s.whatsapp.net")
    chatId: {
      type: String,
      required: true,
      index: true, // Fast lookups by chat
    },
    
    // Chat display name (extracted from WhatsApp)
    chatName: {
      type: String,
      default: null,
    },
    
    // WhatsApp message ID (unique per message)
    messageId: {
      type: String,
      required: true,
      unique: true, // Prevent duplicate messages
    },
    
    // Sender's phone number or participant ID
    sender: {
      type: String,
      required: true,
    },
    
    // Message content (text only)
    content: {
      type: String,
      required: true,
      maxlength: 10000, // Limit message length
    },
    
    // Unix timestamp from WhatsApp
    timestamp: {
      type: Number,
      required: true,
      index: true, // For sorting by time
    },
    
    // Expiration date (auto-delete after this time)
    expiresAt: {
      type: Date,
      required: true,
      // TTL index will be created separately
    },
  },
  {
    timestamps: true, // Add createdAt and updatedAt
  }
);

// ============ COMPOUND INDEXES ============
// Fast queries for "get messages for user X in chat Y"
messageSchema.index({ userId: 1, chatId: 1, timestamp: -1 });

// ============ TTL INDEX (AUTO-DELETE) ============
/**
 * MongoDB will automatically delete documents where expiresAt has passed
 * Runs every 60 seconds in background
 * This is how we keep only 24 hours of messages!
 */
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============ PRE-SAVE MIDDLEWARE ============
/**
 * Automatically set expiresAt to 24 hours from now
 */
messageSchema.pre('save', function (next) {
  if (!this.expiresAt) {
    // Set expiration to MESSAGE_TTL_HOURS (24) from now
    const now = new Date();
    this.expiresAt = new Date(now.getTime() + MESSAGE_TTL_HOURS * 60 * 60 * 1000);
  }
  next();
});

// ============ STATIC METHODS ============
/**
 * Get all messages for a specific chat
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 * @param {number} limit - Max messages to return
 * @returns {Promise<Array>} - Array of messages
 */
messageSchema.statics.getChatMessages = function (userId, chatId, limit = 100) {
  return this.find({ userId, chatId })
    .sort({ timestamp: 1 }) // Oldest first
    .limit(limit)
    .lean(); // Return plain objects (faster)
};

/**
 * Get list of all chats for a user with message counts
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of {chatId, messageCount, lastMessage}
 */
messageSchema.statics.getUserChats = async function (userId) {
  return this.aggregate([
    // Match user's messages
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    
    // Group by chatId and count
    {
      $group: {
        _id: '$chatId',
        messageCount: { $sum: 1 },
        lastMessage: { $max: '$timestamp' },
      },
    },
    
    // Rename _id to chatId
    {
      $project: {
        chatId: '$_id',
        messageCount: 1,
        lastMessage: 1,
        _id: 0,
      },
    },
    
    // Sort by message count (most active chats first)
    { $sort: { messageCount: -1 } },
  ]);
};

/**
 * Search for chats by name pattern
 * @param {string} userId - User ID
 * @param {string} searchTerm - Search query
 * @returns {Promise<Array>} - Matching chats
 */
messageSchema.statics.searchChats = function (userId, searchTerm) {
  // Case-insensitive regex search
  const regex = new RegExp(searchTerm, 'i');
  
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        chatId: regex,
      },
    },
    {
      $group: {
        _id: '$chatId',
        messageCount: { $sum: 1 },
        lastMessage: { $max: '$timestamp' },
      },
    },
    {
      $project: {
        chatId: '$_id',
        messageCount: 1,
        lastMessage: 1,
        _id: 0,
      },
    },
    { $sort: { messageCount: -1 } },
    { $limit: 10 }, // Return top 10 matches
  ]);
};

/**
 * Get total message count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Total messages
 */
messageSchema.statics.getUserMessageCount = function (userId) {
  return this.countDocuments({ userId });
};

// Create and export the model
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;