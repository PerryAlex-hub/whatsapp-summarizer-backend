// ============================================
// MONGODB DATABASE CONNECTION
// Connects to MongoDB Atlas and handles errors
// ============================================

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
const connectDatabase = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // Connect WITHOUT deprecated options
    await mongoose.connect(MONGODB_URI);
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1); // Exit if database connection fails
  }
};

/**
 * Handle MongoDB connection events
 */
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB');
});

/**
 * Graceful shutdown - close database connection
 */
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 MongoDB connection closed due to app termination');
  process.exit(0);
});

module.exports = connectDatabase;