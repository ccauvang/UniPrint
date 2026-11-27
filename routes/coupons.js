const express = require('express');
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const { evaluate } = require('../services/coupon');
const { requireAuth, requireRole } = require('../middleware/auth');
const staffOnly = [requireAuth, requireRole('StoreStaff', 'SuperAdmin')];

const router = express.Router();

const badId = (id) => !mongoose.isValidObjectId(id);

// whitelist - usedCount is server owned, never from body
const EDITABLE = ['code', 'description', 'discountType', 'discountValue', 'minOrderValue',
  'usageLimit', 'startDate', 'endDate', 'isActive'];

function pickFields(body) {
  const out = {};
  for (const k of EDITABLE) if (body && body[k] !== undefined) out[k] = body[k];
  return out;
}

function fail(res, err) {
  if (err.code === 11000) return res.status(409).json({ error: 'Coupon code already exists' });
  res.status(400).json({ error: err.message });
}

// VALIDATE - any logged in user. amount comes from their own cart, never from the client
router.post('/validate', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'code required' });

    const cart = await Cart.findOne({ userId: req.user.id });
    const subTotal = cart ? cart.subTotalAmount : 0;
    if (!subTotal) return res.status(400).json({ error: 'Cart is empty' });

    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
    const r = evaluate(coupon, subTotal);
    if (r.error) return res.status(400).json({ error: r.error });

    res.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      subTotalAmount: subTotal,
      ...r
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE
router.post('/', staffOnly, async (req, res) => {
  try {
    res.status(201).json(await Coupon.create(pickFields(req.body)));
  } catch (err) {
    fail(res, err);
  }
});

// READ all
router.get('/', staffOnly, async (req, res) => {
  try {
    res.json(await Coupon.find().sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ one
router.get('/:id', staffOnly, async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Not found' });
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
router.put('/:id', staffOnly, async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const update = pickFields(req.body);
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update' });

    // save() not findByIdAndUpdate - pre('validate') needs the whole doc to check percent <= 100 and dates
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Not found' });
    coupon.set(update);
    await coupon.save();
    res.json(coupon);
  } catch (err) {
    fail(res, err);
  }
});

// DELETE
router.delete('/:id', staffOnly, async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;