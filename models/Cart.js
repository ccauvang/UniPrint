const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const itemSchema = new mongoose.Schema({
  kind: { type: String, enum: ['product', 'print'], required: true },
  // product items
  productId: { type: ObjectId, ref: 'Product' },
  variantId: ObjectId,
  name: String,
  sku: String,
  imageUrl: String,
  // print items
  fileId: { type: ObjectId, ref: 'File' },
  fileName: String,
  pageCount: Number,
  specs: {
    paperSize: String,
    paperType: String,
    colorMode: String,
    printSide: String,
    binding: String,
    note: String
  },
  // = copies for print items; copies change the price tier, see PATCH in routes/cart.js
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 }
}, { id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true, unique: true },
  items: [itemSchema]
}, { timestamps: true, id: false });

// computed on read - stored totals would drift from items
cartSchema.virtual('totalQuantity').get(function () {
  return this.items.reduce((n, i) => n + i.quantity, 0);
});
cartSchema.virtual('subTotalAmount').get(function () {
  return this.items.reduce((n, i) => n + i.totalPrice, 0);
});
cartSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);    