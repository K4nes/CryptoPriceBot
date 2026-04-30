function registerHelp(bot) {
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'CryptoPriceBot Commands:\n\n' +
      '/price BTC        → 1 BTC = [price] USD\n' +
      '/price 0.5 SOL    → 0.5 SOL = [price] USD\n' +
      '/price solana     → 1 SOL = [price] USD (Solana)\n' +
      '/price 1 BTC -eth → 1 BTC in USD and ETH\n' +
      '/price 1 BTC -idr,eur → 1 BTC in USD, IDR, EUR\n\n' +
      'Format: /price <amount> <symbol> [-target_currency]',
      { reply_parameters: { message_id: ctx.msg.message_id } }
    );
  });
}

module.exports = { registerHelp };
