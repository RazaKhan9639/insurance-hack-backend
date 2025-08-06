const mongoose = require('mongoose');
const Payment = require('./models/Payment');
const Course = require('./models/Course');

mongoose.connect('mongodb://localhost:27017/course-portal')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Check payments with courses
    const payments = await Payment.find().populate('course').limit(5);
    console.log('\n=== Payments with courses ===');
    payments.forEach(p => {
      console.log('Payment ID:', p._id);
      console.log('Course:', p.course ? p.course.title : 'NOT FOUND');
      console.log('Course ID:', p.course);
      console.log('---');
    });

    // Check all courses
    const courses = await Course.find().limit(5);
    console.log('\n=== Available courses ===');
    courses.forEach(c => {
      console.log('Course ID:', c._id);
      console.log('Course Title:', c.title);
      console.log('---');
    });

    // Check payments without courses
    const paymentsWithoutCourse = await Payment.find({ course: { $exists: false } });
    console.log('\n=== Payments without course field ===');
    console.log('Count:', paymentsWithoutCourse.length);

    const paymentsWithNullCourse = await Payment.find({ course: null });
    console.log('\n=== Payments with null course ===');
    console.log('Count:', paymentsWithNullCourse.length);

    mongoose.connection.close();
  })
  .catch(console.error); 