const DEFAULT_MAX_LEN = 4096;
const DEFAULT_MAX_CHUNKS = 3;
const TRUNCATION_NOTE =
  '\n\n(Output truncated; narrow symbols or currencies.)';

/**
 * Split text into Telegram-safe chunks (max `maxLen` chars each).
 * Prefers breaks at newlines; otherwise hard-splits at `maxLen`.
 */
function splitTelegramChunks(text, maxLen = DEFAULT_MAX_LEN) {
  if (text.length <= maxLen) {
    return [text];
  }
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxLen, text.length);
    if (end >= text.length) {
      parts.push(text.slice(i));
      break;
    }
    const window = text.slice(i, end);
    const nl = window.lastIndexOf('\n');
    if (nl > 0) {
      const breakAt = i + nl + 1;
      parts.push(text.slice(i, breakAt));
      i = breakAt;
    } else {
      parts.push(text.slice(i, end));
      i = end;
    }
  }
  return parts;
}

/**
 * Like splitTelegramChunks, but caps the number of messages and appends a
 * truncation note on the last chunk if content was dropped.
 */
function prepareTelegramReplyChunks(
  text,
  maxLen = DEFAULT_MAX_LEN,
  maxChunks = DEFAULT_MAX_CHUNKS
) {
  const all = splitTelegramChunks(text, maxLen);
  if (all.length <= maxChunks) {
    return { chunks: all, truncated: false };
  }
  const head = all.slice(0, maxChunks - 1);
  const tail = all.slice(maxChunks - 1).join('');
  const note = TRUNCATION_NOTE;
  const budget = Math.max(0, maxLen - note.length);
  const body = tail.slice(0, budget);
  const lastChunk = body + note;
  return { chunks: [...head, lastChunk], truncated: true };
}

module.exports = {
  splitTelegramChunks,
  prepareTelegramReplyChunks,
  TRUNCATION_NOTE,
  DEFAULT_MAX_LEN,
  DEFAULT_MAX_CHUNKS,
};
