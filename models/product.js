const mongoose = require('mongoose');

const productSchema = mongoose.Schema(
  {
    title: String,
    description: String,
    price: String,
    summary: String,
    uid: String,
    limit: Number,
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
    },
    additionalInformation: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdditionalInformation',
      },
    ],
    term: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Term',
    },
    coverImage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Image',
    },
    thumbnail: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Image',
    },
    option: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Option',
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
