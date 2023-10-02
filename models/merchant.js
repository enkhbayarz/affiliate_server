const mongoose = require('mongoose');

const merchantSchema = mongoose.Schema(
  {
    storeName: String,
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      select: '-password',
    },
  },
  {
    timestamps: true,
  }
);

const Merchant = mongoose.model('Merchant', merchantSchema);

module.exports = Merchant;
