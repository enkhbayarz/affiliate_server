const express = require('express');
let router = express.Router();

const Affiliate = require('../models/affiliate');
const Customer = require('../models/customer');
const Product = require('../models/product');
const Merchant = require('../models/merchant');
const AffiliateCustomer = require('../models/affiliateCustomer');

const uuid = require('uuid');

const { verifyToken } = require('../middleware/token');
const logger = require('../log');
const { sendSuccess, sendError } = require('../utils/response');
const { sendMailAffiliate } = require('../utils/mail');

//Affiliate

//Create Affiliate
router.post('/', verifyToken, async (req, res) => {
  try {
    const { email, list } = req.body;
    logger.info(`/POST /affiliate START: ${email} ${JSON.stringify(list)}`);

    const customer = req.customer;
    const merchant = await Merchant.findOne({ customer: customer });

    if (!merchant) {
      return sendError(
        res,
        'Can not add affiliate. You have to add product first',
        404
      );
    }

    const foundCustomer = await Customer.findOne({ email: email });
    if (!foundCustomer) {
      return sendError(res, 'Customer not found!', 404);
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

      const v4Uuid = uuid.v4();
      const link = `${process.env.BASE_URL}/affiliate/${v4Uuid}`;

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

    sendMailAffiliate(
      email,
      affiliates.map((affiliate) => affiliate.link).join('\n')
    );

    return sendSuccess(res, 'success', 200, 'true');
  } catch (error) {
    logger.error(`/POST /affiliate ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//Get Affiliate own affiliateCustomer
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

    const affiliate = await Affiliate.find({
      affiliateCustomer: affiliateCustomer,
    });
    return sendSuccess(res, 'success', 200, { affiliate });
  } catch (error) {
    logger.error(`/POST /affiliate/own ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

//Get Affiliate merchant
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

    const affiliates = await Affiliate.find({ merchant: foundMerchant });
    return sendSuccess(res, 'success', 200, { affiliates });
  } catch (error) {
    logger.error(`/POST /affiliate/merchant ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

router.get('/uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    logger.info(`/GET /affiliate/uid/:uid START: ${uid}}`);

    const affiliate = await Affiliate.findOne({ uid: uid })
      .populate('product')
      .exec();

    return sendSuccess(res, 'success', 200, { affiliate });
  } catch (error) {
    logger.error(`/GET /affiliate/uid/:uid ERROR: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

router.get('/list/uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    logger.info(`/GET /affiliate/list/uid/:uid START: ${uid}}`);

    const foundAffiliate = await Affiliate.findOne({ uid: uid });

    console.log(foundAffiliate);

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

// router.put('/:id', async(req, res) => {

//   try {
//       const {id} = req.params;
//       const affiliate = await Affiliate.findByIdAndUpdate(id, req.body)

//       if(!affiliate){
//           return res.status(404).json({message: "affiliate not found"})
//       }
//       const updatedAffiliate = await Affiliate.findById(id);

//       res.status(200).json(updatedAffiliate)

//   } catch (error) {
//       console.log(error)
//       res.status(500).json({message: error.message})
//   }

// })

// router.delete('/:id', async(req, res) => {

//   try {
//     const {id} = req.params;
//       const affiliate = await Affiliate.findByIdAndDelete(id, req.body)

//       if(!affiliate){
//         return res.status(404).json({message: "affiliate not found"})
//       }

//       res.status(200).json(affiliate)

//   } catch (error) {
//       console.log(error)
//       res.status(500).json({message: error.message})
//   }

// })

module.exports = router;
