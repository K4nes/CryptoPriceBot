const { CURRENCY_SYMBOLS } = require('../constants/currencies');

const MAX_AMOUNT = 1e12;
const MAX_DECIMAL_PLACES = 8;

function formatPrice(price) {
  if (typeof price !== 'number' || isNaN(price) || !isFinite(price)) {
    return 'N/A';
  }
  return price < 1 ? price.toFixed(8).replace(/\.?0+$/, '') : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const decimalParts = amount.toString().split('.');
  if (decimalParts[1] && decimalParts[1].length > MAX_DECIMAL_PLACES) {
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
