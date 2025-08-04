const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  updateBankDetails
} = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('country').notEmpty().withMessage('Country is required'),
  body('referralCode').optional().isString(),
  body('role').optional().isIn(['user', 'agent']).withMessage('Role must be user or agent')
], register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], login);

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticateToken, getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, [
  body('username').optional().isLength({ min: 3 }),
  body('email').optional().isEmail(),
  body('firstName').optional().isString(),
  body('lastName').optional().isString(),
  body('phone').optional().isString(),
  body('country').optional().isString()
], updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], changePassword);

// @route   PUT /api/auth/bank-details
// @desc    Update bank details (for agents)
// @access  Private
router.put('/bank-details', authenticateToken, [
  body('accountNumber').notEmpty().withMessage('Account number is required'),
  body('bankName').notEmpty().withMessage('Bank name is required'),
  body('accountHolderName').notEmpty().withMessage('Account holder name is required'),
  body('routingNumber').optional().isString(),
  body('swiftCode').optional().isString(),
  body('iban').optional().isString()
], updateBankDetails);

module.exports = router; 