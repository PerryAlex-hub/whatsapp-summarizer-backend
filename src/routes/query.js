// ============================================
// QUERY ROUTES
// Defines message query and summarization API endpoints
// ============================================

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getRecentChats,
  queryChat,
  getAllChats,
  getChat,
  summarizeChat,
} = require('../controllers/queryController');

/**
 * @route   GET /api/query/chats/recent
 * @desc    Get top 10 most active chats (for dashboard)
 * @access  Private (requires token)
 * @query   ?limit=10 (optional, default 10)
 */
router.get('/chats/recent', auth, getRecentChats);

/**
 * @route   POST /api/query
 * @desc    Search and summarize chat by name
 * @access  Private (requires token)
 * @body    { query: "chat name" }
 */
router.post('/', auth, queryChat);

/**
 * @route   GET /api/query/chats
 * @desc    Get list of all user's chats
 * @access  Private (requires token)
 */
router.get('/chats', auth, getAllChats);

/**
 * @route   GET /api/query/chats/:chatId
 * @desc    Get messages from a specific chat
 * @access  Private (requires token)
 */
router.get('/chats/:chatId', auth, getChat);

/**
 * @route   POST /api/query/summarize/:chatId
 * @desc    Get AI summary of a specific chat
 * @access  Private (requires token)
 */
router.post('/summarize/:chatId', auth, summarizeChat);

module.exports = router;