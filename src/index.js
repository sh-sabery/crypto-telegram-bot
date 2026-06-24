require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const FixedFloatAPI = require('./services/fixedfloat');
const CommandHandler = require('./handlers/commands');
const ExchangeHandler = require('./handlers/exchange');
const userStore = require('./database/userStore');

// بررسی متغیرهای محیطی
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'FIXEDFLOAT_API_KEY',
  'FIXEDFLOAT_API_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Error: ${varName} is not set in environment variables`);
    process.exit(1);
  }
});

// ایجاد instance های لازم
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const fixedFloat = new FixedFloatAPI(
  process.env.FIXEDFLOAT_API_KEY,
  process.env.FIXEDFLOAT_API_SECRET,
  process.env.FIXEDFLOAT_REF_CODE
);

const commandHandler = new CommandHandler(bot, fixedFloat);
const exchangeHandler = new ExchangeHandler(bot, fixedFloat);

console.log('🤖 Bot started successfully!');

// Handle commands
bot.onText(/\/start/, (msg) => {
  commandHandler.handleStart(msg);
});

bot.onText(/\/currencies/, (msg) => {
  commandHandler.handleCurrencies(msg);
});

bot.onText(/\/myorders/, (msg) => {
  commandHandler.handleMyOrders(msg);
});

bot.onText(/\/help/, (msg) => {
  commandHandler.handleHelp(msg);
});

bot.onText(/\/exchange/, (msg) => {
  exchangeHandler.startExchange(msg);
});

bot.onText(/\/check_(.+)/, (msg, match) => {
  const orderId = match[1];
  exchangeHandler.checkOrder(msg, orderId);
});

// Handle callback queries
bot.on('callback_query', (query) => {
  exchangeHandler.handleCallback(query);
});

// Handle text messages (برای فرآیند مبادله)
bot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const userId = msg.from.id;
    const session = exchangeHandler.sessions.get(userId);

    if (session) {
      if (session.step === 'enter_amount') {
        exchangeHandler.handleAmount(msg);
      } else if (session.step === 'enter_address') {
        exchangeHandler.handleAddress(msg);
      } else if (session.step === 'enter_tag') {
        exchangeHandler.handleTag(msg);
      }
    }
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});
