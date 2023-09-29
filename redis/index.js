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

// const getAsync = promisify(client.get).bind(client);

async function get(key) {
  try {
    await client.connect();

    const val = await client.get(key);

    await client.disconnect();

    return val;
  } catch (error) {
    logger.error(`redis get ERROR: ${error.message}`);
  }
}

async function set(key, value) {
  try {
    await client.connect();

    await client.set(key, value);

    await client.disconnect();
  } catch (error) {
    logger.error(`redis set ERROR: ${error.message}`);
  }
}
async function del(key) {
  try {
    await client.connect();

    await client.del(key);

    await client.disconnect();
  } catch (error) {
    logger.error(`redis del ERROR: ${error.message}`);
  }
}

async function setCustomerCount(key) {
  try {
    await client.connect();

    await client.incr(key);

    client.disconnect();

    return true;
  } catch (error) {
    logger.error(`redis setCustomerCount ERROR: ${error.message}`);
    return false;
  }
}

module.exports = { get, set, del, setCustomerCount };
