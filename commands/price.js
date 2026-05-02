const coinmarketcap = require('../services/coinmarketcap');
const { formatPrice, getCurrencySymbol, formatChange, getChangeEmoji, validateAmount, validateSymbol } = require('../utils/formatters');
const { isRateLimited } = require('../utils/rateLimiter');
const { apiErrorHandler } = require('../middleware/errorHandler');
const { RATE_LIMIT_EXCEEDED, PRICE_HELP } = require('../utils/messages');
const { parsePriceArgs } = require('../utils/argParser');
const { prepareTelegramReplyChunks } = require('../utils/telegramChunks');

function registerPrice(bot) {
  bot.command('price', async (ctx) => {
    const chatId = ctx.msg.chat.id;

    const rateCheck = isRateLimited(chatId);
    if (rateCheck.limited) {
      await ctx.reply(RATE_LIMIT_EXCEEDED(rateCheck.retryAfter), {
        reply_parameters: { message_id: ctx.msg.message_id }
      });
      return;
    }

    const args = ctx.message.text.split(/\s+/).slice(1).filter(Boolean);
    const { amount, symbolArgs, targetCurrencies } = parsePriceArgs(args);

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      await ctx.reply(`❌ ${amountValidation.message}`, {
        reply_parameters: { message_id: ctx.msg.message_id }
      });
      return;
    }

    const symbols = symbolArgs.filter(s => s.length > 0);

    for (const sym of symbols) {
      const symValidation = validateSymbol(sym);
      if (!symValidation.valid) {
        await ctx.reply(`❌ ${symValidation.message}`, {
          reply_parameters: { message_id: ctx.msg.message_id }
        });
        return;
      }
    }

    if (symbols.length === 0) {
      await ctx.reply(PRICE_HELP, {
        reply_parameters: { message_id: ctx.msg.message_id }
      });
      return;
    }

    const convertCurrencies = targetCurrencies.length > 0
      ? ['USD', ...targetCurrencies]
      : ['USD'];

    try {
      try {
        await ctx.replyWithChatAction('typing');
      } catch {
        /* ignore chat action failures */
      }
      const results = await coinmarketcap.getQuotesBySymbolOrSlug(symbols, convertCurrencies);
      const validData = results.data;
      const lines = [];
      const foundSymbols = results.foundSymbols || new Set();
      const multipleCandidates = results.multipleCandidates || [];

      // Handle multiple candidates case
      if (multipleCandidates.length > 0) {
        for (const { symbol: querySym, candidates } of multipleCandidates) {
          lines.push(`🔍 Top matches for "${querySym}":`);
          for (const crypto of candidates) {
            const name = crypto.name;
            const change24h = crypto.quote['USD']?.percent_change_24h;
            const changeEmoji = getChangeEmoji(change24h);
            const changeStr = formatChange(change24h);

            lines.push(`${crypto.symbol} (${name})`);
            for (const currency of convertCurrencies) {
              if (!crypto.quote[currency]) {
                lines.push(`  ${crypto.symbol} price unavailable for ${currency}`);
                continue;
              }
              const price = crypto.quote[currency].price * amount;
              const symbol = getCurrencySymbol(currency);
              const priceStr = formatPrice(price);
              lines.push(`  ${amount} ${crypto.symbol} = ${symbol}${priceStr} ${currency}`);
            }

            if (changeStr) {
              lines.push(`  ${changeEmoji} 24h: ${changeStr}`);
            }
            if (crypto.cmc_rank) {
              lines.push(`  Rank: #${crypto.cmc_rank}`);
            }
            lines.push('━━━━━━━━━━━━━━━━━━━━');
          }
        }
      }

      // Handle single token case
      for (const crypto of Object.values(validData)) {
        const name = crypto.name;
        const change24h = crypto.quote['USD']?.percent_change_24h;
        const changeEmoji = getChangeEmoji(change24h);
        const changeStr = formatChange(change24h);

        for (const currency of convertCurrencies) {
          if (!crypto.quote[currency]) {
            lines.push(`${crypto.symbol} price unavailable for ${currency}`);
            continue;
          }
          const price = crypto.quote[currency].price * amount;
          const symbol = getCurrencySymbol(currency);
          const priceStr = formatPrice(price);

          lines.push(`${amount} ${crypto.symbol} = ${symbol}${priceStr} ${currency} (${name})`);
        }

        if (changeStr) {
          lines.push(`${changeEmoji} 24h: ${changeStr}`);
        }
      }

      const missing = symbols.filter(s => !foundSymbols.has(s) && !foundSymbols.has(s.toLowerCase()) && !foundSymbols.has(s.toUpperCase()));
      if (missing.length > 0) {
        lines.push(`Not found: ${missing.join(', ')}`);
      }

      const fullText = lines.join('\n');
      const { chunks } = prepareTelegramReplyChunks(fullText);
      const replyToUser = { reply_parameters: { message_id: ctx.msg.message_id } };
      for (let i = 0; i < chunks.length; i++) {
        await ctx.reply(chunks[i], i === 0 ? replyToUser : {});
      }
    } catch (error) {
      await apiErrorHandler(error, ctx);
    }
  });
}

module.exports = { registerPrice };
