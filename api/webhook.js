require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const FixedFloatAPI = require('../src/services/fixedfloat');
const CommandHandler = require('../src/handlers/commands');
const ExchangeHandler = require('../src/handlers/exchange');

// Global instances
let bot;
let fixedFloat;
let commandHandler;
let exchangeHandler;

function initialize() {
  if (bot) return;

  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

  fixedFloat = new FixedFloatAPI(
    process.env.FIXEDFLOAT_API_KEY,
    process.env.FIXEDFLOAT_API_SECRET,
    process.env.FIXEDFLOAT_REF_CODE
  );

  commandHandler = new CommandHandler(bot, fixedFloat);
  exchangeHandler = new ExchangeHandler(bot, fixedFloat);
}

async function handleUpdate(update) {
  try {
    if (update.message) {
      const msg = update.message;
      const text = msg.text || '';

      // Commands
      if (text === '/start') {
        return await commandHandler.handleStart(msg);
      }
      if (text === '/currencies') {
        return await commandHandler.handleCurrencies(msg);
      }
      if (text === '/myorders') {
        return await commandHandler.handleMyOrders(msg);
      }
      if (text === '/help') {
        return await commandHandler.handleHelp(msg);
      }
      if (text === '/exchange') {
        return await exchangeHandler.startExchange(msg);
      }
      if (text.startsWith('/check_')) {
        const orderId = text.split('_')[1];
        return await exchangeHandler.checkOrder(msg, orderId);
      }

      // Exchange flow messages
      const userId = msg.from.id;
      const session = exchangeHandler.sessions.get(userId);

      if (session) {
        if (session.step === 'awaiting_amount') {
          return await exchangeHandler.handleAmount(msg);
        }
        if (session.step === 'awaiting_address') {
          return await exchangeHandler.handleAddress(msg);
        }
        if (session.step === 'awaiting_tag') {
          return await exchangeHandler.handleTag(msg);
        }
      }
    }

    if (update.callback_query) {
      const query = update.callback_query;
      const data = query.data;

      // دکمه‌های منوی اصلی
      if (data === 'start_exchange') {
        await bot.answerCallbackQuery(query.id);
        return await exchangeHandler.startExchange(query.message);
      }
      if (data === 'show_currencies') {
        await bot.answerCallbackQuery(query.id);
        return await commandHandler.handleCurrencies(query.message);
      }
      if (data === 'my_orders') {
        await bot.answerCallbackQuery(query.id);
        return await commandHandler.handleMyOrders(query.message);
      }
      if (data === 'show_help') {
        await bot.answerCallbackQuery(query.id);
        return await commandHandler.handleHelp(query.message);
      }
      if (data === 'back_to_menu') {
        await bot.answerCallbackQuery(query.id);
        return await commandHandler.handleStart(query.message);
      }

      // Exchange callbacks
      return await exchangeHandler.handleCallback(query);
    }
  } catch (error) {
    console.error('Error handling update:', error);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    initialize();
    await handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
};
