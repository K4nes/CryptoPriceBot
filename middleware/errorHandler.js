const logger = require('../utils/logger');

async function errorHandler(err, ctx) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    chatId: ctx?.msg?.chat?.id,
    command: ctx?.message?.text,
  });

  if (!ctx) return;

  try {
    await ctx.reply('❌ Something went wrong. Please try again later.', {
      reply_parameters: { message_id: ctx.msg.message_id },
    });
  } catch (e) {
    logger.error('Failed to send error reply', { error: e.message });
  }
}

async function apiErrorHandler(err, ctx) {
  if (!err.response) {
    return errorHandler(err, ctx);
  }

  const status = err.response.status;
  const data = err.response.data;

  logger.error('API error', {
    status,
    data,
    chatId: ctx?.msg?.chat?.id,
  });

  if (!ctx) return;

  let message = '❌ Failed to fetch price data. Please try again later.';
  if (status === 429) {
    message = '⏳ API rate limit exceeded. Please try again later.';
  } else if (status === 401 || status === 403) {
    message = '⚠️ API configuration error. Contact the bot owner.';
  }

  try {
    await ctx.reply(message, { reply_parameters: { message_id: ctx.msg.message_id } });
  } catch (e) {
    logger.error('Failed to send API error reply', { error: e.message });
  }
}

module.exports = { errorHandler, apiErrorHandler };
