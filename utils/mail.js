const nodemailer = require('nodemailer');
const logger = require('../log');

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL,
      pass: process.env.GMAIL_PASSWORD,
    },
  });
}

async function sendMail({ email, subject, text, html }) {
  logger.info('send mail START: ');

  const transporter = createTransporter();

  const message = {
    from: process.env.GMAIL,
    to: email,
    subject,
    text,
    html,
  };

  try {
    logger.info(`send mail MESSAGE: ${JSON.stringify(message)}`);
    await transporter.sendMail(message);
    logger.info(`send mail success:`);

    return 'success';
  } catch (e) {
    logger.error(`send mail ERROR: ${e.message}`);
    return e.message;
  }
}

async function sendMailOtp(email, otp) {
  logger.info(`/SEND mailOtp START: ${email} ${otp}`);
  return sendMail({
    email,
    subject: 'Sell Stream',
    text: `OTP code: ${otp}`,
  });
}

async function sendMailAffiliate(email, affiliate) {
  logger.info(`/SEND MailAffiliate START: ${email} ${affiliate}`);
  return sendMail({
    email,
    subject: 'Sell Stream',
    text: `Affiliate Link: ${affiliate}`,
  });
}

async function sendMailAffiliateAndSignup(email, affiliate, signup) {
  logger.info(
    `/SEND MailAffiliateAndSignup START: ${email} ${affiliate} ${signup}`
  );
  return sendMail({
    email,
    subject: 'Sell Stream',
    text: `Affiliate Link: ${affiliate} \n\n\n Signup Link: ${signup}`,
  });
}

async function sendMailForgetPassword(email, forgetPassword) {
  logger.info(`/SEND MailForgetPassword START: ${email} ${forgetPassword}`);
  return sendMail({
    email,
    subject: 'Sell Stream',
    text: `Forget password: ${forgetPassword}`,
  });
}

async function sendMailAfterPurchase(email) {
  logger.info(`/SEND sendMailAfterPurchase START: ${email}`);
  const htmlContent = `
  <p>Худалдан авалт хийсэнд баярлалаа. Та дараах QR зурагыг уншуулж telegram-даа орно уу.</p>
  <img src="${process.env.TELEGRAM_QR_IMAGE}" alt="Image">`;
  return sendMail({
    email,
    subject: 'Sell Stream',
    html: htmlContent,
  });
}

module.exports = {
  sendMailOtp,
  sendMailAffiliate,
  sendMailForgetPassword,
  sendMailAffiliateAndSignup,
  sendMailAfterPurchase,
};
