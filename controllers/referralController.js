const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Commission = require('../models/Commission');
const Payment = require('../models/Payment');
const { 
  generatePagination,
  createErrorResponse,
  createSuccessResponse,
  isValidObjectId
} = require('../Utils/utils');

// @desc    Get user's referral code
// @route   GET /api/referrals/code
// @access  Private
const getReferralCode = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('referralCode username firstName lastName');
    
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    res.json(createSuccessResponse({
      referralCode: user.referralCode,
      username: user.username,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim()
    }));

  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get user's referrals
// @route   GET /api/referrals/my-referrals
// @access  Private
const getMyReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const referrals = await User.find({ referredBy: req.user.userId })
      .select('username email firstName lastName createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await User.countDocuments({ referredBy: req.user.userId });

    // Get payment status for each referral
    const referralsWithPayments = await Promise.all(
      referrals.map(async (referral) => {
        const payment = await Payment.findOne({ 
          user: referral._id,
          status: 'completed'
        }).select('amount createdAt');
        
        return {
          ...referral.toObject(),
          hasPurchased: !!payment,
          purchaseAmount: payment?.amount || 0,
          purchaseDate: payment?.createdAt
        };
      })
    );

    const pagination = generatePagination(page, limit, total);

    res.json(createSuccessResponse({
      referrals: referralsWithPayments,
      pagination
    }));

  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Validate a referral code
// @route   GET /api/referrals/validate/:code
// @access  Public
const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.params;

    const referrer = await User.findOne({ referralCode: code });
    
    if (!referrer) {
      return res.status(404).json(createErrorResponse('Invalid referral code', 404));
    }

    res.json(createSuccessResponse({
      referrer: {
        username: referrer.username,
        referralCode: referrer.referralCode,
        fullName: `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim()
      }
    }, 'Valid referral code'));

  } catch (error) {
    console.error('Validate referral code error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get referral statistics for agents
// @route   GET /api/referrals/stats
// @access  Private
const getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'agent') {
      return res.status(403).json(createErrorResponse('Agent access required', 403));
    }

    // Get total referrals
    const totalReferrals = await User.countDocuments({ referredBy: user._id });

    // Get referrals who made purchases
    const referralsWithPurchases = await Commission.aggregate([
      { $match: { agent: user._id } },
      {
        $lookup: {
          from: 'users',
          localField: 'referral',
          foreignField: '_id',
          as: 'referralUser'
        }
      },
      { $unwind: '$referralUser' },
      {
        $group: {
          _id: '$referral',
          totalCommission: { $sum: '$amount' },
          username: { $first: '$referralUser.username' },
          email: { $first: '$referralUser.email' },
          firstName: { $first: '$referralUser.firstName' },
          lastName: { $first: '$referralUser.lastName' }
        }
      }
    ]);

    // Calculate total commission earned
    const totalCommission = await Commission.aggregate([
      { $match: { agent: user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Calculate paid commission
    const paidCommission = await Commission.aggregate([
      { $match: { agent: user._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Calculate pending commission
    const pendingCommission = await Commission.aggregate([
      { $match: { agent: user._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get monthly referral stats
    const monthlyStats = await User.aggregate([
      { $match: { referredBy: user._id } },
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

    res.json(createSuccessResponse({
      stats: {
        totalReferrals,
        referralsWithPurchases,
        totalCommission: totalCommission[0]?.total || 0,
        paidCommission: paidCommission[0]?.total || 0,
        pendingCommission: pendingCommission[0]?.total || 0,
        monthlyStats
      }
    }));

  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get top performing agents (Admin only)
// @route   GET /api/referrals/top-agents
// @access  Private (Admin only)
const getTopAgents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topAgents = await Commission.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'agent',
          foreignField: '_id',
          as: 'agentUser'
        }
      },
      { $unwind: '$agentUser' },
      {
        $group: {
          _id: '$agent',
          totalCommission: { $sum: '$amount' },
          totalReferrals: { $sum: 1 },
          username: { $first: '$agentUser.username' },
          email: { $first: '$agentUser.email' },
          firstName: { $first: '$agentUser.firstName' },
          lastName: { $first: '$agentUser.lastName' },
          isActiveAgent: { $first: '$agentUser.isActiveAgent' }
        }
      },
      { $sort: { totalCommission: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json(createSuccessResponse({ topAgents }));

  } catch (error) {
    console.error('Get top agents error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Request to become an agent
// @route   POST /api/referrals/become-agent
// @access  Private
const becomeAgent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { firstName, lastName, phone, country } = req.body;

    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    if (user.role === 'agent') {
      return res.status(400).json(createErrorResponse('Already an agent'));
    }

    // Update user to agent role
    user.role = 'agent';
    user.firstName = firstName;
    user.lastName = lastName;
    user.phone = phone;
    user.country = country;
    user.isActiveAgent = false; // Requires admin approval
    await user.save();

    res.json(createSuccessResponse({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode,
        isActiveAgent: user.isActiveAgent
      }
    }, 'Agent application submitted successfully. Awaiting admin approval.'));

  } catch (error) {
    console.error('Become agent error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Update agent profile and bank details
// @route   PUT /api/referrals/agent-profile
// @access  Private
const updateAgentProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'agent') {
      return res.status(403).json(createErrorResponse('Agent access required', 403));
    }

    const updateData = {};
    const { firstName, lastName, phone, country, bankDetails } = req.body;

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    if (country) updateData.country = country;
    if (bankDetails) updateData.bankDetails = bankDetails;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json(createSuccessResponse({ user: updatedUser }, 'Agent profile updated successfully'));

  } catch (error) {
    console.error('Update agent profile error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get agent dashboard data
// @route   GET /api/referrals/agent-dashboard
// @access  Private
const getAgentDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'agent') {
      return res.status(403).json(createErrorResponse('Agent access required', 403));
    }

    // Get recent referrals
    const recentReferrals = await User.find({ referredBy: user._id })
      .select('username email firstName lastName createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent commissions
    const recentCommissions = await Commission.find({ agent: user._id })
      .populate('referral', 'username firstName lastName')
      .populate('payment', 'amount transactionId createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get total stats
    const totalReferrals = await User.countDocuments({ referredBy: user._id });
    const totalCommission = await Commission.aggregate([
      { $match: { agent: user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pendingCommission = await Commission.aggregate([
      { $match: { agent: user._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const paidCommission = await Commission.aggregate([
      { $match: { agent: user._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get monthly performance
    const monthlyPerformance = await Commission.aggregate([
      { $match: { agent: user._id } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalCommission: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.json(createSuccessResponse({
      dashboard: {
        user: {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          referralCode: user.referralCode,
          isActiveAgent: user.isActiveAgent,
          totalReferrals: user.totalReferrals,
          totalCommission: user.totalCommission
        },
        recentReferrals,
        recentCommissions,
        stats: {
          totalReferrals,
          totalCommission: totalCommission[0]?.total || 0,
          pendingCommission: pendingCommission[0]?.total || 0,
          paidCommission: paidCommission[0]?.total || 0
        },
        monthlyPerformance
      }
    }));

  } catch (error) {
    console.error('Get agent dashboard error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Request payout for pending commissions (Agent only)
// @route   POST /api/referrals/request-payout
// @access  Private
const requestPayout = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { amount, payoutMethod } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'agent') {
      return res.status(403).json(createErrorResponse('Agent access required', 403));
    }

    if (!user.isActiveAgent) {
      return res.status(400).json(createErrorResponse('Agent account not approved'));
    }

    // Check if user has enough pending commission
    const pendingCommissions = await Commission.aggregate([
      { $match: { agent: user._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const availableAmount = pendingCommissions[0]?.total || 0;
    if (amount > availableAmount) {
      return res.status(400).json(createErrorResponse(`Insufficient pending commission. Available: $${availableAmount}`));
    }

    // Update commissions to paid status
    const commissionsToUpdate = await Commission.find({ 
      agent: user._id, 
      status: 'pending' 
    }).limit(Math.ceil(amount / 10)); // Approximate number of commissions to update

    let totalUpdated = 0;
    for (const commission of commissionsToUpdate) {
      if (totalUpdated + commission.amount <= amount) {
        commission.status = 'paid';
        commission.paidAt = new Date();
        commission.payoutMethod = payoutMethod;
        await commission.save();
        totalUpdated += commission.amount;
      }
    }

    res.json(createSuccessResponse({
      payout: {
        amount: totalUpdated,
        method: payoutMethod,
        processedCommissions: commissionsToUpdate.length
      }
    }, 'Payout request submitted successfully'));

  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

module.exports = {
  getReferralCode,
  getMyReferrals,
  validateReferralCode,
  getReferralStats,
  getTopAgents,
  becomeAgent,
  updateAgentProfile,
  getAgentDashboard,
  requestPayout
}; 