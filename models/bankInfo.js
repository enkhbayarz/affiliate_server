const mongoose = require('mongoose');

const bankInfoSchema = mongoose.Schema(
  {
    accountName: String,
    accountNumber: String,
    bankId: String,
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
  },
  {
    timestamps: true,
  }
);

const BankInfo = mongoose.model('BankInfo', bankInfoSchema);

module.exports = BankInfo;
