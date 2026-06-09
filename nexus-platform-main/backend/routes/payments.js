const express = require('express');
const auth = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Transaction = require('../models/Transaction');
const router = express.Router();

router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    const { amount, toUser, type } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      metadata: { fromUser: req.user.id, toUser, type }
    });
    const transaction = new Transaction({
      fromUser: req.user.id,
      toUser,
      amount,
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      type
    });
    await transaction.save();
    res.json({ clientSecret: paymentIntent.client_secret, transactionId: transaction._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    await Transaction.findOneAndUpdate({ stripePaymentIntentId: paymentIntent.id }, { status: 'completed' });
  }
  res.json({ received: true });
});

router.get('/history', auth, async (req, res) => {
  const transactions = await Transaction.find({ $or: [{ fromUser: req.user.id }, { toUser: req.user.id }] }).populate('fromUser toUser', 'name email');
  res.json(transactions);
});

module.exports = router;
