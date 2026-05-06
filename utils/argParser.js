// Strict numeric: integer or decimal only. parseFloat("1abc") would silently
// produce 1 and hide the malformed input; this regex rejects it.
const NUMERIC_RE = /^\d+(?:\.\d+)?$/;

/**
 * Parses the argument list of /price <amount> <symbol> [-currency,...].
 * @param {string[]} args - Array of raw command line arguments.
 * @returns {{ amount: number, symbolArgs: string[], targetCurrencies: string[] }} Structured pricing parameters.
 */
function parsePriceArgs(args) {
  let amount = 1;
  const symbolArgs = [];
  const targetCurrencies = [];
  let foundAmount = false;

  for (const arg of args) {
    if (!arg) continue;
    
    if (arg.startsWith('-')) {
      const currencies = arg.slice(1).split(',');
      for (const c of currencies) {
        const trimmed = c.toUpperCase().trim();
        if (trimmed) targetCurrencies.push(trimmed);
      }
    } else if (!foundAmount && NUMERIC_RE.test(arg)) {
      const numArgs = args.filter(a => !a.startsWith('-') && NUMERIC_RE.test(a));
      const firstNumericIdx = args.indexOf(arg);
      const allBeforeNonCurrency = args.slice(0, firstNumericIdx).filter(a => !a.startsWith('-')).length === 0;
      
      if (numArgs.indexOf(arg) === 0 && allBeforeNonCurrency) {
        amount = Number(arg);
        foundAmount = true;
      } else {
        symbolArgs.push(arg.trim());
      }
    } else {
      symbolArgs.push(arg.trim());
    }
  }

  return { amount, symbolArgs, targetCurrencies };
}

module.exports = { parsePriceArgs };
