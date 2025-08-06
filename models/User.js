const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v) {
        return /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  country: { type: String, required: true },
  role: { type: String, enum: ['user', 'agent', 'admin'], default: 'user' },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActiveAgent: { type: Boolean, default: false },
  agentApprovedAt: { type: Date },
  commissionRate: { type: Number, default: 10, min: 0, max: 100 }, // Custom commission rate
  bankDetails: {
    accountNumber: String,
    bankName: String,
    routingNumber: String,
    accountHolderName: String,
    swiftCode: String,
    iban: String,
    isVerified: { type: Boolean, default: false },
    verificationNotes: String,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  // Stripe Connect account for payouts
  stripeAccountId: String,
  stripeAccountStatus: { type: String, enum: ['pending', 'active', 'restricted', 'disabled'], default: 'pending' },
  coursesEnrolled: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  coursesPurchased: [{ 
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    purchasedAt: { type: Date, default: Date.now },
    accessExpires: Date 
  }],
  cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  // Referral tracking
  totalReferrals: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Hash password and generate referral code before saving
userSchema.pre('save', async function(next) {
  try {
    // Hash password if modified
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 12);
    }
    
    // Generate referral code if not already set
    if (!this.referralCode) {
      this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    next();
  } catch (error) {
    console.error('User pre-save error:', error);
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);