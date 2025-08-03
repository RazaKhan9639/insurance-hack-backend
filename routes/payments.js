const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const {
  createPaymentIntent,
  handleWebhook,
  getUserPayments,
  getPaymentById,
  getPaymentStats,
  getUserCommissions,
  processRefund,
  testWebhook,
  manualPaymentConfirm,
  debugUserPurchases
} = require('../controllers/payments');

// @route   POST /api/payments/create-payment-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post('/create-payment-intent', authenticateToken, [
  body('courseId').notEmpty().withMessage('Course ID is required')
], createPaymentIntent);

// @route   POST /api/payments/webhook
// @desc    Stripe webhook for payment confirmation
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// @route   GET /api/payments
// @desc    Get user's payment history
// @access  Private
router.get('/', authenticateToken, getUserPayments);

// @route   GET /api/payments/:id
// @desc    Get payment by ID
// @access  Private
router.get('/:id', authenticateToken, getPaymentById);

// @route   GET /api/payments/stats/overview
// @desc    Get payment statistics (Admin only)
// @access  Private (Admin only)
router.get('/stats/overview', authenticateToken, isAdmin, getPaymentStats);

// @route   GET /api/payments/commissions
// @desc    Get user's commission earnings (for agents)
// @access  Private
router.get('/commissions', authenticateToken, getUserCommissions);

// @route   POST /api/payments/refund
// @desc    Process refund (Admin only)
// @access  Private (Admin only)
router.post('/refund', authenticateToken, isAdmin, [
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('reason').notEmpty().withMessage('Refund reason is required')
], processRefund);

// @route   POST /api/payments/test-webhook
// @desc    Test webhook endpoint
// @access  Public
router.post('/test-webhook', testWebhook);

// @route   POST /api/payments/manual-confirm
// @desc    Manual payment confirmation (for testing)
// @access  Private
router.post('/manual-confirm', authenticateToken, [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
  body('courseId').notEmpty().withMessage('Course ID is required')
], manualPaymentConfirm);

// @route   GET /api/payments/debug-user
// @desc    Debug user's purchase status
// @access  Private
router.get('/debug-user', authenticateToken, debugUserPurchases);

module.exports = router; 