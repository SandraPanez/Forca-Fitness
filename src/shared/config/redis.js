const Redis = require('ioredis');
require('dotenv').config();

function createRedisConnection() {
  const useTls = process.env.REDIS_TLS === 'true';

  const options = {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };

  if (useTls) {
    options.tls = {};
  }

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, options);
  }

  return new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || undefined,
    ...options,
  });
}

const redisConnection = createRedisConnection();

redisConnection.on('error', (error) => {
  console.error('Error inesperado en Redis:', error.message);
});

async function checkRedisConnection() {
  if (redisConnection.status === 'wait') {
    await redisConnection.connect();
  }

  return (await redisConnection.ping()) === 'PONG';
}

module.exports = {
  redisConnection,
  checkRedisConnection,
};
