const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Course = require('../models/Course');
const Payment = require('../models/Payment');
const Commission = require('../models/Commission');
const { 
  generatePagination,
  createErrorResponse,
  createSuccessResponse,
  isValidObjectId,
  getDateRange
} = require('../Utils/utils');

// @desc    Get admin dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getAdminDashboard = async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    const totalAgents = await User.countDocuments({ role: 'agent' });
    const pendingAgents = await User.countDocuments({ role: 'agent', isActiveAgent: false });
    const totalCourses = await Course.countDocuments();
    const totalPayments = await Payment.countDocuments();

    // Get recent users
    const recentUsers = await User.find()
      .select('username email role firstName lastName createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent payments
    const recentPayments = await Payment.find()
      .populate('user', 'username email firstName lastName')
      .populate('course', 'title')
      .populate('referralAgent', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get revenue stats
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    // Get commission stats
    const totalCommissions = await Commission.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pendingCommissions = await Commission.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const paidCommissions = await Commission.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get referral stats
    const referralPayments = await Payment.countDocuments({ 
      referralAgent: { $exists: true, $ne: null } 
    });

    const referralRevenue = await Payment.aggregate([
      { $match: { status: 'completed', referralAgent: { $exists: true, $ne: null } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json(createSuccessResponse({
      dashboard: {
        totalUsers,
        totalAgents,
        pendingAgents,
        totalCourses,
        totalPayments,
        recentUsers,
        recentPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue,
        totalCommissions: totalCommissions[0]?.total || 0,
        pendingCommissions: pendingCommissions[0]?.total || 0,
        paidCommissions: paidCommissions[0]?.total || 0,
        referralPayments,
        referralRevenue: referralRevenue[0]?.total || 0
      }
    }));

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, status } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (status === 'pending') query.isActiveAgent = false;
    if (status === 'active') query.isActiveAgent = true;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('coursesPurchased.courseId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await User.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    res.json(createSuccessResponse({
      users,
      pagination
    }));

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin only)
const updateUserRole = async (req, res) => {
  try {
    console.log('Update user role request:', {
      body: req.body,
      params: req.params,
      user: req.user
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { role, commissionRate, isActiveAgent } = req.body;
    const { id } = req.params;

    console.log('Processing update with:', { role, commissionRate, isActiveAgent, id });

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid user ID'));
    }

    // Prepare update object
    const updateData = { role };
    
    // Only update commission rate if user is being set as agent
    if (role === 'agent' && commissionRate !== undefined) {
      const rate = parseInt(commissionRate);
      if (rate >= 0 && rate <= 100) {
        updateData.commissionRate = rate;
      }
    }
    
    // Only update isActiveAgent if user is being set as agent
    if (role === 'agent' && isActiveAgent !== undefined) {
      updateData.isActiveAgent = Boolean(isActiveAgent);
    }

    console.log('Final update data:', updateData);

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    console.log('User updated successfully:', user);

    res.json(createSuccessResponse({ user }, 'User updated successfully'));

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Approve agent application (Admin only)
// @route   PUT /api/admin/users/:id/approve-agent
// @access  Private (Admin only)
const approveAgent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid user ID'));
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    if (user.role !== 'agent') {
      return res.status(400).json(createErrorResponse('User is not an agent'));
    }

    if (user.isActiveAgent) {
      return res.status(400).json(createErrorResponse('Agent is already approved'));
    }

    user.isActiveAgent = true;
    user.agentApprovedAt = new Date();
    await user.save();

    res.json(createSuccessResponse({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActiveAgent: user.isActiveAgent,
        agentApprovedAt: user.agentApprovedAt
      }
    }, 'Agent approved successfully'));

  } catch (error) {
    console.error('Approve agent error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid user ID'));
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    res.json(createSuccessResponse({}, 'User deleted successfully'));

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get all payments (Admin only)
// @route   GET /api/admin/payments
// @access  Private (Admin only)
const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, referral } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (referral === 'true') query.referralAgent = { $exists: true, $ne: null };
    if (referral === 'false') query.referralAgent = { $exists: false };

    const payments = await Payment.find(query)
      .populate('user', 'username email firstName lastName')
      .populate('course', 'title')
      .populate('referralAgent', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Payment.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    res.json(createSuccessResponse({
      payments,
      pagination
    }));

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get all commissions (Admin only)
// @route   GET /api/admin/commissions
// @access  Private (Admin only)
const getAllCommissions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, agentId } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (agentId) query.agent = agentId;

    const commissions = await Commission.find(query)
      .populate('agent', 'username email firstName lastName')
      .populate('referral', 'username email firstName lastName')
      .populate('payment', 'amount transactionId createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Commission.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    res.json(createSuccessResponse({
      commissions,
      pagination
    }));

  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Update commission status (Admin only)
// @route   PUT /api/admin/commissions/:id/status
// @access  Private (Admin only)
const updateCommissionStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { status, payoutMethod, payoutNotes } = req.body;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid commission ID'));
    }

    const updateData = { status };
    
    if (status === 'paid') {
      updateData.paidAt = new Date();
      updateData.processedBy = req.user.userId;
      updateData.processedAt = new Date();
    }
    
    if (payoutMethod) updateData.payoutMethod = payoutMethod;
    if (payoutNotes) updateData.payoutNotes = payoutNotes;

    const commission = await Commission.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('agent', 'username email firstName lastName');

    if (!commission) {
      return res.status(404).json(createErrorResponse('Commission not found', 404));
    }

    res.json(createSuccessResponse({ commission }, 'Commission status updated successfully'));

  } catch (error) {
    console.error('Update commission status error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Process bulk commission payouts (Admin only)
// @route   POST /api/admin/commissions/bulk-payout
// @access  Private (Admin only)
const processBulkPayout = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { commissionIds, payoutMethod, payoutNotes } = req.body;

    const commissions = await Commission.find({
      _id: { $in: commissionIds },
      status: 'pending'
    });

    if (commissions.length === 0) {
      return res.status(400).json(createErrorResponse('No pending commissions found'));
    }

    const totalAmount = commissions.reduce((sum, commission) => sum + commission.amount, 0);

    // Update all commissions to paid status
    await Commission.updateMany(
      { _id: { $in: commissionIds } },
      {
        status: 'paid',
        paidAt: new Date(),
        payoutMethod,
        payoutNotes,
        processedBy: req.user.userId,
        processedAt: new Date()
      }
    );

    res.json(createSuccessResponse({
      payout: {
        totalCommissions: commissions.length,
        totalAmount,
        method: payoutMethod,
        processedAt: new Date()
      }
    }, 'Bulk payout processed successfully'));

  } catch (error) {
    console.error('Bulk payout error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get comprehensive system statistics (Admin only)
// @route   GET /api/admin/stats/overview
// @access  Private (Admin only)
const getSystemStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const totalAgents = await User.countDocuments({ role: 'agent' });
    const pendingAgents = await User.countDocuments({ role: 'agent', isActiveAgent: false });
    const activeAgents = await User.countDocuments({ role: 'agent', isActiveAgent: true });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });

    // Course statistics
    const totalCourses = await Course.countDocuments();
    const totalEnrollments = await User.aggregate([
      {
        $project: {
          numEnrollments: { $size: { $ifNull: ["$coursesPurchased", []] } }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$numEnrollments" }
        }
      }
    ]);

    // Payment statistics
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({ status: 'completed' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const failedPayments = await Payment.countDocuments({ status: 'failed' });
    const refundedPayments = await Payment.countDocuments({ status: 'refunded' });

    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Commission statistics
    const totalCommissions = await Commission.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pendingCommissions = await Commission.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const paidCommissions = await Commission.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Referral statistics
    const referralPayments = await Payment.countDocuments({ 
      referralAgent: { $exists: true, $ne: null } 
    });

    const referralRevenue = await Payment.aggregate([
      { $match: { status: 'completed', referralAgent: { $exists: true, $ne: null } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Monthly trends
    const monthlyUsers = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const monthlyCommissions = await Commission.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json(createSuccessResponse({
      stats: {
        users: {
          total: totalUsers,
          agents: totalAgents,
          pendingAgents,
          activeAgents,
          newThisMonth: newUsersThisMonth,
          monthlyTrend: monthlyUsers
        },
        courses: {
          total: totalCourses,
          totalEnrollments: totalEnrollments[0]?.total || 0
        },
        payments: {
          total: totalPayments,
          completed: completedPayments,
          pending: pendingPayments,
          failed: failedPayments,
          refunded: refundedPayments,
          totalRevenue: totalRevenue[0]?.total || 0,
          monthlyTrend: monthlyRevenue
        },
        commissions: {
          total: totalCommissions[0]?.total || 0,
          pending: pendingCommissions[0]?.total || 0,
          paid: paidCommissions[0]?.total || 0,
          monthlyTrend: monthlyCommissions
        },
        referrals: {
          totalPayments: referralPayments,
          totalRevenue: referralRevenue[0]?.total || 0
        }
      }
    }));

  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Perform bulk actions (Admin only)
// @route   POST /api/admin/bulk-actions
// @access  Private (Admin only)
const performBulkActions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { action, ids, data } = req.body;
    let result;

    switch (action) {
      case 'delete-users':
        result = await User.deleteMany({ _id: { $in: ids } });
        break;
      
      case 'approve-agents':
        result = await User.updateMany(
          { _id: { $in: ids }, role: 'agent' },
          { 
            isActiveAgent: true, 
            agentApprovedAt: new Date() 
          }
        );
        break;
      
      case 'update-commission-status':
        const updateData = { status: data.status };
        if (data.status === 'paid') {
          updateData.paidAt = new Date();
          updateData.processedBy = req.user.userId;
          updateData.processedAt = new Date();
        }
        result = await Commission.updateMany(
          { _id: { $in: ids } },
          updateData
        );
        break;
      
      case 'delete-courses':
        result = await Course.deleteMany({ _id: { $in: ids } });
        break;
      
      default:
        return res.status(400).json(createErrorResponse('Invalid action'));
    }

    res.json(createSuccessResponse({ result }, `Bulk action '${action}' completed successfully`));

  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

module.exports = {
  getAdminDashboard,
  getAllUsers,
  updateUserRole,
  approveAgent,
  deleteUser,
  getAllPayments,
  getAllCommissions,
  updateCommissionStatus,
  processBulkPayout,
  getSystemStats,
  performBulkActions
}; 