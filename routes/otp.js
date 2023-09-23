const express = require('express');
let router = express.Router();
const { sendMailOtp } = require('../utils/mail');
const { checkBasicAuth } = require('../middleware/token');
const logger = require('../log');
const { sendSuccess, sendError } = require('../utils/response');
const Otp = require('../models/otp');

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

    sendSuccess(res, 'success', 200, { foundOtp });
  } catch (error) {
    logger.error(`/POST /otp/send ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

router.post('/check', checkBasicAuth, async (req, res) => {
  try {
    logger.info(`/POST /otp/check START: `);

    const { email, otpCode } = req.body;

    const foundOtp = await Otp.findOne({ email: email });
    if (!foundOtp) {
      return sendError(res, 'otp not found', 404);
    }

    const currentTime = new Date();
    const timeDifference = currentTime - foundOtp.updatedAt;
    const timeDifferenceInSeconds = timeDifference / 1000;

    if (timeDifferenceInSeconds > 60) {
      return sendError(res, 'otp expired', 400);
    } else {
      if (foundOtp.otpCode == otpCode) {
        sendSuccess(res, 'success', 200, foundOtp);
      } else {
        return sendError(res, 'otp not match', 400);
      }
    }
  } catch (error) {
    logger.error(`/POST /otp/check ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

module.exports = router;
