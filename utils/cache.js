const logger = require('./logger');

const CACHE_TTL = 30 * 1000; // 30 seconds

const cache = new Map();

function getCacheKey(symbol, currency, id = null) {
  const base = `${symbol.toLowerCase()}_${currency.toUpperCase()}`;
  return id ? `${base}_${id}` : base;
}

function get(symbol, currency, id = null) {
  const key = getCacheKey(symbol, currency, id);
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    try {
      cache.delete(key);
    } catch (err) {
      logger.error('Cache cleanup failed', { error: err.message });
    }
    return null;
  }
  
  return entry.data;
}

function set(symbol, currency, data, id = null) {
  try {
    const key = getCacheKey(symbol, currency, id);
    cache.set(key, { data, timestamp: Date.now() });
  } catch (err) {
    logger.error('Cache set failed', { error: err.message });
  }
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      try {
        cache.delete(key);
      } catch (err) {
        logger.error('Cache cleanup failed', { error: err.message });
      }
    }
  }
}

const cleanupTimer = setInterval(cleanup, CACHE_TTL / 2);
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

module.exports = { get, set, CACHE_TTL };
