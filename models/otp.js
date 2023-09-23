const mongoose = require('mongoose');

const otpSchema = mongoose.Schema(
  {
    email: String,
    otpCode: String,
  },
  {
    timestamps: true,
    expires: '2m',
  }
);

const Otp = mongoose.model('Otp', otpSchema);

module.exports = Otp;
