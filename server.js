require('dotenv').config();

const express = require('express');
const cors = require('cors');

const webhookRoutes = require('./routes/webhook');
const checkoutRoutes = require('./routes/checkout');
const analyzeRoutes = require('./routes/analyze');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

const REQUIRED_ENV = ['ANTHROPIC_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`متغيرات بيئة ناقصة: ${missing.join(', ')}. راجع .env.example`);
  process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
  console.warn('تحذير: Stripe غير مُهيّأ بالكامل — زر الشراء لن يعمل حتى تضيف STRIPE_SECRET_KEY و STRIPE_PRICE_ID.');
}

app.use(cors());
app.use('/', webhookRoutes);
app.use(express.json({ limit: '200kb' }));
app.use(express.static('public'));
app.use('/', checkoutRoutes);
app.use('/', analyzeRoutes);
app.use('/', adminRoutes);

app.get('/app', (req, res) => res.sendFile('app.html', { root: 'public' }));
app.get('/success', (req, res) => res.sendFile('success.html', { root: 'public' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Truthlens يعمل الآن على http://localhost:${PORT}`);
});
