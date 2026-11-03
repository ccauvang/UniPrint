const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phoneNumber: String,
  passwordHash: { type: String, required: true },
  avatarUrl: String,
  role: {
    type: String,
    enum: ['Client', 'PrintStaff', 'StoreStaff', 'SuperAdmin'],
    default: 'Client'
  },
  studentOrStaffCode: String,
  classCode: String,
  preferredPaymentMethod: String,
  rewardPoints: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date
}, { timestamps: true });

// never send passwordHash back to client
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);