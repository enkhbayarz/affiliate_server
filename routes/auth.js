const express = require('express');
let router = express.Router();

const { Customer, Otp, ForgetPassword, Signup } = require('../models/index');

const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const { checkBasicAuth, verifyToken } = require('../middleware/token');
const { sendSuccess, sendError } = require('../utils/response');
const { sendMailForgetPassword } = require('../utils/mail');

const logger = require('../log');
const secretKey = `${process.env.SECRET_KEY}`;

const generateTokens = (res, email, userId) => {
  const accessToken = jwt.sign({ email, id: userId }, secretKey, {
    expiresIn: '24h',
  });

  const refreshToken = jwt.sign({ email, id: userId }, secretKey, {
    expiresIn: '30d',
  });

  const currentTimestamp = new Date().getTime();

  const expires_in = currentTimestamp + 24 * 60 * 60 * 1000;

  const refresh_expires_in = currentTimestamp + 30 * 24 * 60 * 60 * 1000;

  return sendSuccess(res, 'success', 200, {
    accessToken,
    refreshToken,
    expires_in,
    refresh_expires_in,
  });
};

router.get('/signup/token/:token/:email', checkBasicAuth, async (req, res) => {
  try {
    const { token, email } = req.params;
    logger.info(
      `/POST /auth/signup/token/:token/:email START: ${token}  ${email}`
    );

    const foundSignup = await Signup.findOne({ token: token });
    if (!foundSignup) {
      return sendError(res, 'token not found', 404);
    }

    if (foundSignup.email !== email) {
      return sendError(res, 'email is not right', 400);
    }
    return sendSuccess(res, 'success', 200, 'true');
  } catch (error) {
    logger.error(
      `/POST /auth/signup/token/:token/:email ERROR: ${error.message}`
    );
    sendError(res, error.message, 500);
  }
});
router.post(
  '/signup',
  [body('email').isEmail().withMessage('Invalid email format')],
  checkBasicAuth,
  async (req, res) => {
    try {
      const { email, password, otpCode, token } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => error.msg);
        return sendError(res, errorMessages.toString(), 404);
      }

      logger.info(
        `/POST /auth/signup START: ${email} ${password} ${otpCode} ${token}`
      );

      const foundSignup = await Signup.findOne({ token: token });
      if (!foundSignup) {
        return sendError(res, 'token not found', 404);
      }

      if (foundSignup.email !== email) {
        return sendError(res, 'email is not right', 400);
      }

      const foundOtp = await Otp.findOne({ email: email });
      if (!foundOtp) {
        return sendError(res, 'otp not found', 404);
      }

      const currentTime = new Date();
      const timeDifference = currentTime - foundOtp.updatedAt;
      const timeDifferenceInSeconds = timeDifference / 1000;

      if (timeDifferenceInSeconds > 60) {
        return sendError(res, 'otp expired send again!', 400);
      } else {
        if (foundOtp.otpCode == otpCode) {
          const foundCustomer = await Customer.findOne({ email: email });
          if (foundCustomer) {
            if (foundCustomer.password) {
              return generateTokens(res, email, foundCustomer._id);
            } else {
              const saltRounds = 10;
              const hashedPassword = await bcrypt.hash(password, saltRounds);

              foundCustomer.password = hashedPassword;

              await foundCustomer.save();

              return generateTokens(res, email, foundCustomer._id);
            }
          } else {
            return sendError(res, 'customer not match', 400);
          }
        } else {
          return sendError(res, 'otp not match', 400);
        }
      }
    } catch (error) {
      logger.error(`/POST /auth/signup ERROR: ${error.message}`);
      sendError(res, error.message, 500);
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail().withMessage('Invalid email format')],
  checkBasicAuth,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => error.msg);
        return sendError(res, errorMessages.toString(), 404);
      }

      logger.info(`/POST /auth/login START: ${email} ${password}`);

      const foundCustomer = await Customer.findOne({ email: email });

      if (!foundCustomer) {
        return sendError(res, 'Customer not found', 404);
      }

      if (!foundCustomer.password) {
        return sendError(res, 'Go to signup', 404);
      }

      const passwordMatch = await bcrypt.compare(
        password,
        foundCustomer.password
      );

      if (!passwordMatch) {
        return sendError(res, 'Password does not match', 401);
      }

      return generateTokens(res, email, foundCustomer._id);
    } catch (error) {
      logger.error(`/POST /auth/login ERROR: ${error.message}`);
      sendError(res, error.message, 500);
    }
  }
);

router.post('/refresh-token', verifyToken, async (req, res) => {
  try {
    logger.info(`/POST /auth/refresh-token START: `);

    const foundCustomer = req.customer;

    const newAccessToken = jwt.sign(
      { email: foundCustomer.email, id: foundCustomer._id },
      secretKey,
      {
        expiresIn: '24h',
      }
    );

    sendSuccess(res, 'success', 200, { accessToken: newAccessToken });
  } catch (error) {
    logger.error(`/POST /refresh-token ERROR: ${error.message}`);
    sendError(res, 'Invalid refresh token', 401);
  }
});

router.post('/forgot-password', checkBasicAuth, async (req, res) => {
  try {
    const { email } = req.body;
    const uid = uuid.v4();

    logger.info(`/POST /auth/forgot-password START: ${email} ${uid}`);

    const foundCustomer = await Customer.findOne({ email: email });
    if (!foundCustomer) {
      return sendError(res, 'Customer not found. You should just sign up', 404);
    }

    const foundForgetPassword = await ForgetPassword.findOne({ email: email });
    if (foundForgetPassword) {
      foundForgetPassword.uid = uid;
      await foundForgetPassword.save();

      const link = `${process.env.WEB_BASE_URL}/api/auth/forget-password/${uid}`;

      sendMailForgetPassword(email, link);

      return sendSuccess(res, 'success', 200, link);
    } else {
      const forgetPassword = new ForgetPassword();
      forgetPassword.email = email;
      forgetPassword.uid = uid;

      await forgetPassword.save();

      const link = `${process.env.BASE_URL}/forget-password/${uid}`;

      sendMailForgetPassword(email, link);
      return sendSuccess(res, 'success', 200, link);
    }
  } catch (error) {
    logger.error(`/POST /auth/forgot-password ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

router.get('/password-reset/:uid', checkBasicAuth, async (req, res) => {
  try {
    const { uid } = req.params;

    logger.info(`/GET /auth/password-reset/:uid START: ${uid}`);

    const foundForgetPassword = await ForgetPassword.findOne({ uid: uid });
    if (!foundForgetPassword) {
      return sendError(res, 'Forget password not found', 404);
    }
    const currentTime = new Date();
    const timeDifference = currentTime - foundForgetPassword.updatedAt;
    const timeDifferenceInSeconds = timeDifference / 1000;
    if (timeDifferenceInSeconds > 300) {
      return sendError(res, 'Link has expired send new one', 400);
    }
    return sendSuccess(res, 'success', 200, foundForgetPassword);
  } catch (error) {
    logger.error(`/GET /auth/password-reset/:uid ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

router.post('/password-reset/:uid', checkBasicAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    const { newPassword } = req.body;
    logger.info(`/POST /auth/password-reset/:uid START: ${uid}`);

    const foundForgetPassword = await ForgetPassword.findOne({ uid: uid });
    if (!foundForgetPassword) {
      return sendError(res, 'Forget password not found', 404);
    }

    const email = foundForgetPassword.email;

    const foundCustomer = await Customer.findOne({
      email: email,
    });
    if (!foundCustomer) {
      return sendError(res, 'Customer not found', 404);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    foundCustomer.password = hashedPassword;

    await foundCustomer.save();

    return generateTokens(res, email, foundCustomer._id);
  } catch (error) {
    logger.error(`/POST /auth/password-reset/:uid ERROR: ${error.message}`);
    sendError(res, error.message, 500);
  }
});

module.exports = router;

// router.post('/google', checkBasicAuth, async (req, res) => {
//   try {
//     const { email, name, profileImage } = req.body;

//     logger.info(`/POST /auth/google START: ${email}, ${name}, ${profileImage}`);

//     const foundCustomer = await Customer.findOne({ email: email });

//     if (foundCustomer) {
//       const token = jwt.sign({ email, id: foundCustomer._id }, secretKey, {
//         expiresIn: '60m',
//       });

//       sendSuccess(res, 'success', 200, { token });
//     } else {
//       const customer = new Customer();
//       customer.email = email;
//       customer.name = name;
//       customer.profileImage = profileImage;

//       await customer.save();

//       const token = jwt.sign({ email, id: customer._id }, secretKey, {
//         expiresIn: '60m',
//       });

//       sendSuccess(res, 'success', 200, { token });
//     }
//   } catch (error) {
//     logger.error(`/POST /auth/google ERROR: ${error.message}`);
//     sendError(res, error.message, 500);
//   }
// });
