const { body, validationResult } = require('express-validator');
const Course = require('../models/Course');
const User = require('../models/User');
const { 
  generatePagination,
  createErrorResponse,
  createSuccessResponse,
  isValidObjectId
} = require('../Utils/utils');

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
const getAllCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const courses = await Course.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Course.countDocuments(query);
    const pagination = generatePagination(page, limit, total);

    res.json(createSuccessResponse({
      courses,
      pagination
    }));

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get course by ID
// @route   GET /api/courses/:id
// @access  Public
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid course ID'));
    }

    const course = await Course.findById(id);
    
    if (!course) {
      return res.status(404).json(createErrorResponse('Course not found', 404));
    }

    res.json(createSuccessResponse({ course }));

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Create a new course
// @route   POST /api/courses
// @access  Private (Admin only)
const createCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const {
      title,
      description,
      price,
      duration,
      level,
      category,
      content,
      requirements,
      whatYouWillLearn,
      image,
      videoUrl,
      pdfUrl
    } = req.body;

    // ✅ No parsing needed
    const course = new Course({
      title,
      description,
      price,
      duration,
      level,
      category,
      content,
      requirements: requirements || [],
      whatYouWillLearn: whatYouWillLearn || [],
      image,
      videoUrl,
      pdfUrl
    });

    await course.save();

    res.status(201).json(createSuccessResponse({ course }, 'Course created successfully'));
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};


// @desc    Update a course
// @route   PUT /api/courses/:id
// @access  Private (Admin only)
const updateCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', 400, errors.array()));
    }

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid course ID'));
    }

    const course = await Course.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json(createErrorResponse('Course not found', 404));
    }

    res.json(createSuccessResponse({ course }, 'Course updated successfully'));

  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Delete a course
// @route   DELETE /api/courses/:id
// @access  Private (Admin only)
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid course ID'));
    }

    const course = await Course.findByIdAndDelete(id);

    if (!course) {
      return res.status(404).json(createErrorResponse('Course not found', 404));
    }

    res.json(createSuccessResponse({}, 'Course deleted successfully'));

  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Enroll in a course
// @route   POST /api/courses/:id/enroll
// @access  Private
const enrollInCourse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid course ID'));
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json(createErrorResponse('Course not found', 404));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    // Check if already enrolled
    if (user.coursesEnrolled.includes(course._id)) {
      return res.status(400).json(createErrorResponse('Already enrolled in this course'));
    }

    // Add course to user's enrolled courses
    user.coursesEnrolled.push(course._id);
    await user.save();

    res.json(createSuccessResponse({
      course: {
        id: course._id,
        title: course.title,
        description: course.description
      }
    }, 'Successfully enrolled in course'));

  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get user's enrolled courses
// @route   GET /api/courses/enrolled
// @access  Private
const getEnrolledCourses = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('coursesEnrolled', 'title description duration content');

    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    res.json(createSuccessResponse({ courses: user.coursesEnrolled }));

  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

// @desc    Get course content (for enrolled users)
// @route   GET /api/courses/:id/content
// @access  Private
const getCourseContent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json(createErrorResponse('Invalid course ID'));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json(createErrorResponse('Course not found', 404));
    }

    // Check if user is enrolled
    if (!user.coursesEnrolled.includes(course._id)) {
      return res.status(403).json(createErrorResponse('Not enrolled in this course', 403));
    }

    res.json(createSuccessResponse({ content: course.content }));

  } catch (error) {
    console.error('Get course content error:', error);
    res.status(500).json(createErrorResponse('Server error', 500));
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollInCourse,
  getEnrolledCourses,
  getCourseContent
}; 