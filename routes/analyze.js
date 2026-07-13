const express = require('express');
const rateLimit = require('express-rate-limit');
const { checkAndConsume, getLicense } = require('../lib/licensing');

const router = express.Router();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'لقد تجاوزت الحد المسموح من الطلبات مؤقتًا. حاول بعد قليل.' }
});
router.use('/api/', limiter);

const SYSTEM_PROMPT = `أنت محلل متخصص في كشف علامات التضليل والتلاعب داخل النصوص الإخبارية والمنشورات. لا تحكم على صحة الحدث نفسه (فأنت لا تملك وصولاً لمصادر خارجية أو للحدث الفعلي)، بل حلل فقط الأسلوب، الصياغة، الادعاءات غير القابلة للتحقق، اللغة العاطفية أو التحريضية، غياب المصادر، والعلامات النمطية للمحتوى المصنّع أو المبالغ فيه.

أعد ردك بصيغة JSON فقط، بدون أي نص إضافي قبله أو بعده، وبدون علامات ماركداون، بالشكل التالي بالضبط:
{
  "confidence_level": "low" | "medium" | "high",
  "reasoning": "فقرة من 2-3 جمل بالعربية تشرح تقييمك العام",
  "red_flags": ["إشارة تحذير 1", "إشارة تحذير 2"],
  "verification_steps": ["خطوة تحقق يدوية 1", "خطوة تحقق يدوية 2"]
}

confidence_level يعني: "high" = النص لا يحمل إشارات تلاعب أسلوبية واضحة (لكن هذا لا يعني أن الحدث صحيح). "medium" = توجد بعض العلامات المثيرة للشك. "low" = النص مليء بإشارات التلاعب والتضليل الأسلوبية. اجعل red_flags و verification_steps من 3 إلى 5 عناصر كل واحدة، مختصرة وعملية بالعربية.`;

function requireLicense(req, res, next) {
  const key = req.header('X-License-Key');
  if (!key) return res.status(401).json({ error: 'مفتاح الترخيص مفقود. أدخل مفتاحك في التطبيق.' });

  const license = getLicense(key);
  if (!license) return res.status(401).json({ error: 'مفتاح الترخيص غير صالح.' });

  const result = checkAndConsume(key);
  if (!result.ok) return res.status(403).json({ error: result.reason });

  req.remainingQuota = result.remaining;
  next();
}

router.get('/api/license/verify', (req, res) => {
  const key = req.header('X-License-Key');
  const license = getLicense(key);
  if (!license || !license.active) {
    return res.status(401).json({ valid: false });
  }
  return res.json({
    valid: true,
    quota: license.quota,
    used: license.usage.count,
    remaining: license.quota - license.usage.count
  });
});

router.post('/api/analyze', requireLicense, async (req, res) => {
  const text = (req.body && req.body.text || '').toString().trim();

  if (!text) return res.status(400).json({ error: 'النص فارغ.' });
  if (text.length > 8000) return res.status(400).json({ error: 'النص طويل جدًا. الحد الأقصى 8000 حرف.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'فشل الاتصال بخدمة التحليل.' });
    }

    const data = await response.json();
    const textBlocks = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const cleaned = textBlocks.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse model output as JSON:', cleaned);
      return res.status(502).json({ error: 'تعذّر فهم رد المحلل.' });
    }

    parsed.remaining_quota = req.remainingQuota;
    return res.json(parsed);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم.' });
  }
});

module.exports = router;
