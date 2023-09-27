const express = require('express');
let router = express.Router();

const { Merchant, Transaction } = require('../models/index');

const { verifyToken } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../log');
const { set, get } = require('../redis');

//Payout
//Get Payout
router.get('/', verifyToken, async (req, res) => {
  try {
    const foundCustomer = req.customer;
    logger.info(`/GET /payout START: ${JSON.stringify(foundCustomer)}`);

    const foundMerchant = await Merchant.findOne({ customer: foundCustomer });
    if (!foundMerchant) {
      return sendSuccess(res, 'success', 200, {});
    }
    const val = await get(`payout/${foundMerchant._id}`);

    if (val) {
      return sendSuccess(res, 'success', 200, JSON.parse(val));
    } else {
      const revenue = await Transaction.aggregate([
        {
          $match: {
            merchant: foundMerchant._id,
            status: 'PAID',
          },
        },
        {
          $group: {
            _id: 0,
            totalAmount: {
              $sum: { $toDouble: '$afterFee' },
            },
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
            transactionCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id.merchant',
            transactionCount: '$transactionCount',
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
            uniqueCustomersCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            merchant: '$_id',
            uniqueCustomersCount: '$uniqueCustomersCount',
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
                format: '%Y-%m-%d %H:%M:%S', // Format the date as 'yyyy-MM-dd HH:mm:ss'
                timezone: 'Asia/Shanghai', // Replace with your desired timezone
              },
            }, // Use updatedAt instead of updated_at
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
                afterFee: '$afterFee',
                updatedAt: '$updatedAt',
                customer_email: '$customerInfo.email',
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            transactions: { $slice: ['$transactions', 10] },
          },
        },
      ]).exec();

      await set(
        `payout/${foundMerchant._id}`,
        JSON.stringify({
          revenue,
          revenueByDay,
          revenueByWeek,
          revenueByMonth,
          sales,
          members,
          tranList,
        })
      );
      return sendSuccess(res, 'success', 200, {
        revenue,
        revenueByDay,
        revenueByWeek,
        revenueByMonth,
        sales,
        members,
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
