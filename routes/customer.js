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

module.exports = router;
