const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const reviewSchema = new mongoose.Schema({
    productId: { type: ObjectId, ref: 'Product', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    // pending until staff approves - only approved ones show on the web
    isApproved: { type: Boolean, default: false }
}, { timestamps: true });

// one review per user per product, also stops a double tap on Post
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);    