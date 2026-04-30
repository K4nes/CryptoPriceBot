const WELCOME_MESSAGE = '👋 Welcome! I\'m CryptoPriceBot.\nUse /help to see available commands.';
const RATE_LIMIT_EXCEEDED = (retryAfter) => `⏳ Rate limit exceeded. Try again in ${retryAfter} seconds.`;
const PRICE_HELP = `/price <amount> <symbol> [-target_currency]

Required:
  amount  - Number of crypto (default: 1)
  symbol  - Ticker (BTC, ETH) or name (bitcoin, solana)

Optional:
  -idr   - Show in Indonesian Rupiah
  -eur   - Show in Euro
  -gbp   - Show in British Pound
  -jpy   - Show in Japanese Yen
  -eth   - Show in Ethereum
  -btc   - Show in Bitcoin

Examples:
  /price btc              → 1 BTC = $67000 USD
  /price 0.5 sol          → 0.5 SOL = $42 USD
  /price solana -idr      → 1 SOL = $84 USD (Solana)
                           → 1 SOL = Rp 1350000 IDR (Solana)`;

module.exports = { WELCOME_MESSAGE, RATE_LIMIT_EXCEEDED, PRICE_HELP };
