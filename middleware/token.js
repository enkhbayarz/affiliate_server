const jwt = require('jsonwebtoken');
const secretKey = `${process.env.SECRET_KEY}`;
const axios = require('axios');

const { Session, Customer } = require('../models/index');

const basicAuth = require('basic-auth');
const { sendSuccess, sendError } = require('../utils/response');

async function verifyToken(req, res, next) {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication failed', 401);
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, secretKey);

    const foundCustomer = await Customer.findById(decoded.id).select(
      '-password'
    );
    if (!foundCustomer) {
      return sendError(res, 'Customer not found!', 404);
    }

    req.customer = foundCustomer;
    next();
  } catch (error) {
    return sendError(res, 'Invalid token', 401);
  }
}

async function checkBasicAuth(req, res, next) {
  const unauthorized = (res) => {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };
  const user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  }

  const username = user.name;
  const password = user.pass;

  if (username === process.env.USERNAME && password === process.env.PASSWORD) {
    return next();
  } else {
    return unauthorized(res);
  }
}

async function fetchQpayToken(req, res, next) {
  try {
    const session = await Session.findById('650a9fdcee10c021e00d3b9b');

    if (new Date().getTime() > session.expires_in * 1000 + 15000) {
      const apiUrl = 'https://merchant-sandbox.qpay.mn/v2/auth/token';

      const username = 'TEST_MERCHANT';
      const password = '123456';
      const basicAuthHeader = `Basic ${Buffer.from(
        `${username}:${password}`
      ).toString('base64')}`;

      const config = {
        headers: {
          Authorization: basicAuthHeader,
          'Content-Type': 'application/json',
        },
      };

      const requestBody = {};

      const response = await axios.post(apiUrl, requestBody, config);

      const tokenData = response.data;

      session.refresh_expires_in = tokenData.refresh_expires_in;
      session.refresh_token = tokenData.refresh_token;
      session.access_token = tokenData.access_token;
      session.expires_in = tokenData.expires_in;
      session.createdAt = new Date().getTime();

      await session.save();

      req.qpay_access_token = tokenData.access_token;
      next();
    } else {
      req.qpay_access_token = session.access_token;
      next();
    }
  } catch (error) {
    return sendError(res, 'Failed to get qpay the token.', 500);
  }
}

module.exports = { verifyToken, fetchQpayToken, checkBasicAuth };
