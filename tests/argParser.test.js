const test = require('node:test');
const assert = require('node:assert/strict');

const { parsePriceArgs } = require('../utils/argParser');

test('defaults to amount=1 when only a symbol is given', () => {
  const out = parsePriceArgs(['btc']);
  assert.equal(out.amount, 1);
  assert.deepEqual(out.symbolArgs, ['btc']);
  assert.deepEqual(out.targetCurrencies, []);
});

test('parses leading numeric as the amount', () => {
  const out = parsePriceArgs(['0.5', 'sol']);
  assert.equal(out.amount, 0.5);
  assert.deepEqual(out.symbolArgs, ['sol']);
});

test('rejects malformed numerics like "1abc" instead of silently using 1', () => {
  const out = parsePriceArgs(['1abc', 'btc']);
  assert.equal(out.amount, 1, 'falls back to default amount');
  assert.deepEqual(out.symbolArgs, ['1abc', 'btc']);
});

test('does not upper-case symbols (preserves EIP-55 / base58 casing)', () => {
  const evm = '0xAbCdEf1234567890aBcDeF1234567890AbCdEf12';
  const sol = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const out = parsePriceArgs([evm, sol]);
  assert.deepEqual(out.symbolArgs, [evm, sol]);
});

test('parses single-currency flag', () => {
  const out = parsePriceArgs(['1', 'btc', '-eth']);
  assert.deepEqual(out.targetCurrencies, ['ETH']);
});

test('parses multi-currency comma-separated flag', () => {
  const out = parsePriceArgs(['btc', '-idr,eur,gbp']);
  assert.deepEqual(out.targetCurrencies, ['IDR', 'EUR', 'GBP']);
});

test('upper-cases currency codes', () => {
  const out = parsePriceArgs(['btc', '-eur']);
  assert.deepEqual(out.targetCurrencies, ['EUR']);
});

test('treats a numeric after the first symbol as a symbol candidate', () => {
  const out = parsePriceArgs(['1', 'btc', '2.5', 'eth']);
  assert.equal(out.amount, 1);
  assert.deepEqual(out.symbolArgs, ['btc', '2.5', 'eth']);
});

test('handles empty / undefined entries gracefully', () => {
  const out = parsePriceArgs(['', 'btc', undefined, '-eur']);
  assert.equal(out.amount, 1);
  assert.deepEqual(out.symbolArgs, ['btc']);
  assert.deepEqual(out.targetCurrencies, ['EUR']);
});

test('strips empty currency tokens from -eur,,gbp', () => {
  const out = parsePriceArgs(['btc', '-eur,,gbp']);
  assert.deepEqual(out.targetCurrencies, ['EUR', 'GBP']);
});

test('integer amounts are parsed as numbers', () => {
  const out = parsePriceArgs(['100', 'btc']);
  assert.equal(out.amount, 100);
  assert.equal(typeof out.amount, 'number');
});
