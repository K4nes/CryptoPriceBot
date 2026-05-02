# CryptoPriceBot

Telegram bot fetching crypto prices from CoinMarketCap API.

## Setup

```bash
npm install
cp .env.example .env
# Fill TELEGRAM_BOT_TOKEN and CMC_API_KEY in .env
npm start
```

Run tests: `npm test` (Node built-in test runner, `tests/*.test.js`).

## Commands

- `/price BTC` → `1 BTC = [price] USD (Bitcoin)`
- `/price 0.5 SOL` → `0.5 SOL = [price] USD (Solana)`
- `/price solana` → `1 SOL = [price] USD (Solana)` (resolves name to symbol)
- `/price 333 cc -idr` → 333 CC in USD AND IDR
- `/price 1 btc -eth` → 1 BTC in USD and ETH
- `/start` → Short welcome, then the same command help as `/help`
- `/help` → Shows available commands with examples

**Format:** `/price <amount> <symbol> [-target_currency1,target_currency2]`

## Architecture

```
bot.js                    # Telegram bot entry: commands, middleware, startup/shutdown
commands/
  start.js               # /start: welcome + HELP_MESSAGE (same body as /help)
  help.js                # /help command handler
  price.js               # /price: typing action, CMC fetch, chunked replies
utils/
  argParser.js           # Parses /price args: amount, symbol tokens, -currencies
  formatters.js          # Price and change formatting, input validation
  telegramChunks.js      # Split /price text for Telegram 4096 limit (max 3 messages + truncation note)
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
tests/                   # Node:test (argParser, formatters, cache, telegramChunks)
config.js                # API keys and base URLs from .env
```

## Startup and Telegram UX

On launch, `bot.js`:

1. Registers the command menu with `setMyCommands` for **global** scopes: `default`, `all_private_chats`, `all_group_chats`, and `all_chat_administrators` (same `/start`, `/help`, `/price` descriptions in DMs and groups).
2. Calls `getMe`; logs bot `id` and `username`, and **exits** if the token is invalid (before long polling starts).
3. Starts the bot (`bot.start()`).

For `/price`, after validation the handler sends a **typing** chat action before calling CoinMarketCap, then sends the reply text split across up to **three** messages if needed (Telegram’s 4096-character limit per message), with a short truncation note if content was cut.

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