const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
    },
    amount: {
      type: mongoose.Types.Decimal128,
    },
    status: String,
    qrText: String,
    objectId: String,
    uid: String,
    affiliate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Affiliate',
    },
    affiliateCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AffiliateCustomer',
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
