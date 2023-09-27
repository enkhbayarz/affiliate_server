const express = require('express');
let router = express.Router();
const uuid = require('uuid');
const mongoose = require('mongoose');

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
const cache = require('memory-cache');

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = '__express__' + req.originalUrl || req.url;
    const cachedBody = cache.get(key);

    if (cachedBody) {
      res.setHeader('Content-Type', 'application/json');
      res.send(cachedBody);
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        cache.put(key, body, duration * 1000);
        res.setHeader('Content-Type', 'application/json');
        res.sendResponse(body);
      };
      next();
    }
  };
};

const clearCacheMiddleware = (condition) => {
  return (req, res, next) => {
    if (condition(req)) {
      const key = '__express__' + req.originalUrl || req.url;
      cache.del(key);
    }
    next();
  };
};

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

    return sendSuccess(res, 'success', 200, { product });
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
      return sendSuccess(res, 'success', 200, []);
    }
    const products = await Product.find({ merchant: foundMerchant })
      .populate('thumbnail')
      .populate('option')
      .lean();

    products.map((product) => {
      product.option.map((option) => {
        if (option.price && option.price instanceof mongoose.Types.Decimal128) {
          option.price = parseFloat(option.price.toString());
        }
      });
    });

    return sendSuccess(res, 'success', 200, { products });
  } catch (error) {
    logger.error(`/GET /product ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get('/revenue-members', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /product START: ${JSON.stringify(foundCustomer)}`);

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, []);
    }
    const product = await Product.findById('6513cd44bb134393a3547845')
      .populate('thumbnail')
      .populate('option');

    const revenue = await Transaction.aggregate([
      {
        $group: {
          _id: {
            merchant: foundMerchant._id,
            product: product._id,
          },
          totalRevenue: { $sum: { $toDouble: '$afterFee' } },
        },
      },
      {
        $project: {
          _id: 0,
          merchant: '$_id.merchant',
          product: '$_id.product',
          totalRevenue: '$totalRevenue',
        },
      },
    ]);

    const members = await Transaction.aggregate([
      {
        $group: {
          _id: {
            merchant: foundMerchant._id,
            product: product._id,
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
          totalMembers: { $sum: 1 }, // Count the unique customers
        },
      },
      {
        $project: {
          _id: 0,
          merchant: '$_id.merchant',
          product: '$_id.product',
          totalMembers: '$totalMembers',
        },
      },
    ]);

    const transactionCount = await Transaction.aggregate([
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
          transactionCount: { $sum: 1 }, // Count transactions
        },
      },
      {
        $project: {
          _id: 0,
          merchant: '$_id.merchant',
          product: '$_id.product',
          transactionCount: '$transactionCount',
        },
      },
    ]);

    return sendSuccess(res, 'success', 200, {
      revenue,
      members,
      transactionCount,
    });
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
  cacheMiddleware(10),
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
router.get('/store/uid/:uid', checkBasicAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    logger.info(`/GET /product/store/uid/:uid START: ${uid}`);

    const product = await Product.findOne({ uid: uid })
      .populate('additionalInformation')
      .populate('option')
      .populate('coverImage')
      .populate('thumbnail')
      .populate('term')
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
});

router.get('/affiliate/uid/:uid', checkBasicAuth, async (req, res) => {
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
});

// router.put('/:id', verifyToken, async(req, res) => {

//   try {
//       const {id} = req.params;
//       const product = await Product.findByIdAndUpdate(id, req.body)

//       if(!product){
//           return res.status(404).json({message: "customer not found"})
//       }
//       const updatedProduct = await Product.findById(id);

//       res.status(200).json(updatedProduct)

//   } catch (error) {
//       res.status(500).json({message: error.message})
//   }

// })

// router.delete('/:id', verifyToken, async(req, res) => {

//   try {
//     const {id} = req.params;
//       const product = await Product.findByIdAndDelete(id, req.body)

//       if(!product){
//         return res.status(404).json({message: "customer not found"})
//       }

//       res.status(200).json(product)

//   } catch (error) {
//       res.status(500).json({message: error.message})
//   }

// })

module.exports = router;
