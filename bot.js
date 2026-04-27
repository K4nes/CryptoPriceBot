const { Bot } = require('grammy');
const config = require('./config');
const coinmarketcap = require('./services/coinmarketcap');

const bot = new Bot(config.telegram.botToken);

const CURRENCY_SYMBOLS = {
  USD: '$',
  IDR: 'Rp',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  CNY: '¥',
  INR: '₹',
  KRW: '₩',
  BRL: 'R$',
  RUB: '₽',
  SGD: 'S$',
  HKD: 'HK$',
  THB: '฿',
  MYR: 'RM',
  PHP: '₱',
  VND: '₫',
  TRY: '₺',
  PLN: 'zł',
  NOK: 'kr',
  SEK: 'kr',
  DKK: 'kr',
  NZD: 'NZ$',
  ZAR: 'R',
  MXN: '$',
  BGN: 'лв',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BDT: '৳',
  PKR: '₨',
  EGP: '£',
  BHD: '.د.ب',
  KWD: 'د.ك',
  OMR: 'ر.ع.',
  QAR: 'ر.ق',
  SAR: 'ر.س',
  AED: 'د.إ',
  JOD: 'د.ا',
  LBP: 'ل.ل',
  ILS: '₪',
};

function formatPrice(price) {
  return price < 1 ? price.toFixed(8).replace(/\.?0+$/, '') : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Crypto Price Bot\n\n' +
    'Get live crypto prices from CoinMarketCap.\n\n' +
    'Commands:\n' +
    '/price BTC - Get price of 1 BTC in USD\n' +
    '/price 0.5 SOL - Get price of 0.5 SOL in USD\n' +
    '/price 1 BTC -eth - Get 1 BTC in USD and ETH\n' +
    '/price 1 BTC -idr,eur - Get 1 BTC in USD, IDR, and EUR\n\n' +
    'Example: /price 0.5 BTC -idr'
  );
});

bot.command('price', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);

  let amount = 1;
  const symbolArgs = [];
  const targetCurrencies = [];

  for (const arg of args) {
    if (arg.startsWith('-')) {
      const currencies = arg.slice(1).split(',');
      targetCurrencies.push(...currencies.map(c => c.toUpperCase().trim()));
    } else {
      const parsed = parseFloat(arg);
      if (!isNaN(parsed) && symbolArgs.length === 0) {
        amount = parsed;
      } else {
        symbolArgs.push(arg.toUpperCase().trim());
      }
    }
  }

  const symbols = symbolArgs.filter(s => s.length > 0);

  if (symbols.length === 0) {
    await ctx.reply(
      '/price <amount> <symbol> [-target_currency]\n\n' +
      'Required:\n' +
      '  amount  - Number of crypto (default: 1)\n' +
      '  symbol  - Ticker (BTC, ETH) or name (bitcoin, solana)\n\n' +
      'Optional:\n' +
      '  -idr   - Show in Indonesian Rupiah\n' +
      '  -eur   - Show in Euro\n' +
      '  -gbp   - Show in British Pound\n' +
      '  -jpy   - Show in Japanese Yen\n' +
      '  -eth   - Show in Ethereum\n' +
      '  -btc   - Show in Bitcoin\n\n' +
      'Examples:\n' +
      '  /price btc              → 1 BTC = $67000 USD\n' +
      '  /price 0.5 sol          → 0.5 SOL = $42 USD\n' +
      '  /price solana -idr      → 1 SOL = $84 USD (Solana)\n' +
      '                           → 1 SOL = Rp 1350000 IDR (Solana)'
    );
    return;
  }

  const convertCurrencies = targetCurrencies.length > 0
    ? ['USD', ...targetCurrencies]
    : ['USD'];

  try {
    const results = await coinmarketcap.getQuotesBySymbolOrSlug(symbols, convertCurrencies);
    const validData = results.data;
    const lines = [];
    const foundSymbols = results.foundSymbols || new Set();

    for (const crypto of Object.values(validData)) {
      const name = crypto.name;

      for (const currency of convertCurrencies) {
        const price = crypto.quote[currency].price * amount;
        const symbol = getCurrencySymbol(currency);
        const priceStr = formatPrice(price);

        lines.push(`${amount} ${crypto.symbol} = ${symbol}${priceStr} ${currency} (${name})`);
      }
    }

    const missing = symbols.filter(s => !foundSymbols.has(s) && !foundSymbols.has(s.toLowerCase()) && !foundSymbols.has(s.toUpperCase()));
    if (missing.length > 0) {
      lines.push(`Not found: ${missing.join(', ')}`);
    }

    await ctx.reply(lines.join('\n'));
  } catch (error) {
    console.error('CMC API Error:', error.response?.data || error.message);
    await ctx.reply('Failed to fetch price data. Please try again later.');
  }
});

bot.start();