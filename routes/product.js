const express = require('express');
let router = express.Router();

const Product = require('../models/product');
const Merchant = require('../models/merchant');
const AdditionalInformation = require('../models/additionalInformation');
const Option = require('../models/option');
const Image = require('../models/image');
const Term = require('../models/term');
const Affiliate = require('../models/affiliate');

const uuid = require('uuid');

const logger = require('../log');
const { verifyToken, checkBasicAuth } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');

//Product

//Create Product
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
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
      price,
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

//Get Product by Merchant
router.get('/', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /product START: ${JSON.stringify(foundCustomer)}`);

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, []);
    }
    const product = await Product.find({ merchant: foundMerchant });

    return sendSuccess(res, 'success', 200, { product });
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

//Get Products by store Name
router.get('/store/:id', checkBasicAuth, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`/GET /product/store/:id START: ${id}`);

    const foundMerchant = await Merchant.findById(id);

    if (!foundMerchant) {
      return sendError(res, 'merchant not found', 404);
    }
    const product = await Product.find({ merchant: foundMerchant })
      .populate('additionalInformation')
      .populate('option')
      .exec();

    return sendSuccess(res, 'success', 200, {
      merchant: foundMerchant,
      product: product,
    });
  } catch (error) {
    logger.error(`/GET /product/store/:storeName ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//Get Product store by UID
router.get('/store/uid/:uid', checkBasicAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    logger.info(`/GET /product/store/uid/:uid START: ${uid}`);

    const product = await Product.findOne({ uid: uid })
      .populate('additionalInformation')
      .populate('option')
      .exec();

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

    const affiliate = await Affiliate.findOne({ uid: uid })
      .populate('product')
      .exec();

    return sendSuccess(res, 'success', 200, { affiliate });
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
//       console.log(error)
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
//       console.log(error)
//       res.status(500).json({message: error.message})
//   }

// })

module.exports = router;
