const fs = require('fs');
const path = require('path');

const envContent = `# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/course-portal

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=30d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Commission Configuration
COMMISSION_PERCENTAGE=10
`;

const envPath = path.join(__dirname, '.env');

try {
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
    console.log('📝 Please update the following values in .env:');
    console.log('   - MONGODB_URI (if using different MongoDB setup)');
    console.log('   - JWT_SECRET (change to a secure random string)');
  } else {
    console.log('⚠️  .env file already exists. Skipping creation.');
  }
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
} 