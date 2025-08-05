const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentMethod: { type: String, enum: ['bank_transfer', 'stripe_payout', 'manual', 'paypal'], default: 'manual' },
  paymentReference: { type: String },
  notes: { type: String },
  adminNotes: { type: String },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
  completedAt: { type: Date },
  // Commission tracking
  commissionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commission' }], // Which commissions this payout covers
  totalCommissionsPaid: { type: Number }, // Total amount of commissions paid in this payout
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
PayoutSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Payout', PayoutSchema); 