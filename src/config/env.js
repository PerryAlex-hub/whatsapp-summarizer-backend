// ============================================
// ENVIRONMENT CONFIGURATION
// Loads and validates environment variables
// ============================================

require('dotenv').config(); // Load .env file

// Export all environment variables
module.exports = {
  // Server config
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI,
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  JWT_EXPIRES_IN: '7d', // Token valid for 7 days
  
  // External APIs
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',
  
  // Message storage config
  MESSAGE_TTL_HOURS: 24, // Messages auto-delete after 24 hours
  MAX_MESSAGES_PER_CHAT: 500, // Limit per chat
};

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'GEMINI_API_KEY'];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ ERROR: ${envVar} is not defined in .env file`);
    process.exit(1); // Stop server if critical env var is missing
  }
});

console.log('✅ Environment variables loaded successfully');