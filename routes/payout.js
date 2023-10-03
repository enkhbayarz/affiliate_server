const express = require('express');
let router = express.Router();

const { Merchant, Transaction } = require('../models/index');
const { Decimal128 } = require('mongoose').Types;

const { verifyToken } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../log');
const { set, get, getAsync } = require('../redis');
const { payoutMerchantRedis } = require('../utils/const');

//Payout
//Get Payout
router.get('/', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /payout START: ${JSON.stringify(foundCustomer)}`);

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, null);
    }
    const val = await get(`${payoutMerchantRedis}${foundMerchant._id}`);

    if (val) {
      return sendSuccess(res, 'success', 200, JSON.parse(val));
    } else {
      let revenue = await Transaction.aggregate([
        {
          $match: {
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              merchant: foundMerchant._id,
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
            title: 'Revenue',
            type: 'amount',
            value: '$value',
          },
        },
      ]).exec();

      const revenueByDay = await Transaction.aggregate([
        {
          $match: {
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              day: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$updatedAt',
                  timezone: 'Asia/Shanghai', // Replace with your desired timezone
                },
              },
            },
            totalAmount: {
              $sum: { $toDouble: '$afterFee' },
            },
          },
        },
        {
          $project: {
            _id: 0,
            day: '$_id.day',
            totalAmount: '$totalAmount',
          },
        },
        {
          $sort: {
            day: 1, // Sort by day in ascending order
          },
        },
      ]);

      const revenueByWeek = await Transaction.aggregate([
        {
          $match: {
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              week: {
                $dateToString: {
                  format: '%Y-%U',
                  date: '$updatedAt',
                  timezone: 'Asia/Shanghai', // Replace with your desired timezone
                },
              },
            },
            totalAmount: {
              $sum: { $toDouble: '$afterFee' },
            },
          },
        },
        {
          $project: {
            _id: 0,
            week: '$_id.week',
            totalAmount: '$totalAmount',
          },
        },
        {
          $sort: {
            week: 1, // Sort by week in ascending order
          },
        },
      ]);

      const revenueByMonth = await Transaction.aggregate([
        {
          $match: {
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: {
              month: {
                $dateToString: {
                  format: '%Y-%m',
                  date: '$updatedAt',
                  timezone: 'Asia/Shanghai', // Replace with your desired timezone
                },
              },
            },
            totalAmount: {
              $sum: { $toDouble: '$afterFee' },
            },
          },
        },
        {
          $project: {
            _id: 0,
            month: '$_id.month',
            totalAmount: '$totalAmount',
          },
        },
        {
          $sort: {
            month: 1, // Sort by month in ascending order
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
            },
            value: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            title: 'Sales',
            type: 'count',
            value: '$value',
          },
        },
      ]).exec();

      const members = await Transaction.aggregate([
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
              customer: '$customer',
            },
          },
        },
        {
          $group: {
            _id: '$_id.merchant',
            value: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id',
            title: 'Unique Customers',
            type: 'count',
            value: '$value',
          },
        },
      ]).exec();

      const tranList = await Transaction.aggregate([
        {
          $match: {
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $lookup: {
            from: 'merchants',
            localField: 'merchant',
            foreignField: '_id',
            as: 'merchantInfo',
          },
        },
        {
          $unwind: '$merchantInfo',
        },
        {
          $lookup: {
            from: 'customers',
            localField: 'customer',
            foreignField: '_id',
            as: 'customerInfo',
          },
        },
        {
          $unwind: '$customerInfo',
        },
        {
          $project: {
            _id: 0,
            afterFee: { $toDouble: '$afterFee' }, // Use afterFee instead of amount
            updatedAt: {
              $dateToString: {
                date: '$updatedAt',
                format: '%Y-%m-%d %H:%M:%S',
                timezone: 'Asia/Shanghai',
              },
            },
            'customerInfo.email': 1,
            'merchantInfo.storeName': 1,
          },
        },
        {
          $sort: { updatedAt: -1 }, // Sort by updatedAt in descending order
        },
        {
          $group: {
            _id: '$merchantInfo.storeName',
            transactions: {
              $push: {
                totalAmount: '$afterFee',
                updatedAt: '$updatedAt',
                customerEmail: '$customerInfo.email',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            transactions: { $slice: ['$transactions', 5] },
          },
        },
      ]).exec();

      await set(
        `${payoutMerchantRedis}${foundMerchant._id}`,
        JSON.stringify({
          cards: {
            revenue,
            sales,
            members,
          },
          overview: {
            revenueByDay,
            revenueByWeek,
            revenueByMonth,
          },
          tranList,
        })
      );
      return sendSuccess(res, 'success', 200, {
        cards: {
          revenue,
          sales,
          members,
        },
        overview: {
          revenueByDay,
          revenueByWeek,
          revenueByMonth,
        },
        tranList,
      });
    }
  } catch (error) {
    logger.error(`/GET /payout ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

// //Tran list
// router.get('/list', verifyToken, async (req, res) => {
//   try {
//     const foundCustomer = req.customer;
//     logger.info(`/GET /payout START: ${JSON.stringify(foundCustomer)}`);

//     const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
//     if (!foundMerchant) {
//       return sendSuccess(res, 'success', 200, {});
//     }

//     return sendSuccess(res, 'success', 200, { list });
//   } catch (error) {
//     logger.error(`/GET /payout ERROR: ${error.message}`);
//     return sendError(res, error.message, 500);
//   }
// });

module.exports = router;
