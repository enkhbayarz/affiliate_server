const mongoose = require('mongoose');

const forgetPasswordSchema = mongoose.Schema(
  {
    email: String,
    uid: String,
  },
  {
    timestamps: true,
  }
);

const ForgetPassword = mongoose.model('ForgetPassword', forgetPasswordSchema);

module.exports = ForgetPassword;
