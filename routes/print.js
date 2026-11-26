const express = require('express');
const PrintConfig = require('../models/PrintConfig');
const { quote } = require('../services/printPricing');
const { requireAuth, requireRole } = require('../middleware/auth');
const staffOnly = [requireAuth, requireRole('PrintStaff', 'SuperAdmin')];

const router = express.Router();

const EDITABLE = ['paperSizes', 'paperTypes', 'bindings', 'priceTiers', 'duplexMultiplier'];

// staff send the whole list, so removing an option = leave it out
function configError(b) {
  for (const k of ['paperSizes', 'paperTypes', 'bindings']) {
    if (b[k] === undefined) continue;
    if (!Array.isArray(b[k])) return `${k} must be an array`;
    if (k !== 'bindings' && !b[k].length) return `${k} cannot be empty`;
    const codes = b[k].map((x) => String(x && x.code));
    if (new Set(codes).size !== codes.length) return `${k} has duplicate code`;
  }
  // without a minPages 1 tier a small job has no price
  if (b.priceTiers !== undefined) {
    if (!Array.isArray(b.priceTiers) || !b.priceTiers.some((t) => t && t.minPages === 1)) {
      return 'priceTiers needs a tier with minPages 1';
    }
  }
  return null;
}

// QUOTE - public, print form calls it on every option change
router.post('/quote', async (req, res) => {
  try {
    const body = req.body || {}; // express 5 leaves req.body undefined when no body sent
    const result = quote(await PrintConfig.current(), body.pageCount, body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CONFIG read - public, form needs it to draw the options
router.get('/config', async (req, res) => {
  try {
    res.json(await PrintConfig.current());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CONFIG edit
router.put('/config', staffOnly, async (req, res) => {
  try {
    const body = req.body || {};
    const update = {};
    for (const k of EDITABLE) if (body[k] !== undefined) update[k] = body[k];
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update' });

    const msg = configError(update);
    if (msg) return res.status(400).json({ error: msg });

    // save() not findOneAndUpdate - runs full validation on every list entry
    const cfg = await PrintConfig.current();
    cfg.set(update);
    await cfg.save();
    res.json(cfg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;