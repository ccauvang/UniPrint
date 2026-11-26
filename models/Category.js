const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // unique slug also blocks "Mug" vs "mug" duplicates, a unique name index would not
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: String
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
