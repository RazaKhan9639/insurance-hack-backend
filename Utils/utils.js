const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const getStream = require('get-stream');

// Generate referral code
const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Generate transaction ID
const generateTransactionId = () => {
  return 'TXN' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Calculate commission amount
const calculateCommission = (amount, rate = 0.1) => {
  return amount * rate;
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate pagination info
const generatePagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    currentPage: page,
    totalPages,
    total,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
};

// Sanitize user data (remove sensitive information)
const sanitizeUser = (user) => {
  const { password, ...sanitizedUser } = user.toObject();
  return sanitizedUser;
};

// Create error response
const createErrorResponse = (message, statusCode = 400) => {
  return {
    success: false,
    message,
    statusCode
  };
};

// Create success response
const createSuccessResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data
  };
};

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
  const ObjectId = require('mongoose').Types.ObjectId;
  return ObjectId.isValid(id);
};

// Get date range for filtering
const getDateRange = (period = 'month') => {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  return { startDate, endDate: now };
};

// Calculate percentage
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return ((value / total) * 100).toFixed(2);
};

// Format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Format date time
const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};



const generatePDFReceipt = async (user, course) => {
  const doc = new PDFDocument();
  doc.text(`Receipt for ${user.firstName} ${user.lastName}`);
  doc.text(`Course: ${course.title}`);
  doc.text(`Amount: £${course.price}`);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.end();
  return await getStream.buffer(doc);
};


module.exports = {
  generateReferralCode,
  generateTransactionId,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  calculateCommission,
  formatCurrency,
  isValidEmail,
  generatePagination,
  sanitizeUser,
  createErrorResponse,
  createSuccessResponse,
  isValidObjectId,
  getDateRange,
  calculatePercentage,
  formatDate,
  formatDateTime,
  generatePDFReceipt
};
