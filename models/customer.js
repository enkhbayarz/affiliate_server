const mongoose = require('mongoose');

const customerSchema = mongoose.Schema(
  {
    email: String,
    username: String,
    password: String,
    name: String,
    profileImage: String,
    type: String,
    status: String,
    role: String,
    uid: String,
  },
  {
    timestamps: true,
  }
);

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
