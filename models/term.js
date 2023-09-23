const mongoose = require('mongoose');

const termSchema = mongoose.Schema(
  {
    title: String,
    description: String,
  },
  {
    timestamps: true,
  }
);

const Term = mongoose.model('Term', termSchema);

module.exports = Term;
