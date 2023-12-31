const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const logger = require('./log');
const cors = require('cors');
const app = express();

const {
  customerRoute,
  productRoute,
  qpayRoute,
  affiliateRoute,
  authRoute,
  payoutRoute,
  imageRoute,
  otpRoute,
  merchantRoute,
} = require('./routes/index');

//midllewares
const allowedOrigins = [
  'https://gum-road.vercel.app',
  'http://localhost:3000',
  'https://www.sellstream.store',
  'https://sellstream.store',
  'https://www.sellstream.shop',
  'https://sellstream.shop',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static('public'));

app.get('/', (req, res) => {
  res.send('Welcome to Sell Stream Store');
});

app.use('/affiliate', affiliateRoute);
app.use('/auth', authRoute);
app.use('/customer', customerRoute);
app.use('/payout', payoutRoute);
app.use('/product', productRoute);
app.use('/image', imageRoute);
app.use('/otp', otpRoute);
app.use('/merchant', merchantRoute);
app.use('/', qpayRoute);

mongoose.set('strictQuery', false);

mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    logger.info('MongoDb is connecting');
    app.listen(process.env.PORT, () => {
      logger.info(`App listening on port ${process.env.PORT}`);
    });
  });
