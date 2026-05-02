const { CURRENCY_SYMBOLS } = require('../constants/currencies');

const MAX_AMOUNT = 1e12;
const MAX_DECIMAL_PLACES = 8;

function formatPrice(price) {
  if (typeof price !== 'number' || isNaN(price) || !isFinite(price)) {
    return 'N/A';
  }
  if (price === 0) return '0';
  const abs = Math.abs(price);
  if (abs < 1) {
    // Sub-satoshi values would round to 0 at 8 decimals; fall back to exponential.
    if (abs < 1e-8) return price.toExponential(4);
    return price.toFixed(8).replace(/\.?0+$/, '');
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}

function formatChange(percent) {
  if (percent === undefined || percent === null) return '';
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

function getChangeEmoji(percent) {
  if (percent === undefined || percent === null) return '';
  return percent >= 0 ? '📈' : '📉';
}

function countDecimals(num) {
  if (Number.isInteger(num)) return 0;
  const str = num.toString();
  if (!/e/i.test(str)) {
    const frac = str.split('.')[1];
    return frac ? frac.length : 0;
  }
  // Exponential form (e.g. "1e-9" or "1.5e-8") bypasses the simple split.
  const [mantissa, expPart] = str.toLowerCase().split('e');
  const expNum = parseInt(expPart, 10);
  const dotIdx = mantissa.indexOf('.');
  const mantissaDecimals = dotIdx >= 0 ? mantissa.length - dotIdx - 1 : 0;
  return Math.max(0, mantissaDecimals - expNum);
}

function validateAmount(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, message: 'Amount must be a valid number' };
  }
  if (amount <= 0) {
    return { valid: false, message: 'Amount must be greater than 0' };
  }
  if (amount > MAX_AMOUNT) {
    return { valid: false, message: 'Amount is too large (max: 1 trillion)' };
  }
  if (countDecimals(amount) > MAX_DECIMAL_PLACES) {
    return { valid: false, message: 'Amount can have max 8 decimal places' };
  }
  return { valid: true };
}

function validateSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, message: 'Symbol is required' };
  }
  if (symbol.length > 50) {
    return { valid: false, message: 'Symbol is too long (max: 50 characters)' };
  }
  if (!/^[A-Za-z0-9\s-]+$/.test(symbol)) {
    return { valid: false, message: 'Symbol can only contain letters, numbers, spaces, and hyphens' };
  }
  return { valid: true };
}

module.exports = { formatPrice, getCurrencySymbol, formatChange, getChangeEmoji, validateAmount, validateSymbol };
