const express = require('express');
const Stripe = require('stripe');
const { createLicense } = require('../lib/licensing');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('توقيع الويب هوك غير صالح:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const license = createLicense({
      email: session.customer_details ? session.customer_details.email : null,
      stripeCustomerId: session.customer,
      sessionId: session.id
    });
    console.log(`تم إنشاء ترخيص جديد: ${license.key} للعميل ${license.email || 'غير معروف'}`);
  }

  res.json({ received: true });
});

module.exports = router;
