// Strict numeric: integer or decimal only. parseFloat("1abc") would silently
// produce 1 and hide the malformed input; this regex rejects it.
const NUMERIC_RE = /^\d+(?:\.\d+)?$/;

// Parse the argument list of /price <amount> <symbol> [-currency,...].
// Preserves case on symbols/addresses so EIP-55 / base58 inputs survive into
// the resolver. Currencies are upper-cased.
function parsePriceArgs(args) {
  let amount = 1;
  const symbolArgs = [];
  const targetCurrencies = [];

  for (const arg of args) {
    if (!arg) continue;
    if (arg.startsWith('-')) {
      const currencies = arg.slice(1).split(',');
      for (const c of currencies) {
        const trimmed = c.toUpperCase().trim();
        if (trimmed) targetCurrencies.push(trimmed);
      }
    } else if (symbolArgs.length === 0 && NUMERIC_RE.test(arg)) {
      amount = Number(arg);
    } else {
      symbolArgs.push(arg.trim());
    }
  }

  return { amount, symbolArgs, targetCurrencies };
}

module.exports = { parsePriceArgs };
