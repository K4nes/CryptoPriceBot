require('dotenv').config();

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