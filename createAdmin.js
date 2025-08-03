const mongoose = require('mongoose');
const User = require('./models/User');
const { hashPassword, generateReferralCode } = require('./Utils/utils');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/course-portal';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    const hashedPassword = await hashPassword('admin123');
    const referralCode = generateReferralCode();

    const adminUser = new User({
      username: 'admin',
      email: 'admin@courseportal.com',
      password: hashedPassword,
      role: 'admin',
      referralCode,
      firstName: 'Admin',
      lastName: 'User',
      isActiveAgent: true,
      agentApprovedAt: new Date()
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@courseportal.com');
    console.log('Password: admin123');
    console.log('Role: admin');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

createAdminUser(); 