const mongoose = require('mongoose');

// first item in each list = default when client sends nothing, keep A4 and 70gsm on top
const DEFAULTS = {
  paperSizes: [
    { code: 'A4', label: 'A4', multiplier: 1 },
    { code: 'A3', label: 'A3', multiplier: 2 },
    { code: 'A5', label: 'A5', multiplier: 0.6 }
  ],
  paperTypes: [
    { code: '70gsm', label: '70gsm', multiplier: 1 },
    { code: 'ford80', label: 'Ford 80gsm', multiplier: 1.2 },
    { code: 'couche200', label: 'Couche 200gsm', multiplier: 3 }
  ],
  bindings: [
    { code: 'staple', label: 'Staple', price: 1000 },
    { code: 'spiral', label: 'Spiral', price: 15000 },
    { code: 'hardcover', label: 'Gold-stamped hardcover', price: 80000 },
    { code: 'lamination', label: 'Lamination', price: 10000 }
  ],
  priceTiers: [
    { minPages: 1, bwPrice: 500, colorPrice: 2000 },
    { minPages: 50, bwPrice: 400, colorPrice: 1800 },
    { minPages: 200, bwPrice: 300, colorPrice: 1500 }
  ]
};

const multiplierSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true },
  label: String,
  multiplier: { type: Number, required: true, min: 0 }
}, { _id: false });

const bindingSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true },
  label: String,
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const tierSchema = new mongoose.Schema({
  minPages: { type: Number, required: true, min: 1 },
  bwPrice: { type: Number, required: true, min: 0 },
  colorPrice: { type: Number, required: true, min: 0 }
}, { _id: false });

const printConfigSchema = new mongoose.Schema({
  // fixed key + unique index = only one config doc can exist
  key: { type: String, default: 'default', unique: true },
  paperSizes: { type: [multiplierSchema], default: () => DEFAULTS.paperSizes },
  paperTypes: { type: [multiplierSchema], default: () => DEFAULTS.paperTypes },
  bindings: { type: [bindingSchema], default: () => DEFAULTS.bindings },
  priceTiers: { type: [tierSchema], default: () => DEFAULTS.priceTiers },
  duplexMultiplier: { type: Number, default: 0.9, min: 0 }
}, { timestamps: true });

printConfigSchema.statics.current = async function () {
  const found = await this.findOne({ key: 'default' });
  if (found) return found;
  try {
    return await this.create({});
  } catch (err) {
    // two first requests raced - loser hits the unique key, just read the winner
    if (err.code === 11000) return this.findOne({ key: 'default' });
    throw err;
  }
};

module.exports = mongoose.model('PrintConfig', printConfigSchema);