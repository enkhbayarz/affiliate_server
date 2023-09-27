const express = require('express');
let router = express.Router();
const axios = require('axios');
const moment = require('moment');
const uuid = require('uuid');

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

//Create Qpay Invoice with affiliate
router.post(
  '/create-invoice/affiliate',
  checkBasicAuth,
  fetchQpayToken,
  async (req, res) => {
    try {
      const { affiliateId, email, optionId } = req.body;

      logger.info(
        `/POST /create-invoice/affiliate START: ${affiliateId} ${email}`
      );

      const affiliate = await Affiliate.findOne({ uid: affiliateId });
      if (!affiliate) {
        return sendError(res, 'affiliate not found!', 404);
      }

      const foundProduct = await Product.findById(affiliate.product);
      if (!foundProduct) {
        return sendError(res, 'product not found!', 404);
      }
      const selectedOption = await Option.findOne({
        _id: optionId,
        _id: { $in: foundProduct.option },
      });

      if (!selectedOption) {
        return sendError(res, 'option not found!', 404);
      }

      const v4Uuid = uuid.v4();

      const data = {
        invoice_code: 'TEST1_INVOICE',
        sender_invoice_no: 'MABNK000001',
        invoice_receiver_code: '83',
        sender_branch_code: 'BRANCH1',
        invoice_description: 'Order No1311 4444.00',
        enable_expiry: 'false',
        allow_partial: false,
        minimum_amount: null,
        allow_exceed: false,
        maximum_amount: null,
        amount: parseFloat(selectedOption.price.toString()),
        callback_url: `https://mma-service.onrender.com/call-back/${v4Uuid}`,
        sender_staff_code: 'online',
        note: null,
        invoice_receiver_data: {
          register: 'UZ96021178',
          name: 'Dulguun',
          email: 'dulguun@gmail.com',
          phone: '88789856',
        },
        transactions: [
          {
            description: 'gg',
            amount: selectedOption.price.toString(),
            accounts: [
              {
                account_bank_code: '390000',
                account_name: 'аззаяа',
                account_number: '8000101230',
                account_currency: 'MNT',
                is_default: true,
              },
            ],
          },
        ],
      };

      const token = req.qpay_access_token;
      const url = 'https://merchant-sandbox.qpay.mn/v2/invoice';

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

      const transaction = new Transaction({
        status: 'NEW',
        objectId: response.data.invoice_id,
        uid: v4Uuid,
        customer: foundCustomer,
        product: affiliate.product,
        affiliate: affiliate,
        merchant: affiliate.merchant,
        affiliateCustomer: affiliate.affiliateCustomer,
        option: selectedOption,
        qpayFee: qpayFee,
        afterFee: realAfterFee,
        affiliateFee: affiliateFee,
      });
      await transaction.save();

      return sendSuccess(res, 'success', 200, {
        qpay: response.data,
        transaction: transaction._id,
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
  checkBasicAuth,
  fetchQpayToken,
  async (req, res) => {
    try {
      const { productId, email, optionId } = req.body;

      logger.info(`/POST /create-invoice START: ${productId} ${email}`);

      const foundProduct = await Product.findById(productId);
      if (!foundProduct) {
        return sendError(res, 'product not found!', 404);
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

      const data = {
        invoice_code: 'TEST1_INVOICE',
        sender_invoice_no: 'MABNK000001',
        invoice_receiver_code: '83',
        sender_branch_code: 'BRANCH1',
        invoice_description: 'Order No1311 4444.00',
        enable_expiry: 'false',
        allow_partial: false,
        minimum_amount: null,
        allow_exceed: false,
        maximum_amount: null,
        amount: parseFloat(selectedOption.price.toString()),
        callback_url: `https://mma-service.onrender.com/call-back/${v4Uuid}`,
        sender_staff_code: 'online',
        note: null,
        invoice_receiver_data: {
          register: 'UZ96021178',
          name: 'Dulguun',
          email: 'dulguun@gmail.com',
          phone: '88789856',
        },
        transactions: [
          {
            description: 'gg',
            amount: selectedOption.price.toString(),
            accounts: [
              {
                account_bank_code: '390000',
                account_name: 'аззаяа',
                account_number: '8000101230',
                account_currency: 'MNT',
                is_default: true,
              },
            ],
          },
        ],
      };

      const token = req.qpay_access_token;
      const url = 'https://merchant-sandbox.qpay.mn/v2/invoice';

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

      const transaction = new Transaction({
        status: 'NEW',
        objectId: response.data.invoice_id,
        uid: v4Uuid,
        customer: foundCustomer,
        product: foundProduct,
        merchant: foundProduct.merchant,
        option: selectedOption,
        qpayFee: qpayFee,
        afterFee: afterFee,
      });
      await transaction.save();

      return sendSuccess(res, 'success', 200, {
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
    const url = 'https://merchant-sandbox.qpay.mn/v2/payment/check';

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

    if (response.data.count === 0) {
      transaction.status = 'PAID';

      await transaction.save();

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
    const url = 'https://merchant-sandbox.qpay.mn/v2/payment/check';

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

    if (response.data.count === 0) {
      transaction.status = 'PAID';

      await transaction.save();

      return sendSuccess(res, 'success', 200, response.data);
    } else {
      return sendError(res, 'Not Payed', 404);
    }
  } catch (error) {
    logger.error(`/GET /call-back/affiliate/:id ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get('/qpay/check/transaction/:id', checkBasicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`/POST /qpay/check/transaction/:id START: ${id}`);

    const foundTransaction = await Transaction.findById(id);

    if (!foundTransaction) {
      return sendError(res, 'transaction not found!', 404);
    }

    if (foundTransaction.status === 'PAID') {
      return sendSuccess(res, 'success', 200, { isPaid: true });
    } else {
      return sendSuccess(res, 'success', 200, { isPaid: false });
    }
  } catch (error) {
    logger.error(`/GET /qpay/check/transaction/:id ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
