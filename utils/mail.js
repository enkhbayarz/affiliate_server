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
    const emailList = process.env.EMAIL_LIST_CHECK;

    if (emailList.includes(email)) {
      logger.info(`send mail START: ${JSON.stringify(message)}`);
      await transporter.sendMail(message);
    }
    return 'success';
  } catch (e) {
    logger.error(`send mail ERROR: ${e.message}`);
    return e.message;
  }
}

async function sendMailOtp(email, otp) {
  return sendMail({
    email,
    subject: 'Social Club',
    text: `OTP code: ${otp}`,
  });
}

async function sendMailAffiliate(email, affiliate) {
  return sendMail({
    email,
    subject: 'Social Club',
    text: `Affiliate Link: ${affiliate}`,
  });
}

async function sendMailAffiliateAndSignup(email, affiliate, signup) {
  return sendMail({
    email,
    subject: 'Social Club',
    text: `Affiliate Link: ${affiliate} \n\n\n Signup Link: ${signup}`,
  });
}

async function sendMailForgetPassword(email, forgetPassword) {
  return sendMail({
    email,
    subject: 'Social Club',
    text: `Forget password: ${forgetPassword}`,
  });
}

module.exports = {
  sendMailOtp,
  sendMailAffiliate,
  sendMailForgetPassword,
  sendMailAffiliateAndSignup,
};
