const express = require('express');
let router = express.Router();

const { Merchant } = require('../models/index');

const { checkBasicAuth, verifyToken } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../log');
const { cacheMiddleware } = require('../middleware/cache');

router.get('/list', cacheMiddleware(3600), checkBasicAuth, async (req, res) => {
  try {
    logger.info(`/GET /merchant/list START: `);

    const merchantList = await Merchant.find({}, '_id');

    const list = merchantList.map((merchant) => merchant._id);

    return sendSuccess(res, 'success', 200, { list });
  } catch (error) {
    logger.error(`/POST /list: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

module.exports = router;
