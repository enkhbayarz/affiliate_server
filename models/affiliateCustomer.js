const mongoose = require('mongoose');

const affiliateCustomerSchema = mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
  },
  {
    timestamps: true,
  }
);

const AffiliateCustomer = mongoose.model(
  'AffiliateCustomer',
  affiliateCustomerSchema
);

module.exports = AffiliateCustomer;
