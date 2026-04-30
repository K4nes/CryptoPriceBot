const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

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

function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    
    const stats = fs.statSync(LOG_FILE);
    if (stats.size >= MAX_LOG_SIZE) {
      const date = new Date().toISOString().split('T')[0];
      const archivePath = path.join(LOG_DIR, `bot-${date}.log`);
      fs.renameSync(LOG_FILE, archivePath);
    }
  } catch (err) {
    console.error('Log rotation failed:', err.message);
  }
}

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaStr}`.trim();
}

function log(level, levelName, message, meta = {}) {
  if (LOG_LEVELS[levelName] > CURRENT_LEVEL) return;
  
  ensureLogDir();
  rotateLogIfNeeded();
  
  const formatted = formatMessage(levelName, message, meta);
  console.log(formatted);
  
  try {
    fs.appendFileSync(LOG_FILE, formatted + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
}

const logger = {
  error: (message, meta = {}) => log('ERROR', 'ERROR', message, meta),
  warn: (message, meta = {}) => log('WARN', 'WARN', message, meta),
  info: (message, meta = {}) => log('INFO', 'INFO', message, meta),
  debug: (message, meta = {}) => log('DEBUG', 'DEBUG', message, meta),
};

module.exports = logger;
