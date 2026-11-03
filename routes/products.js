const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { requireAuth, requireRole } = require('../middleware/auth');
const staffOnly = [requireAuth, requireRole('StoreStaff', 'SuperAdmin')];

const router = express.Router();

const badId = (id) => !mongoose.isValidObjectId(id);

// CREATE
router.post('/', staffOnly, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ all (optional filter: ?isPrintable=true  ?status=Active)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.isPrintable) filter.isPrintable = req.query.isPrintable === 'true';
    if (req.query.status) filter.status = req.query.status;
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ one
router.get('/:id', async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

// UPDATE
router.put('/:id', staffOnly, async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', staffOnly, async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

module.exports = router;