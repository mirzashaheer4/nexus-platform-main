const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');

dotenv.config();

async function completePending() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const pendingDeposits = await Transaction.find({ type: 'deposit', status: 'pending' });
    console.log(`Found ${pendingDeposits.length} pending deposits.`);

    for (const tx of pendingDeposits) {
      tx.status = 'completed';
      await tx.save();

      // Update wallet balance
      let wallet = await Wallet.findOne({ userId: tx.userId });
      if (!wallet) {
        wallet = new Wallet({ userId: tx.userId, balance: 0 });
      }
      wallet.balance += tx.amount;
      await wallet.save();

      console.log(`Completed deposit of $${tx.amount / 100} for User ID ${tx.userId}.`);
    }

    console.log('All pending deposits completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error completing deposits:', err);
    process.exit(1);
  }
}

completePending();
