// ============================================
// QUERY CONTROLLER
// Handle message queries and AI summarization
// ============================================

const messageService = require("../services/messageService");
const aiService = require("../services/aiService");
const whatsappService = require("../services/whatsappService");

/**
 * GET RECENT CHATS - Get top 10 most active chats (for dashboard)
 * GET /api/query/chats/recent
 * Requires authentication
 */
const getRecentChats = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10; // Default 10, can be changed via query param

    // Check if connected
    if (!whatsappService.isConnected(userId)) {
      return res.status(400).json({
        success: false,
        message: "Please connect to WhatsApp first",
      });
    }

    // Get user's chats (already sorted by activity)
    const chats = await messageService.getUserChats(userId);

    // Format and return top N most active chats
    const results = chats.slice(0, limit).map((c) => ({
      chatId: c.chatId,
      chatName: c.chatId.split("@")[0],
      messageCount: c.messageCount,
      lastMessage: c.lastMessage
        ? new Date(c.lastMessage * 1000).toLocaleString()
        : null,
    }));

    res.status(200).json({
      success: true,
      chats: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Get recent chats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent chats",
    });
  }
};

/**
 * QUERY CHAT - Search and summarize chat by name
 * POST /api/query
 * Body: { query }
 * Requires authentication
 */
const queryChat = async (req, res) => {
  try {
    const userId = req.userId;
    const {query} = req.body;

    // Validate input
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }

    // Check if user is connected to WhatsApp
    if (!whatsappService.isConnected(userId)) {
      return res.status(400).json({
        success: false,
        message: "Please connect to WhatsApp first",
      });
    }

    // Search for matching chats
    const matchingChats = await messageService.searchChats(userId, query);

    if (matchingChats.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No chat found matching "${query}". Try the exact chat name from your WhatsApp.`,
      });
    }

    // Get top match
    const topMatch = matchingChats[0];
    const chatId = topMatch.chatId;
    const chatName = chatId.split("@")[0];

    // Get messages from this chat
    const messages = await messageService.getChatMessages(userId, chatId, 500);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Chat "${chatName}" found but no messages available.`,
      });
    }

    // Generate AI summary
    const summary = await aiService.summarizeMessages(messages);

    // Get time range
    const timestamps = messages.map((m) => m.timestamp * 1000);
    const oldestDate = new Date(Math.min(...timestamps)).toLocaleDateString();
    const newestDate = new Date(Math.max(...timestamps)).toLocaleDateString();

    // Return results
    res.status(200).json({
      success: true,
      found: true,
      chat: {
        chatId,
        chatName,
        messageCount: messages.length,
        timeRange: {
          from: oldestDate,
          to: newestDate,
        },
      },
      summary,
      otherMatches: matchingChats.slice(1, 4).map((c) => ({
        chatId: c.chatId,
        chatName: c.chatId.split("@")[0],
        messageCount: c.messageCount,
      })),
    });
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing query",
    });
  }
};

/**
 * GET ALL CHATS - List all user's chats
 * GET /api/query/chats
 * Requires authentication
 */
const getAllChats = async (req, res) => {
  try {
    const userId = req.userId;

    // Check if connected
    if (!whatsappService.isConnected(userId)) {
      return res.status(400).json({
        success: false,
        message: "Please connect to WhatsApp first",
      });
    }

    // Get all chats
    const chats = await messageService.getUserChats(userId);

    // Format response
    const formattedChats = chats.map((chat) => ({
      chatId: chat.chatId,
      chatName: chat.chatId.split("@")[0],
      messageCount: chat.messageCount,
      lastMessage: chat.lastMessage
        ? new Date(chat.lastMessage * 1000).toLocaleString()
        : null,
    }));

    res.status(200).json({
      success: true,
      chats: formattedChats,
      total: formattedChats.length,
    });
  } catch (error) {
    console.error("Get all chats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching chats",
    });
  }
};

/**
 * GET SPECIFIC CHAT - Get messages from a specific chat
 * GET /api/query/chats/:chatId
 * Requires authentication
 */
const getChat = async (req, res) => {
  try {
    const userId = req.userId;
    const {chatId} = req.params;

    // Check if connected
    if (!whatsappService.isConnected(userId)) {
      return res.status(400).json({
        success: false,
        message: "Please connect to WhatsApp first",
      });
    }

    // Get messages
    const messages = await messageService.getChatMessages(userId, chatId, 500);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No messages found in this chat",
      });
    }

    // Format messages
    const formattedMessages = messages.map((msg) => ({
      messageId: msg.messageId,
      sender: msg.sender,
      content: msg.content,
      timestamp: new Date(msg.timestamp * 1000).toLocaleString(),
    }));

    res.status(200).json({
      success: true,
      chatId,
      chatName: chatId.split("@")[0],
      messageCount: messages.length,
      messages: formattedMessages,
    });
  } catch (error) {
    console.error("Get chat error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching chat messages",
    });
  }
};

/**
 * SUMMARIZE SPECIFIC CHAT - Get AI summary of a specific chat
 * POST /api/query/summarize/:chatId
 * Requires authentication
 */
const summarizeChat = async (req, res) => {
  try {
    const userId = req.userId;
    const {chatId} = req.params;

    // Check if connected
    if (!whatsappService.isConnected(userId)) {
      return res.status(400).json({
        success: false,
        message: "Please connect to WhatsApp first",
      });
    }

    // Get messages
    const messages = await messageService.getChatMessages(userId, chatId, 500);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No messages found in this chat",
      });
    }

    // Generate summary
    const summary = await aiService.summarizeMessages(messages);

    // Get time range
    const timestamps = messages.map((m) => m.timestamp * 1000);
    const oldestDate = new Date(Math.min(...timestamps)).toLocaleDateString();
    const newestDate = new Date(Math.max(...timestamps)).toLocaleDateString();

    res.status(200).json({
      success: true,
      chatId,
      chatName: chatId.split("@")[0],
      messageCount: messages.length,
      timeRange: {
        from: oldestDate,
        to: newestDate,
      },
      summary,
    });
  } catch (error) {
    console.error("Summarize chat error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating summary",
    });
  }
};

module.exports = {
  getRecentChats, // Added this
  queryChat,
  getAllChats,
  getChat,
  summarizeChat,
};
