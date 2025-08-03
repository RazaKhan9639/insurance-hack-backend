const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const courseRoutes = require('./courses');
const paymentRoutes = require('./payments');
const referralRoutes = require('./referrals');
const adminRoutes = require('./admin');

// Mount routes
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/payments', paymentRoutes);
router.use('/referrals', referralRoutes);
router.use('/admin', adminRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Course Portal API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
