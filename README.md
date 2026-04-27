# CryptoPriceBot

Telegram bot for getting live cryptocurrency prices from CoinMarketCap.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your credentials:
- `TELEGRAM_BOT_TOKEN` — Get from [@BotFather](https://t.me/BotFather)
- `CMC_API_KEY` — Get from [coinmarketcap.com/api](https://coinmarketcap.com/api)

Start the bot:
```bash
npm start
```

## Commands

### Get price of 1 crypto
```
/price BTC
```
Response: `1 BTC = $67000.00 USD (Bitcoin)`

### Get price of specific amount
```
/price 0.5 SOL
```
Response: `0.5 SOL = $42.00 USD (Solana)`

### Use crypto name instead of ticker
```
/price solana
```
Response: `1 SOL = $84.00 USD (Solana)`

### Convert to other currencies
```
/price 1 BTC -idr
```
Response:
```
1 BTC = $67000.00 USD (Bitcoin)
1 BTC = Rp 1072000000.00 IDR (Bitcoin)
```

### Multiple crypto and currencies
```
/price 0.5 BTC -idr,eur
/price solana eth -usd
```

## Format

```
/price <amount> <symbol> [-target_currency1,target_currency2]
```

| Parameter | Description |
|-----------|-------------|
| `amount` | Number of crypto units (default: 1) |
| `symbol` | Ticker (BTC, ETH) or name (bitcoin, solana) |
| `-idr` | Convert to Indonesian Rupiah |
| `-eur` | Convert to Euro |
| `-gbp` | Convert to British Pound |
| `-jpy` | Convert to Japanese Yen |
| `-eth` | Convert to Ethereum |
| `-btc` | Convert to Bitcoin |

## Examples

```
/price btc              → 1 BTC = $67000 USD
/price 0.5 sol          → 0.5 SOL = $42 USD
/price solana -idr      → 1 SOL = $84 USD + IDR
/price bitcoin -eth     → 1 BTC = USD + ETH
```