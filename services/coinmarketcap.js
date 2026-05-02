const axios = require('axios');
const config = require('../config');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const COIN_MAP_TTL_MS = 60 * 60 * 1000; // 1 hour
const COIN_MAP_LIMIT = 5000;

class CoinmarketcapService {
  constructor() {
    this.proClient = axios.create({
      baseURL: 'https://pro-api.coinmarketcap.com',
      headers: {
        'X-CMC_PRO_API_KEY': config.coinmarketcap.apiKey,
      },
      timeout: 30000,
    });

    this.marketClient = axios.create({
      baseURL: 'https://api.coinmarketcap.com',
      headers: {
        'X-CMC_PRO_API_KEY': config.coinmarketcap.apiKey,
      },
      timeout: 30000,
    });

    this._coinMap = null;
    this._coinMapAt = 0;
    this._coinMapInflight = null;
  }

  // Detect blockchain addresses. EVM: 0x + 40 hex. Solana: base58, 32-44.
  isBlockchainAddress(input) {
    if (typeof input !== 'string') return false;
    if (/^0x[a-fA-F0-9]{40}$/.test(input)) return true;
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);
  }

  isSymbolLikeInput(input) {
    return /^[A-Za-z]{1,5}$/.test(input);
  }

  async verifyTokenSecurity(platformName, address) {
    try {
      const resp = await this.proClient.get('/v1/dex/security/detail', {
        params: { platformName, address },
      });

      if (resp.data?.data && resp.data.data.length > 0) {
        const security = resp.data.data[0];
        return {
          exists: security.exist,
          securityLevel: security.securityLevel,
          isVerified: security.extra?.isVerified || false,
          isFlagged: security.extra?.isFlaggedByVendor || false,
          buyTax: security.extra?.buyTax || 0,
          sellTax: security.extra?.sellTax || 0,
          honeypotStatus: security.evmDisplay?.honeypotStatus || 'Unknown',
          rugPullStatus: security.evmDisplay?.rugPullStatus || 'Unknown',
          fakeTokenStatus: security.evmDisplay?.fakeTokenStatus || 'Unknown',
          tags: security.tags || [],
        };
      }
      return null;
    } catch (err) {
      logger.warn(`Security check failed for ${platformName}/${address}:`, err.message);
      return null;
    }
  }

  async searchDexTokens(query, limit = 10) {
    try {
      const resp = await this.proClient.get('/v1/dex/search', {
        params: {
          keyword: query,
          limit,
          sort: 'mc',
        },
      });

      if (resp.data?.data) {
        const tokens = resp.data.data.tks || [];
        return tokens.map(t => ({
          id: t.cid,
          name: t.n,
          symbol: t.s,
          address: t.addr,
          platform: t.plt,
          platformId: t.pltId,
          price: t.pu,
          priceChange24h: t.pc24h,
          volume24h: t.v24h,
          liquidity: t.liq,
          marketCap: t.mc,
          fullyDilutedVal: t.fdv,
          isPin: t.pin,
          tags: t.tags || [],
          source: 'dex',
        }));
      }
      return [];
    } catch (err) {
      logger.warn(`DEX search failed for ${query}:`, err.message);
      return [];
    }
  }

  // Batched metadata lookup. Pass an array of ids; one API call regardless of count.
  async getCryptoMetadata(ids) {
    try {
      const idList = Array.isArray(ids) ? ids.join(',') : ids;
      if (!idList) return [];
      const resp = await this.proClient.get('/v2/cryptocurrency/info', {
        params: { id: idList },
      });

      if (resp.data?.data) {
        return Object.values(resp.data.data).map(c => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          slug: c.slug,
          logo: c.logo,
          description: c.description,
          urls: c.urls || {},
          isVerified: c.is_verified || false,
          dateAdded: c.date_added,
          notices: c.notices || [],
          tags: c.tags || [],
          platform: c.platform,
          source: 'centralized',
        }));
      }
      return [];
    } catch (err) {
      logger.warn(`Metadata lookup failed:`, err.message);
      return [];
    }
  }

  // In-process cache of the active coin map (~5k coins). Single in-flight request
  // is shared across concurrent callers to avoid stampedes.
  async getActiveCoinMap() {
    if (this._coinMap && Date.now() - this._coinMapAt < COIN_MAP_TTL_MS) {
      return this._coinMap;
    }
    if (this._coinMapInflight) return this._coinMapInflight;

    this._coinMapInflight = (async () => {
      try {
        const resp = await this.proClient.get('/v1/cryptocurrency/map', {
          params: {
            listing_status: 'active',
            sort: 'cmc_rank',
            limit: COIN_MAP_LIMIT,
          },
        });
        if (resp.data?.data) {
          this._coinMap = resp.data.data;
          this._coinMapAt = Date.now();
          return this._coinMap;
        }
        return [];
      } catch (err) {
        logger.warn(`Coin map fetch failed:`, err.message);
        return this._coinMap || [];
      } finally {
        this._coinMapInflight = null;
      }
    })();

    return this._coinMapInflight;
  }

  // Resolve by slug via the map endpoint (supports any slug, not just top-100).
  async lookupBySlug(slug) {
    try {
      const resp = await this.proClient.get('/v1/cryptocurrency/map', {
        params: {
          slug: slug.toLowerCase(),
          listing_status: 'active',
        },
      });

      if (resp.data?.data && resp.data.data.length > 0) {
        const match = resp.data.data[0];
        return {
          id: match.id,
          name: match.name,
          symbol: match.symbol,
          slug: match.slug,
          rank: match.rank,
        };
      }
      return null;
    } catch (err) {
      logger.warn(`Slug lookup failed for ${slug}:`, err.message);
      return null;
    }
  }

  async getCoinId(symbol) {
    try {
      const resp = await this.proClient.get('/v1/cryptocurrency/map', {
        params: {
          symbol: symbol.toUpperCase(),
          listing_status: 'active',
          sort: 'cmc_rank',
          aux: 'is_active,platform',
        },
      });

      if (resp.data?.data && resp.data.data.length > 0) {
        const matches = resp.data.data
          .filter(c => c.is_active === 1)
          .sort((a, b) => (a.rank || 999999) - (b.rank || 999999))
          .slice(0, 3);

        if (matches.length > 0) {
          return matches.map(coin => ({
            id: coin.id,
            name: coin.name,
            symbol: coin.symbol,
            slug: coin.slug,
            rank: coin.rank,
          }));
        }
      }
      return null;
    } catch (err) {
      logger.warn(`ID map lookup failed for ${symbol}:`, err.message);
      return null;
    }
  }

  // Substring search over the cached coin map. Avoids paying for /listings/latest
  // (which also returns full quote payloads) just to do a name match.
  async searchCoins(query) {
    const map = await this.getActiveCoinMap();
    if (!map || map.length === 0) return null;

    const q = query.toLowerCase();
    const matches = map
      .filter(c => {
        const nameMatch = c.name && c.name.toLowerCase().includes(q);
        const slugMatch = c.slug && c.slug.toLowerCase().includes(q);
        return nameMatch || slugMatch;
      })
      .sort((a, b) => (a.rank || 999999) - (b.rank || 999999))
      .slice(0, 3)
      .map(c => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        slug: c.slug,
        rank: c.rank,
      }));

    return matches.length > 0 ? matches : null;
  }

  // === Per-input resolvers ===

  async _resolveAddress(sym) {
    try {
      const dexTokens = await this.searchDexTokens(sym, 5);
      if (dexTokens.length === 0) {
        return { error: 'unresolvable_address', candidates: [] };
      }

      const token = dexTokens[0];
      const [security, meta] = await Promise.all([
        this.verifyTokenSecurity(token.platform, token.address),
        token.id ? this.getCryptoMetadata([token.id]) : Promise.resolve([]),
      ]);

      const cmcVerified = meta.length > 0 && meta[0].isVerified;
      return {
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        slug: token.name.toLowerCase().replace(/\s+/g, '-'),
        id: token.id,
        platform: token.platform,
        isVerified: cmcVerified || (security?.isVerified || false),
        cmcVerified,
        securityLevel: security?.securityLevel || 'unknown',
        quote: {},
      };
    } catch (err) {
      logger.warn(`Address lookup failed for ${sym}:`, err.message);
      return { error: 'unresolvable_address', candidates: [] };
    }
  }

  async _resolveTicker(sym) {
    const coins = await this.getCoinId(sym);
    if (!coins || coins.length === 0) return null;

    // Single batched metadata call for all candidates.
    const meta = await this.getCryptoMetadata(coins.map(c => c.id));
    const metaById = new Map(meta.map(m => [m.id, m]));

    if (coins.length === 1) {
      const c = coins[0];
      const isCmcVerified = metaById.get(c.id)?.isVerified || false;
      return {
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        slug: c.slug,
        cmc_rank: c.rank,
        isVerified: isCmcVerified,
        cmcVerified: isCmcVerified,
        quote: {},
      };
    }

    const verifiedCoins = coins.map(c => {
      const isCmcVerified = metaById.get(c.id)?.isVerified || false;
      return {
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        slug: c.slug,
        cmc_rank: c.rank,
        isVerified: isCmcVerified,
        cmcVerified: isCmcVerified,
      };
    });

    verifiedCoins.sort((a, b) => {
      if (a.isVerified !== b.isVerified) return b.isVerified ? 1 : -1;
      return (a.cmc_rank || 999999) - (b.cmc_rank || 999999);
    });

    return { candidates: verifiedCoins };
  }

  async _resolveFromDex(sym) {
    const lower = sym.toLowerCase();
    const dexTokens = await this.searchDexTokens(sym, 10);
    if (dexTokens.length === 0) return null;

    const viableTokens = dexTokens.filter(t => t.liquidity > 0 && !t.tags.includes('flagged'));
    if (viableTokens.length === 0) return null;

    const bestMatches = viableTokens
      .filter(t => t.symbol.toLowerCase() === lower || t.name.toLowerCase().includes(lower))
      .sort((a, b) => {
        if (a.isPin !== b.isPin) return b.isPin ? 1 : -1;
        return (b.liquidity || 0) - (a.liquidity || 0);
      })
      .slice(0, 3);

    if (bestMatches.length === 0) return null;

    if (bestMatches.length === 1) {
      const token = bestMatches[0];
      const security = await this.verifyTokenSecurity(token.platform, token.address);
      return {
        symbol: token.symbol,
        name: token.name,
        slug: token.name.toLowerCase().replace(/\s+/g, '-'),
        address: token.address,
        platform: token.platform,
        id: token.id,
        isVerified: security?.isVerified || false,
        securityLevel: security?.securityLevel || 'unknown',
        quote: {},
      };
    }

    return {
      candidates: bestMatches.map(t => ({
        id: t.id,
        symbol: t.symbol,
        name: t.name,
        slug: t.name.toLowerCase().replace(/\s+/g, '-'),
        address: t.address,
        platform: t.platform,
        isVerified: t.isPin || false,
        cmc_rank: null,
      })),
    };
  }

  async _resolveFromMarketPairs(sym) {
    try {
      const resp = await this.marketClient.get('/data-api/v3/cryptocurrency/market-pairs/latest', {
        params: {
          slug: sym.toLowerCase(),
          start: 1,
          limit: 1,
          category: 'spot',
          centerType: 'all',
          sort: 'cmc_rank_advanced',
          direction: 'desc',
          spotUntracked: true,
        },
      });

      if (!resp.data?.data) return null;
      const { name, symbol, id } = resp.data.data;
      const meta = await this.getCryptoMetadata([id]);
      const isCmcVerified = meta.length > 0 && meta[0].isVerified;

      return {
        symbol: symbol.toUpperCase(),
        name,
        slug: sym.toLowerCase(),
        id,
        isVerified: isCmcVerified,
        cmcVerified: isCmcVerified,
        quote: {},
      };
    } catch (err) {
      logger.warn(`Market pairs lookup failed for ${sym}:`, err.message);
      return null;
    }
  }

  async _resolveFromListings(sym) {
    const coins = await this.searchCoins(sym);
    if (!coins || coins.length === 0) return null;

    const meta = await this.getCryptoMetadata(coins.map(c => c.id));
    const metaById = new Map(meta.map(m => [m.id, m]));

    const verifiedCoins = coins.map(c => {
      const isCmcVerified = metaById.get(c.id)?.isVerified || false;
      return {
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        slug: c.slug,
        cmc_rank: c.rank,
        isVerified: isCmcVerified,
        cmcVerified: isCmcVerified,
      };
    });

    verifiedCoins.sort((a, b) => {
      if (a.isVerified !== b.isVerified) return b.isVerified ? 1 : -1;
      return (a.cmc_rank || 999999) - (b.cmc_rank || 999999);
    });

    if (verifiedCoins.length === 1) {
      return { ...verifiedCoins[0], quote: {} };
    }
    return { candidates: verifiedCoins };
  }

  async _resolveName(sym) {
    const fromDex = await this._resolveFromDex(sym);
    if (fromDex) return fromDex;

    const fromMarketPairs = await this._resolveFromMarketPairs(sym);
    if (fromMarketPairs) return fromMarketPairs;

    const fromListings = await this._resolveFromListings(sym);
    if (fromListings) return fromListings;

    const slugResult = await this.lookupBySlug(sym.toLowerCase());
    if (!slugResult) return null;
    const meta = await this.getCryptoMetadata([slugResult.id]);
    const isCmcVerified = meta.length > 0 && meta[0].isVerified;
    return {
      id: slugResult.id,
      symbol: slugResult.symbol,
      name: slugResult.name,
      slug: slugResult.slug,
      cmc_rank: slugResult.rank,
      isVerified: isCmcVerified,
      cmcVerified: isCmcVerified,
      quote: {},
    };
  }

  // Resolve all input symbols in parallel.
  async resolveSymbols(symbols) {
    const entries = await Promise.all(symbols.map(async (sym) => {
      let entry;
      if (this.isBlockchainAddress(sym)) {
        entry = await this._resolveAddress(sym);
      } else if (this.isSymbolLikeInput(sym)) {
        entry = await this._resolveTicker(sym);
        if (!entry) entry = await this._resolveName(sym);
      } else {
        entry = await this._resolveName(sym);
      }
      return [sym.toLowerCase(), entry || {}];
    }));
    return Object.fromEntries(entries);
  }

  // Fetch quotes for one entry across all requested currencies in a single API
  // call. Cache hits are filled first; only the missing currencies are fetched.
  async _fetchQuoteFor(entry, convertArr) {
    const result = {};
    const missing = [];
    for (const currency of convertArr) {
      const cached = cache.get(entry.symbol, currency, entry.id);
      if (cached) {
        result[currency] = cached;
      } else {
        missing.push(currency);
      }
    }

    if (missing.length === 0) return result;

    try {
      const params = entry.id
        ? { id: entry.id, convert: missing.join(','), skip_invalid: true }
        : { symbol: entry.symbol.toLowerCase(), convert: missing.join(','), skip_invalid: true };

      const resp = await this.proClient.get('/v1/cryptocurrency/quotes/latest', { params });

      const tokenData = entry.id
        ? resp.data?.data?.[entry.id]
        : resp.data?.data?.[entry.symbol] || resp.data?.data?.[entry.symbol.toUpperCase()];

      if (tokenData?.quote) {
        for (const currency of missing) {
          const quote = tokenData.quote[currency];
          if (quote) {
            result[currency] = quote;
            cache.set(entry.symbol, currency, quote, entry.id);
          }
        }
      }
    } catch (err) {
      logger.warn(`Quote fetch failed for ${entry.symbol}/${missing.join(',')}:`, err.message);
    }

    return result;
  }

  async getQuotesBySymbolOrSlug(symbols, convert = config.coinmarketcap.defaultCurrency) {
    const convertArr = Array.isArray(convert) ? convert : [convert];
    const resolved = await this.resolveSymbols(symbols);

    const allData = {};
    const foundSymbols = new Set();
    const multipleCandidates = [];

    // Build a flat list of fetch jobs first, then run them in parallel.
    const jobs = [];

    for (const [origSym, entry] of Object.entries(resolved)) {
      if (entry.candidates && entry.candidates.length > 0) {
        foundSymbols.add(origSym);
        foundSymbols.add(entry.candidates[0].symbol);
        foundSymbols.add(entry.candidates[0].symbol.toLowerCase());

        const candidatesData = entry.candidates.map(candidate => ({
          symbol: candidate.symbol,
          name: candidate.name,
          slug: candidate.slug,
          cmc_rank: candidate.cmc_rank,
          isVerified: candidate.isVerified || false,
          quote: {},
          _id: candidate.id,
        }));

        for (const merged of candidatesData) {
          jobs.push((async () => {
            const quotes = await this._fetchQuoteFor(
              { symbol: merged.symbol, id: merged._id },
              convertArr,
            );
            merged.quote = quotes;
            delete merged._id;
          })());
        }

        multipleCandidates.push({ symbol: origSym, candidates: candidatesData });
      } else if (entry.symbol) {
        const merged = {
          symbol: entry.symbol,
          name: entry.name,
          slug: entry.slug,
          cmc_rank: entry.cmc_rank,
          isVerified: entry.isVerified || false,
          quote: {},
        };

        foundSymbols.add(origSym);
        foundSymbols.add(entry.symbol);
        foundSymbols.add(entry.symbol.toLowerCase());

        jobs.push((async () => {
          merged.quote = await this._fetchQuoteFor(entry, convertArr);
        })());

        allData[entry.symbol] = merged;
      }
    }

    await Promise.all(jobs);

    return { data: allData, foundSymbols, multipleCandidates };
  }
}

module.exports = new CoinmarketcapService();
