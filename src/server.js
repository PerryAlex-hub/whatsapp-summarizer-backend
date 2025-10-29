// ============================================
// MAIN SERVER FILE
// Express server setup and initialization
// ============================================

const express = require('express');
const cors = require('cors');
const connectDatabase = require('./config/database');
const { PORT, CORS_ORIGIN, NODE_ENV } = require('./config/env');

// Import routes
const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');
const queryRoutes = require('./routes/query');

// Import WhatsApp service for connection restoration
const whatsappService = require('./services/whatsappService');

// ============ INITIALIZE EXPRESS APP ============
const app = express();

// ============ MIDDLEWARE ============

// 1. CORS - Allow frontend to call backend (UPDATED)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Get allowed origins from environment variable
    const allowedOrigins = CORS_ORIGIN.split(',').map(o => o.trim());
    
    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Allow all origins with wildcard
      if (allowedOrigin === '*') {
        return true;
      }
      
      // Exact match
      if (allowedOrigin === origin) {
        return true;
      }
      
      // Support wildcard subdomains like *.vercel.app
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp('^' + pattern + '$');
        return regex.test(origin);
      }
      
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // Cache preflight for 24 hours
}));

// 2. Body Parsers - Parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Request Logging (development only)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ============ ROUTES ============

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Summarizer API is running! 🚀',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/query', queryRoutes);

console.log('✅ Routes registered: /api/auth, /api/whatsapp, /api/query');

// ============ ERROR HANDLING ============

// 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============ START SERVER ============

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDatabase();
    
    // 2. Restore WhatsApp connections (reconnect users who were connected)
    await whatsappService.restoreConnections();
    
    // 3. Start Express server
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 SERVER STARTED SUCCESSFULLY!');
      console.log('='.repeat(50));
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 CORS enabled for: ${CORS_ORIGIN}`);
      console.log('='.repeat(50) + '\n');
      
      console.log('📋 Available endpoints:');
      console.log('   GET  /                          - Health check');
      console.log('\n   AUTH ENDPOINTS:');
      console.log('   POST /api/auth/signup           - Register new user');
      console.log('   POST /api/auth/login            - Login user');
      console.log('   GET  /api/auth/me               - Get current user (auth required)');
      console.log('   PUT  /api/auth/phone            - Update phone number (auth required)');
      console.log('   POST /api/auth/logout           - Logout (auth required)');
      console.log('\n   WHATSAPP ENDPOINTS:');
      console.log('   POST /api/whatsapp/connect      - Connect WhatsApp (auth required)');
      console.log('   GET  /api/whatsapp/qr           - Get QR code (auth required)');
      console.log('   GET  /api/whatsapp/status       - Connection status (auth required)');
      console.log('   POST /api/whatsapp/disconnect   - Disconnect WhatsApp (auth required)');
      console.log('\n   QUERY ENDPOINTS:');
      console.log('   POST /api/query                 - Query and summarize chat (auth required)');
      console.log('   GET  /api/query/chats           - Get all chats (auth required)');
      console.log('   GET  /api/query/chats/:chatId   - Get specific chat (auth required)');
      console.log('   POST /api/query/summarize/:chatId - Summarize chat (auth required)');
      console.log('\n' + '='.repeat(50) + '\n');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});