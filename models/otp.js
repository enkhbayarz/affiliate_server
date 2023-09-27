const mongoose = require('mongoose');

const otpSchema = mongoose.Schema(
  {
    email: String,
    otpCode: String,
  },
  {
    timestamps: true,
  }
);

const Otp = mongoose.model('Otp', otpSchema);

module.exports = Otp;
