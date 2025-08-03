const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const {
  getReferralCode,
  getMyReferrals,
  validateReferralCode,
  getReferralStats,
  getTopAgents,
  becomeAgent,
  updateAgentProfile,
  getAgentDashboard,
  requestPayout
} = require('../controllers/referralController');

// @route   GET /api/referrals/code
// @desc    Get user's referral code
// @access  Private
router.get('/code', authenticateToken, getReferralCode);

// @route   GET /api/referrals/my-referrals
// @desc    Get user's referrals
// @access  Private
router.get('/my-referrals', authenticateToken, getMyReferrals);

// @route   GET /api/referrals/validate/:code
// @desc    Validate a referral code
// @access  Public
router.get('/validate/:code', validateReferralCode);

// @route   GET /api/referrals/stats
// @desc    Get referral statistics for agents
// @access  Private
router.get('/stats', authenticateToken, getReferralStats);

// @route   GET /api/referrals/top-agents
// @desc    Get top performing agents (Admin only)
// @access  Private (Admin only)
router.get('/top-agents', authenticateToken, isAdmin, getTopAgents);

// @route   POST /api/referrals/become-agent
// @desc    Request to become an agent
// @access  Private
router.post('/become-agent', authenticateToken, [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('country').notEmpty().withMessage('Country is required')
], becomeAgent);

// @route   PUT /api/referrals/agent-profile
// @desc    Update agent profile and bank details
// @access  Private
router.put('/agent-profile', authenticateToken, [
  body('firstName').optional().notEmpty(),
  body('lastName').optional().notEmpty(),
  body('phone').optional().notEmpty(),
  body('country').optional().notEmpty(),
  body('bankDetails.accountName').optional().notEmpty(),
  body('bankDetails.accountNumber').optional().notEmpty(),
  body('bankDetails.bankName').optional().notEmpty(),
  body('bankDetails.swiftCode').optional().notEmpty()
], updateAgentProfile);

// @route   GET /api/referrals/agent-dashboard
// @desc    Get agent dashboard data
// @access  Private
router.get('/agent-dashboard', authenticateToken, getAgentDashboard);

// @route   POST /api/referrals/request-payout
// @desc    Request payout for pending commissions (Agent only)
// @access  Private
router.post('/request-payout', authenticateToken, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('payoutMethod').isIn(['bank_transfer', 'stripe_payout']).withMessage('Invalid payout method')
], requestPayout);

module.exports = router; 