const mongoose = require('mongoose');
const Payment = require('./models/Payment');
const Commission = require('./models/Commission');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/course-portal', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixMissingCommissions = async () => {
  try {
    console.log('🔧 Fixing missing commission records...\n');

    // Find all payments with referral agents but no commission records
    const paymentsWithReferrals = await Payment.find({
      referralAgent: { $exists: true, $ne: null },
      status: 'completed'
    }).populate('referralAgent').populate('user');

    console.log(`Found ${paymentsWithReferrals.length} payments with referrals`);

    for (const payment of paymentsWithReferrals) {
      console.log(`\nProcessing payment: ${payment._id}`);
      console.log(`- User: ${payment.user.firstName} ${payment.user.lastName}`);
      console.log(`- Course: ${payment.course}`);
      console.log(`- Amount: £${payment.amount}`);
      console.log(`- Referral Agent: ${payment.referralAgent.firstName} ${payment.referralAgent.lastName}`);

      // Check if commission already exists
      const existingCommission = await Commission.findOne({
        payment: payment._id,
        agent: payment.referralAgent._id
      });

      if (existingCommission) {
        console.log('✅ Commission already exists for this payment');
        continue;
      }

      // Calculate commission
      const commissionRate = payment.referralAgent.commissionRate || 10;
      const commissionAmount = payment.amount * (commissionRate / 100);

      console.log(`- Commission Rate: ${commissionRate}%`);
      console.log(`- Commission Amount: £${commissionAmount}`);

      // Create commission record
      const commission = new Commission({
        agent: payment.referralAgent._id,
        referral: payment.user._id,
        payment: payment._id,
        amount: commissionAmount,
        originalAmount: payment.amount,
        status: 'pending'
      });

      await commission.save();
      console.log('✅ Commission record created');

      // Update payment with commission info
      payment.commissionAmount = commissionAmount;
      await payment.save();
      console.log('✅ Payment updated with commission info');

      // Update agent stats
      await User.findByIdAndUpdate(payment.referralAgent._id, {
        $inc: {
          totalCommission: commissionAmount,
          totalReferrals: 1
        },
        $addToSet: { referrals: payment.user._id }
      });
      console.log('✅ Agent stats updated');
    }

    console.log('\n✅ All missing commissions have been fixed!');

    // Display summary
    const totalCommissions = await Commission.countDocuments();
    const totalPayments = await Payment.countDocuments({ referralAgent: { $exists: true, $ne: null } });
    
    console.log('\n📊 SUMMARY:');
    console.log(`- Total Commission Records: ${totalCommissions}`);
    console.log(`- Total Referral Payments: ${totalPayments}`);

  } catch (error) {
    console.error('❌ Error fixing commissions:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the fix
fixMissingCommissions(); 