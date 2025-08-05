const mongoose = require('mongoose');

const PayoutRequestSchema = new mongoose.Schema({
  agent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'completed'], 
    default: 'pending' 
  },
  requestDate: { 
    type: Date, 
    default: Date.now 
  },
  processedDate: { 
    type: Date 
  },
  processedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['bank_transfer', 'stripe_payout', 'paypal', 'manual'], 
    default: 'bank_transfer' 
  },
  notes: { 
    type: String 
  },
  adminNotes: { 
    type: String 
  },
  rejectionReason: { 
    type: String 
  },
  // Commission IDs that are being paid out
  commissionIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Commission' 
  }],
  // Payout details
  payoutReference: { 
    type: String 
  },
  bankDetails: {
    accountNumber: String,
    bankName: String,
    routingNumber: String,
    accountHolderName: String,
    swiftCode: String,
    iban: String
  }
}, { timestamps: true });

// Update the updatedAt field before saving
PayoutRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PayoutRequest', PayoutRequestSchema); 