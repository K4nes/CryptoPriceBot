const axios = require('axios');
const config = require('../config');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

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
  }

  // Check if input looks like a blockchain address
  isBlockchainAddress(input) {
    return /^0x[a-fA-F0-9]{40}$/.test(input) || /^[a-zA-Z0-9]{32,44}$/.test(input);
  }

  // Verify token security via DEX security endpoint
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

  // Search DEX tokens with security info
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

  // Get centralized crypto metadata for verification
  async getCryptoMetadata(ids) {
    try {
      const idList = Array.isArray(ids) ? ids.join(',') : ids;
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

  // Lookup by slug - tries to find exact slug match first
  async lookupBySlug(slug) {
    try {
      // The map endpoint doesn't filter by slug alone - it requires symbol parameter
      // Instead, search by name in the listings which has slugs
      const resp = await this.proClient.get('/v1/cryptocurrency/listings/latest', {
        params: {
          start: 1,
          limit: 100,
          convert: 'USD',
          sort: 'market_cap',
        },
      });

      if (resp.data?.data) {
        // Find exact slug match
        const slugLower = slug.toLowerCase();
        const match = resp.data.data.find(c => c.slug.toLowerCase() === slugLower);
        if (match) {
          const meta = await this.getCryptoMetadata([match.id]);
          return {
            id: match.id,
            name: match.name,
            symbol: match.symbol,
            slug: match.slug,
            rank: match.cmc_rank,
            isVerified: meta.length > 0 && meta[0].isVerified,
          };
        }
      }
      return null;
    } catch (err) {
      logger.warn(`Slug lookup failed for ${slug}:`, err.message);
      return null;
    }
  }

  async getQuotes(symbols, convert = config.coinmarketcap.defaultCurrency) {
    const symbolList = Array.isArray(symbols) ? symbols.join(',') : symbols;
    const response = await this.proClient.get('/v1/cryptocurrency/quotes/latest', {
      params: { symbol: symbolList, convert, skip_invalid: true },
    });
    return response.data;
  }

  isSymbolLikeInput(input) {
    return /^[A-Za-z]{1,5}$/.test(input);
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
        // Sort by rank (lowest = most established), return top 3 matches
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

  async searchCoins(query) {
    // Search for coins by name/slug containing the query string
    try {
      const resp = await this.proClient.get('/v1/cryptocurrency/listings/latest', {
        params: {
          start: 1,
          limit: 50,
          convert: 'USD',
          sort: 'market_cap',
        },
      });

      if (resp.data?.data) {
        const queryLower = query.toLowerCase();
        const matches = resp.data.data
          .filter(c => {
            const nameMatch = c.name.toLowerCase().includes(queryLower);
            const slugMatch = c.slug.toLowerCase().includes(queryLower);
            return nameMatch || slugMatch;
          })
          .slice(0, 3)
          .map(c => ({
            id: c.id,
            name: c.name,
            symbol: c.symbol,
            slug: c.slug,
            rank: c.cmc_rank,
          }));
        return matches.length > 0 ? matches : null;
      }
      return null;
    } catch (err) {
      logger.warn(`Search lookup failed for ${query}:`, err.message);
      return null;
    }
  }

  async resolveSymbols(symbols) {
    const resolved = {};

    for (const sym of symbols) {
      const lower = sym.toLowerCase();

      // Handle blockchain address input directly
      if (this.isBlockchainAddress(sym)) {
        try {
          // Try to find token info from address via DEX search
          const dexTokens = await this.searchDexTokens(sym, 5);
          if (dexTokens.length > 0) {
            // Get security info for the first (most likely) match
            const token = dexTokens[0];
            const security = await this.verifyTokenSecurity(token.platform, token.address);

            resolved[lower] = {
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              slug: token.slug || token.name.toLowerCase().replace(/\s+/g, '-'),
              id: token.id,
              platform: token.platform,
              isVerified: security?.isVerified || false,
              securityLevel: security?.securityLevel || 'unknown',
              quote: {},
            };

            // Verify against centralized data if possible
            if (token.id) {
              const meta = await this.getCryptoMetadata([token.id]);
              if (meta.length > 0 && meta[0].isVerified) {
                resolved[lower].isVerified = true;
                resolved[lower].cmcVerified = true;
              }
            }
            continue;
          }
        } catch (err) {
          logger.warn(`Address lookup failed for ${sym}:`, err.message);
        }
        resolved[lower] = { error: 'unresolvable_address', candidates: [] };
        continue;
      }

      // Try ID-based lookup first for symbol-like inputs (1-5 letters)
      if (this.isSymbolLikeInput(sym)) {
        const coins = await this.getCoinId(sym); // returns array of top 3
        if (coins && coins.length > 0) {
          if (coins.length === 1) {
            // Exact match - verify with metadata
            const meta = await this.getCryptoMetadata([coins[0].id]);
            const isCmcVerified = meta.length > 0 && meta[0].isVerified;

            resolved[lower] = {
              id: coins[0].id,
              symbol: coins[0].symbol,
              name: coins[0].name,
              slug: coins[0].slug,
              cmc_rank: coins[0].rank,
              isVerified: isCmcVerified,
              cmcVerified: isCmcVerified,
              quote: {},
            };
          } else {
            // Multiple matches - store all candidates with verification status
            const verifiedCoins = await Promise.all(
              coins.map(async (c) => {
                const meta = await this.getCryptoMetadata([c.id]);
                return {
                  id: c.id,
                  symbol: c.symbol,
                  name: c.name,
                  slug: c.slug,
                  cmc_rank: c.rank,
                  isVerified: meta.length > 0 && meta[0].isVerified,
                  cmcVerified: meta.length > 0 && meta[0].isVerified,
                };
              })
            );

            // Sort by verification status first, then by rank
            verifiedCoins.sort((a, b) => {
              if (a.isVerified !== b.isVerified) return b.isVerified ? 1 : -1;
              return (a.cmc_rank || 999999) - (b.cmc_rank || 999999);
            });

            resolved[lower] = { candidates: verifiedCoins };
          }
          continue;
        }
      }

      // For name-like inputs or unresolved symbols, try comprehensive search
      let found = false;

      // First try: DEX search for tokens
      const dexTokens = await this.searchDexTokens(sym, 10);
      if (dexTokens.length > 0) {
        // Filter out low-liquidity or flagged tokens, prefer verified
        const viableTokens = dexTokens.filter(t =>
          t.liquidity > 0 && !t.tags.includes('flagged')
        );

        if (viableTokens.length > 0) {
          // Prefer tokens with matching symbol, verified, good liquidity
          const bestMatches = viableTokens
            .filter(t => t.symbol.toLowerCase() === lower || t.name.toLowerCase().includes(lower))
            .sort((a, b) => {
              // Verified first
              if (a.isPin !== b.isPin) return b.isPin ? 1 : -1;
              // Then by liquidity
              return (b.liquidity || 0) - (a.liquidity || 0);
            })
            .slice(0, 3);

          if (bestMatches.length === 1) {
            const token = bestMatches[0];
            const security = await this.verifyTokenSecurity(token.platform, token.address);

            resolved[lower] = {
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
            found = true;
          } else if (bestMatches.length > 1) {
            resolved[lower] = {
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
            found = true;  // Only reachable when bestMatches.length > 1
          }
        }
      }

      // Second try: name/slug lookup via market-pairs API
      if (!found) {
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
            const meta = await this.getCryptoMetadata([id]);
            const isCmcVerified = meta.length > 0 && meta[0].isVerified;

            resolved[lower] = {
              symbol: symbol.toUpperCase(),
              name,
              slug: lower,
              id,
              isVerified: isCmcVerified,
              cmcVerified: isCmcVerified,
              quote: {},
            };
            found = true;
          }
        } catch (err) {
          logger.warn(`Market pairs lookup failed for ${sym}:`, err.message);
        }
      }

      // Third try: search by name/slug via listings
      if (!found) {
        const coins = await this.searchCoins(sym);
        if (coins && coins.length > 0) {
          // Verify each candidate
          const verifiedCoins = await Promise.all(
            coins.map(async (c) => {
              const meta = await this.getCryptoMetadata([c.id]);
              return {
                id: c.id,
                symbol: c.symbol,
                name: c.name,
                slug: c.slug,
                cmc_rank: c.rank,
                isVerified: meta.length > 0 && meta[0].isVerified,
                cmcVerified: meta.length > 0 && meta[0].isVerified,
              };
            })
          );

          // Sort: verified first, then by rank
          verifiedCoins.sort((a, b) => {
            if (a.isVerified !== b.isVerified) return b.isVerified ? 1 : -1;
            return (a.cmc_rank || 999999) - (b.cmc_rank || 999999);
          });

          if (verifiedCoins.length === 1) {
            resolved[lower] = { ...verifiedCoins[0], quote: {} };
          } else {
            resolved[lower] = { candidates: verifiedCoins };
          }
        } else {
          // Final fallback: try to lookup by slug directly
          const slugResult = await this.lookupBySlug(lower);
          if (slugResult) {
            resolved[lower] = {
              id: slugResult.id,
              symbol: slugResult.symbol,
              name: slugResult.name,
              slug: slugResult.slug,
              cmc_rank: slugResult.rank,
              isVerified: slugResult.isVerified,
              cmcVerified: slugResult.isVerified,
              quote: {},
            };
          }
        }
      }
    }

    return resolved;
  }

  async getQuotesBySymbolOrSlug(symbols, convert = config.coinmarketcap.defaultCurrency) {
    const convertArr = Array.isArray(convert) ? convert : [convert];
    const resolved = await this.resolveSymbols(symbols);

    const allData = {};
    const foundSymbols = new Set();
    const multipleCandidates = [];

    for (const [origSym, entry] of Object.entries(resolved)) {
      // Handle multiple candidates case
      if (entry.candidates && entry.candidates.length > 0) {
        const candidatesData = [];
        foundSymbols.add(origSym);
        foundSymbols.add(entry.candidates[0].symbol);
        foundSymbols.add(entry.candidates[0].symbol.toLowerCase());

        for (const candidate of entry.candidates) {
          const mergedEntry = {
            symbol: candidate.symbol,
            name: candidate.name,
            slug: candidate.slug,
            cmc_rank: candidate.cmc_rank,
            isVerified: candidate.isVerified || false,
            quote: {},
          };

          for (const currency of convertArr) {
            const cached = cache.get(candidate.symbol, currency, candidate.id);
            if (cached) {
              mergedEntry.quote[currency] = cached;
              continue;
            }

            try {
              const resp = await this.proClient.get('/v1/cryptocurrency/quotes/latest', {
                params: { id: candidate.id, convert: currency, skip_invalid: true },
              });

              const quote = resp.data.data[candidate.id]?.quote?.[currency];
              if (quote) {
                mergedEntry.quote[currency] = quote;
                cache.set(candidate.symbol, currency, quote, candidate.id);
              }
            } catch (err) {
              logger.warn(`Quote fetch failed for ${candidate.symbol}/${currency}:`, err.message);
            }
          }

          candidatesData.push(mergedEntry);
        }

        multipleCandidates.push({ symbol: origSym, candidates: candidatesData });
      } else if (entry.symbol) {
        // Single token case
        const mergedEntry = {
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

        for (const currency of convertArr) {
          const cached = cache.get(entry.symbol, currency, entry.id);
          if (cached) {
            mergedEntry.quote[currency] = cached;
            continue;
          }

          try {
            const params = entry.id
              ? { id: entry.id, convert: currency, skip_invalid: true }
              : { symbol: entry.symbol.toLowerCase(), convert: currency, skip_invalid: true };

            const resp = await this.proClient.get('/v1/cryptocurrency/quotes/latest', { params });

            const quote = entry.id
              ? resp.data.data[entry.id]?.quote?.[currency]
              : resp.data.data[entry.symbol]?.quote?.[currency];

            if (quote) {
              mergedEntry.quote[currency] = quote;
              cache.set(entry.symbol, currency, quote, entry.id);
            }
          } catch (err) {
            logger.warn(`Quote fetch failed for ${entry.symbol}/${currency}:`, err.message);
          }
        }

        allData[entry.symbol] = mergedEntry;
      }
    }

    return { data: allData, foundSymbols, multipleCandidates };
  }
}

module.exports = new CoinmarketcapService();