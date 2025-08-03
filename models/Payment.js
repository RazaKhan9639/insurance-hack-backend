// const mongoose = require('mongoose');

// const PaymentSchema = new mongoose.Schema({
//     user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//     amount: { type: Number, required: true },
//     paymentMethod: { type: String, required: true },
//     transactionId: { type: String, required: true },
//     status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
//     referralAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     commissionEarned: { type: Number },
//     createdAt: { type: Date, default: Date.now }
//   });

// module.exports = mongoose.model('Payment', PaymentSchema);

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  paymentMethod: { type: String, required: true },
  stripePaymentId: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  referralAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  commissionAmount: { type: Number },
  commissionStatus: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);