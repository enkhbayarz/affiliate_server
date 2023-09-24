const express = require('express');
let router = express.Router();
const Customer = require('../models/customer');

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

router.get('/check/email/:email', verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    logger.info(`/GET /customer/check/email/:email START: ${email}`);

    const foundCustomer = await Customer.findOne({ email: email });

    if (!foundCustomer) {
      return sendError(res, 'Customer not found', 404);
    }

    return sendSuccess(res, 'success', 200, 'true');
  } catch (error) {
    logger.error(`/GET /customer ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
