const express = require('express');
let router = express.Router();
const mongoose = require('mongoose');

const {
  Affiliate,
  Customer,
  Product,
  Merchant,
  AffiliateCustomer,
  Transaction,
  Signup,
} = require('../models/index');

const uuid = require('uuid');

const { verifyToken, checkBasicAuth } = require('../middleware/token');
const logger = require('../log');
const { sendSuccess, sendError } = require('../utils/response');
const {
  sendMailAffiliate,
  sendMailAffiliateAndSignup,
} = require('../utils/mail');
const { set, get } = require('../redis');

//Affiliate

//Create Affiliate
router.post('/', verifyToken, async (req, res) => {
  try {
    const { email, list } = req.body;
    logger.info(`/POST /affiliate START: ${email} ${JSON.stringify(list)}`);

    const customer = req.customer;
    const merchant = await Merchant.findOne({ customer: customer });
    let isCustomerFound = true;

    if (!merchant) {
      return sendError(
        res,
        'Can not add affiliate. You have to add product first',
        404
      );
    }

    let foundCustomer = await Customer.findOne({ email: email });
    if (!foundCustomer) {
      foundCustomer = new Customer();
      foundCustomer.email = email;

      isCustomerFound = false;

      await foundCustomer.save();
    }
    if (!foundCustomer.password) {
      isCustomerFound = false;
    }

    let affiliateCustomer = await AffiliateCustomer.findOne({
      customer: foundCustomer,
    });
    if (!affiliateCustomer) {
      affiliateCustomer = new AffiliateCustomer({ customer: foundCustomer });
      await affiliateCustomer.save();
    }

    const affiliates = [];

    for (const item of list) {
      const { commission, productId } = item;

      const foundProduct = await Product.findById(productId);

      if (!foundProduct) {
        return sendError(res, `Product not found for ID: ${productId}`, 404);
      }

      const foundAffiliates = await Affiliate.find({
        merchant: merchant,
        affiliateCustomer: affiliateCustomer,
        product: productId,
      });

      if (!foundAffiliates.length === 0) {
        return sendError(
          res,
          `Already created this affiliate on customer with product`,
          400
        );
      }
    }

    for (const item of list) {
      const { commission, productId } = item;

      const foundProduct = await Product.findById(productId);

      const v4Uuid = uuid.v4();
      const link = `${process.env.WEB_BASE_URL}/affiliate/${v4Uuid}`;

      const affiliate = new Affiliate({
        uid: v4Uuid,
        status: 'ACTIVE',
        type: 'AFFILIATE',
        commission: commission,
        link: link,
        affiliateCustomer: affiliateCustomer,
        product: foundProduct,
        merchant: merchant,
      });

      await Affiliate.create(affiliate);
      affiliates.push(affiliate);
    }

    if (isCustomerFound) {
      sendMailAffiliate(
        email,
        affiliates.map((affiliate) => affiliate.link).join('\n')
      );
    } else {
      const token = uuid.v4();
      const signupLink = `${process.env.WEB_BASE_URL}/api/auth/signup/${token}`;

      const signup = new Signup({
        email: email,
        token: token,
      });

      await signup.save();

      sendMailAffiliateAndSignup(
        email,
        affiliates.map((affiliate) => affiliate.link).join('\n'),
        signupLink
      );
    }

    return sendSuccess(res, 'success', 200, 'true');
  } catch (error) {
    logger.error(`/POST /affiliate ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//TODO: mnii burtguulsen affilaites
//Get Affiliate by affiliateCustomer
router.get('/own', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /affiliate/own START: ${JSON.stringify(foundCustomer)} `);

    const affiliateCustomer = await AffiliateCustomer.findOne({
      customer: foundCustomer,
    });
    if (!affiliateCustomer) {
      return sendSuccess(res, 'success', 200, []);
    }

    const affiliates = await Affiliate.find({
      affiliateCustomer: affiliateCustomer,
    })
      .populate('product')
      .lean();

    const extractedData = affiliates.map((affiliate) => {
      if (
        affiliate.commission &&
        affiliate.commission instanceof mongoose.Types.Decimal128
      ) {
        affiliate.commission = parseFloat(affiliate.commission.toString());
      }

      return {
        link: affiliate.link,
        commission: affiliate.commission,
        productTitle: affiliate.product.title,
        productId: affiliate.product.uid,
        status: affiliate.status,
        uid: affiliate.uid,
        id: affiliate._id,
      };
    });

    return sendSuccess(res, 'success', 200, { affiliates: extractedData });
  } catch (error) {
    logger.error(`/POST /affiliate/own ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get('/own/revenue', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(
      `/GET /affiliate/own/revenue START: ${JSON.stringify(foundCustomer)} `
    );
    const affiliateCustomer = await AffiliateCustomer.findOne({
      customer: foundCustomer,
    });

    if (!affiliateCustomer) {
      return sendSuccess(res, 'success', 200, []);
    }

    const val = await get(`affiliate/own/revenue/${affiliateCustomer._id}`);

    if (val) {
      console.log('val valid');
      return sendSuccess(res, 'success', 200, JSON.parse(val));
    } else {
      console.log('val not valid');
      const affiliates = await Affiliate.find({
        affiliateCustomer: affiliateCustomer,
      });

      const affiliateIds = affiliates.map((affiliate) => affiliate._id);

      const data = await Transaction.aggregate([
        {
          $match: {
            affiliate: { $in: affiliateIds },
            affiliateCustomer: affiliateCustomer._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              affiliateCustomer: affiliateCustomer._id,
              affiliate: '$affiliate',
            },
            totalRevenue: { $sum: { $toDouble: '$affiliateFee' } },
          },
        },
        {
          $project: {
            _id: 0,
            affiliateCustomer: '$_id.affiliateCustomer',
            affiliate: '$_id.affiliate',
            totalRevenue: '$totalRevenue',
          },
        },
      ]);
      const totalSales = await Transaction.aggregate([
        {
          $match: {
            affiliate: { $in: affiliateIds },
            affiliateCustomer: affiliateCustomer._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              affiliateCustomer: affiliateCustomer._id,
              affiliate: '$affiliate',
            },
            totalTransactions: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            affiliateCustomer: '$_id.affiliateCustomer',
            affiliate: '$_id.affiliate',
            totalTransactions: '$totalTransactions',
          },
        },
      ]);

      await set(
        `affiliate/own/revenue/${affiliateCustomer._id}`,
        JSON.stringify({ data, totalSales })
      );

      return sendSuccess(res, 'success', 200, { data, totalSales });
    }
  } catch (error) {
    logger.error(`/POST /affiliate/own ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//TODO: mnii buteegdehuun deer baigaa affiliates
//Get Affiliate by merchant
router.get('/merchant', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(
      `/GET /affiliate/merchant START: ${JSON.stringify(foundCustomer)}`
    );

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, []);
    }

    let affiliates = await Affiliate.find({ merchant: foundMerchant })
      .populate('product')
      .populate({
        path: 'affiliateCustomer',
        populate: {
          path: 'customer',
          model: 'Customer',
        },
      })
      .lean();

    const extractedData = affiliates.map((affiliate) => {
      if (
        affiliate.commission &&
        affiliate.commission instanceof mongoose.Types.Decimal128
      ) {
        affiliate.commission = parseFloat(affiliate.commission.toString());
      }

      return {
        email: affiliate.affiliateCustomer.customer.email,
        link: affiliate.link,
        commission: affiliate.commission,
        productTitle: affiliate.product.title,
        status: affiliate.status,
        productId: affiliate.product.uid,
        uid: affiliate.uid,
        id: affiliate._id,
      };
    });
    return sendSuccess(res, 'success', 200, { affiliates: extractedData });
  } catch (error) {
    logger.error(`/POST /affiliate/merchant ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get('/merchant/revenue', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(
      `/GET /affiliate/merchant/revenue START: ${JSON.stringify(
        foundCustomer
      )} `
    );

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, []);
    }
    const val = await get(`affiliate/merchant/revenue/${foundMerchant._id}`);

    if (val) {
      console.log('val valid');
      return sendSuccess(res, 'success', 200, JSON.parse(val));
    } else {
      console.log('val not valid');
      const affiliates = await Affiliate.find({ merchant: foundMerchant });

      const affiliateIds = affiliates.map((affiliate) => affiliate._id);

      const data = await Transaction.aggregate([
        {
          $match: {
            affiliate: { $in: affiliateIds },
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              merchant: foundMerchant._id,
              affiliate: '$affiliate',
            },
            totalRevenue: { $sum: { $toDouble: '$afterFee' } },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            affiliate: '$_id.affiliate',
            totalRevenue: '$totalRevenue',
          },
        },
      ]);
      const totalSales = await Transaction.aggregate([
        {
          $match: {
            affiliate: { $in: affiliateIds },
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              merchant: foundMerchant._id,
              affiliate: '$affiliate',
            },
            totalTransactions: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            affiliate: '$_id.affiliate',
            totalTransactions: '$totalTransactions',
          },
        },
      ]);

      await set(
        `affiliate/merchant/revenue/${foundMerchant._id}`,
        JSON.stringify({ data, totalSales })
      );

      return sendSuccess(res, 'success', 200, { data, totalSales });
    }
  } catch (error) {
    logger.error(`/POST /affiliate/merchant/revenue ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get('/uid/:uid', checkBasicAuth, async (req, res) => {
  try {
    const { uid } = req.params;

    logger.info(`/GET /affiliate/uid/:uid START: ${uid}}`);

    const affiliate = await Affiliate.findOne({ uid: uid })
      .populate({
        path: 'product',
        populate: [
          {
            path: 'additionalInformation',
            model: 'AdditionalInformation',
          },
          {
            path: 'term',
            model: 'Term',
          },
          {
            path: 'coverImage',
            model: 'Image',
          },
          {
            path: 'thumbnail',
            model: 'Image',
          },
          {
            path: 'option',
            model: 'Option',
          },
        ],
      })
      .lean();
    if (
      affiliate &&
      affiliate.commission &&
      affiliate.commission instanceof mongoose.Types.Decimal128
    ) {
      affiliate.commission = parseFloat(affiliate.commission.toString());
    }

    affiliate.product.option.map((option) => {
      if (option.price && option.price instanceof mongoose.Types.Decimal128) {
        option.price = parseFloat(option.price.toString());
      }
    });

    return sendSuccess(res, 'success', 200, { affiliate });
  } catch (error) {
    logger.error(`/GET /affiliate/uid/:uid ERROR: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

router.get('/list/uid/:uid', checkBasicAuth, async (req, res) => {
  try {
    const { uid } = req.params;

    logger.info(`/GET /affiliate/list/uid/:uid START: ${uid}}`);

    const foundAffiliate = await Affiliate.findOne({ uid: uid });

    const listAffiliate = await Affiliate.find({
      affiliateCustomer: foundAffiliate.affiliateCustomer,
    });

    const list = listAffiliate.map((aff) => ({
      uid: aff.uid,
      productId: (aff.product && aff.product._id) || null,
    }));

    return sendSuccess(res, 'success', 200, { list });
  } catch (error) {
    logger.error(`/GET /affiliate/list/uid/:uid ERROR: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;
