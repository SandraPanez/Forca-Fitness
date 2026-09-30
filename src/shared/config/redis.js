const { createClient } = require('redis');
require('dotenv').config();

const redisProtocol = process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
const redisUrl = process.env.REDIS_URL
  || `${redisProtocol}://${encodeURIComponent(process.env.REDIS_USERNAME || 'default')}:${encodeURIComponent(process.env.REDIS_PASSWORD || '')}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;

const client = createClient({ url: redisUrl });

client.on('error', (error) => {
  console.error('Error inesperado en el cliente de Redis:', error);
});

const checkConnection = async () => {
  if (!client.isOpen) {
    await client.connect();
  }

  return (await client.ping()) === 'PONG';
};

module.exports = {
  client,
  checkConnection
};
