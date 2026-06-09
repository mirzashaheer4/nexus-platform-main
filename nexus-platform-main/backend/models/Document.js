const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  signature: { type: String },
  status: { type: String, enum: ['draft', 'signed', 'final'], default: 'draft' },
  version: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
