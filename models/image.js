const mongoose = require('mongoose');

const imageSchema = mongoose.Schema(
  {
    type: String,
    phone: String,
    tablet: String,
    desktop: String,
    thumb: String,
  },
  {
    timestamps: true,
  }
);

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
