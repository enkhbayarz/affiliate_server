const logger = require('../log');
const cache = require('memory-cache');

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = '__express__' + req.originalUrl || req.url;
    logger.info(`/GET __express__ cache START: ${req.originalUrl || req.url}`);

    const cachedBody = cache.get(key);

    if (cachedBody) {
      res.setHeader('Content-Type', 'application/json');
      res.send(cachedBody);
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        cache.put(key, body, duration * 1000);
        res.setHeader('Content-Type', 'application/json');
        res.sendResponse(body);
      };
      next();
    }
  };
};

const clearCacheMiddleware = (condition, url) => {
  return (req, res, next) => {
    if (condition(req)) {
      const key = '__express__' + url;
      cache.del(key);
    }
    next();
  };
};

module.exports = { cacheMiddleware };
