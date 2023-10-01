const express = require('express');
let router = express.Router();

const { Otp } = require('../models/index');

const { sendMailOtp } = require('../utils/mail');
const { checkBasicAuth } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../log');

router.post('/send', checkBasicAuth, async (req, res) => {
  try {
    logger.info(`/POST /otp/send START: `);

    const { email } = req.body;

    const otpCode = Math.floor(100000 + Math.random() * 900000);

    let foundOtp = await Otp.findOne({ email: email });

    if (foundOtp) {
      foundOtp.otpCode = otpCode;
      await foundOtp.save();
    } else {
      const newOtp = new Otp({
        email: email,
        otpCode: otpCode,
      });

      await newOtp.save();
    }

    sendMailOtp(email, otpCode);

    const currentTimestamp = new Date().getTime();

    const expires_in = currentTimestamp + 2 * 60 * 1000;

    sendSuccess(res, 'success', 200, { expires_in });
  } catch (error) {
    logger.error(`/POST /otp/send ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

module.exports = router;
