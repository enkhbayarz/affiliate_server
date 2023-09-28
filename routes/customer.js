const express = require('express');
let router = express.Router();

const {
  Customer,
  Merchant,
  Affiliate,
  AffiliateCustomer,
  BankInfo,
} = require('../models/index');

const logger = require('../log');
const { sendSuccess, sendError } = require('../utils/response');
const { verifyToken } = require('../middleware/token');

//Customer

//Get Customer
router.get('/', verifyToken, async (req, res) => {
  try {
    logger.info(`/GET /customer START:`);
    return sendSuccess(res, 'success', 200, req.customer);
  } catch (error) {
    logger.error(`/GET /customer ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//TODO ???
router.get('/check/email/:email', verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    logger.info(`/GET /customer/check/email/:email START: ${email}`);

    const customer = req.customer;
    const merchant = await Merchant.findOne({ customer: customer });

    if (!merchant) {
      return sendError(
        res,
        'Can not add affiliate. You have to add product first',
        404
      );
    }

    const foundCustomer = await Customer.findOne({ email: email });

    if (!foundCustomer) {
      return sendError(res, 'Customer not found', 404);
    }

    const affiliateCustomer = await AffiliateCustomer.findOne({
      customer: foundCustomer,
    });

    const foundAffiliates = await Affiliate.find({
      merchant: merchant,
      affiliateCustomer: affiliateCustomer,
    }).select('product');

    if (!foundAffiliates) {
      return sendSuccess(res, 'success', 200, []);
    }

    return sendSuccess(res, 'success', 200, foundAffiliates);
  } catch (error) {
    logger.error(`/GET /customer ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.post('/bankInfo', verifyToken, async (req, res) => {
  try {
    logger.info(`/POST /customer/bankInfo START: `);
    const customer = req.customer;

    const { accountName, accountNumber, bankId } = req.body;

    const bankInfo = new BankInfo();
    bankInfo.accountName = accountName;
    bankInfo.accountNumber = accountNumber;
    bankInfo.bankId = bankId;
    bankInfo.customer = customer;

    await bankInfo.save();

    return sendSuccess(res, 'success', 200, { bankInfo });
  } catch (error) {
    logger.error(`/POST /customer/bankInfo ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

module.exports = router;
