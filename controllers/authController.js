const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { 
  generateReferralCode, 
  hashPassword, 
  comparePassword, 
  generateToken, 
  sanitizeUser,
  createErrorResponse,
  createSuccessResponse
} = require('../Utils/utils');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { 
      username, 
      email, 
      password, 
      referralCode, 
      firstName, 
      lastName, 
      phone, 
      country,
      role = 'user'
    } = req.body;

    console.log('Extracted registration data:', {
      username, email, firstName, lastName, phone, country, role, referralCode
    });

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json(createErrorResponse('User with this email or username already exists'));
    }

    // Find referrer if referral code provided
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    // Create new user
    const user = new User({
      username,
      email,
      password, // The User model will hash this automatically
      referredBy,
      firstName,
      lastName,
      phone,
      country,
      role
      // The User model will generate referral code automatically
    });

    console.log('Creating user with data:', {
      username, email, firstName, lastName, phone, country, role
    });

    await user.save();

    console.log('User created successfully:', user._id);
    console.log('Generated referral code:', user.referralCode);

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      role: user.role
    });

    res.status(201).json(createSuccessResponse({
      token,
      user: sanitizeUser(user)
    }, 'User registered successfully'));

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json(createErrorResponse('Invalid credentials'));
    }

    // Check password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json(createErrorResponse('Invalid credentials'));
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      role: user.role
    });

    res.json(createSuccessResponse({
      token,
      user: sanitizeUser(user)
    }, 'Login successful'));

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('coursesEnrolled', 'title description');

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    res.json(createSuccessResponse({ user }));

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { username, email, firstName, lastName, phone, country } = req.body;
    const updateFields = {};

    if (username) updateFields.username = username;
    if (email) updateFields.email = email;
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (phone) updateFields.phone = phone;
    if (country) updateFields.country = country;

    // Check if username or email already exists
    if (username || email) {
      const existingUser = await User.findOne({
        $or: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : [])
        ],
        _id: { $ne: req.user.userId }
      });

      if (existingUser) {
        return res.status(400).json(createErrorResponse('Username or email already exists'));
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    res.json(createSuccessResponse({ user }, 'Profile updated successfully'));

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.userId).select('+password');
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    // Verify current password
    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json(createErrorResponse('Current password is incorrect'));
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json(createSuccessResponse({}, 'Password changed successfully'));

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
}; 