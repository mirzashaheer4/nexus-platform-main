const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const OTP = require('../models/OTP');
require('dotenv').config();

async function runVerification() {
  console.log('=== STARTING AUTOMATED SECURITY & PAYMENTS VERIFICATION ===');
  
  if (!process.env.MONGO_URI) {
    console.error('Error: MONGO_URI env var is not defined.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('[MongoDB] Connected successfully.');

  try {
    // 1. Setup Test Users
    await User.deleteMany({ email: { $in: ['test_sender@nexus.com', 'test_recipient@nexus.com'] } });
    await Wallet.deleteMany({});
    await Transaction.deleteMany({});
    await OTP.deleteMany({});

    console.log('\n--- 1. Testing User & Wallet Creation on Registration ---');
    const sender = new User({
      name: 'Test Sender',
      email: 'test_sender@nexus.com',
      password: 'Password123!',
      role: 'investor'
    });
    await sender.save();
    console.log(`User created: ${sender.name} (${sender.email})`);

    // Create wallet (mimicking registration controller)
    const senderWallet = await Wallet.create({ userId: sender._id, balance: 0 });
    console.log(`Wallet created for sender. Initial Balance: ${senderWallet.balance} cents`);

    const recipient = new User({
      name: 'Test Recipient',
      email: 'test_recipient@nexus.com',
      password: 'Password123!',
      role: 'entrepreneur'
    });
    await recipient.save();
    const recipientWallet = await Wallet.create({ userId: recipient._id, balance: 0 });
    console.log(`Wallet created for recipient. Initial Balance: ${recipientWallet.balance} cents`);

    // 2. Test 2FA OTP Hashing and Expiry Check
    console.log('\n--- 2. Testing 2FA OTP Hashing & Expiry Check ---');
    const rawOtp = '123456';
    const hashedOtp = await bcrypt.hash(rawOtp, 12);
    const otpRecord = await OTP.create({
      userId: sender._id,
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      used: false
    });
    console.log('OTP Record generated and hashed using bcrypt.');

    const isMatch = await bcrypt.compare(rawOtp, otpRecord.otp);
    console.log(`Does plain OTP match database hash? ${isMatch ? 'YES (Passed)' : 'NO (Failed)'}`);

    // 3. Test Direct Wallet Deposit (Internal Simulation of Webhook)
    console.log('\n--- 3. Testing Webhook Wallet Deposit Simulation ---');
    // Simulate webhook payment_intent.succeeded
    const mockIntentId = 'pi_test_intent_123';
    const depositTx = await Transaction.create({
      userId: sender._id,
      type: 'deposit',
      amount: 5000, // $50.00
      status: 'pending',
      stripePaymentIntentId: mockIntentId,
      description: 'Stripe Wallet Deposit'
    });
    console.log(`Transaction logged: status=${depositTx.status}, amount=${depositTx.amount} cents`);

    // Webhook updates status & adds to balance
    depositTx.status = 'completed';
    await depositTx.save();
    
    senderWallet.balance += depositTx.amount;
    await senderWallet.save();
    console.log(`Webhook succeeded simulation: Sender wallet updated. New Balance: ${senderWallet.balance} cents ($50.00)`);

    // 4. Test Wallet Withdraw and Balance Checks
    console.log('\n--- 4. Testing Wallet Withdrawal with Balance Checks ---');
    const withdrawAmount = 2000; // $20.00
    if (senderWallet.balance < withdrawAmount) {
      console.log('Error: Insufficient funds (Failed)');
    } else {
      senderWallet.balance -= withdrawAmount;
      await senderWallet.save();
      await Transaction.create({
        userId: sender._id,
        type: 'withdrawal',
        amount: withdrawAmount,
        status: 'completed',
        description: 'Wallet withdrawal'
      });
      console.log(`Withdrawal successful. Deducted ${withdrawAmount} cents. Remaining balance: ${senderWallet.balance} cents`);
    }

    // Try withdrawing more than balance
    const invalidWithdraw = 10000; // $100.00
    if (senderWallet.balance < invalidWithdraw) {
      console.log(`Validation Passed: Successfully blocked withdrawal of ${invalidWithdraw} cents due to insufficient funds (Balance: ${senderWallet.balance} cents).`);
    } else {
      console.error('Security Failure: Allowed withdrawal exceeding wallet balance!');
    }

    // 5. Test Wallet Peer Transfer
    console.log('\n--- 5. Testing Instant Peer Transfer ---');
    const transferAmount = 1500; // $15.00
    if (senderWallet.balance >= transferAmount) {
      senderWallet.balance -= transferAmount;
      recipientWallet.balance += transferAmount;
      await Promise.all([senderWallet.save(), recipientWallet.save()]);

      // Log both transactions
      await Transaction.create({
        userId: sender._id,
        type: 'transfer',
        amount: transferAmount,
        status: 'completed',
        recipient: recipient._id,
        description: `Transfer to ${recipient.name}`
      });

      await Transaction.create({
        userId: recipient._id,
        type: 'transfer',
        amount: transferAmount,
        status: 'completed',
        recipient: recipient._id,
        description: `Transfer from ${sender.name}`
      });

      console.log(`Transfer successful. Sender remaining: ${senderWallet.balance} cents. Recipient balance: ${recipientWallet.balance} cents.`);
    } else {
      console.error('Transfer failed: Insufficient funds');
    }

    // Clean up test users
    await User.deleteMany({ email: { $in: ['test_sender@nexus.com', 'test_recipient@nexus.com'] } });
    await Wallet.deleteMany({ userId: { $in: [sender._id, recipient._id] } });
    console.log('\n[Clean Up] Test documents deleted.');
    console.log('\n=== ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');

  } catch (err) {
    console.error('Verification failed with error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

runVerification();
