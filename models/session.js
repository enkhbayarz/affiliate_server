const mongoose = require('mongoose');

const sessionSchema = mongoose.Schema({
  token_type: String,
  refresh_expires_in: Number,
  refresh_token: String,
  access_token: String,
  expires_in: Number,
  createdAt: Number,
});

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
