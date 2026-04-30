const { isNewUser, markUserSeen } = require('../utils/userTracker');
const { WELCOME_MESSAGE } = require('../utils/messages');

function registerStart(bot) {
  bot.command('start', async (ctx) => {
    const chatId = ctx.msg.chat.id;
    
    if (await isNewUser(chatId)) {
      await markUserSeen(chatId);
      await ctx.reply(WELCOME_MESSAGE, {
        reply_parameters: { message_id: ctx.msg.message_id }
      });
      return;
    }
    
    await ctx.reply(
      'Crypto Price Bot\n\n' +
      'Get live crypto prices from CoinMarketCap.\n\n' +
      'Commands:\n' +
      '/price BTC - Get price of 1 BTC in USD\n' +
      '/price 0.5 SOL - Get price of 0.5 SOL in USD\n' +
      '/price 1 BTC -eth - Get 1 BTC in USD and ETH\n' +
      '/price 1 BTC -idr,eur - Get 1 BTC in USD, IDR, and EUR\n\n' +
      'Example: /price 0.5 BTC -idr',
      { reply_parameters: { message_id: ctx.msg.message_id } }
    );
  });
}

module.exports = { registerStart };
