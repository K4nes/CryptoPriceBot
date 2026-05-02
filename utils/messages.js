const WELCOME_MESSAGE = '👋 Welcome! I\'m CryptoPriceBot.';
const RATE_LIMIT_EXCEEDED = (retryAfter) => `⏳ Rate limit exceeded. Try again in ${retryAfter} seconds.`;

const HELP_MESSAGE = `CryptoPriceBot Commands

Format:
  /price <amount> <symbol> [-target_currency1,target_currency2]

Required:
  amount  - Number of crypto (default: 1)
  symbol  - Ticker (BTC, ETH) or name (bitcoin, solana)

Optional currency conversions:
  -idr   - Indonesian Rupiah
  -eur   - Euro
  -gbp   - British Pound
  -jpy   - Japanese Yen
  -eth   - Ethereum
  -btc   - Bitcoin

Examples:
  /price btc                → 1 BTC = $67000 USD
  /price 0.5 sol            → 0.5 SOL = $42 USD
  /price solana -idr        → 1 SOL in USD and IDR
  /price 1 btc -eth         → 1 BTC in USD and ETH
  /price 1 btc -idr,eur     → 1 BTC in USD, IDR, EUR`;

// Same content, but framed as the /price-with-no-args reminder.
const PRICE_HELP = HELP_MESSAGE;

module.exports = { WELCOME_MESSAGE, RATE_LIMIT_EXCEEDED, PRICE_HELP, HELP_MESSAGE };
