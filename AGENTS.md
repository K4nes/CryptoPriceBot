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

- `/price BTC` → `1 BTC = [price] USD (Bitcoin)`
- `/price 0.5 SOL` → `0.5 SOL = [price] USD (Solana)`
- `/price solana` → `1 SOL = [price] USD (Solana)` (resolves name to symbol)
- `/price 333 cc -idr` → 333 CC in USD AND IDR
- `/price 1 btc -eth` → 1 BTC in USD and ETH
- `/help` → Shows available commands with examples

**Format:** `/price <amount> <symbol> [-target_currency1,target_currency2]`

## Architecture

```
bot.js                    # Telegram bot entry, registers commands
commands/
  start.js               # /start command handler
  help.js                # /help command handler
  price.js               # /price command handler
utils/
  formatters.js          # Price and change formatting, input validation
  userTracker.js         # First-time user tracking (users.json)
  rateLimiter.js         # Per-user rate limiting (env-configurable)
  logger.js              # Logging with rotation (logs/bot.log)
  cache.js               # 30s TTL cache for API responses
  messages.js            # Shared message constants (welcome message, PRICE_HELP)
middleware/
  errorHandler.js        # Global error handling
constants/
  currencies.js          # Currency symbols mapping
services/
  coinmarketcap.js       # CMC API calls, symbol/slug resolution
config.js                # API keys and base URLs from .env
```

## Rate Limiting

- **10 requests per minute per user** (by `chatId`, configurable via env)
- In-memory tracking with automatic cleanup
- Env vars: `RATE_LIMIT` (default 10), `RATE_WINDOW_SEC` (default 60)
- When exceeded: `⏳ Rate limit exceeded. Try again in X seconds.`

## Logging

- Logs to `logs/bot.log` with rotation (5MB max)
- Levels: ERROR, WARN, INFO, DEBUG (set via `LOG_LEVEL` env var, default: INFO)
- Logs: API errors, rate limit triggers, startup/shutdown, uncaught exceptions, slow requests

## Response Time Monitoring

- Requests > 100ms are logged: `[INFO] Request completed in XXXms`
- Helps identify slow responses and API issues

## Error Handling

- Global error middleware catches all unhandled errors
- User-friendly messages for API failures
- Detailed logging for debugging

## Key Implementation Notes

**Two API clients** (`services/coinmarketcap.js`):
- `proClient` → `https://pro-api.coinmarketcap.com` (for `/v1/` endpoints: map, quotes, listings, DEX search)
- `marketClient` → `https://api.coinmarketcap.com` (for `/data-api/v3/` endpoints: market-pairs)

**Symbol resolution** (`resolveSymbols`):
- Blockchain address → DEX search with security verification
- Symbol-like input (1-5 letters, e.g. "SOL", "CC") → `getCoinId` via `/v1/cryptocurrency/map` (returns top 3 ranked matches)
- Name-like input (e.g. "solana", "canton") → DEX search → market-pairs → listings fallback → slug lookup

**Multiple candidates:** When a symbol matches multiple tokens (e.g., CC, PROS), resolved with `candidates` array, sorted by CMC rank. Quote fetching uses `candidate.id` in cache key to avoid collisions (e.g., `pros_usd_37263` vs `pros_usd_28945`).

**Slug and symbol params always lowercase:** API rejects uppercase slugs and symbol params.

**Multi-currency:** Each currency requires a separate API call. USD is always fetched first; target currencies appended via `-idr`, `-eur`, etc.

## Caching

- **30 second TTL cache** for CMC API responses (`utils/cache.js`)
- Cache key: `symbol_currency_id` (id is optional, only used when available to avoid collisions)
- Reduces API calls, improves response time

## Input Validation

- Amount: must be > 0, max 8 decimal places, max 1 trillion
- Symbol: max 50 characters, alphanumeric + spaces + hyphens only

## Dependencies

- `grammy` — Telegram bot framework
- `axios` — HTTP client
- `dotenv` — env file loading