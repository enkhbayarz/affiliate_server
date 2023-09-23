const mongoose = require('mongoose');

const optionSchema = mongoose.Schema(
  {
    price: {
      type: mongoose.Types.Decimal128,
    },
    duration: String,
    type: String,
  },
  {
    timestamps: true,
  }
);

const Option = mongoose.model('Option', optionSchema);

module.exports = Option;
