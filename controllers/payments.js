const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const User = require('../models/User');
const Commission = require('../models/Commission');
const { 
  generatePagination,
  createErrorResponse,
  createSuccessResponse,
  isValidObjectId,
  calculateCommission,
  generatePDFReceipt
} = require('../Utils/utils');
const { sendCourseAccessEmail, sendCoursePurchaseEmail } = require('../services/emailService');

// @desc    Test webhook endpoint
// @route   POST /api/payments/test-webhook
// @access  Public
const testWebhook = async (req, res) => {
  console.log('Test webhook called');
  res.json({ message: 'Webhook test successful' });
};

// @desc    Create Stripe payment intent
// @route   POST /api/payments/create-payment-intent
// @access  Private
const createPaymentIntent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const course = await Course.findById(req.body.courseId);
    if (!course) {
      return res.status(404).json(createErrorResponse('Course not found', 404));
    }

    // Check if user already purchased this course
    const user = await User.findById(req.user.userId);
    if (user.coursesEnrolled.includes(req.body.courseId)) {
      return res.status(400).json(createErrorResponse('You already purchased this course'));
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: course.price * 100, // Stripe uses cents
      currency: 'usd',
      metadata: {
        userId: req.user.userId,
        courseId: req.body.courseId,
        integration_check: 'accept_a_payment'
      }
    });

    res.json(createSuccessResponse({
      clientSecret: paymentIntent.client_secret,
      amount: course.price,
      course: {
        id: course._id,
        title: course.title,
        description: course.description
      }
    }));

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Stripe webhook for payment confirmation
// @route   POST /api/payments/webhook
// @access  Public
const handleWebhook = async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Headers:', req.headers);
  console.log('Body length:', req.body?.length);
  
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received webhook event:', event.type);

  // Handle the payment_intent.succeeded event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    try {
      console.log('Processing successful payment:', paymentIntent.id);
      
      // Extract metadata
      const { userId, courseId } = paymentIntent.metadata;
      
      if (!userId || !courseId) {
        console.error('Missing metadata in payment intent:', paymentIntent.metadata);
        return res.status(400).json({ error: 'Missing metadata' });
      }
      
      // Find user and course
      const user = await User.findById(userId);
      const course = await Course.findById(courseId);
      
      if (!user) {
        console.error('User not found:', userId);
        return res.status(400).json({ error: 'User not found' });
      }
      
      if (!course) {
        console.error('Course not found:', courseId);
        return res.status(400).json({ error: 'Course not found' });
      }

      // Check if payment already processed
      const existingPayment = await Payment.findOne({ 
        transactionId: paymentIntent.id 
      });
      
      if (existingPayment) {
        console.log('Payment already processed:', paymentIntent.id);
        return res.status(200).json({ received: true });
      }

      // Check if user already purchased this course
      if (user.coursesEnrolled.includes(courseId)) {
        console.log('User already enrolled in course:', userId, courseId);
        return res.status(200).json({ received: true });
      }

      console.log('Creating payment record for user:', userId, 'course:', courseId);

      // Create payment record
      const payment = new Payment({
        user: userId,
        course: courseId,
        amount: paymentIntent.amount / 100,
        paymentMethod: 'stripe',
        transactionId: paymentIntent.id,
        status: 'completed',
        referralAgent: user.referredBy || null
      });

      await payment.save();
      console.log('Payment record created:', payment._id);

      // Create commission automatically if there's a referral agent
      if (user.referredBy) {
        try {
          console.log('Creating commission for referral agent:', user.referredBy);
          
          // Find the referral agent
          const referralAgent = await User.findById(user.referredBy);
          
          if (referralAgent && referralAgent.role === 'agent') {
            // Calculate commission amount
            const commissionAmount = (payment.amount * referralAgent.commissionRate / 100);
            
            console.log('Commission calculation:', {
              paymentAmount: payment.amount,
              commissionRate: referralAgent.commissionRate,
              commissionAmount: commissionAmount
            });

            // Create commission record
            const commission = new Commission({
              agent: user.referredBy,
              referral: userId,
              payment: payment._id,
              amount: commissionAmount,
              status: 'pending', // Start as pending until admin pays out
              commissionRate: referralAgent.commissionRate / 100,
              originalAmount: payment.amount,
              type: 'commission'
            });

            await commission.save();
            console.log('Commission created:', commission._id);

            // Update payment with commission status
            payment.commissionStatus = 'pending';
            await payment.save();
            console.log('Payment updated with commission status');
          }
        } catch (commissionError) {
          console.error('Error creating commission:', commissionError);
          // Don't fail the payment if commission creation fails
        }
      }

      // Add course to purchased courses (separate from enrolled)
      const purchaseRecord = {
        courseId: courseId,
        purchasedAt: new Date(),
        accessExpires: null // Lifetime access
      };

      // Check if already purchased
      const alreadyPurchased = user.coursesPurchased.some(purchase => 
        purchase.courseId.toString() === courseId
      );

      console.log('User coursesPurchased before:', user.coursesPurchased);
      console.log('Already purchased check:', alreadyPurchased);

      if (!alreadyPurchased) {
        user.coursesPurchased.push(purchaseRecord);
        console.log('Course added to purchased courses:', courseId);
      }

      // Enroll user in course (for immediate access)
      if (!user.coursesEnrolled.includes(courseId)) {
        user.coursesEnrolled.push(courseId);
        console.log('User enrolled in course:', userId, courseId);
      }

      console.log('User coursesEnrolled before save:', user.coursesEnrolled);
      console.log('User coursesPurchased before save:', user.coursesPurchased);

      await user.save();

      console.log('User saved successfully. Updated user data:');
      console.log('- coursesEnrolled:', user.coursesEnrolled);
      console.log('- coursesPurchased:', user.coursesPurchased);

      // Generate PDF receipt and send purchase confirmation email
      try {
        const pdfBuffer = await generatePDFReceipt(user, course);
        await sendCoursePurchaseEmail(user, course, pdfBuffer, payment);
        console.log('Purchase confirmation email sent to:', user.email);
      } catch (emailError) {
        console.error('Error sending purchase confirmation email:', emailError);
        // Don't fail the payment if email fails
      }

      // Handle referral commission if applicable
      if (user.referredBy) {
        try {
          const referrer = await User.findById(user.referredBy);
          if (referrer && referrer.role === 'agent' && referrer.isActiveAgent) {
            const commissionPercentage = referrer.commissionRate || parseFloat(process.env.COMMISSION_PERCENTAGE || 10);
            const commissionAmount = (paymentIntent.amount / 100) * (commissionPercentage / 100);
          
            const commission = new Commission({
              agent: user.referredBy,
              referral: userId,
              payment: payment._id,
              amount: commissionAmount,
              originalAmount: paymentIntent.amount / 100,
              status: 'pending'
            });
          
            await commission.save();
            console.log('Commission record created:', commission._id);
          
            // Update payment record with commission info
            payment.commissionAmount = commissionAmount;
            payment.referralAgent = user.referredBy;
            await payment.save();
            console.log('Payment updated with commission info');
          
            await User.findByIdAndUpdate(user.referredBy, {
              $inc: {
                totalCommission: commissionAmount,
                totalReferrals: 1
              },
              $addToSet: { referrals: userId }
            });
            console.log('Referrer stats updated:', user.referredBy);
          }
        } catch (commissionError) {
          console.error('Error processing commission:', commissionError);
          // Don't fail the payment if commission processing fails
        }
      }

      console.log(`Payment processed successfully for user ${userId} for course ${courseId}`);
    } catch (err) {
      console.error('Error processing webhook:', err);
      return res.status(400).json({ error: err.message });
    }
  }

  // Handle payment_intent.payment_failed event
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    console.log('Payment failed:', paymentIntent.id);
    
    try {
      const { userId, courseId } = paymentIntent.metadata;
      
      // Log the failed payment
      const payment = new Payment({
        user: userId,
        course: courseId,
        amount: paymentIntent.amount / 100,
        paymentMethod: 'stripe',
        transactionId: paymentIntent.id,
        status: 'failed',
        referralAgent: null
      });

      await payment.save();
      console.log('Failed payment record created:', payment._id);
    } catch (err) {
      console.error('Error processing failed payment:', err);
    }
  }

  res.json({ received: true });
};

// @desc    Get user's payment history
// @route   GET /api/payments
// @access  Private
const getUserPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { user: req.user.userId };
    if (status) {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate('course', 'title description')
      .populate('referralAgent', 'username email')
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

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid payment ID'));
    }

    const payment = await Payment.findById(id)
      .populate('course', 'title description')
      .populate('user', 'username email')
      .populate('referralAgent', 'username email');

    if (!payment) {
      return res.status(404).json(createErrorResponse('Payment not found', 404));
    }

    // Check if user owns this payment or is admin
    if (payment.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Access denied', 403));
    }

    res.json(createSuccessResponse({ payment }));

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get payment statistics (Admin only)
// @route   GET /api/payments/stats/overview
// @access  Private (Admin only)
const getPaymentStats = async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({ status: 'completed' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const failedPayments = await Payment.countDocuments({ status: 'failed' });

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
      { $limit: 12 }
    ]);

    // Referral payment stats
    const referralPayments = await Payment.countDocuments({ 
      referralAgent: { $exists: true, $ne: null } 
    });

    const referralRevenue = await Payment.aggregate([
      { $match: { status: 'completed', referralAgent: { $exists: true, $ne: null } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json(createSuccessResponse({
      stats: {
        totalPayments,
        completedPayments,
        pendingPayments,
        failedPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue,
        referralPayments,
        referralRevenue: referralRevenue[0]?.total || 0
      }
    }));

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get user's commission earnings (for agents)
// @route   GET /api/payments/commissions
// @access  Private
const getUserCommissions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'agent') {
      return res.status(403).json(createErrorResponse('Agent access required', 403));
    }

    const { page = 1, limit = 10, status } = req.query;
    
    const query = { agent: user._id };
    if (status) {
      query.status = status;
    }

    const commissions = await Commission.find(query)
      .populate('referral', 'username email firstName lastName')
      .populate('payment', 'amount transactionId createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Commission.countDocuments(query);

    const totalEarnings = await Commission.aggregate([
      { $match: { agent: user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const paidEarnings = await Commission.aggregate([
      { $match: { agent: user._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pendingEarnings = await Commission.aggregate([
      { $match: { agent: user._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const pagination = generatePagination(page, limit, total);

    res.json(createSuccessResponse({
      commissions,
      pagination,
      earnings: {
        total: totalEarnings[0]?.total || 0,
        paid: paidEarnings[0]?.total || 0,
        pending: pendingEarnings[0]?.total || 0
      }
    }));

  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Process refund (Admin only)
// @route   POST /api/payments/refund
// @access  Private (Admin only)
const processRefund = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { paymentId, reason } = req.body;

    if (!isValidObjectId(paymentId)) {
      return res.status(400).json(createErrorResponse('Invalid payment ID'));
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json(createErrorResponse('Payment not found', 404));
    }

    if (payment.status !== 'completed') {
      return res.status(400).json(createErrorResponse('Payment is not completed'));
    }

    // Process refund through Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.transactionId,
      reason: 'requested_by_customer',
      metadata: {
        reason: reason,
        processedBy: req.user.userId
      }
    });

    // Update payment status
    payment.status = 'refunded';
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    await payment.save();

    // Handle commission reversal if applicable
    if (payment.referralAgent) {
      const commission = await Commission.findOne({ payment: payment._id });
      if (commission && commission.status === 'pending') {
        commission.status = 'cancelled';
        commission.payoutNotes = `Refunded: ${reason}`;
        await commission.save();

        // Update agent's total commission
        await User.findByIdAndUpdate(payment.referralAgent, {
          $inc: { totalCommission: -commission.amount }
        });
      }
    }

    res.json(createSuccessResponse({
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    }, 'Refund processed successfully'));

  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Manual payment confirmation (for testing when webhook is not available)
// @route   POST /api/payments/manual-confirm
// @access  Private
const manualPaymentConfirm = async (req, res) => {
  try {
    const { paymentIntentId, courseId } = req.body;
    
    if (!paymentIntentId || !courseId) {
      return res.status(400).json(createErrorResponse('Payment intent ID and course ID are required'));
    }

    console.log('Manual payment confirmation:', { paymentIntentId, courseId });

    // Find the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log('Payment intent status:', paymentIntent.status);
    console.log('Payment intent amount:', paymentIntent.amount);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json(createErrorResponse('Payment not succeeded'));
    }

    const userId = req.user.userId;
    console.log('User ID from token:', userId);

    // Find user and course
    const user = await User.findById(userId);
    const course = await Course.findById(courseId);
    
    console.log('User found:', !!user);
    console.log('Course found:', !!course);
    
    if (!user || !course) {
      return res.status(404).json(createErrorResponse('User or course not found'));
    }

    console.log('User before update:', {
      coursesEnrolled: user.coursesEnrolled,
      coursesPurchased: user.coursesPurchased
    });

    // Check if payment already processed
    const existingPayment = await Payment.findOne({ 
      transactionId: paymentIntentId 
    });
    
    if (existingPayment) {
      return res.status(400).json(createErrorResponse('Payment already processed'));
    }

    // Create payment record
    const payment = new Payment({
      user: userId,
      course: courseId,
      amount: paymentIntent.amount / 100,
      paymentMethod: 'stripe',
      transactionId: paymentIntentId,
      status: 'completed',
      referralAgent: user.referredBy || null
    });

    await payment.save();

    // Create commission automatically if there's a referral agent
    if (user.referredBy) {
      try {
        console.log('Creating commission for referral agent:', user.referredBy);
        
        // Find the referral agent
        const referralAgent = await User.findById(user.referredBy);
        
        if (referralAgent && referralAgent.role === 'agent') {
          // Calculate commission amount
          const commissionAmount = (payment.amount * referralAgent.commissionRate / 100);
          
          console.log('Commission calculation:', {
            paymentAmount: payment.amount,
            commissionRate: referralAgent.commissionRate,
            commissionAmount: commissionAmount
          });

          // Create commission record
          const commission = new Commission({
            agent: user.referredBy,
            referral: userId,
            payment: payment._id,
            amount: commissionAmount,
            status: 'pending', // Start as pending until admin pays out
            commissionRate: referralAgent.commissionRate / 100,
            originalAmount: payment.amount,
            type: 'commission'
          });

          await commission.save();
          console.log('Commission created:', commission._id);

          // Update payment with commission status
          payment.commissionStatus = 'pending';
          await payment.save();
          console.log('Payment updated with commission status');
        }
      } catch (commissionError) {
        console.error('Error creating commission:', commissionError);
        // Don't fail the payment if commission creation fails
      }
    }

    // Add course to purchased courses
    const purchaseRecord = {
      courseId: courseId,
      purchasedAt: new Date(),
      accessExpires: null
    };

    const alreadyPurchased = user.coursesPurchased.some(purchase => 
      purchase.courseId.toString() === courseId
    );

    if (!alreadyPurchased) {
      user.coursesPurchased.push(purchaseRecord);
    }

    // Enroll user in course
    if (!user.coursesEnrolled.includes(courseId)) {
      user.coursesEnrolled.push(courseId);
    }

    await user.save();

    console.log('User after update:', {
      coursesEnrolled: user.coursesEnrolled,
      coursesPurchased: user.coursesPurchased
    });

    // Send email
    try {
      const pdfBuffer = await generatePDFReceipt(user, course);
      await sendCoursePurchaseEmail(user, course, pdfBuffer, payment);
      console.log('Purchase confirmation email sent successfully');
    } catch (emailError) {
      console.error('Error sending email:', emailError);
    }

    res.json(createSuccessResponse({ 
      message: 'Payment confirmed successfully',
      user: {
        coursesEnrolled: user.coursesEnrolled,
        coursesPurchased: user.coursesPurchased
      }
    }));

  } catch (error) {
    console.error('Manual payment confirmation error:', error);
    res.status(500).json(createErrorResponse('Server error'));
  }
};

// @desc    Debug endpoint to check user's purchase status
// @route   GET /api/payments/debug-user
// @access  Private
const debugUserPurchases = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).populate('coursesEnrolled coursesPurchased.courseId');
    
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found'));
    }
    
    res.json(createSuccessResponse({
      user: {
        _id: user._id,
        username: user.username,
        coursesEnrolled: user.coursesEnrolled,
        coursesPurchased: user.coursesPurchased,
        totalEnrolled: user.coursesEnrolled.length,
        totalPurchased: user.coursesPurchased.length
      }
    }));
  } catch (error) {
    console.error('Debug user purchases error:', error);
    res.status(500).json(createErrorResponse('Server error'));
  }
};

module.exports = {
  testWebhook,
  createPaymentIntent,
  handleWebhook,
  getUserPayments,
  getPaymentById,
  getPaymentStats,
  getUserCommissions,
  processRefund,
  manualPaymentConfirm,
  debugUserPurchases
}; 