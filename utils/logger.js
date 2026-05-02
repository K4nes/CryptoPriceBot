const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const ROTATE_CHECK_INTERVAL_MS = 60 * 1000;

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO;

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create log directory:', err.message);
  }
}

ensureLogDir();

let stream = openStream();

function openStream() {
  try {
    const s = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    s.on('error', (err) => {
      console.error('Log stream error:', err.message);
    });
    return s;
  } catch (err) {
    console.error('Failed to open log stream:', err.message);
    return null;
  }
}

function rotateIfNeeded() {
  fs.stat(LOG_FILE, (err, stats) => {
    if (err || !stats || stats.size < MAX_LOG_SIZE) return;
    const date = new Date().toISOString().split('T')[0];
    const archivePath = path.join(LOG_DIR, `bot-${date}.log`);
    const oldStream = stream;
    stream = null;
    if (oldStream) oldStream.end();
    fs.rename(LOG_FILE, archivePath, (renameErr) => {
      if (renameErr) console.error('Log rotation rename failed:', renameErr.message);
      stream = openStream();
    });
  });
}

const rotateTimer = setInterval(rotateIfNeeded, ROTATE_CHECK_INTERVAL_MS);
if (typeof rotateTimer.unref === 'function') rotateTimer.unref();

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaStr}`.trim();
}

function log(levelName, message, meta = {}) {
  if (LOG_LEVELS[levelName] > CURRENT_LEVEL) return;

  const formatted = formatMessage(levelName, message, meta);
  console.log(formatted);

  if (stream) {
    stream.write(formatted + '\n');
  }
}

const logger = {
  error: (message, meta = {}) => log('ERROR', message, meta),
  warn: (message, meta = {}) => log('WARN', message, meta),
  info: (message, meta = {}) => log('INFO', message, meta),
  debug: (message, meta = {}) => log('DEBUG', message, meta),
};

module.exports = logger;
