const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const {
  getAdminDashboard,
  getAllUsers,
  updateUserRole,
  approveAgent,
  deleteUser,
  getAllPayments,
  getAllCommissions,
  updateCommissionStatus,
  processBulkPayout,
  processManualPayout,
  getPayoutHistory,
  getSystemStats,
  performBulkActions,
  getPurchaseTracking,
  getAgentAnalytics
} = require('../controllers/adminController');

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard data
// @access  Private (Admin only)
router.get('/dashboard', authenticateToken, isAdmin, getAdminDashboard);

// @route   GET /api/admin/users
// @desc    Get all users (Admin only)
// @access  Private (Admin only)
router.get('/users', authenticateToken, isAdmin, getAllUsers);

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role (Admin only)
// @access  Private (Admin only)
router.put('/users/:id/role', authenticateToken, isAdmin, [
  body('role').isIn(['user', 'agent', 'admin']).withMessage('Invalid role'),
  body('commissionRate').optional().isNumeric().withMessage('Commission rate must be a number'),
  body('isActiveAgent').optional().isBoolean().withMessage('isActiveAgent must be a boolean')
], updateUserRole);

// @route   PUT /api/admin/users/:id/approve-agent
// @desc    Approve agent application (Admin only)
// @access  Private (Admin only)
router.put('/users/:id/approve-agent', authenticateToken, isAdmin, approveAgent);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (Admin only)
// @access  Private (Admin only)
router.delete('/users/:id', authenticateToken, isAdmin, deleteUser);

// @route   GET /api/admin/payments
// @desc    Get all payments (Admin only)
// @access  Private (Admin only)
router.get('/payments', authenticateToken, isAdmin, getAllPayments);

// @route   GET /api/admin/commissions
// @desc    Get all commissions (Admin only)
// @access  Private (Admin only)
router.get('/commissions', authenticateToken, isAdmin, getAllCommissions);

// @route   PUT /api/admin/commissions/:id/status
// @desc    Update commission status (Admin only)
// @access  Private (Admin only)
router.put('/commissions/:id/status', authenticateToken, isAdmin, [
  body('status').isIn(['pending', 'paid', 'cancelled']).withMessage('Invalid status'),
  body('payoutMethod').optional().isIn(['bank_transfer', 'stripe_payout', 'manual']),
  body('payoutNotes').optional().isString()
], updateCommissionStatus);

// @route   POST /api/admin/commissions/bulk-payout
// @desc    Process bulk commission payouts (Admin only)
// @access  Private (Admin only)
router.post('/commissions/bulk-payout', authenticateToken, isAdmin, [
  body('commissionIds').isArray().withMessage('Commission IDs must be an array'),
  body('payoutMethod').isIn(['bank_transfer', 'stripe_payout', 'manual']).withMessage('Invalid payout method'),
  body('payoutNotes').optional().isString()
], processBulkPayout);

// @route   POST /api/admin/commissions/payout
// @desc    Process manual payout to agent (Admin only)
// @access  Private (Admin only)
router.post('/commissions/payout', authenticateToken, isAdmin, [
  body('agentId').notEmpty().withMessage('Agent ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('paymentMethod').isIn(['bank_transfer', 'stripe_payout', 'manual', 'paypal']).withMessage('Invalid payment method'),
  body('notes').optional().isString()
], processManualPayout);

// @route   GET /api/admin/commissions/payouts
// @desc    Get payout history (Admin only)
// @access  Private (Admin only)
router.get('/commissions/payouts', authenticateToken, isAdmin, getPayoutHistory);

// @route   GET /api/admin/purchases
// @desc    Get detailed purchase tracking (Admin only)
// @access  Private (Admin only)
router.get('/purchases', authenticateToken, isAdmin, getPurchaseTracking);

// @route   GET /api/admin/agents/analytics
// @desc    Get agent performance analytics (Admin only)
// @access  Private (Admin only)
router.get('/agents/analytics', authenticateToken, isAdmin, getAgentAnalytics);

// @route   GET /api/admin/stats/overview
// @desc    Get comprehensive system statistics (Admin only)
// @access  Private (Admin only)
router.get('/stats/overview', authenticateToken, isAdmin, getSystemStats);

// @route   POST /api/admin/bulk-actions
// @desc    Perform bulk actions (Admin only)
// @access  Private (Admin only)
router.post('/bulk-actions', authenticateToken, isAdmin, [
  body('action').isIn(['delete-users', 'approve-agents', 'update-commission-status', 'delete-courses']).withMessage('Invalid action'),
  body('ids').isArray().withMessage('IDs must be an array'),
  body('data').optional()
], performBulkActions);

module.exports = router; 