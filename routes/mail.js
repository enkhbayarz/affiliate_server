const express = require('express');
let router = express.Router();
const { sendMail } = require('../utils/mail');
const { checkBasicAuth } = require('../middleware/token');
const logger = require('../log');
const { sendSuccess, sendError } = require('../utils/response');

router.post('/send', checkBasicAuth, async (req, res) => {
  try {
    logger.info(`/POST /mail/send START: `);

    const { email } = req.body;

    sendMail(email);

    sendSuccess(res, 'success', 200, { email });
  } catch (error) {
    logger.error(`/POST /mail/send ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

module.exports = router;
