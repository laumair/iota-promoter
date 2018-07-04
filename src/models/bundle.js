const mongoose = require('mongoose');

const BundleSchema = new mongoose.Schema({
  bundle: {
    type: String,
    trim: true,
    unique: true,
  },
  receivedAt: {
    type: Date,
    default: Date.now(),
  },
  promotionCount: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('Bundle', BundleSchema);
