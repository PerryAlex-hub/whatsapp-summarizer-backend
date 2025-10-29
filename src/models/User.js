// ============================================
// USER MODEL
// Defines user schema and methods
// ============================================

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * User Schema
 * Simple authentication with username + password
 */
const userSchema = new mongoose.Schema(
  {
    // Username (unique identifier for login)
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true, // This creates an index automatically
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
    },

    // Password (hashed with bcrypt)
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password in queries by default
    },

    // WhatsApp phone number (optional initially)
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
    },

    // WhatsApp connection status
    whatsappConnected: {
      type: Boolean,
      default: false,
    },

    // Last login timestamp
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    // Automatically add createdAt and updatedAt fields
    timestamps: true,
  }
);

// No need for explicit index since unique: true already creates one

// ============ PRE-SAVE MIDDLEWARE ============
/**
 * Hash password before saving to database
 * Only runs if password is modified
 */
userSchema.pre("save", async function (next) {
  // If password wasn't modified, skip hashing
  if (!this.isModified("password")) {
    return next();
  }

  try {
    // Generate salt (random data added to password)
    const salt = await bcrypt.genSalt(10);

    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

// ============ INSTANCE METHODS ============
/**
 * Compare entered password with hashed password in database
 * @param {string} enteredPassword - Plain text password from login
 * @returns {Promise<boolean>} - True if passwords match
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Get user object without sensitive data
 * @returns {Object} - Safe user object for client
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    username: this.username,
    phoneNumber: this.phoneNumber,
    whatsappConnected: this.whatsappConnected,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

// ============ STATIC METHODS ============
/**
 * Find user by username
 * @param {string} username
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByUsername = function (username) {
  return this.findOne({username: username.toLowerCase()});
};

// Create and export the model
const User = mongoose.model("User", userSchema);

module.exports = User;
