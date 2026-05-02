const { WELCOME_MESSAGE, HELP_MESSAGE } = require('../utils/messages');

function registerStart(bot) {
  bot.command('start', async (ctx) => {
    const opts = { reply_parameters: { message_id: ctx.msg.message_id } };
    await ctx.reply(WELCOME_MESSAGE, opts);
    await ctx.reply(HELP_MESSAGE, opts);
  });
}

module.exports = { registerStart };
