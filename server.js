const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');

// Load env vars
dotenv.config();

// Initialize Express
const app = express();
console.log(process.env.MONGODB_URI);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/course-portal';
mongoose.connect(MONGODB_URI, {
  autoIndex: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const sanitizedBody = mongoSanitize.sanitize(req.body);
  const sanitizedParams = mongoSanitize.sanitize(req.params);

  if (sanitizedBody || sanitizedParams) {
    console.warn('Sanitization applied to incoming request.');
  }

  next();
});

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 1000, // Higher limit for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

// More lenient rate limiting for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 20000 : 2000, // Higher limit for development
  message: {
    success: false,
    message: 'Too many admin requests from this IP, please try again later.'
  }
});

// Apply rate limiting (disabled for development)
if (process.env.NODE_ENV === 'production') {
  app.use('/api', generalLimiter);
  app.use('/api/admin', adminLimiter);
}

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api', require('./routes/routes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});