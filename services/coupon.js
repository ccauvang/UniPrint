const Coupon = require('../models/Coupon');

// returns { error } or { discountAmount, totalAfterDiscount } - never throws, same idea as printPricing.quote
function evaluate(coupon, subTotal, now = new Date()) {
    if (!coupon || !coupon.isActive) return { error: 'Invalid coupon' };
    if (coupon.startDate && now < coupon.startDate) return { error: 'Coupon not started yet' };
    if (coupon.endDate && now > coupon.endDate) return { error: 'Coupon expired' };
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { error: 'Coupon used up' };
    if (subTotal < coupon.minOrderValue) return { error: `Min order ${coupon.minOrderValue} VND` };

    const raw = coupon.discountType === 'percent'
        ? Math.round(subTotal * coupon.discountValue / 100)
        : coupon.discountValue;
    // fixed coupon bigger than cart must not make total negative
    const discountAmount = Math.min(raw, subTotal);
    return { discountAmount, totalAfterDiscount: subTotal - discountAmount };
}

// atomic +1 - checkout calls this after evaluate(), two buyers on the last use cannot both win
function redeem(code) {
    return Coupon.findOneAndUpdate(
        { code, isActive: true, $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
        { $inc: { usedCount: 1 } },
        { new: true }
    );
}

module.exports = { evaluate, redeem };