const mongoose = require('mongoose');

const signupSchema = mongoose.Schema(
  {
    email: String,
    token: String,
  },
  {
    timestamps: true,
  }
);

const Signup = mongoose.model('Signup', signupSchema);

module.exports = Signup;
