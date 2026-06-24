require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const FixedFloatAPI = require('./services/fixedfloat');
const CommandHandler = require('./handlers/commands');
const ExchangeHandler = require('./handlers/exchange');

// بررسی متغیرهای محیطی
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN تنظیم نشده است!');
  process.exit(1);
}

if (!process.env.FIXEDFLOAT_API_KEY || !process.env.FIXEDFLOAT_API_SECRET) {
  console.error('❌ کلیدهای API FixedFloat تنظیم نشده‌اند!');
  process.exit(1);
}

// ایجاد bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// ایجاد service instances
const fixedFloat = new FixedFloatAPI(
  process.env.FIXEDFLOAT_API_KEY,
  process.env.FIXEDFLOAT_API_SECRET,
  process.env.FIXEDFLOAT_REF_CODE
);

const commandHandler = new CommandHandler(bot, fixedFloat);
const exchangeHandler = new ExchangeHandler(bot, fixedFloat);

// Command handlers
bot.onText(/\/start/, (msg) => commandHandler.handleStart(msg));
bot.onText(/\/currencies/, (msg) => commandHandler.handleCurrencies(msg));
bot.onText(/\/myorders/, (msg) => commandHandler.handleMyOrders(msg));
bot.onText(/\/help/, (msg) => commandHandler.handleHelp(msg));
bot.onText(/\/exchange/, (msg) => exchangeHandler.startExchange(msg));
bot.onText(/\/check_(.+)/, (msg, match) => {
  const orderId = match[1];
  exchangeHandler.checkOrder(msg, orderId);
});

// Callback query handler برای دکمه‌های شیشه‌ای
bot.on('callback_query', async (query) => {
  const data = query.data;

  // دکمه‌های منوی اصلی
  if (data === 'start_exchange') {
    await bot.answerCallbackQuery(query.id);
    return exchangeHandler.startExchange(query.message);
  }

  if (data === 'show_currencies') {
    await bot.answerCallbackQuery(query.id);
    return commandHandler.handleCurrencies(query.message);
  }

  if (data === 'my_orders') {
    await bot.answerCallbackQuery(query.id);
    return commandHandler.handleMyOrders(query.message);
  }

  if (data === 'show_help') {
    await bot.answerCallbackQuery(query.id);
    return commandHandler.handleHelp(query.message);
  }

  if (data === 'back_to_menu') {
    await bot.answerCallbackQuery(query.id);
    return commandHandler.handleStart(query.message);
  }

  // سایر callbackها برای exchange flow
  await exchangeHandler.handleCallback(query);
});

// Text message handler برای مراحل exchange
bot.on('message', async (msg) => {
  // Skip اگر command است
  if (msg.text && msg.text.startsWith('/')) return;

  const userId = msg.from.id;
  const session = exchangeHandler.sessions.get(userId);

  if (!session) return;

  if (session.step === 'awaiting_amount') {
    await exchangeHandler.handleAmount(msg);
  } else if (session.step === 'awaiting_address') {
    await exchangeHandler.handleAddress(msg);
  } else if (session.step === 'awaiting_tag') {
    await exchangeHandler.handleTag(msg);
  }
});

console.log('✅ ربات با موفقیت راه‌اندازی شد!');
console.log('📱 در حال گوش دادن به پیام‌ها...');
