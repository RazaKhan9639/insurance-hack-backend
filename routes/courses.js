const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollInCourse,
  getEnrolledCourses,
  getCourseContent
} = require('../controllers/courseController');
const upload = require('../middleware/upload');

// @route   GET /api/courses
// @desc    Get all courses
// @access  Public
router.get('/', getAllCourses);

// @route   GET /api/courses/enrolled
// @desc    Get user's enrolled courses
// @access  Private
router.get('/enrolled', authenticateToken, getEnrolledCourses);

// @route   GET /api/courses/:id
// @desc    Get course by ID
// @access  Public
router.get('/:id', getCourseById);

// @route   POST /api/courses
// @desc    Create a new course
// @access  Private (Admin only)
router.post(
  '/',
  authenticateToken,
  isAdmin,
  upload.single('pdf'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('duration').optional().isString(),
    body('level').optional().isString(),
    body('category').optional().isString(),
    body('image').optional().isURL().withMessage('Image must be a valid URL'),
    body('videoUrl').optional().isURL().withMessage('Video URL must be a valid URL'),
    body('pdfUrl').optional().isURL().withMessage('PDF URL must be a valid URL')
    // optional: validate videoUrl or pdfUrl if needed
  ],
  createCourse
);

// @route   PUT /api/courses/:id
// @desc    Update a course
// @access  Private (Admin only)
router.put('/:id', authenticateToken, isAdmin, [
  body('title').optional().notEmpty(),
  body('description').optional().notEmpty(),
  body('price').optional().isNumeric(),
  body('duration').optional().isString(),
  body('content').optional().isArray()
], updateCourse);

// @route   DELETE /api/courses/:id
// @desc    Delete a course
// @access  Private (Admin only)
router.delete('/:id', authenticateToken, isAdmin, deleteCourse);

// @route   POST /api/courses/:id/enroll
// @desc    Enroll in a course
// @access  Private
router.post('/:id/enroll', authenticateToken, enrollInCourse);

// @route   GET /api/courses/:id/content
// @desc    Get course content (for enrolled users)
// @access  Private
router.get('/:id/content', authenticateToken, getCourseContent);

module.exports = router; 