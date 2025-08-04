const mongoose = require('mongoose');

const CommissionSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for payouts
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }, // Optional for payouts
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paidAt: { type: Date },
  // Additional tracking fields
  commissionRate: { type: Number, default: 0.1 }, // 10% default
  originalAmount: { type: Number }, // Original payment amount (optional for payouts)
  // Payout tracking
  payoutMethod: { type: String, enum: ['bank_transfer', 'stripe_payout', 'manual', 'paypal'], default: 'manual' },
  payoutReference: { type: String },
  payoutNotes: { type: String },
  adminNotes: { type: String }, // Admin notes for payouts
  // Type of commission record
  type: { type: String, enum: ['commission', 'payout'], default: 'commission' },
  // Admin tracking
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
CommissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Commission', CommissionSchema);