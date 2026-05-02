const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatPrice,
  getCurrencySymbol,
  formatChange,
  getChangeEmoji,
  validateAmount,
  validateSymbol,
} = require('../utils/formatters');

test('formatPrice handles non-numeric input', () => {
  assert.equal(formatPrice(NaN), 'N/A');
  assert.equal(formatPrice(Infinity), 'N/A');
  assert.equal(formatPrice(undefined), 'N/A');
  assert.equal(formatPrice(null), 'N/A');
  assert.equal(formatPrice('5'), 'N/A');
});

test('formatPrice formats zero', () => {
  assert.equal(formatPrice(0), '0');
});

test('formatPrice formats large prices with thousands separators', () => {
  assert.equal(formatPrice(67000), '67,000.00');
  assert.equal(formatPrice(1234567.89), '1,234,567.89');
});

test('formatPrice trims trailing zeros for sub-1 prices', () => {
  assert.equal(formatPrice(0.5), '0.5');
  assert.equal(formatPrice(0.1234), '0.1234');
});

test('formatPrice falls back to exponential for ultra-small prices', () => {
  const out = formatPrice(5e-10);
  assert.match(out, /e/i, 'should use exponential notation for sub-1e-8 values');
});

test('formatChange returns empty for nullish input', () => {
  assert.equal(formatChange(undefined), '');
  assert.equal(formatChange(null), '');
});

test('formatChange adds explicit + sign for non-negative values', () => {
  assert.equal(formatChange(0), '+0.00%');
  assert.equal(formatChange(2.5), '+2.50%');
  assert.equal(formatChange(-1.234), '-1.23%');
});

test('getChangeEmoji selects up/down by sign', () => {
  assert.equal(getChangeEmoji(1), '📈');
  assert.equal(getChangeEmoji(-1), '📉');
  assert.equal(getChangeEmoji(0), '📈');
  assert.equal(getChangeEmoji(undefined), '');
});

test('getCurrencySymbol falls back to the ISO code', () => {
  assert.equal(getCurrencySymbol('USD'), '$');
  assert.equal(getCurrencySymbol('XYZ'), 'XYZ');
});

test('validateAmount rejects bad numbers', () => {
  assert.equal(validateAmount(NaN).valid, false);
  assert.equal(validateAmount(0).valid, false);
  assert.equal(validateAmount(-1).valid, false);
  assert.equal(validateAmount(1e13).valid, false);
  assert.equal(validateAmount(0.000000001).valid, false); // 9 decimal places
});

test('validateAmount accepts valid numbers', () => {
  assert.equal(validateAmount(1).valid, true);
  assert.equal(validateAmount(0.5).valid, true);
  assert.equal(validateAmount(0.00000001).valid, true); // 8 decimal places
});

test('validateSymbol rejects empty/long/invalid', () => {
  assert.equal(validateSymbol('').valid, false);
  assert.equal(validateSymbol('a'.repeat(51)).valid, false);
  assert.equal(validateSymbol('btc!').valid, false);
});

test('validateSymbol accepts allowed characters', () => {
  assert.equal(validateSymbol('BTC').valid, true);
  assert.equal(validateSymbol('btc-eth').valid, true);
  assert.equal(validateSymbol('Wrapped BTC').valid, true);
  assert.equal(validateSymbol('PROS123').valid, true);
});
