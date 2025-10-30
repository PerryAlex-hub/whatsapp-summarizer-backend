// ============================================
// AUTH CONTROLLER
// Handles signup, login, and logout
// ============================================

const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

/**
 * SIGNUP - Register new user
 * POST /api/auth/signup
 * Body: { username, password, phoneNumber? }
 */
const signup = async (req, res) => {
  try {
    const { username, password, phoneNumber } = req.body;
    
    // 1. Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }
    
    // Check username length
    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long.',
      });
    }
    
    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }
    
    // 2. Check if username already exists
    const existingUser = await User.findByUsername(username);
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken. Please choose another.',
      });
    }
    
    // 3. Create new user
    const user = new User({
      username: username.toLowerCase().trim(),
      password, // Will be hashed by User model pre-save hook
      phoneNumber: phoneNumber || null,
    });
    
    // 4. Save to database
    const savedUser = await user.save();
    console.log('✅ User saved to database:', savedUser._id);
    
    // 5. Generate JWT token
    const token = generateToken(savedUser._id);
    
    // 6. Return success response
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: savedUser.toSafeObject(), // Don't send password
    });
    
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account. Please try again.',
      error: error.message, // Include error for debugging
    });
  }
};

/**
 * LOGIN - Authenticate user
 * POST /api/auth/login
 * Body: { username, password }
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 1. Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }
    
    // 2. Find user by username (include password field)
    const user = await User.findByUsername(username).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }
    
    // 3. Verify password
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }
    
    // 4. Update last login timestamp
    user.lastLogin = new Date();
    await user.save();
    
    // 5. Generate JWT token
    const token = generateToken(user._id);
    
    // 6. Return success response
    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: user.toSafeObject(),
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in. Please try again.',
    });
  }
};

/**
 * GET CURRENT USER - Get logged in user's info
 * GET /api/auth/me
 * Requires authentication
 */
const getCurrentUser = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }
    
    res.status(200).json({
      success: true,
      user: user.toSafeObject(),
    });
    
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data.',
    });
  }
};

/**
 * UPDATE PHONE NUMBER - Update WhatsApp phone number
 * PUT /api/auth/phone
 * Body: { phoneNumber }
 * Requires authentication
 */
const updatePhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required.',
      });
    }
    
    // Update user's phone number
    const user = await User.findById(req.userId);
    user.phoneNumber = phoneNumber;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Phone number updated successfully!',
      user: user.toSafeObject(),
    });
    
  } catch (error) {
    console.error('Update phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating phone number.',
    });
  }
};

/**
 * LOGOUT - Clear session (client-side token removal)
 * POST /api/auth/logout
 * 
 * Note: With JWT, logout is mainly client-side (delete token from localStorage)
 * This endpoint is optional but useful for logging/analytics
 */
const logout = async (req, res) => {
  try {
    // Update last active timestamp
    if (req.userId) {
      await User.findByIdAndUpdate(req.userId, {
        lastLogin: new Date(),
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Clear your token on the client side.',
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out.',
    });
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  updatePhoneNumber,
  logout,
};