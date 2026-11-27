const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { requireAuth, requireRole } = require('../middleware/auth');
const staffOnly = [requireAuth, requireRole('StoreStaff', 'SuperAdmin')];

const router = express.Router();

const MAX_COMMENT = 1000;
const badId = (id) => !mongoose.isValidObjectId(id);

// recompute from approved reviews only - counters on product can never drift from the real list
async function syncRating(productId) {
    const [s] = await Review.aggregate([
        { $match: { productId, isApproved: true } },
        { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }
    ]);
    await Product.findByIdAndUpdate(productId, {
        averageRating: s ? Math.round(s.avg * 10) / 10 : 0,
        reviewCount: s ? s.n : 0
    });
}

// ADD review - starts pending
router.post('/products/:id/reviews', requireAuth, async (req, res) => {
    if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    try {
        const { rating, comment } = req.body || {};
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'rating must be a whole number 1-5' });
        }
        if (comment !== undefined && (typeof comment !== 'string' || comment.length > MAX_COMMENT)) {
            return res.status(400).json({ error: `comment must be text, max ${MAX_COMMENT} chars` });
        }

        const product = await Product.findById(req.params.id);
        if (!product || product.status === 'Inactive') return res.status(404).json({ error: 'Product not found' });

        const review = await Review.create({
            productId: product._id,
            userId: req.user.id,
            rating,
            comment: (comment || '').trim() || undefined
        });
        res.status(201).json(review);
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: 'You already reviewed this product' });
        res.status(500).json({ error: err.message });
    }
});

// LIST approved reviews of a product - public. plain array, product.js loadReviews expects that
router.get('/products/:id/reviews', async (req, res) => {
    if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const rows = await Review.find({ productId: req.params.id, isApproved: true })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'fullName') // name only, no email leak
            .lean();
        res.json(rows.map((r) => ({
            _id: r._id,
            userName: r.userId ? r.userId.fullName : 'Customer',
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STAFF list (extra) - staff need ids to approve. ?isApproved=false = pending queue
router.get('/reviews', staffOnly, async (req, res) => {
    try {
        const filter = {};
        if (req.query.isApproved !== undefined) filter.isApproved = req.query.isApproved === 'true';
        const rows = await Review.find(filter)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('userId', 'fullName')
            .populate('productId', 'name');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APPROVE - body optional, { "approved": false } hides it again
router.patch('/reviews/:id/approve', staffOnly, async (req, res) => {
    if (badId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    try {
        const approved = req.body && req.body.approved !== undefined ? req.body.approved : true;
        if (typeof approved !== 'boolean') return res.status(400).json({ error: 'approved must be true or false' });

        const review = await Review.findByIdAndUpdate(req.params.id, { isApproved: approved }, { new: true });
        if (!review) return res.status(404).json({ error: 'Not found' });
        await syncRating(review.productId);
        res.json(review);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;