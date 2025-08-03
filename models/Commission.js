const mongoose = require('mongoose');

const CommissionSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paidAt: { type: Date },
  // Additional tracking fields
  commissionRate: { type: Number, default: 0.1 }, // 10% default
  originalAmount: { type: Number, required: true }, // Original payment amount
  // Payout tracking
  payoutMethod: { type: String, enum: ['bank_transfer', 'stripe_payout', 'manual'], default: 'manual' },
  payoutReference: { type: String },
  payoutNotes: { type: String },
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