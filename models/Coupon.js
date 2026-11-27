const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    // empty = unlimited
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// cross-field rules live here - a field validator cannot see the other fields
couponSchema.pre('validate', function () {
    if (this.discountValue != null && !(this.discountValue > 0)) {
        this.invalidate('discountValue', 'discountValue must be above 0');
    }
    if (this.discountType === 'percent' && this.discountValue > 100) {
        this.invalidate('discountValue', 'percent max 100');
    }
    if (this.startDate && this.endDate && this.endDate < this.startDate) {
        this.invalidate('endDate', 'endDate is before startDate');
    }
});

module.exports = mongoose.model('Coupon', couponSchema);