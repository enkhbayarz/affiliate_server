const express = require('express');
let router = express.Router();

const { checkBasicAuth, verifyToken } = require('../middleware/token');
const logger = require('../log');
const { sendSuccess, sendError } = require('../utils/response');

const Merchant = require('../models/merchant');

router.get('/check/storename/:storeName', verifyToken, async (req, res) => {
  try {
    logger.info(`/GET /merchant/check/storename/:storeName START: `);

    const { storeName } = req.params;

    const foundMerchant = await Merchant.findOne({ storeName: storeName });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, {});
    }
    return sendSuccess(res, 'success', 200, { storeName });
  } catch (error) {
    logger.error(
      `/POST /merchant/check/storename/:storeName: ${error.message}`
    );
    sendError(res, error.message, 500);
  }
});

router.get('/list', checkBasicAuth, async (req, res) => {
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
