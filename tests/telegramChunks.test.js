const test = require('node:test');
const assert = require('node:assert/strict');

const {
  splitTelegramChunks,
  prepareTelegramReplyChunks,
  DEFAULT_MAX_LEN,
} = require('../utils/telegramChunks');

test('empty string yields one empty chunk', () => {
  assert.deepEqual(splitTelegramChunks(''), ['']);
});

test('short text is a single chunk', () => {
  assert.deepEqual(splitTelegramChunks('hello'), ['hello']);
});

test('text exactly at maxLen is one chunk', () => {
  const s = 'a'.repeat(DEFAULT_MAX_LEN);
  const out = splitTelegramChunks(s);
  assert.equal(out.length, 1);
  assert.equal(out[0].length, DEFAULT_MAX_LEN);
});

test('text one over maxLen splits into two chunks', () => {
  const s = 'a'.repeat(DEFAULT_MAX_LEN + 1);
  const out = splitTelegramChunks(s);
  assert.equal(out.length, 2);
  assert.equal(out[0].length, DEFAULT_MAX_LEN);
  assert.equal(out[1].length, 1);
});

test('prefers newline breaks when over limit', () => {
  const line = 'x'.repeat(100);
  const lines = Array.from({ length: 50 }, () => line).join('\n');
  assert.ok(lines.length > DEFAULT_MAX_LEN);
  const out = splitTelegramChunks(lines, DEFAULT_MAX_LEN);
  for (const c of out) {
    assert.ok(c.length <= DEFAULT_MAX_LEN);
  }
  assert.ok(out.length >= 2);
});

test('prepareTelegramReplyChunks caps chunks and marks truncated', () => {
  const small = 50;
  const line = 'y'.repeat(small);
  // Each chunk under maxLen but many chunks when split by newlines... splitTelegramChunks merges lines until maxLen.
  // Force >3 chunks: use lines of length ~2000 so 3 lines = 6000+ with newlines -> 2 chunks per split... 
  // Simpler: use maxLen=100, maxChunks=2 with text that splits to 3+ chunks of 100 each
  const maxLen = 100;
  const body = Array.from({ length: 5 }, (_, i) => `${'n'.repeat(90)}_${i}`).join('\n');
  const { chunks, truncated } = prepareTelegramReplyChunks(body, maxLen, 2);
  assert.equal(truncated, true);
  assert.equal(chunks.length, 2);
  for (const c of chunks) {
    assert.ok(c.length <= maxLen);
  }
  assert.ok(chunks[1].includes('truncated'));
});

test('prepareTelegramReplyChunks passes through when under cap', () => {
  const { chunks, truncated } = prepareTelegramReplyChunks('abc', 4096, 3);
  assert.equal(truncated, false);
  assert.deepEqual(chunks, ['abc']);
});
