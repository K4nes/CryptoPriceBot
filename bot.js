const { Bot } = require('grammy');
const config = require('./config');
const logger = require('./utils/logger');

const SLOW_REQUEST_THRESHOLD_MS = 100;

const bot = new Bot(config.telegram.botToken);

/** Shown in Telegram when the user types `/` (Bot API setMyCommands). */
const BOT_COMMANDS = [
  { command: 'start', description: '👋 Welcome and command overview' },
  { command: 'help', description: '📖 /price format and examples' },
  { command: 'price', description: '💱 Crypto price from CoinMarketCap' },
];

/**
 * Scopes that need no chat/user ids (BotCommandScope*).
 * @see https://core.telegram.org/bots/api#botcommandscope
 */
const BOT_COMMAND_GLOBAL_SCOPES = [
  { type: 'default' },
  { type: 'all_private_chats' },
  { type: 'all_group_chats' },
  { type: 'all_chat_administrators' },
];

/** Registers BOT_COMMANDS for global Telegram command scopes (private, groups, admins). */
async function registerBotCommandsMenu() {
  const scopesRegistered = [];
  for (const scope of BOT_COMMAND_GLOBAL_SCOPES) {
    await bot.api.setMyCommands(BOT_COMMANDS, { scope });
    scopesRegistered.push(scope.type);
  }
  logger.info('Bot command menu registered with Telegram', { scopes: scopesRegistered });
}

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

(async function startBot() {
  try {
    await registerBotCommandsMenu();
  } catch (err) {
    logger.error('Failed to register bot commands menu', { error: err.message });
  }
  try {
    const me = await bot.api.getMe();
    logger.info('Telegram bot identity', { id: me.id, username: me.username });
  } catch (err) {
    logger.error('Invalid Telegram token or getMe failed', { error: err.message });
    process.exit(1);
  }
  logger.info('CryptoPriceBot starting...');
  bot.start();
  logger.info('CryptoPriceBot is running');
})();
