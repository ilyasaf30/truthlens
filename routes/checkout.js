const express = require('express');
const Stripe = require('stripe');
const { getLicenseBySession } = require('../lib/licensing');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

router.get('/checkout', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return res.status(500).send('لم يتم إعداد Stripe بعد. راجع ملف .env و README.');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/`,
      billing_address_collection: 'auto'
    });

    return res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).send('تعذّر إنشاء جلسة الدفع. حاول لاحقًا.');
  }
});

router.get('/api/price', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return res.json({ configured: false });
  }
  try {
    const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
    return res.json({
      configured: true,
      amount: price.unit_amount,
      currency: price.currency
    });
  } catch (err) {
    console.error('Stripe price fetch error:', err);
    return res.json({ configured: false });
  }
});

router.get('/api/checkout/session/:id', (req, res) => {
  const license = getLicenseBySession(req.params.id);
  if (!license) {
    return res.status(202).json({ pending: true });
  }
  return res.json({ licenseKey: license.key });
});

module.exports = router;
