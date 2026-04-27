const axios = require('axios');
const config = require('../config');

class CoinmarketcapService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://pro-api.coinmarketcap.com',
      headers: {
        'X-CMC_PRO_API_KEY': config.coinmarketcap.apiKey,
      },
    });

    this.marketClient = axios.create({
      baseURL: 'https://api.coinmarketcap.com',
      headers: {
        'X-CMC_PRO_API_KEY': config.coinmarketcap.apiKey,
      },
    });
  }

  async getQuotes(symbols, convert = config.coinmarketcap.defaultCurrency) {
    const symbolList = Array.isArray(symbols) ? symbols.join(',') : symbols;
    const response = await this.client.get('/v1/cryptocurrency/quotes/latest', {
      params: { symbol: symbolList, convert, skip_invalid: true },
    });
    return response.data;
  }

  isSymbolLikeInput(input) {
    return /^[A-Za-z]{1,5}$/.test(input);
  }

  async resolveSymbols(symbols) {
    const resolved = {};

    for (const sym of symbols) {
      const lower = sym.toLowerCase();

      if (this.isSymbolLikeInput(sym)) {
        try {
          const resp = await this.client.get('/v1/cryptocurrency/quotes/latest', {
            params: { symbol: lower, convert: 'USD', skip_invalid: true },
          });

          for (const [key, entry] of Object.entries(resp.data.data)) {
            if (entry?.cmc_rank) {
              resolved[lower] = {
                symbol: entry.symbol,
                name: entry.name,
                slug: entry.slug,
                cmc_rank: entry.cmc_rank,
              };
            }
          }

          if (resolved[lower]) continue;
        } catch (err) {
          console.warn(`Symbol lookup failed for ${sym}:`, err.message);
        }
      }

      try {
        const resp = await this.marketClient.get('/data-api/v3/cryptocurrency/market-pairs/latest', {
          params: {
            slug: lower,
            start: 1,
            limit: 1,
            category: 'spot',
            centerType: 'all',
            sort: 'cmc_rank_advanced',
            direction: 'desc',
            spotUntracked: true,
          },
        });

        if (resp.data?.data) {
          const { name, symbol, id } = resp.data.data;
          resolved[lower] = {
            symbol: symbol.toUpperCase(),
            name,
            slug: lower,
            id,
          };
        }
      } catch (err) {
        console.warn(`Market pairs lookup failed for ${sym}:`, err.message);
      }
    }

    return resolved;
  }

  async getQuotesBySymbolOrSlug(symbols, convert = config.coinmarketcap.defaultCurrency) {
    const convertArr = Array.isArray(convert) ? convert : [convert];
    const resolved = await this.resolveSymbols(symbols);

    const allData = {};
    const foundSymbols = new Set();

    for (const [origSym, entry] of Object.entries(resolved)) {
      const mergedEntry = {
        symbol: entry.symbol,
        name: entry.name,
        slug: entry.slug,
        cmc_rank: entry.cmc_rank,
        quote: {},
      };

      foundSymbols.add(origSym);
      foundSymbols.add(entry.symbol);
      foundSymbols.add(entry.symbol.toLowerCase());

      for (const currency of convertArr) {
        try {
          const resp = await this.client.get('/v1/cryptocurrency/quotes/latest', {
            params: { symbol: entry.symbol.toLowerCase(), convert: currency, skip_invalid: true },
          });

          const quote = resp.data.data[entry.symbol]?.quote?.[currency];
          if (quote) {
            mergedEntry.quote[currency] = quote;
          }
        } catch (err) {
          console.warn(`Quote fetch failed for ${entry.symbol}/${currency}:`, err.message);
        }
      }

      allData[entry.symbol] = mergedEntry;
    }

    return { data: allData, foundSymbols };
  }

  async getPrice(symbol, convert = config.coinmarketcap.defaultCurrency) {
    const data = await this.getQuotes(symbol, convert);
    const entry = data.data[symbol];

    if (!entry?.quote?.[convert]) {
      return null;
    }

    return {
      symbol: entry.symbol,
      name: entry.name,
      price: entry.quote[convert].price,
      currency: convert,
      lastUpdated: entry.quote[convert].last_updated,
    };
  }
}

module.exports = new CoinmarketcapService();