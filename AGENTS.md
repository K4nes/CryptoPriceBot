# CryptoPriceBot

Telegram bot fetching crypto prices from CoinMarketCap API.

## Setup

```bash
npm install
cp .env.example .env
# Fill TELEGRAM_BOT_TOKEN and CMC_API_KEY in .env
npm start
```

## Commands

- `/price BTC` → `1 BTC = $67000.00 USD (Bitcoin)`
- `/price 0.5 SOL` → `0.5 SOL = $41.25 USD (Solana)`
- `/price solana` → `1 SOL = $84.00 USD (Solana)` (resolves name to symbol)
- `/price 333 cc -idr` → 333 CC in USD AND IDR
- `/price 1 btc -eth` → 1 BTC in USD and ETH

**Format:** `/price <amount> <symbol> [-target_currency1,target_currency2]`

## Architecture

```
bot.js              # Telegram bot entry, /price command handler
config.js           # API keys and base URLs from .env
services/
  coinmarketcap.js  # CMC API calls, symbol/slug resolution, multi-currency merge
```

## Key Implementation Notes

**Two API clients** (`services/coinmarketcap.js`):
- `client` → `https://pro-api.coinmarketcap.com` (for `/v1/` endpoints)
- `marketClient` → `https://api.coinmarketcap.com` (for `/data-api/v3/` endpoints)

**Symbol resolution** (`services/coinmarketcap.js:resolveSymbols`):
- Symbol-like input (≤5 letters, e.g. "SOL", "BTC"): tries `/v1/cryptocurrency/quotes/latest?symbol=`
- Name-like input (e.g. "solana", "bitcoin"): uses `/data-api/v3/cryptocurrency/market-pairs/latest?slug=` which returns `name`, `symbol` directly
- `isSymbolLikeInput()`: `/^[A-Za-z]{1,5}$/` — must be exactly 1-5 letters

**All API params always lowercase:**
- `slug` → `sym.toLowerCase()` — API rejects uppercase
- `symbol` → `lower` for quotes API calls

**Multi-currency** (`services/coinmarketcap.js:getQuotesBySymbolOrSlug`):
- **Sequential API calls per currency** — plan-limited to 1 convert per call
- Step 1: resolve symbols once (market-pairs gives name + symbol)
- Step 2: for each resolved symbol, loop over currencies, make separate API call
- Step 3: merge all quote data into single entry with `quote.USD`, `quote.IDR`, etc.
- Bot sends ONE reply with all currency lines

**Amount parsing** (`bot.js`):
- First numeric arg becomes `amount`, rest are symbols
- `parseFloat` handles decimals (0.5, 1.5, etc.)
- Price multiplied by amount before display

**Price formatting** (`bot.js`):
- `< 1`: `price.toFixed(8).replace(/\.?0+$/, '')` (shows significant decimals)
- `>= 1`: `price.toLocaleString('en-US', { minimumFractionDigits: 2 })`

## No cache

In-memory caching was removed due to stale-data corruption. Every query hits the CMC API live.

## Dependencies

- `grammy` — Telegram bot framework
- `axios` — HTTP client
- `dotenv` — env file loading