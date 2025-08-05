const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Course = require('../models/Course');
const Payment = require('../models/Payment');
const Commission = require('../models/Commission');
const Payout = require('../models/Payout');
const PayoutRequest = require('../models/PayoutRequest');
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
      .populate('referredBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get referral counts and commission totals for agents
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject();
      
      if (user.role === 'agent') {
        // Get referral count (users who used this agent's referral code)
        const referralCount = await User.countDocuments({ 
          referredBy: user._id 
        });
        
        // Get total commission earned
        const commissionStats = await Commission.aggregate([
          { $match: { agent: user._id } },
          { $group: { 
            _id: null, 
            totalCommission: { $sum: '$amount' },
            pendingCommission: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
            paidCommission: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } }
          }}
        ]);
        
        // Get payments made through this agent's referrals
        const referralPayments = await Payment.aggregate([
          { $match: { referralAgent: user._id, status: 'completed' } },
          { $group: { 
            _id: null, 
            totalAmount: { $sum: '$amount' },
            paymentCount: { $sum: 1 }
          }}
        ]);
        
        userObj.referralStats = {
          referralCount,
          totalCommission: commissionStats[0]?.totalCommission || 0,
          pendingCommission: commissionStats[0]?.pendingCommission || 0,
          paidCommission: commissionStats[0]?.paidCommission || 0,
          referralPaymentsAmount: referralPayments[0]?.totalAmount || 0,
          referralPaymentsCount: referralPayments[0]?.paymentCount || 0
        };
      }
      
      return userObj;
    }));

    const total = await User.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    res.json(createSuccessResponse({
      users: usersWithStats,
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
    const { page = 1, limit = 10, status, referral, agentId, courseId, dateRange } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (referral === 'true') query.referralAgent = { $exists: true, $ne: null };
    if (referral === 'false') query.referralAgent = { $exists: false };
    if (agentId) query.referralAgent = agentId;
    if (courseId) query.course = courseId;
    
    // Add date range filter
    if (dateRange) {
      const { startDate, endDate } = getDateRange(dateRange);
      if (startDate && endDate) {
        query.createdAt = { $gte: startDate, $lte: endDate };
      }
    }

    const payments = await Payment.find(query)
      .populate('user', 'username email firstName lastName')
      .populate('course', 'title price')
      .populate('referralAgent', 'username firstName lastName commissionRate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get commission information for each payment
    const paymentsWithCommission = await Promise.all(payments.map(async (payment) => {
      const paymentObj = payment.toObject();
      
      if (payment.referralAgent) {
        // Get commission for this payment
        const commission = await Commission.findOne({ 
          payment: payment._id,
          agent: payment.referralAgent._id 
        });
        
        paymentObj.commission = commission ? {
          amount: commission.amount,
          status: commission.status,
          paidAt: commission.paidAt
        } : null;
      }
      
      return paymentObj;
    }));

    const total = await Payment.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    // Get summary stats
    const summaryStats = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalPayments: { $sum: 1 },
        referralPayments: { $sum: { $cond: [{ $ne: ['$referralAgent', null] }, 1, 0] } },
        referralAmount: { $sum: { $cond: [{ $ne: ['$referralAgent', null] }, '$amount', 0] } }
      }}
    ]);

    res.json(createSuccessResponse({
      payments: paymentsWithCommission,
      pagination,
      summary: summaryStats[0] || {
        totalAmount: 0,
        totalPayments: 0,
        referralPayments: 0,
        referralAmount: 0
      }
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
    const { page = 1, limit = 10, status, agentId, dateRange } = req.query;
    
    const query = {}; // All commission records (payouts are now in separate collection)
    if (status) query.status = status;
    if (agentId) query.agent = agentId;
    
    // Add date range filter
    if (dateRange) {
      const { startDate, endDate } = getDateRange(dateRange);
      if (startDate && endDate) {
        query.createdAt = { $gte: startDate, $lte: endDate };
      }
    }

    const commissions = await Commission.find(query)
      .populate('agent', 'username email firstName lastName commissionRate')
      .populate('referral', 'username email firstName lastName')
      .populate('payment', 'amount transactionId createdAt course')
      .populate('payment.course', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Commission.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    // Get summary stats
    const summaryStats = await Commission.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalCommission: { $sum: '$amount' },
        pendingCommission: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
        paidCommission: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
        totalCommissions: { $sum: 1 },
        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } }
      }}
    ]);

    // Get agent-wise summary
    const agentSummary = await Commission.aggregate([
      { $match: query },
      { $group: {
        _id: '$agent',
        totalCommission: { $sum: '$amount' },
        pendingCommission: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
        paidCommission: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
        commissionCount: { $sum: 1 }
      }},
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'agent'
      }},
      { $unwind: '$agent' },
      { $project: {
        agent: {
          _id: '$agent._id',
          username: '$agent.username',
          firstName: '$agent.firstName',
          lastName: '$agent.lastName',
          email: '$agent.email'
        },
        totalCommission: 1,
        pendingCommission: 1,
        paidCommission: 1,
        commissionCount: 1
      }}
    ]);

    res.json(createSuccessResponse({
      commissions,
      pagination,
      summary: summaryStats[0] || {
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
        totalCommissions: 0,
        pendingCount: 0,
        paidCount: 0
      },
      agentSummary
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

// @desc    Process manual payout to agent (Admin only)
// @route   POST /api/admin/commissions/payout
// @access  Private (Admin only)
const processManualPayout = async (req, res) => {
  try {
    const { agentId, amount, paymentMethod, notes } = req.body;

    if (!agentId || !amount || !paymentMethod) {
      return res.status(400).json(createErrorResponse('Agent ID, amount, and payment method are required'));
    }

    if (!isValidObjectId(agentId)) {
      return res.status(400).json(createErrorResponse('Invalid agent ID'));
    }

    // Find the agent
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json(createErrorResponse('Agent not found'));
    }

    // Check if agent has bank details
    if (!agent.bankDetails || !agent.bankDetails.accountNumber || !agent.bankDetails.bankName) {
      return res.status(400).json(createErrorResponse('Agent has not provided bank details yet'));
    }

    // Check if bank details are verified (for bank transfers)
    if (paymentMethod === 'bank_transfer' && !agent.bankDetails.isVerified) {
      return res.status(400).json(createErrorResponse('Agent bank details must be verified before processing bank transfer'));
    }

    // Get pending commissions for this agent
    const pendingCommissions = await Commission.find({
      agent: agentId,
      status: 'pending'
    });

    if (pendingCommissions.length === 0) {
      return res.status(400).json(createErrorResponse('No pending commissions found for this agent'));
    }

    const totalPendingAmount = pendingCommissions.reduce((sum, commission) => sum + commission.amount, 0);
    
    if (amount > totalPendingAmount) {
      return res.status(400).json(createErrorResponse(`Amount exceeds pending commission. Maximum payout: £${totalPendingAmount}`));
    }

    // Calculate how many commissions we can pay with this amount
    let remainingAmount = amount;
    const commissionsToPay = [];
    let totalCommissionsPaid = 0;

    for (const commission of pendingCommissions) {
      if (remainingAmount >= commission.amount) {
        commissionsToPay.push(commission._id);
        remainingAmount -= commission.amount;
        totalCommissionsPaid += commission.amount;
      } else {
        break;
      }
    }

    // Update commission status to paid and link to payout
    await Commission.updateMany(
      { _id: { $in: commissionsToPay } },
      { 
        status: 'paid',
        paidAt: new Date(),
        adminNotes: notes
      }
    );

    // Create payout record
    const payout = new Payout({
      agent: agentId,
      amount: totalCommissionsPaid,
      status: 'completed',
      paymentMethod,
      notes: notes,
      adminNotes: notes,
      processedBy: req.user._id,
      processedAt: new Date(),
      completedAt: new Date(),
      commissionIds: commissionsToPay,
      totalCommissionsPaid: totalCommissionsPaid
    });

    await payout.save();

    // Update commissions with payout reference
    await Commission.updateMany(
      { _id: { $in: commissionsToPay } },
      { payoutId: payout._id }
    );

    res.json(createSuccessResponse({
      payout: {
        id: payout._id,
        agent: {
          _id: agent._id,
          username: agent.username,
          firstName: agent.firstName,
          lastName: agent.lastName,
          bankDetails: {
            accountNumber: agent.bankDetails.accountNumber,
            bankName: agent.bankDetails.bankName,
            accountHolderName: agent.bankDetails.accountHolderName,
            routingNumber: agent.bankDetails.routingNumber,
            isVerified: agent.bankDetails.isVerified
          }
        },
        amount,
        paymentMethod,
        paidAt: payout.paidAt,
        notes
      }
    }, 'Payout processed successfully'));

  } catch (error) {
    console.error('Process payout error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Process bank transfer to agent (Admin only)
// @route   POST /api/admin/commissions/bank-transfer
// @access  Private (Admin only)
const processBankTransfer = async (req, res) => {
  try {
    const { agentId, amount, notes, transferReference } = req.body;

    if (!agentId || !amount) {
      return res.status(400).json(createErrorResponse('Agent ID and amount are required'));
    }

    if (!isValidObjectId(agentId)) {
      return res.status(400).json(createErrorResponse('Invalid agent ID'));
    }

    // Find the agent
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json(createErrorResponse('Agent not found'));
    }

    // Check if agent has bank details
    if (!agent.bankDetails || !agent.bankDetails.accountNumber || !agent.bankDetails.bankName) {
      return res.status(400).json(createErrorResponse('Agent has not provided bank details yet'));
    }

    // Check if bank details are verified
    if (!agent.bankDetails.isVerified) {
      return res.status(400).json(createErrorResponse('Agent bank details must be verified before processing bank transfer'));
    }

    // Get pending commissions for this agent
    const pendingCommissions = await Commission.find({
      agent: agentId,
      status: 'pending'
    });

    if (pendingCommissions.length === 0) {
      return res.status(400).json(createErrorResponse('No pending commissions found for this agent'));
    }

    const totalPendingAmount = pendingCommissions.reduce((sum, commission) => sum + commission.amount, 0);
    
    if (amount > totalPendingAmount) {
      return res.status(400).json(createErrorResponse(`Amount exceeds pending commission. Maximum payout: £${totalPendingAmount}`));
    }

    // Update commission status to paid
    const commissionIds = pendingCommissions.map(c => c._id);
    await Commission.updateMany(
      { _id: { $in: commissionIds } },
      { 
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: 'bank_transfer',
        adminNotes: notes,
        transferReference
      }
    );

    // Create payout record
    const payout = new Commission({
      agent: agentId,
      amount: amount,
      status: 'paid',
      paymentMethod: 'bank_transfer',
      adminNotes: notes,
      transferReference,
      paidAt: new Date(),
      type: 'payout'
    });

    await payout.save();

    res.json(createSuccessResponse({
      payout: {
        id: payout._id,
        agent: {
          _id: agent._id,
          username: agent.username,
          firstName: agent.firstName,
          lastName: agent.lastName,
          bankDetails: {
            accountNumber: agent.bankDetails.accountNumber,
            bankName: agent.bankDetails.bankName,
            accountHolderName: agent.bankDetails.accountHolderName,
            routingNumber: agent.bankDetails.routingNumber,
            swiftCode: agent.bankDetails.swiftCode,
            iban: agent.bankDetails.iban
          }
        },
        amount,
        paymentMethod: 'bank_transfer',
        paidAt: payout.paidAt,
        notes,
        transferReference
      }
    }, 'Bank transfer processed successfully'));

  } catch (error) {
    console.error('Process bank transfer error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get payout history (Admin only)
// @route   GET /api/admin/commissions/payouts
// @access  Private (Admin only)
const getPayoutHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, agentId, dateRange } = req.query;
    
    const query = {};
    if (agentId) query.agent = agentId;
    
    if (dateRange) {
      const { startDate, endDate } = getDateRange(dateRange);
      if (startDate && endDate) {
        query.completedAt = { $gte: startDate, $lte: endDate };
      }
    }

    const payouts = await Payout.find(query)
      .populate('agent', 'username email firstName lastName')
      .populate('processedBy', 'username firstName lastName')
      .populate('commissionIds', 'amount originalAmount referral payment')
      .populate('commissionIds.referral', 'username firstName lastName')
      .populate('commissionIds.payment', 'amount course')
      .populate('commissionIds.payment.course', 'title')
      .sort({ completedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Payout.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    // Get summary stats
    const summaryStats = await Payout.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalPayouts: { $sum: '$amount' },
        totalPayoutCount: { $sum: 1 }
      }}
    ]);

    res.json(createSuccessResponse({
      payouts,
      pagination,
      summary: summaryStats[0] || {
        totalPayouts: 0,
        totalPayoutCount: 0
      }
    }));

  } catch (error) {
    console.error('Get payout history error:', error);
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

// @desc    Get detailed purchase tracking (Admin only)
// @route   GET /api/admin/purchases
// @access  Private (Admin only)
const getPurchaseTracking = async (req, res) => {
  try {
    const { page = 1, limit = 10, courseId, agentId, dateRange, referral } = req.query;
    
    const query = {};
    if (courseId) query.course = courseId;
    if (dateRange) {
      const { startDate, endDate } = getDateRange(dateRange);
      if (startDate && endDate) {
        query.createdAt = { $gte: startDate, $lte: endDate };
      }
    }
    if (referral === 'true') query.referralAgent = { $exists: true, $ne: null };
    if (referral === 'false') query.referralAgent = { $exists: false };

    const purchases = await Payment.find(query)
      .populate('user', 'username email firstName lastName referredBy')
      .populate('course', 'title price category')
      .populate('referralAgent', 'username firstName lastName commissionRate')
      .populate('user.referredBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // Get commission information for each purchase
    const purchasesWithCommission = await Promise.all(purchases.map(async (purchase) => {
      const purchaseObj = purchase.toObject();
      
      if (purchase.referralAgent) {
        const commission = await Commission.findOne({
          payment: purchase._id,
          agent: purchase.referralAgent._id
        });
        
        purchaseObj.commission = commission ? {
          amount: commission.amount,
          status: commission.status,
          paidAt: commission.paidAt
        } : null;
      }
      
      return purchaseObj;
    }));

    const total = await Payment.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    // Get summary stats
    const summaryStats = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalPurchases: { $sum: 1 },
        totalRevenue: { $sum: '$amount' },
        referralPurchases: { $sum: { $cond: [{ $ne: ['$referralAgent', null] }, 1, 0] } },
        referralRevenue: { $sum: { $cond: [{ $ne: ['$referralAgent', null] }, '$amount', 0] } },
        directPurchases: { $sum: { $cond: [{ $eq: ['$referralAgent', null] }, 1, 0] } },
        directRevenue: { $sum: { $cond: [{ $eq: ['$referralAgent', null] }, '$amount', 0] } }
      }}
    ]);

    // Get course-wise summary
    const courseSummary = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: '$course',
        purchaseCount: { $sum: 1 },
        totalRevenue: { $sum: '$amount' },
        referralCount: { $sum: { $cond: [{ $ne: ['$referralAgent', null] }, 1, 0] } }
      }},
      { $lookup: {
        from: 'courses',
        localField: '_id',
        foreignField: '_id',
        as: 'course'
      }},
      { $unwind: '$course' },
      { $project: {
        course: {
          _id: '$course._id',
          title: '$course.title',
          price: '$course.price'
        },
        purchaseCount: 1,
        totalRevenue: 1,
        referralCount: 1
      }}
    ]);

    res.json(createSuccessResponse({
      purchases: purchasesWithCommission,
      pagination,
      summary: summaryStats[0] || {
        totalPurchases: 0,
        totalRevenue: 0,
        referralPurchases: 0,
        referralRevenue: 0,
        directPurchases: 0,
        directRevenue: 0
      },
      courseSummary
    }));

  } catch (error) {
    console.error('Get purchase tracking error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get agent performance analytics (Admin only)
// @route   GET /api/admin/agents/analytics
// @access  Private (Admin only)
const getAgentAnalytics = async (req, res) => {
  try {
    const { agentId, dateRange } = req.query;
    
    const query = { role: 'agent' };
    if (agentId) query._id = agentId;

    const agents = await User.find(query)
      .select('username email firstName lastName commissionRate isActiveAgent createdAt');

    const agentAnalytics = await Promise.all(agents.map(async (agent) => {
      // Get referrals count
      const referralCount = await User.countDocuments({ referredBy: agent._id });
      
      // Get payments through referrals
      const referralPayments = await Payment.aggregate([
        { $match: { referralAgent: agent._id, status: 'completed' } },
        { $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          paymentCount: { $sum: 1 }
        }}
      ]);

      // Get commission stats
      const commissionStats = await Commission.aggregate([
        { $match: { agent: agent._id } },
        { $group: {
          _id: null,
          totalCommission: { $sum: '$amount' },
          pendingCommission: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          paidCommission: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          commissionCount: { $sum: 1 }
        }}
      ]);

      // Get monthly performance
      const monthlyPerformance = await Payment.aggregate([
        { $match: { referralAgent: agent._id, status: 'completed' } },
        { $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }},
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      return {
        agent: {
          _id: agent._id,
          username: agent.username,
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          commissionRate: agent.commissionRate,
          isActiveAgent: agent.isActiveAgent,
          createdAt: agent.createdAt
        },
        analytics: {
          referralCount,
          totalReferralAmount: referralPayments[0]?.totalAmount || 0,
          referralPaymentCount: referralPayments[0]?.paymentCount || 0,
          totalCommission: commissionStats[0]?.totalCommission || 0,
          pendingCommission: commissionStats[0]?.pendingCommission || 0,
          paidCommission: commissionStats[0]?.paidCommission || 0,
          commissionCount: commissionStats[0]?.commissionCount || 0,
          monthlyPerformance
        }
      };
    }));

    res.json(createSuccessResponse({
      agents: agentAnalytics
    }));

  } catch (error) {
    console.error('Get agent analytics error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get all payout requests (Admin only)
// @route   GET /api/admin/payout-requests
// @access  Private (Admin only)
const getAllPayoutRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, agentId, dateRange } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (agentId) query.agent = agentId;
    
    // Add date range filter
    if (dateRange) {
      const { startDate, endDate } = getDateRange(dateRange);
      if (startDate && endDate) {
        query.requestDate = { $gte: startDate, $lte: endDate };
      }
    }

    const payoutRequests = await PayoutRequest.find(query)
      .populate('agent', 'username email firstName lastName commissionRate bankDetails')
      .populate('processedBy', 'username firstName lastName')
      .populate('commissionIds', 'amount status payment')
      .sort({ requestDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await PayoutRequest.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    // Get summary stats
    const summaryStats = await PayoutRequest.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
        approvedAmount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] } },
        completedAmount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
        totalRequests: { $sum: 1 },
        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
      }}
    ]);

    res.json(createSuccessResponse({
      payoutRequests,
      pagination,
      summary: summaryStats[0] || {
        totalAmount: 0,
        pendingAmount: 0,
        approvedAmount: 0,
        completedAmount: 0,
        totalRequests: 0,
        pendingCount: 0,
        approvedCount: 0,
        completedCount: 0
      }
    }));

  } catch (error) {
    console.error('Get payout requests error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Process payout request (Admin only)
// @route   PUT /api/admin/payout-requests/:id/process
// @access  Private (Admin only)
const processPayoutRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, payoutReference, rejectionReason } = req.body;

    const payoutRequest = await PayoutRequest.findById(id)
      .populate('agent', 'username email firstName lastName bankDetails')
      .populate('commissionIds', 'amount status');

    if (!payoutRequest) {
      return res.status(404).json(createErrorResponse('Payout request not found', 404));
    }

    // Check if agent has bank details
    if (status === 'approved' || status === 'completed') {
      if (!payoutRequest.agent.bankDetails || 
          !payoutRequest.agent.bankDetails.accountNumber || 
          !payoutRequest.agent.bankDetails.bankName) {
        return res.status(400).json(createErrorResponse('Agent has not provided bank details yet', 400));
      }
    }

    // Update payout request
    payoutRequest.status = status;
    payoutRequest.processedBy = req.user._id;
    payoutRequest.processedDate = new Date();
    payoutRequest.adminNotes = adminNotes;
    payoutRequest.payoutReference = payoutReference;
    payoutRequest.rejectionReason = rejectionReason;

    if (status === 'completed') {
      // Update commission statuses to paid
      await Commission.updateMany(
        { _id: { $in: payoutRequest.commissionIds } },
        { 
          status: 'paid', 
          paidAt: new Date(),
          payoutMethod: 'bank_transfer',
          payoutReference: payoutReference,
          adminNotes: adminNotes,
          processedBy: req.user._id,
          processedAt: new Date()
        }
      );
    }

    await payoutRequest.save();

    res.json(createSuccessResponse({
      payoutRequest,
      message: `Payout request ${status} successfully`
    }));

  } catch (error) {
    console.error('Process payout request error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Verify agent bank details (Admin only)
// @route   PUT /api/admin/users/:id/verify-bank-details
// @access  Private (Admin only)
const verifyAgentBankDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, verificationNotes } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    if (user.role !== 'agent') {
      return res.status(400).json(createErrorResponse('Only agents can have bank details verified', 400));
    }

    if (!user.bankDetails || !user.bankDetails.accountNumber || !user.bankDetails.bankName) {
      return res.status(400).json(createErrorResponse('Agent has not provided bank details yet', 400));
    }

    // Update bank details verification status
    user.bankDetails.isVerified = isVerified;
    user.bankDetails.verificationNotes = verificationNotes;
    user.bankDetails.verifiedAt = new Date();
    user.bankDetails.verifiedBy = req.user._id;

    await user.save();

    res.json(createSuccessResponse({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        bankDetails: user.bankDetails
      }
    }, `Bank details ${isVerified ? 'verified' : 'unverified'} successfully`));

  } catch (error) {
    console.error('Verify bank details error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Create payout request (Agent only)
// @route   POST /api/admin/payout-requests
// @access  Private (Agent only)
const createPayoutRequest = async (req, res) => {
  try {
    const { amount, notes, commissionIds } = req.body;
    const agentId = req.user._id;

    // Check if agent has bank details
    const agent = await User.findById(agentId);
    if (!agent.bankDetails || 
        !agent.bankDetails.accountNumber || 
        !agent.bankDetails.bankName) {
      return res.status(400).json(createErrorResponse('Please add your bank details before requesting a payout', 400));
    }

    // Validate commission IDs belong to this agent
    if (commissionIds && commissionIds.length > 0) {
      const commissions = await Commission.find({
        _id: { $in: commissionIds },
        agent: agentId,
        status: 'pending'
      });

      if (commissions.length !== commissionIds.length) {
        return res.status(400).json(createErrorResponse('Invalid commission IDs or commissions already paid', 400));
      }
    }

    const payoutRequest = new PayoutRequest({
      agent: agentId,
      amount,
      notes,
      commissionIds: commissionIds || [],
      bankDetails: agent.bankDetails
    });

    await payoutRequest.save();

    res.json(createSuccessResponse({
      payoutRequest,
      message: 'Payout request created successfully'
    }));

  } catch (error) {
    console.error('Create payout request error:', error);
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
  processManualPayout,
  getPayoutHistory,
  getSystemStats,
  performBulkActions,
  getPurchaseTracking,
  getAgentAnalytics,
  getAllPayoutRequests,
  processPayoutRequest,
  createPayoutRequest,
  verifyAgentBankDetails,
  processBankTransfer
}; 