const express = require('express');
let router = express.Router();
const mongoose = require('mongoose');
const { cacheMiddleware } = require('../middleware/cache');

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
const { set, get, del } = require('../redis');
const {
  affiliateOwnRevenueRedis,
  affiliateMerchantRevenueRedis,
} = require('../utils/const');

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

      if (foundAffiliates.length !== 0) {
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
      const link = `${process.env.WEB_BASE_URL}/store/${merchant._id}/affiliate/${v4Uuid}`;

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
      const signupLink = `${process.env.WEB_BASE_URL}/auth/register?token=${token}`;

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
    await del(`${affiliateOwnRevenueRedis}${affiliateCustomer._id}`);
    await del(`${affiliateMerchantRevenueRedis}${merchant._id}`);

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
      return sendSuccess(res, 'success', 200, null);
    }

    const val = await get(
      `${affiliateOwnRevenueRedis}${affiliateCustomer._id}`
    );

    if (val) {
      return sendSuccess(res, 'success', 200, JSON.parse(val));
    } else {
      const affiliates = await Affiliate.find({
        affiliateCustomer: affiliateCustomer,
      })
        .populate('product')
        .lean();

      const affiliateIds = affiliates.map((affiliate) => affiliate._id);

      const revenue = await Transaction.aggregate([
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
            value: {
              $sum: { $toDouble: '$affiliateFee' },
            },
          },
        },
        {
          $project: {
            _id: 0,
            affiliateCustomer: '$_id.affiliateCustomer',
            affiliate: '$_id.affiliate',
            value: '$value',
          },
        },
      ]);

      const sales = await Transaction.aggregate([
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
            value: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            affiliateCustomer: '$_id.affiliateCustomer',
            affiliate: '$_id.affiliate',
            value: '$value',
          },
        },
      ]);

      const salesCountMap = new Map();
      const revenueMap = new Map();

      sales.forEach((sale) => {
        salesCountMap.set(sale.affiliate.toString(), sale.value);
      });

      revenue.forEach((e) => {
        revenueMap.set(e.affiliate.toString(), e.value);
      });

      const extractedData = affiliates.map((affiliate) => {
        if (
          affiliate.commission &&
          affiliate.commission instanceof mongoose.Types.Decimal128
        ) {
          affiliate.commission = parseFloat(affiliate.commission.toString());
        }

        const affiliateId = affiliate._id.toString();
        const salesCount = salesCountMap.get(affiliateId) || 0;
        const reveuneAmount = revenueMap.get(affiliateId) || 0;

        return {
          link: affiliate.link,
          commission: affiliate.commission,
          productTitle: affiliate.product.title,
          productId: affiliate.product.uid,
          status: affiliate.status,
          uid: affiliate.uid,
          id: affiliate._id,
          sales: salesCount,
          reveune: reveuneAmount,
        };
      });
      const totalSales = sales.reduce((acc, sale) => acc + sale.value, 0);
      const totalRevenue = revenue.reduce((acc, e) => acc + e.value, 0);

      const response = {
        cards: {
          revenue: [
            {
              title: 'Revenue',
              type: 'amount',
              value: totalRevenue,
            },
          ],
          sales: [
            {
              title: 'Sales',
              type: 'count',
              value: totalSales,
            },
          ],
        },
        affiliates: extractedData,
      };
      await set(
        `${affiliateOwnRevenueRedis}${affiliateCustomer._id}`,
        JSON.stringify(response)
      );

      return sendSuccess(res, 'success', 200, response);
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
      return sendSuccess(res, 'success', 200, null);
    }

    const val = await get(
      `${affiliateMerchantRevenueRedis}${foundMerchant._id}`
    );

    if (val) {
      return sendSuccess(res, 'success', 200, JSON.parse(val));
    } else {
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

      const affiliateIds = affiliates.map((affiliate) => affiliate._id);

      let revenue = await Transaction.aggregate([
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
            totalAmount: {
              $sum: { $toDouble: '$afterFee' },
            },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            affiliate: '$_id.affiliate',
            totalAmount: '$totalAmount',
          },
        },
      ]);

      const affiliateRevenue = await Transaction.aggregate([
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
            totalAmount: {
              $sum: { $toDouble: '$affiliateFee' },
            },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            affiliate: '$_id.affiliate',
            totalAmount: '$totalAmount',
          },
        },
      ]);

      const sales = await Transaction.aggregate([
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
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            affiliate: '$_id.affiliate',
            count: '$count',
          },
        },
      ]);
      const salesCountMap = new Map();
      const revenueMap = new Map();
      const affiliateRevenueMap = new Map();

      sales.forEach((sale) => {
        salesCountMap.set(sale.affiliate.toString(), sale.count);
      });

      revenue.forEach((e) => {
        revenueMap.set(e.affiliate.toString(), e.totalAmount);
      });

      affiliateRevenue.forEach((e) => {
        affiliateRevenueMap.set(e.affiliate.toString(), e.totalAmount);
      });

      const extractedData = affiliates.map((affiliate) => {
        if (
          affiliate.commission &&
          affiliate.commission instanceof mongoose.Types.Decimal128
        ) {
          affiliate.commission = parseFloat(affiliate.commission.toString());
        }

        const affiliateId = affiliate._id.toString();
        const salesCount = salesCountMap.get(affiliateId) || 0;
        const reveuneAmount = revenueMap.get(affiliateId) || 0;
        const affiliateRevenueAmount =
          affiliateRevenueMap.get(affiliateId) || 0;

        return {
          email: affiliate.affiliateCustomer.customer.email,
          link: affiliate.link,
          commission: affiliate.commission,
          productTitle: affiliate.product.title,
          status: affiliate.status,
          productId: affiliate.product.uid,
          uid: affiliate.uid,
          id: affiliate._id,
          sales: salesCount,
          reveune: reveuneAmount,
          affiliateRevenue: affiliateRevenueAmount,
        };
      });
      const totalSales = sales.reduce((acc, sale) => acc + sale.count, 0);
      const totalRevenue = revenue.reduce((acc, e) => acc + e.totalAmount, 0);
      const totalAffiliateRevenue = affiliateRevenue.reduce(
        (acc, e) => acc + e.totalAmount,
        0
      );

      const response = {
        cards: {
          revenue: [
            {
              title: 'Revenue',
              type: 'amount',
              value: totalRevenue,
            },
          ],
          sales: [
            {
              title: 'Sales',
              type: 'count',
              value: totalSales,
            },
          ],
          affiliateRevenue: [
            {
              title: 'Affiliates Revenue',
              type: 'amount',
              value: totalAffiliateRevenue,
            },
          ],
        },
        affiliates: extractedData,
      };
      await set(
        `${affiliateMerchantRevenueRedis}${foundMerchant._id}`,
        JSON.stringify(response)
      );

      return sendSuccess(res, 'success', 200, response);
    }
  } catch (error) {
    logger.error(`/POST /affiliate/merchant ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get(
  '/uid/:uid',
  checkBasicAuth,
  cacheMiddleware(3600),
  async (req, res) => {
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
            {
              path: 'merchant',
              model: 'Merchant',
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
  }
);

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
