// ============================================
// WHATSAPP AUTH MODEL
// Store WhatsApp authentication data in MongoDB
// ============================================

const mongoose = require('mongoose');

const whatsappAuthSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    
    // Store Baileys auth state as JSON
    authState: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    
    connected: {
      type: Boolean,
      default: false,
    },
    
    lastConnected: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const WhatsAppAuth = mongoose.model('WhatsAppAuth', whatsappAuthSchema);

module.exports = WhatsAppAuth;