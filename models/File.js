const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileName: { type: String, required: true },
  storageId: { type: String, required: true },
  fileSize: { type: Number, required: true },
  pageCount: { type: Number, required: true }
}, { timestamps: { createdAt: 'uploadedAt', updatedAt: false } });

module.exports = mongoose.model('File', fileSchema);