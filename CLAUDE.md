# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

```bash
npm install
cp .env.example .env
# Add TELEGRAM_BOT_TOKEN and CMC_API_KEY to .env
npm start
```

## Commands

- `npm start` — Start the bot (node bot.js)
- `npm test` — Run `tests/*.test.js` with Node’s built-in test runner

## Architecture

**Entry point:** `bot.js` — initializes Grammy bot, registers command handlers, sets up middleware and graceful shutdown. On startup it registers `setMyCommands` for global scopes (`default`, `all_private_chats`, `all_group_chats`, `all_chat_administrators`), runs `getMe` (exit on failure), then starts polling.

**Parsing:** `utils/argParser.js` — `parsePriceArgs` for `/price` (strict numeric amount, `-IDR,EUR` style currencies, preserves case for addresses/symbols).

**Long replies:** `utils/telegramChunks.js` — `prepareTelegramReplyChunks` caps `/price` output at three Telegram messages (4096 chars each) and appends a truncation note if needed.

**`/price` UX:** `commands/price.js` sends `replyWithChatAction('typing')` before the CMC request (failures ignored).

**Two API clients** in `services/coinmarketcap.js`:
- `proClient` → `https://pro-api.coinmarketcap.com` (v1 endpoints: map, quotes, listings, DEX search)
- `marketClient` → `https://api.coinmarketcap.com` (v3 endpoints: market-pairs)

**Symbol resolution flow** (`resolveSymbols`):
1. Blockchain address detection → DEX search
2. Symbol-like input (1-5 letters) → `getCoinId` via `/v1/cryptocurrency/map` (returns top 3 ranked matches)
3. Name-like input → DEX search → market-pairs → listings fallback → slug lookup

**Multiple candidates:** When a symbol matches multiple tokens (e.g., CC, PROS), resolved with `candidates` array, sorted by CMC rank. Quote fetching uses `candidate.id` to avoid cache collisions.

**Multi-currency:** Each currency requires a separate API call. USD is always fetched first; target currencies appended via `-idr`, `-eur`, etc.

## Key Implementation Notes

- **Cache key includes `id`** — `cache.get(symbol, currency, id)` ensures different tokens with same symbol have separate entries (e.g., `pros_usd_37263` vs `pros_usd_28945`)
- **Slug lookups always lowercase** — API rejects uppercase slugs
- **Validation:** Amount max 8 decimals, symbol max 50 chars alphanumeric/hyphen/spaces

## Logging

- Logs to `logs/bot.log` with 5MB rotation
- Levels: ERROR, WARN, INFO, DEBUG via `LOG_LEVEL` env (default: INFO)
- Slow requests (>100ms) are logged; rate limit triggers and startup/shutdown also logged; successful command menu registration logs the list of scope types