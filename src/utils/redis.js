const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

client.on('connect', () => console.log('Redis connecté'));
client.on('error', (err) => console.error('Erreur Redis:', err));

client.connect();

module.exports = client;
