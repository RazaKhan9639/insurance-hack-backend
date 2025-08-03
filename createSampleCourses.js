const mongoose = require('mongoose');
const Course = require('./models/Course');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/course-portal';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const sampleCourses = [
  {
    title: 'Complete Web Development Bootcamp',
    description: 'Learn HTML, CSS, JavaScript, React, Node.js and become a full-stack web developer. This comprehensive course covers everything from basics to advanced concepts.',
    price: 99.99,
    duration: '40 hours',
    level: 'Beginner to Advanced',
    category: 'Web Development',
    content: [
      'HTML5 Fundamentals',
      'CSS3 Styling and Layout',
      'JavaScript ES6+',
      'React.js Framework',
      'Node.js Backend Development',
      'Database Integration',
      'Deployment Strategies'
    ],
    requirements: [
      'Basic computer knowledge',
      'No programming experience required'
    ],
    whatYouWillLearn: [
      'Build responsive websites',
      'Create dynamic web applications',
      'Deploy applications to the cloud',
      'Work with databases',
      'Understand modern web technologies'
    ],
    rating: 4.8,
    reviews: 1250,
    image: 'https://source.unsplash.com/random?web-development'
  },
  {
    title: 'Python for Data Science',
    description: 'Master Python programming for data analysis, machine learning, and scientific computing. Learn pandas, numpy, matplotlib, and scikit-learn.',
    price: 79.99,
    duration: '35 hours',
    level: 'Intermediate',
    category: 'Data Science',
    content: [
      'Python Fundamentals',
      'Data Manipulation with Pandas',
      'Numerical Computing with NumPy',
      'Data Visualization with Matplotlib',
      'Machine Learning with Scikit-learn',
      'Statistical Analysis',
      'Real-world Projects'
    ],
    requirements: [
      'Basic programming concepts',
      'High school mathematics'
    ],
    whatYouWillLearn: [
      'Analyze large datasets',
      'Create data visualizations',
      'Build machine learning models',
      'Perform statistical analysis',
      'Work with real-world data'
    ],
    rating: 4.7,
    reviews: 890,
    image: 'https://source.unsplash.com/random?python-data'
  },
  {
    title: 'Digital Marketing Masterclass',
    description: 'Learn modern digital marketing strategies including SEO, social media marketing, email marketing, and content marketing to grow your business.',
    price: 69.99,
    duration: '25 hours',
    level: 'Beginner to Intermediate',
    category: 'Marketing',
    content: [
      'SEO Fundamentals',
      'Social Media Marketing',
      'Email Marketing Campaigns',
      'Content Marketing Strategy',
      'Google Ads and Analytics',
      'Conversion Optimization',
      'Marketing Automation'
    ],
    requirements: [
      'Basic computer skills',
      'Interest in marketing'
    ],
    whatYouWillLearn: [
      'Optimize websites for search engines',
      'Create engaging social media content',
      'Build email marketing campaigns',
      'Analyze marketing performance',
      'Develop comprehensive marketing strategies'
    ],
    rating: 4.6,
    reviews: 650,
    image: 'https://source.unsplash.com/random?digital-marketing'
  },
  {
    title: 'Mobile App Development with React Native',
    description: 'Build cross-platform mobile applications using React Native. Learn to create apps for both iOS and Android with a single codebase.',
    price: 89.99,
    duration: '30 hours',
    level: 'Intermediate',
    category: 'Mobile Development',
    content: [
      'React Native Fundamentals',
      'Navigation and Routing',
      'State Management with Redux',
      'API Integration',
      'Native Module Integration',
      'Testing and Debugging',
      'App Store Deployment'
    ],
    requirements: [
      'Basic JavaScript knowledge',
      'Understanding of React concepts'
    ],
    whatYouWillLearn: [
      'Build cross-platform mobile apps',
      'Integrate with device features',
      'Handle app state management',
      'Deploy to app stores',
      'Test and debug mobile applications'
    ],
    rating: 4.5,
    reviews: 420,
    image: 'https://source.unsplash.com/random?mobile-app'
  },
  {
    title: 'AWS Cloud Practitioner Certification',
    description: 'Prepare for the AWS Certified Cloud Practitioner exam. Learn AWS fundamentals, services, security, and best practices.',
    price: 59.99,
    duration: '20 hours',
    level: 'Beginner',
    category: 'Cloud Computing',
    content: [
      'AWS Fundamentals',
      'Core AWS Services',
      'Security and Compliance',
      'Pricing and Billing',
      'Architecture Best Practices',
      'Exam Preparation',
      'Practice Tests'
    ],
    requirements: [
      'Basic IT knowledge',
      'No AWS experience required'
    ],
    whatYouWillLearn: [
      'Understand AWS services and concepts',
      'Implement security best practices',
      'Optimize costs and performance',
      'Prepare for certification exam',
      'Navigate AWS console effectively'
    ],
    rating: 4.4,
    reviews: 320,
    image: 'https://source.unsplash.com/random?aws-cloud'
  }
];

const createSampleCourses = async () => {
  try {
    // Check if courses already exist
    const existingCourses = await Course.countDocuments();
    if (existingCourses > 0) {
      console.log(`${existingCourses} courses already exist in the database.`);
      return;
    }

    // Create sample courses
    const createdCourses = await Course.insertMany(sampleCourses);
    console.log(`${createdCourses.length} sample courses created successfully!`);
    
    createdCourses.forEach(course => {
      console.log(`- ${course.title} ($${course.price})`);
    });

  } catch (error) {
    console.error('Error creating sample courses:', error);
  } finally {
    mongoose.connection.close();
  }
};

createSampleCourses(); 