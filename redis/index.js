const { createClient } = require('redis');
const logger = require('../log');
const { promisify } = require('util');

const client = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

const getAsync = promisify(client.get).bind(client);
const existsAsync = promisify(client.exists).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);
const incrAsync = promisify(client.incr).bind(client);

// const getAsync = promisify(client.get).bind(client);

async function get(key) {
  try {
    logger.info(`/REDIS /get key START: ${key}`);

    const val = await getAsync(key);

    return val;
  } catch (error) {
    logger.error(`redis get ERROR: ${error.message}`);
  }
}

async function exists(key) {
  try {
    logger.info(`/REDIS /exists key START: ${key}`);

    const val = await existsAsync(key);

    logger.info(`/REDIS /exists value: ${val}`);

    return val;
  } catch (error) {
    logger.error(`redis exists ERROR: ${error.message}`);
  }
}

async function set(key, value) {
  try {
    logger.info(`/REDIS /set key value START: ${key}`);

    await setAsync(key, value);
  } catch (error) {
    logger.error(`redis set ERROR: ${error.message}`);
  }
}
async function del(key) {
  try {
    logger.info(`/REDIS /del key START: ${key}`);

    await delAsync(key);
  } catch (error) {
    logger.error(`redis del ERROR: ${error.message}`);
  }
}

async function setCustomerCount(key) {
  try {
    logger.info(`/REDIS /setCustomerCount key START: ${key}`);

    await incrAsync(key);

    return true;
  } catch (error) {
    logger.error(`redis setCustomerCount ERROR: ${error.message}`);
    return false;
  }
}

module.exports = { get, set, del, setCustomerCount, exists };
