const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const File = require('../models/File');
const PrintConfig = require('../models/PrintConfig');
const { quote } = require('../services/printPricing');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_QTY = 200;
const badId = (id) => typeof id !== 'string' || !mongoose.isValidObjectId(id);
const validQty = (q) => Number.isInteger(q) && q >= 1;

const unitPriceOf = (product, variant) =>
  Math.max(0, (product.salePrice || product.basePrice) + (variant ? variant.priceAdjustment : 0));

async function getCart(userId) {
  const found = await Cart.findOne({ userId });
  if (found) return found;
  try {
    return await Cart.create({ userId });
  } catch (err) {
    // double tap on first add - loser hits the unique userId, read the winner
    if (err.code === 11000) return Cart.findOne({ userId });
    throw err;
  }
}

// READ
router.get('/', async (req, res) => {
  try {
    res.json(await getCart(req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD souvenir
router.post('/items', async (req, res) => {
  try {
    const { productId, variantId, qty } = req.body || {};
    if (badId(productId)) return res.status(400).json({ error: 'Invalid productId' });
    if (!validQty(qty) || qty > MAX_QTY) return res.status(400).json({ error: `qty must be 1-${MAX_QTY}` });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.status !== 'Active') return res.status(409).json({ error: 'Product not available' });

    let variant = null;
    if (product.variants.length) {
      if (badId(variantId)) return res.status(400).json({ error: 'variantId required' });
      variant = product.variants.id(variantId);
      if (!variant) return res.status(404).json({ error: 'Variant not found' });
    } else if (variantId) {
      return res.status(400).json({ error: 'Product has no variants' });
    }

    const cart = await getCart(req.user.id);
    const same = cart.items.find((i) => i.kind === 'product'
      && String(i.productId) === String(product._id)
      && String(i.variantId || '') === String(variant ? variant._id : ''));

    // stock check counts what is already in the cart, not just this request
    const newQty = (same ? same.quantity : 0) + qty;
    if (newQty > MAX_QTY) return res.status(400).json({ error: `Max ${MAX_QTY} per item` });
    if (variant && newQty > variant.stockQuantity) {
      return res.status(409).json({ error: `Only ${variant.stockQuantity} in stock` });
    }

    const unitPrice = unitPriceOf(product, variant);
    if (same) {
      same.quantity = newQty;
      same.unitPrice = unitPrice;
      same.totalPrice = unitPrice * newQty;
    } else {
      cart.items.push({
        kind: 'product',
        productId: product._id,
        variantId: variant ? variant._id : undefined,
        name: product.name,
        sku: variant ? variant.sku : undefined,
        imageUrl: (variant && variant.imageUrl) || product.imageUrls[0],
        quantity: qty,
        unitPrice,
        totalPrice: unitPrice * qty
      });
    }
    await cart.save();
    res.status(201).json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD print job
router.post('/print-items', async (req, res) => {
  try {
    const body = req.body || {};
    if (badId(body.fileId)) return res.status(400).json({ error: 'Invalid fileId' });

    const file = await File.findById(body.fileId);
    // 404 for other people's files too - do not leak which ids exist
    if (!file || String(file.userId) !== req.user.id) {
      return res.status(404).json({ error: 'File not found' });
    }

    // pageCount from stored file, never from client - client could fake 1 page
    const q = quote(await PrintConfig.current(), file.pageCount, body);
    if (q.error) return res.status(400).json({ error: q.error });

    const cart = await getCart(req.user.id);
    cart.items.push({
      kind: 'print',
      fileId: file._id,
      fileName: file.fileName,
      pageCount: file.pageCount,
      specs: q.specs,
      quantity: q.copies,
      unitPrice: q.unitPrice,
      totalPrice: q.totalPrice
    });
    await cart.save();
    res.status(201).json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CHANGE qty
router.patch('/items/:id', async (req, res) => {
  try {
    if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const { qty } = req.body || {};
    if (!validQty(qty)) return res.status(400).json({ error: 'qty must be a whole number, 1 or more' });

    const cart = await getCart(req.user.id);
    const item = cart.items.id(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item.kind === 'print') {
      // copies move the price tier, so reprice from stored specs - unitPrice * qty would be wrong
      const q = quote(await PrintConfig.current(), item.pageCount, { ...item.toObject().specs, copies: qty });
      if (q.error) return res.status(409).json({ error: q.error + '. Remove item and add it again' });
      item.quantity = q.copies;
      item.unitPrice = q.unitPrice;
      item.totalPrice = q.totalPrice;
    } else {
      if (qty > MAX_QTY) return res.status(400).json({ error: `qty max ${MAX_QTY}` });
      const product = await Product.findById(item.productId);
      const variant = product && item.variantId ? product.variants.id(item.variantId) : null;
      if (!product || product.status !== 'Active' || (item.variantId && !variant)) {
        return res.status(409).json({ error: 'Product no longer available' });
      }
      if (variant && qty > variant.stockQuantity) {
        return res.status(409).json({ error: `Only ${variant.stockQuantity} in stock` });
      }
      item.quantity = qty;
      item.unitPrice = unitPriceOf(product, variant);
      item.totalPrice = item.unitPrice * qty;
    }
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVE
router.delete('/items/:id', async (req, res) => {
  try {
    if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const cart = await getCart(req.user.id);
    const item = cart.items.id(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    cart.items.pull(item._id);
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;