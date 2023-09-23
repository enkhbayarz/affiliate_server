const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
  {
    username: String,
    password: String,
    role: String,
    status: String,
    uid: String,
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
