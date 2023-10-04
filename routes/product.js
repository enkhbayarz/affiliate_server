const express = require('express');
let router = express.Router();
const uuid = require('uuid');
const mongoose = require('mongoose');
const cache = require('memory-cache');

const {
  Merchant,
  Product,
  AdditionalInformation,
  Option,
  Image,
  Term,
  Affiliate,
  Transaction,
} = require('../models/index');

const { verifyToken, checkBasicAuth } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../log');
const { set, get, del } = require('../redis');
const { productRevenueMembersRedis } = require('../utils/const');
const { cacheMiddleware } = require('../middleware/cache');

//Product
//Create Product
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      coverImageId,
      thumbnailId,
      summary,
      storeName,
      additionalInformation,
      options,
      term,
    } = req.body;

    logger.info(`/POST /product START: ${JSON.stringify(req.body)}`);

    const foundCustomer = req.customer;

    const emailList = process.env.EMAIL_LIST_CHECK;

    if (emailList.includes(foundCustomer.email)) {
      const v4Uuid = uuid.v4();

      let merchant = await Merchant.findOne({ customer: foundCustomer });

      if (!merchant) {
        merchant = new Merchant({
          customer: foundCustomer,
          storeName: storeName,
        });
        await merchant.save();
      }

      const additionalInformationArray = [];

      for (const info of additionalInformation) {
        const { attribute, value } = info;

        const additionalInfo = new AdditionalInformation({
          attribute,
          value,
        });

        await additionalInfo.save();

        additionalInformationArray.push(additionalInfo._id);
      }

      const optionArray = [];
      for (const o of options) {
        const { price, duration, type } = o;

        const opt = new Option({
          price,
          duration,
          type,
        });

        await opt.save();

        optionArray.push(opt);
      }

      const foundCoverImage = await Image.findById(coverImageId);
      if (!foundCoverImage) {
        return sendError(res, 'cover image not found', 404);
      }
      const foundThumbnail = await Image.findById(thumbnailId);
      if (!foundThumbnail) {
        return sendError(res, 'thumbnail not found', 404);
      }

      const newTerm = new Term();
      newTerm.title = term.title;
      newTerm.description = term.description;

      const product = new Product({
        title,
        description,
        coverImage: foundCoverImage,
        thumbnail: foundThumbnail,
        uid: v4Uuid,
        summary,
        merchant,
        additionalInformation: additionalInformationArray,
        option: optionArray,
        term: newTerm,
      });

      await newTerm.save();
      await Product.create(product);

      const key = `__express__/product/store/${merchant._id}`;
      cache.del(key);

      await del(`${productRevenueMembersRedis}${merchant._id}`);

      return sendSuccess(res, 'success', 200, { product });
    } else {
      return sendError(res, 'can not add product', 400);
    }
  } catch (error) {
    logger.error(`/POST /product ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//  Prodcut nemeh erhtei esehiig shalgana
router.get('/add-check', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /product START: ${JSON.stringify(foundCustomer)}`);

    const emailList = process.env.EMAIL_LIST_CHECK;

    if (emailList.includes(foundCustomer.email)) {
      return sendSuccess(res, 'success', 200, 'true');
    } else {
      return sendError(res, 'can not add product', 400);
    }
  } catch (error) {
    logger.error(`/GET /product ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//Get Product by Merchant
router.get('/', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /product START: ${JSON.stringify(foundCustomer)}`);

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, null);
    }

    const val = await get(`${productRevenueMembersRedis}${foundMerchant._id}`);

    if (val) {
      return sendSuccess(res, 'success', 200, JSON.parse(val));
    } else {
      const products = await Product.find({ merchant: foundMerchant })
        .populate('thumbnail')
        .populate('option')
        .lean();

      if (products.length === 0) {
        return sendSuccess(res, 'success', 200, null);
      }

      const productIds = products.map((p) => p._id);

      let revenue = await Transaction.aggregate([
        {
          $match: {
            product: { $in: productIds },
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              merchant: '$merchant',
              product: '$product',
            },
            value: {
              $sum: { $toDouble: '$afterFee' },
            },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            product: '$_id.product',
            title: 'Revenue',
            value: '$value',
          },
        },
      ]);

      const members = await Transaction.aggregate([
        {
          $match: {
            product: { $in: productIds },
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              merchant: '$merchant',
              product: '$product',
            },
            uniqueCustomers: { $addToSet: '$customer' },
          },
        },
        {
          $unwind: '$uniqueCustomers',
        },
        {
          $group: {
            _id: {
              merchant: '$_id.merchant',
              product: '$_id.product',
            },
            totalMembers: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            product: '$_id.product',
            title: 'Members',
            value: '$totalMembers',
          },
        },
      ]);

      const sales = await Transaction.aggregate([
        {
          $match: {
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              merchant: '$merchant',
              product: '$product',
            },
            transactionCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            product: '$_id.product',
            title: 'Sales',
            value: '$transactionCount',
          },
        },
      ]);

      const salesCountMap = new Map();
      const revenueMap = new Map();
      const membersMap = new Map();

      sales.forEach((sale) => {
        salesCountMap.set(sale.product.toString(), sale.value);
      });

      revenue.forEach((e) => {
        revenueMap.set(e.product.toString(), e.value);
      });

      members.forEach((e) => {
        membersMap.set(e.product.toString(), e.value);
      });

      const extractedData = products.map((product) => {
        product.option.map((option) => {
          if (
            option.price &&
            option.price instanceof mongoose.Types.Decimal128
          ) {
            option.price = parseFloat(option.price.toString());
          }
        });
        const productId = product._id.toString();
        const salesCount = salesCountMap.get(productId) || 0;
        const reveuneAmount = revenueMap.get(productId) || 0;
        const membersCount = membersMap.get(productId) || 0;

        return {
          id: product._id,
          uid: product.uid,
          title: product.title,
          thumbnail: product.thumbnail,
          option: product.option,
          sales: salesCount,
          reveune: reveuneAmount,
          members: membersCount,
        };
      });
      const totalSales = sales.reduce((acc, sale) => acc + sale.value, 0);
      const totalRevenue = revenue.reduce((acc, e) => acc + e.value, 0);
      const totalMembers = members.reduce((acc, e) => acc + e.value, 0);

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
        products: extractedData,
      };

      await set(
        `${productRevenueMembersRedis}${foundMerchant._id}`,
        JSON.stringify(response)
      );
      return sendSuccess(res, 'success', 200, response);
    }
  } catch (error) {
    logger.error(`/GET /product ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//Gey Product by Id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`/GET /product/:id START: ${id}`);

    const product = await Product.findById(id);

    return sendSuccess(res, 'success', 200, { product });
  } catch (error) {
    logger.error(`/GET /product/:id ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//Get Products by merchant
router.get(
  '/store/:id',
  cacheMiddleware(3600),
  checkBasicAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      logger.info(`/GET /product/store/:id START: ${id}`);

      const foundMerchant = await Merchant.findById(id);

      if (!foundMerchant) {
        return sendError(res, 'merchant not found', 404);
      }
      const products = await Product.find({ merchant: foundMerchant })
        .populate('additionalInformation')
        .populate('option')
        .populate('coverImage')
        .populate('thumbnail')
        .populate('term')
        .populate('merchant')
        .lean()
        .exec();

      products.map((product) => {
        product.option.map((option) => {
          if (
            option.price &&
            option.price instanceof mongoose.Types.Decimal128
          ) {
            option.price = parseFloat(option.price.toString());
          }
        });
      });

      return sendSuccess(res, 'success', 200, {
        merchant: foundMerchant,
        product: products,
      });
    } catch (error) {
      logger.error(`/GET /product/store/:storeName ERROR: ${error.message}`);
      return sendError(res, error.message, 500);
    }
  }
);

//Get Product store by UID
router.get(
  '/store/uid/:uid',
  checkBasicAuth,
  cacheMiddleware(3600),
  async (req, res) => {
    try {
      const { uid } = req.params;
      logger.info(`/GET /product/store/uid/:uid START: ${uid}`);

      const product = await Product.findOne({ uid: uid })
        .populate('additionalInformation')
        .populate('option')
        .populate('coverImage')
        .populate('thumbnail')
        .populate('term')
        .populate('merchant')
        .lean()
        .exec();

      product.option.map((option) => {
        if (option.price && option.price instanceof mongoose.Types.Decimal128) {
          option.price = parseFloat(option.price.toString());
        }
      });

      return sendSuccess(res, 'success', 200, { product });
    } catch (error) {
      logger.error(`/GET /product/store/uid/:uid ERROR: ${error.message}`);
      return sendError(res, error.message, 500);
    }
  }
);

router.get(
  '/affiliate/uid/:uid',
  checkBasicAuth,
  cacheMiddleware(3600),
  async (req, res) => {
    try {
      const { uid } = req.params;
      logger.info(`/GET /product/affiliate/uid/:uid START: ${uid}`);

      const affiliates = await Affiliate.findOne({ uid: uid })
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
        .lean()
        .exec();

      if (
        affiliates.commission &&
        affiliates.commission instanceof mongoose.Types.Decimal128
      ) {
        affiliates.commission = parseFloat(affiliates.commission.toString());
      }

      affiliates.product.option.map((option) => {
        if (option.price && option.price instanceof mongoose.Types.Decimal128) {
          option.price = parseFloat(option.price.toString());
        }
      });

      return sendSuccess(res, 'success', 200, { affiliates });
    } catch (error) {
      logger.error(`/GET /product/affiliate/uid/:uid ERROR: ${error.message}`);
      return sendError(res, error.message, 500);
    }
  }
);

module.exports = router;
