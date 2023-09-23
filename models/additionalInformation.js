const mongoose = require('mongoose');

const additionalInformationSchema = mongoose.Schema(
  {
    attribute: String,
    value: String,
  },
  {
    timestamps: true,
  }
);

const AdditionalInformation = mongoose.model(
  'AdditionalInformation',
  additionalInformationSchema
);

module.exports = AdditionalInformation;
