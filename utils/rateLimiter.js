const logger = require('./logger');

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT) || 10;
const RATE_WINDOW_MS = (parseInt(process.env.RATE_WINDOW_SEC) || 60) * 1000;
const MAX_MAP_SIZE = 10000;

const userRequests = new Map();

function cleanupExpired() {
  const now = Date.now();
  for (const [chatId, data] of userRequests.entries()) {
    if (now - data.windowStart > RATE_WINDOW_MS) {
      userRequests.delete(chatId);
    }
  }
}

function tryCleanup() {
  if (userRequests.size > MAX_MAP_SIZE) {
    cleanupExpired();
  }
}

const sweepTimer = setInterval(cleanupExpired, RATE_WINDOW_MS);
if (typeof sweepTimer.unref === 'function') sweepTimer.unref();

function isRateLimited(chatId) {
  tryCleanup();
  const now = Date.now();
  const userData = userRequests.get(chatId);

  if (!userData || now - userData.windowStart > RATE_WINDOW_MS) {
    userRequests.set(chatId, { count: 1, windowStart: now });
    return { limited: false, remaining: RATE_LIMIT - 1, retryAfter: 0 };
  }

  if (userData.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((RATE_WINDOW_MS - (now - userData.windowStart)) / 1000);
    logger.warn('Rate limit exceeded', { chatId, retryAfter });
    return { limited: true, remaining: 0, retryAfter };
  }

  userData.count++;
  return { limited: false, remaining: RATE_LIMIT - userData.count, retryAfter: 0 };
}

module.exports = { isRateLimited };
