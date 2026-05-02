const { Bot } = require('grammy');
const config = require('./config');
const logger = require('./utils/logger');

const SLOW_REQUEST_THRESHOLD_MS = 100;

const bot = new Bot(config.telegram.botToken);

const { registerStart } = require('./commands/start');
const { registerHelp } = require('./commands/help');
const { registerPrice } = require('./commands/price');
const { errorHandler } = require('./middleware/errorHandler');

bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  if (duration > SLOW_REQUEST_THRESHOLD_MS) {
    logger.info(`Request completed in ${duration}ms`, {
      chatId: ctx.msg?.chat?.id,
      command: ctx.message?.text?.split(' ')[0],
    });
  }
});

registerStart(bot);
registerHelp(bot);
registerPrice(bot);

bot.catch(({ error, ctx }) => errorHandler(error, ctx));

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await bot.stop();
  } catch (err) {
    logger.error('Error while stopping bot', { error: err.message });
  }
  logger.info('Bot shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
  process.exit(1);
});

logger.info('CryptoPriceBot starting...');
bot.start();
logger.info('CryptoPriceBot is running');
