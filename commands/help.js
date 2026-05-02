const { HELP_MESSAGE } = require('../utils/messages');

function registerHelp(bot) {
  bot.command('help', async (ctx) => {
    await ctx.reply(HELP_MESSAGE, {
      reply_parameters: { message_id: ctx.msg.message_id },
    });
  });
}

module.exports = { registerHelp };
