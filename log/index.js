const winston = require('winston');
const { format } = require('winston');

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};

const customTimestamp = format((info, opts) => {
  const date = new Date();
  const gmtPlus8Time = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  info.timestamp = gmtPlus8Time.toISOString();
  return info;
});

const logger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(customTimestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
if (process.env.NODE_ENV !== 'PROD') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}
module.exports = logger;
