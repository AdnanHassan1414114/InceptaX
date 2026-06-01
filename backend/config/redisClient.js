/**
 * config/redisClient.js
 *
 * Single shared Redis client for the entire app.
 * Uses ioredis — install: npm install ioredis
 *
 * .env:
 *   REDIS_URL=redis://localhost:6379
 *   (or REDIS_URL=redis://:password@host:port for remote Redis)
 */

const Redis = require('ioredis');

let _client = null;

function getRedisClient() {
  if (_client) return _client;

  _client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    enableReadyCheck:     true,
    lazyConnect:          false,
  });

  _client.on('connect', () => console.log('✅ Redis connected'));
  _client.on('error',   (err) => console.error('❌ Redis error:', err.message));

  return _client;
}

module.exports = getRedisClient;