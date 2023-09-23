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
    await transporter.sendMail(message);
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

async function sendMailForgetPassword(email, forgetPassword) {
  return sendMail({
    email,
    subject: 'Social Club',
    text: `Forget password: ${forgetPassword}`,
  });
}

module.exports = {
  sendMail,
  sendMailOtp,
  sendMailAffiliate,
  sendMailForgetPassword,
};
