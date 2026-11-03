const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  size: String,
  color: String,
  priceAdjustment: { type: Number, default: 0 },
  stockQuantity: { type: Number, default: 0 },
  imageUrl: String
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  shortDescription: String,
  description: String,
  basePrice: { type: Number, required: true, min: 0 },
  salePrice: Number,
  imageUrls: [String],
  status: { type: String, enum: ['Active', 'OutOfStock', 'Inactive'], default: 'Active' },
  tags: [String],
  isPrintable: { type: Boolean, default: false },
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  variants: [variantSchema]
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);