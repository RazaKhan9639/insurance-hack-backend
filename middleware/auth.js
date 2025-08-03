const { verifyToken, createErrorResponse } = require('../Utils/utils');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(createErrorResponse('Access token required', 401));
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json(createErrorResponse('Invalid token', 403));
  }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json(createErrorResponse('Admin access required', 403));
  }
  next();
};

// Middleware to check if user is agent
const isAgent = (req, res, next) => {
  if (req.user.role !== 'agent') {
    return res.status(403).json(createErrorResponse('Agent access required', 403));
  }
  next();
};

// Middleware to check if user is active agent
const isActiveAgent = (req, res, next) => {
  if (req.user.role !== 'agent' || !req.user.isActiveAgent) {
    return res.status(403).json(createErrorResponse('Active agent access required', 403));
  }
  next();
};

// Middleware to check if user owns resource or is admin
const isOwnerOrAdmin = (resourceUserId) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.userId === resourceUserId) {
      return next();
    }
    return res.status(403).json(createErrorResponse('Access denied', 403));
  };
};

module.exports = {
  authenticateToken,
  isAdmin,
  isAgent,
  isActiveAgent,
  isOwnerOrAdmin
}; 
