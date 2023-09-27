const { createClient } = require('redis');
const logger = require('../log');

async function get(key) {
  try {
    const client = createClient({
      password: 'Xk99TWezkDCQgh45EfZrGjw1vgK8Jph7',
      socket: {
        host: 'redis-14266.c295.ap-southeast-1-1.ec2.cloud.redislabs.com',
        port: 14266,
      },
    });
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
    const client = createClient({
      password: 'Xk99TWezkDCQgh45EfZrGjw1vgK8Jph7',
      socket: {
        host: 'redis-14266.c295.ap-southeast-1-1.ec2.cloud.redislabs.com',
        port: 14266,
      },
    });
    await client.connect();

    await client.set(key, value);

    await client.disconnect();
  } catch (error) {
    logger.error(`redis set ERROR: ${error.message}`);
  }
}
async function del(key) {
  try {
    const client = createClient({
      password: 'Xk99TWezkDCQgh45EfZrGjw1vgK8Jph7',
      socket: {
        host: 'redis-14266.c295.ap-southeast-1-1.ec2.cloud.redislabs.com',
        port: 14266,
      },
    });
    await client.connect();

    await client.del(key);

    await client.disconnect();
  } catch (error) {
    logger.error(`redis del ERROR: ${error.message}`);
  }
}
module.exports = { get, set };
