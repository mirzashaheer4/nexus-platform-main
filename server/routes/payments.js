const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'dummy_key');
const verifyToken = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

const router = express.Router();

// Helper validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return res.status(400).json({ errors: errors.array() });
  };
};

/**
 * @swagger
 * /api/payments/create-intent:
 *   post:
 *     summary: Create a Stripe PaymentIntent for deposit
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Amount in cents to deposit
 *     responses:
 *       200:
 *         description: PaymentIntent created successfully
 *       400:
 *         description: Validation or Stripe error
 */
router.post(
  '/create-intent',
  verifyToken,
  validate([
    body('amount').isInt({ min: 50 }).withMessage('Minimum deposit is 50 cents ($0.50).')
  ]),
  async (req, res) => {
    const { amount } = req.body;

    try {
      // Create Stripe PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: { userId: req.user.id }
      });

      // Save a pending Transaction
      const transaction = new Transaction({
        userId: req.user.id,
        type: 'deposit',
        amount,
        currency: 'usd',
        status: 'pending',
        stripePaymentIntentId: paymentIntent.id,
        description: 'Stripe Wallet Deposit'
      });
      await transaction.save();

      res.json({
        clientSecret: paymentIntent.client_secret,
        stripePaymentIntentId: paymentIntent.id
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

/**
 * @swagger
 * /api/payments/confirm/{intentId}:
 *   post:
 *     summary: Check/confirm Transaction status after frontend payment confirmation
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: intentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction retrieved and status returned
 *       404:
 *         description: Transaction not found
 */
router.post('/confirm/:intentId', verifyToken, async (req, res) => {
  const transaction = await Transaction.findOne({
    stripePaymentIntentId: req.params.intentId,
    userId: req.user.id
  });

  if (!transaction) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  res.json({ status: transaction.status, transaction });
});

/**
 * @swagger
 * /api/payments/withdraw:
 *   post:
 *     summary: Withdraw funds from user wallet (internal deduction)
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Amount in cents to withdraw
 *     responses:
 *       200:
 *         description: Withdrawal successful
 *       400:
 *         description: Insufficient funds or validation error
 */
router.post(
  '/withdraw',
  verifyToken,
  validate([
    body('amount').isInt({ min: 1 }).withMessage('Withdrawal amount must be at least 1 cent.')
  ]),
  async (req, res) => {
    const { amount } = req.body;

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Deduct balance
    wallet.balance -= amount;
    await wallet.save();

    // Log withdrawal transaction
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'withdrawal',
      amount,
      status: 'completed',
      description: 'Wallet withdrawal'
    });
    await transaction.save();

    res.json({ message: 'Withdrawal successful', balance: wallet.balance });
  }
);

/**
 * @swagger
 * /api/payments/transfer:
 *   post:
 *     summary: Transfer funds internally to another user
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientEmail
 *               - amount
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 description: Email address of the recipient user
 *               amount:
 *                 type: integer
 *                 description: Amount in cents to transfer
 *     responses:
 *       200:
 *         description: Transfer successful
 *       400:
 *         description: Insufficient balance or validation error
 *       404:
 *         description: Recipient not found
 */
router.post(
  '/transfer',
  verifyToken,
  validate([
    body('recipientEmail').isEmail().normalizeEmail().withMessage('Valid recipient email required.'),
    body('amount').isInt({ min: 1 }).withMessage('Transfer amount must be at least 1 cent.')
  ]),
  async (req, res) => {
    const { recipientEmail, amount } = req.body;

    const senderWallet = await Wallet.findOne({ userId: req.user.id });
    if (!senderWallet || senderWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    if (recipient._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot transfer funds to yourself.' });
    }

    let recipientWallet = await Wallet.findOne({ userId: recipient._id });
    if (!recipientWallet) {
      recipientWallet = await Wallet.create({ userId: recipient._id, balance: 0 });
    }

    // Process Transfer
    senderWallet.balance -= amount;
    recipientWallet.balance += amount;
    await Promise.all([senderWallet.save(), recipientWallet.save()]);

    const senderUser = await User.findById(req.user.id);

    // Log debit transaction for sender
    const debitTx = new Transaction({
      userId: req.user.id,
      type: 'transfer',
      amount,
      status: 'completed',
      recipient: recipient._id,
      description: `Transfer to ${recipient.name} (${recipient.email})`
    });

    // Log credit transaction for recipient
    const creditTx = new Transaction({
      userId: recipient._id,
      type: 'transfer',
      amount,
      status: 'completed',
      recipient: recipient._id,
      description: `Transfer from ${senderUser.name} (${senderUser.email})`
    });

    await Promise.all([debitTx.save(), creditTx.save()]);

    res.json({ message: 'Transfer successful', balance: senderWallet.balance });
  }
);

/**
 * @swagger
 * /api/payments/balance:
 *   get:
 *     summary: Get logged-in user's wallet balance
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance details
 */
router.get('/balance', verifyToken, async (req, res) => {
  let wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user.id, balance: 0 });
  }
  res.json({ balance: wallet.balance });
});

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Get logged-in user's transaction history
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get('/history', verifyToken, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .select('type amount status description createdAt');
  res.json(transactions);
});

/**
 * Stripe Webhook Handler (Fix 7)
 * Recieves callbacks from Stripe upon payment events.
 */
const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const transaction = await Transaction.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (transaction) {
      transaction.status = 'completed';
      await transaction.save();

      // Internally update wallet
      let wallet = await Wallet.findOne({ userId: transaction.userId });
      if (!wallet) {
        wallet = new Wallet({ userId: transaction.userId, balance: 0 });
      }
      wallet.balance += transaction.amount;
      await wallet.save();
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    const transaction = await Transaction.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (transaction) {
      transaction.status = 'failed';
      await transaction.save();
    }
  }

  res.json({ received: true });
};

module.exports = {
  router,
  stripeWebhookHandler
};
