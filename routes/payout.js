const express = require('express');
let router = express.Router();

const Affiliate = require('../models/affiliate');
const Customer = require('../models/customer');
const Product = require('../models/product');
const Merchant = require('../models/merchant');
const AffiliateCustomer = require('../models/affiliateCustomer');
const Transaction = require('../models/transaction');

const { verifyToken } = require('../middleware/token');
const logger = require('../log');
const { sendSuccess, sendError } = require('../utils/response');

//Payout

//Get Payout
router.get('/', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /payout START: ${JSON.stringify(foundCustomer)}`);

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, {});
    }

    const transactionAmount = await Transaction.aggregate([
      {
        $match: {
          merchant: foundMerchant._id,
          status: 'NEW',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: { $toDouble: '$amount' },
          },
        },
      },
    ]).exec();

    return sendSuccess(res, 'success', 200, { transactionAmount });
  } catch (error) {
    logger.error(`/GET /payout ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
