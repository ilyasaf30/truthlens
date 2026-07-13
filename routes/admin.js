const express = require('express');
const { listLicenses, createLicense } = require('../lib/licensing');

const router = express.Router();

function requireAdmin(req, res, next) {
  const key = req.header('X-Admin-Key');
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'غير مصرح.' });
  }
  next();
}

router.get('/api/admin/licenses', requireAdmin, (req, res) => {
  const licenses = listLicenses().map(l => ({
    key: l.key,
    email: l.email,
    createdAt: l.createdAt,
    active: l.active,
    quota: l.quota,
    usedThisMonth: l.usage.count
  }));
  res.json({ total: licenses.length, licenses });
});

router.post('/api/admin/licenses/create', requireAdmin, express.json(), (req, res) => {
  const email = (req.body && req.body.email) || null;
  const license = createLicense({ email });
  res.json({ key: license.key, email: license.email, quota: license.quota });
});

module.exports = router;
