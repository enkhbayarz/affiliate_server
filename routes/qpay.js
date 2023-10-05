const express = require('express');
let router = express.Router();
const axios = require('axios');
const moment = require('moment');
const uuid = require('uuid');
const { body, validationResult } = require('express-validator');

const {
  Customer,
  Product,
  Transaction,
  Affiliate,
  Option,
} = require('../models/index');

const { fetchQpayToken, checkBasicAuth } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../log');
const { setCustomerCount, get, set, del, exists } = require('../redis');
const { sendMailAfterPurchase } = require('../utils/mail');

const {
  payoutMerchantRedis,
  productLimitCustomerCountRedis,
  affiliateOwnRevenueRedis,
  affiliateMerchantRevenueRedis,
  productRevenueMembersRedis,
} = require('../utils/const');

//Create Qpay Invoice with affiliate
router.post(
  '/create-invoice/affiliate',
  [body('email').isEmail().withMessage('Invalid email format')],
  checkBasicAuth,
  fetchQpayToken,
  async (req, res) => {
    try {
      const { affiliateId, email, optionId } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => error.msg);
        return sendError(res, errorMessages.toString(), 404);
      }

      logger.info(
        `/POST /create-invoice/affiliate START: ${affiliateId} ${email} ${optionId}`
      );

      const affiliate = await Affiliate.findOne({ uid: affiliateId });
      if (!affiliate) {
        return sendError(res, 'affiliate not found!', 404);
      }

      const foundProduct = await Product.findById(affiliate.product);
      if (!foundProduct) {
        return sendError(res, 'product not found!', 404);
      }

      const limitCustomerCount = await get(
        `${productLimitCustomerCountRedis}${foundProduct._id}`
      );
      if (
        limitCustomerCount &&
        parseInt(limitCustomerCount) >= foundProduct.limitCustomer
      ) {
        return res.status(400).json({ message: 'Product is sold out' });
      }

      const selectedOption = await Option.findById(optionId);

      if (!selectedOption) {
        return sendError(res, 'option not found!', 404);
      }

      const isOptionInProduct = foundProduct.option.includes(
        selectedOption._id
      );

      if (!isOptionInProduct) {
        return sendError(
          res,
          'Selected option is not associated with the product!',
          400
        );
      }

      const v4Uuid = uuid.v4();

      const transaction = new Transaction();

      const data = {
        invoice_code: 'TUGO116_INVOICE',
        sender_invoice_no: `${transaction._id.toString()}`,
        invoice_receiver_code: '83',
        sender_branch_code: 'BRANCH1',
        invoice_description: `Order ${selectedOption.price.toString()} ${transaction._id.toString()}`,
        enable_expiry: 'false',
        allow_partial: false,
        minimum_amount: null,
        allow_exceed: false,
        maximum_amount: null,
        amount: parseFloat(selectedOption.price.toString()),
        callback_url: `${process.env.BASE_URL}/call-back/affiliate/${v4Uuid}`,
        sender_staff_code: 'online',
        note: null,
        invoice_receiver_data: {
          register: 'UK00240730',
          name: 'Enkhbayar Enkhorkhon',
          email: 'e.enkhbayat@gmail.com',
          phone: '95059075',
        },
      };

      const token = req.qpay_access_token;
      const url = `${process.env.QPAY_URL}/v2/invoice`;

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.post(url, data, config);

      logger.info(`QPAY RESPONSE: ${response}`);

      let foundCustomer = await Customer.findOne({ email: email });
      if (!foundCustomer) {
        const v4UuidCustomer = uuid.v4();

        foundCustomer = new Customer();

        foundCustomer.email = email;
        foundCustomer.uid = v4UuidCustomer;

        await foundCustomer.save();
      }

      const priceAsNumber = selectedOption.price;
      const qpayFee = (priceAsNumber * 0.01).toFixed(2);
      const afterFee = (priceAsNumber - qpayFee).toFixed(2);
      const affiliateFee = (afterFee * (affiliate.commission / 100)).toFixed(2);
      const realAfterFee = (afterFee - affiliateFee).toFixed(2);

      transaction.status = 'NEW';
      transaction.objectId = response.data.invoice_id;
      transaction.uid = v4Uuid;
      transaction.customer = foundCustomer;
      transaction.product = affiliate.product;
      transaction.affiliate = affiliate;
      transaction.merchant = affiliate.merchant;
      transaction.affiliateCustomer = affiliate.affiliateCustomer;
      transaction.option = selectedOption;
      transaction.qpayFee = qpayFee;
      transaction.afterFee = realAfterFee;
      transaction.affiliateFee = affiliateFee;

      await transaction.save();

      const currentTimestamp = new Date().getTime();

      const expires_in = currentTimestamp + 5 * 60 * 1000;

      return sendSuccess(res, 'success', 200, {
        transaction: { id: transaction._id, uid: v4Uuid },
        expires_in,
        qpay: response.data,
      });
    } catch (error) {
      logger.error(`/POST /create-invoice/affiliate ERROR: ${error.message}`);
      return sendError(res, error.message, 500);
    }
  }
);

//Create Qpay Invoice
router.post(
  '/create-invoice',
  [body('email').isEmail().withMessage('Invalid email format')],
  checkBasicAuth,
  fetchQpayToken,
  async (req, res) => {
    try {
      const { productId, email, optionId } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => error.msg);
        return sendError(res, errorMessages.toString(), 404);
      }

      logger.info(`/POST /create-invoice START: ${productId} ${email}`);

      const foundProduct = await Product.findById(productId);
      if (!foundProduct) {
        return sendError(res, 'product not found!', 404);
      }

      const limitCustomerCount = await get(
        `${productLimitCustomerCountRedis}${foundProduct._id}`
      );
      if (
        limitCustomerCount &&
        parseInt(limitCustomerCount) >= foundProduct.limitCustomer
      ) {
        return res.status(400).json({ message: 'Product is sold out' });
      }

      const selectedOption = await Option.findById(optionId);

      if (!selectedOption) {
        return sendError(res, 'option not found!', 404);
      }

      const isOptionInProduct = foundProduct.option.includes(
        selectedOption._id
      );

      if (!isOptionInProduct) {
        return sendError(
          res,
          'Selected option is not associated with the product!',
          400
        );
      }

      const v4Uuid = uuid.v4();

      const transaction = new Transaction();

      const data = {
        invoice_code: 'TUGO116_INVOICE',
        sender_invoice_no: `${transaction._id.toString()}`,
        invoice_receiver_code: '83',
        sender_branch_code: 'BRANCH1',
        invoice_description: `Order ${selectedOption.price.toString()} ${transaction._id.toString()}`,
        enable_expiry: 'false',
        allow_partial: false,
        minimum_amount: null,
        allow_exceed: false,
        maximum_amount: null,
        amount: parseFloat(selectedOption.price.toString()),
        callback_url: `${process.env.BASE_URL}/call-back/simple/${v4Uuid}`,
        sender_staff_code: 'online',
        note: null,
        invoice_receiver_data: {
          register: 'UK00240730',
          name: 'Enkhbayar Enkhorkhon',
          email: 'e.enkhbayat@gmail.com',
          phone: '95059075',
        },
      };

      const token = req.qpay_access_token;
      const url = `${process.env.QPAY_URL}/v2/invoice`;

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.post(url, data, config);

      logger.info(`QPAY RESPONSE: ${response}`);

      let foundCustomer = await Customer.findOne({ email: email });
      if (!foundCustomer) {
        const v4UuidCustomer = uuid.v4();

        foundCustomer = new Customer();
        foundCustomer.email = email;
        foundCustomer.uid = v4UuidCustomer;

        await foundCustomer.save();
      }

      const priceAsNumber = selectedOption.price;
      const qpayFee = (priceAsNumber / 100).toFixed(2);
      const afterFee = (priceAsNumber - qpayFee).toFixed(2);

      transaction.status = 'NEW';
      transaction.objectId = response.data.invoice_id;
      transaction.uid = v4Uuid;
      transaction.customer = foundCustomer;
      transaction.product = foundProduct;
      transaction.merchant = foundProduct.merchant;
      transaction.option = selectedOption;
      transaction.qpayFee = qpayFee;
      transaction.afterFee = afterFee;

      await transaction.save();

      const currentTimestamp = new Date().getTime();

      const expires_in = currentTimestamp + 5 * 60 * 1000;

      return sendSuccess(res, 'success', 200, {
        transaction: { id: transaction._id, uid: v4Uuid },
        expires_in,
        qpay: response.data,
      });
    } catch (error) {
      logger.error(`/POST /create-invoice ERROR: ${error.message}`);
      return sendError(res, error.message, 500);
    }
  }
);

router.get('/call-back/simple/:id', fetchQpayToken, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`/POST /call-back/simple/:id START: ${id}`);

    const transaction = await Transaction.findOne({ uid: id });
    if (!transaction) {
      return sendError(res, 'transaction not found!', 404);
    }

    if (transaction.status === 'PAID') {
      return sendError(res, 'transaction already paid!', 400);
    }

    const token = req.qpay_access_token;
    const url = `${process.env.QPAY_URL}/v2/payment/check`;

    const data = {
      object_type: 'INVOICE',
      object_id: transaction.objectId,
      offset: {
        page_number: 1,
        page_limit: 100,
      },
    };
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.post(url, data, config);
    logger.info(`/POST QPAY CHECK RESPONSE: ${JSON.stringify(response.data)}`);

    if (response.data.count === 1) {
      const foundProduct = await Product.findById(transaction.product._id);
      if (!foundProduct) {
        return sendError(res, 'product not found!', 404);
      }

      const limitCustomerCount = await get(
        `${productLimitCustomerCountRedis}${foundProduct._id}`
      );
      if (
        limitCustomerCount &&
        parseInt(limitCustomerCount) >= foundProduct.limitCustomer
      ) {
        return sendError(res, 'Product is sold out', 400);
      }
      await setCustomerCount(
        `${productLimitCustomerCountRedis}${foundProduct._id}`
      );

      const payoutMerchantExists = await exists(
        `${payoutMerchantRedis}${transaction.merchant._id}`
      );
      if (payoutMerchantExists) {
        await del(`${payoutMerchantRedis}${transaction.merchant._id}`);
      }

      const productRevenueMembersExists = await exists(
        `${productRevenueMembersRedis}${transaction.merchant._id}`
      );
      if (productRevenueMembersExists) {
        await del(`${productRevenueMembersRedis}${transaction.merchant._id}`);
      }

      transaction.status = 'PAID';

      await transaction.save();

      sendMailAfterPurchase(transaction.customer.email);

      return sendSuccess(res, 'success', 200, response.data);
    } else {
      return sendError(res, 'Not Payed', 404);
    }
  } catch (error) {
    logger.error(`/GET /call-back/simple/:id ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get('/call-back/affiliate/:id', fetchQpayToken, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`/POST /call-back/affiliate/:id START: ${id}`);

    const transaction = await Transaction.findOne({ uid: id });
    if (!transaction) {
      return sendError(res, 'transaction not found!', 404);
    }

    if (transaction.status === 'PAID') {
      return sendError(res, 'transaction already paid!', 400);
    }

    const affiliate = await Affiliate.findById(transaction.affiliate._id);

    if (!affiliate) {
      return sendError(res, 'affiliate not found!', 404);
    }

    const token = req.qpay_access_token;
    const url = `${process.env.QPAY_URL}/v2/payment/check`;

    const data = {
      object_type: 'INVOICE',
      object_id: transaction.objectId,
      offset: {
        page_number: 1,
        page_limit: 100,
      },
    };
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.post(url, data, config);
    logger.info(`/POST QPAY CHECK RESPONSE: ${JSON.stringify(response.data)}`);

    if (response.data.count === 1) {
      const foundProduct = await Product.findById(transaction.product._id);
      if (!foundProduct) {
        return sendError(res, 'product not found!', 404);
      }

      const limitCustomerCount = await get(
        `${productLimitCustomerCountRedis}${foundProduct._id}`
      );
      if (
        limitCustomerCount &&
        parseInt(limitCustomerCount) >= foundProduct.limitCustomer
      ) {
        return sendError(res, 'Product is sold out', 400);
      }
      await setCustomerCount(
        `${productLimitCustomerCountRedis}${foundProduct._id}`
      );

      const affiliateOwnRevenueExists = await exists(
        `${affiliateOwnRevenueRedis}${affiliate.affiliateCustomer._id}`
      );
      if (affiliateOwnRevenueExists) {
        await del(
          `${affiliateOwnRevenueRedis}${affiliate.affiliateCustomer._id}`
        );
      }

      const affiliateMerchantRevenueExists = await exists(
        `${affiliateMerchantRevenueRedis}${affiliate.merchant._id}`
      );
      if (affiliateMerchantRevenueExists) {
        await del(`${affiliateMerchantRevenueRedis}${affiliate.merchant._id}`);
      }

      const payoutMerchantExists = await exists(
        `${payoutMerchantRedis}${transaction.merchant._id}`
      );
      if (payoutMerchantExists) {
        await del(`${payoutMerchantRedis}${transaction.merchant._id}`);
      }

      const productRevenueMembersExists = exists(
        `${productRevenueMembersRedis}${transaction.merchant._id}`
      );
      if (productRevenueMembersExists) {
        await del(`${productRevenueMembersRedis}${transaction.merchant._id}`);
      }

      transaction.status = 'PAID';

      await transaction.save();

      sendMailAfterPurchase(transaction.customer.email);

      return sendSuccess(res, 'success', 200, response.data);
    } else {
      return sendError(res, 'Not Payed', 404);
    }
  } catch (error) {
    logger.error(`/GET /call-back/affiliate/:id ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//TODO enendeer expire hiih 5 min
router.get('/qpay/check/transaction/:id', checkBasicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`/POST /qpay/check/transaction/:id START: ${id}`);

    const foundTransaction = await Transaction.findById(id);

    if (!foundTransaction) {
      return sendError(res, 'transaction not found!', 404);
    }

    const currentTime = new Date();
    const timeDifference = currentTime - foundTransaction.createdAt;
    const timeDifferenceInSeconds = timeDifference / 1000;
    if (timeDifferenceInSeconds > 300) {
      return sendError(res, 'qpay expired create new one', 400);
    } else {
      if (foundTransaction.status === 'PAID') {
        return sendSuccess(res, 'success', 200, { isPaid: true });
      } else {
        return sendSuccess(res, 'success', 200, { isPaid: false });
      }
    }
  } catch (error) {
    logger.error(`/GET /qpay/check/transaction/:id ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
