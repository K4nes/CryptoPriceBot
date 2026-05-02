require('dotenv').config();

const REQUIRED_ENV_VARS = ['TELEGRAM_BOT_TOKEN', 'CMC_API_KEY'];

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name] || !process.env[name].trim());
  if (missing.length > 0) {
    const message = `Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env and fill them in.`;
    console.error(`[FATAL] ${message}`);
    process.exit(1);
  }
}

validateEnv();

module.exports = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  coinmarketcap: {
    apiKey: process.env.CMC_API_KEY,
    baseUrl: 'https://pro-api.coinmarketcap.com',
    defaultCurrency: 'USD',
  },
};