const mongoose = require('mongoose');

const affiliateSchema = mongoose.Schema(
  {
    status: String,
    type: String,
    uid: String,
    startDate: String,
    expireDate: String,
    commission: Number,
    link: String,
    affiliateCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AffiliateCustomer',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
    },
  },
  {
    timestamps: true,
  }
);

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

module.exports = Affiliate;
