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

  const htmlContent = `
  <p>OTP code:</p>
  <p>${otp}</p>
`;

  return sendMail({
    email,
    subject: 'Sell Stream',
    html: htmlContent,
  });
}

async function sendMailAffiliate(email, affiliate) {
  logger.info(`/SEND MailAffiliate START: ${email} ${affiliate}`);

  const htmlContent = `
  <p>Affiliate Link:</p>
  <p>${affiliate}</p>
`;
  return sendMail({
    email,
    subject: 'Sell Stream',
    html: htmlContent,
  });
}

async function sendMailAffiliateAndSignup(email, affiliate, signup) {
  logger.info(
    `/SEND MailAffiliateAndSignup START: ${email} ${affiliate} ${signup}`
  );

  const htmlContent = `
  <p>Signup Link:</p>
  <a href="${signup}" style="background-color: #0088cc; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Sign up</a>
  <br>
  <br>
  <p>Affiliate Link:</p>
  <p>${affiliate}</p>
`;
  return sendMail({
    email,
    subject: 'Sell Stream',
    html: htmlContent,
  });
}

async function sendMailForgetPassword(email, forgetPassword) {
  logger.info(`/SEND MailForgetPassword START: ${email} ${forgetPassword}`);
  const htmlContent = `
  <p>Forget password: </p>
  <p>${forgetPassword}</p>
`;
  return sendMail({
    email,
    subject: 'Sell Stream',
    html: htmlContent,
  });
}

async function sendMailAfterPurchase(email) {
  logger.info(`/SEND sendMailAfterPurchase START: ${email}`);
  const htmlContent = `
  <p>Худалдан авалт хийсэнд баярлалаа. Та дараах Link-н дээр дарж эсвэл QR зурагыг уншуулж telegram-даа орно уу.</p>
  <br>
  <a href="${process.env.TELEGRAM_LINK}" style="background-color: #0088cc; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Click Here</a>
  `;
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
