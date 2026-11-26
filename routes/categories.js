const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { requireAuth, requireRole } = require('../middleware/auth');
const staffOnly = [requireAuth, requireRole('StoreStaff', 'SuperAdmin')];

const router = express.Router();

const badId = (id) => !mongoose.isValidObjectId(id);

// strip accents first - "Áo thun" becomes "ao-thun", and đ has no accent form so it needs its own replace
const slugify = (s) => s
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const validName = (n) => typeof n === 'string' && slugify(n) !== '';

function fail(res, err) {
  if (err.code === 11000) return res.status(409).json({ error: 'Category already exists' });
  res.status(400).json({ error: err.message });
}

// CREATE
router.post('/', staffOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!validName(name)) return res.status(400).json({ error: 'name required (letters or numbers)' });
    const category = await Category.create({ name, slug: slugify(name), description });
    res.status(201).json(category);
  } catch (err) {
    fail(res, err);
  }
});

// READ all
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ one
router.get('/:id', async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
router.put('/:id', staffOnly, async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    // whitelist - slug must follow name, never come straight from the body
    const update = {};
    if (req.body.name !== undefined) {
      if (!validName(req.body.name)) return res.status(400).json({ error: 'name needs letters or numbers' });
      update.name = req.body.name;
      update.slug = slugify(req.body.name);
    }
    if (req.body.description !== undefined) update.description = req.body.description;

    const category = await Category.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });
    if (!category) return res.status(404).json({ error: 'Not found' });
    res.json(category);
  } catch (err) {
    fail(res, err);
  }
});

// DELETE
router.delete('/:id', staffOnly, async (req, res) => {
  if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    // products would keep a dangling categoryId, so staff must move them first
    const used = await Product.countDocuments({ categoryId: req.params.id });
    if (used) return res.status(409).json({ error: `Category has ${used} product(s). Move them first` });

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
