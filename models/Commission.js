const mongoose = require('mongoose');

const CommissionSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paidAt: { type: Date },
  // Commission tracking
  commissionRate: { type: Number, default: 0.1 }, // 10% default
  originalAmount: { type: Number, required: true }, // Original payment amount
  // Payout tracking
  payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout' }, // Reference to payout that paid this commission
  adminNotes: { type: String }, // Admin notes for this commission
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
CommissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Commission', CommissionSchema);