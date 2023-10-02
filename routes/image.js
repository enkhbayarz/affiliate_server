const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
let router = express.Router();

const { Image } = require('../models/index');

const { verifyToken } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const s3 = require('../s3');
const logger = require('../log');

const generateFileName = (bytes = 8) => {
  const randomBytes = crypto.randomBytes(bytes);
  return randomBytes.toString('hex').slice(0, bytes * 2);
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//Image
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  const sizes = [
    { name: 'phone', width: 480, height: 320 },
    { name: 'tablet', width: 1024, height: 768 },
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'thumb', width: 100, height: 100 },
  ];

  const { file, type } = req;

  try {
    const foundCustomer = req.customer;
    logger.info(`/POST /image/upload START: ${foundCustomer}}`);

    const emailList = process.env.EMAIL_LIST_CHECK;

    if (emailList.includes(foundCustomer.email)) {
      if (file) {
        const imageUrls = {};

        await Promise.all(
          sizes.map(async (size) => {
            const resizedImage = await sharp(file.buffer)
              .resize({ width: size.width, height: size.height, fit: 'fill' })
              .toBuffer();

            const fileName = generateFileName();

            const s3UploadResponse = await s3
              .upload({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: `images/${size.name}/${foundCustomer._id}/${fileName}`,
                Body: resizedImage,
                ContentType: file.mimetype,
              })
              .promise();

            imageUrls[size.name] = s3UploadResponse.Location;
          })
        );

        const image = new Image();
        image.type = type;
        image.phone = imageUrls['phone'];
        image.tablet = imageUrls['tablet'];
        image.desktop = imageUrls['desktop'];
        image.thumb = imageUrls['thumb'];

        await image.save();

        return sendSuccess(res, 'success', 200, image);
      } else {
        return sendError(res, 'NO file uploaded', 400);
      }
    } else {
      return sendError(res, 'can not add product', 400);
    }
  } catch (error) {
    logger.error(`/POST /image/upload ERROR: ${error.message}`);
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
