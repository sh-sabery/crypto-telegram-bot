require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const FixedFloatAPI = require('../src/services/fixedfloat');
const CommandHandler = require('../src/handlers/commands');
const ExchangeHandler = require('../src/handlers/exchange');

let bot, fixedFloat, commandHandler, exchangeHandler;

function initialize() {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const apiKey = process.env.FIXEDFLOAT_API_KEY;
    const apiSecret = process.env.FIXEDFLOAT_API_SECRET;

    if (!token || !apiKey || !apiSecret) {
      throw new Error('Missing required environment variables');
    }

    bot = new TelegramBot(token);
    fixedFloat = new FixedFloatAPI(apiKey, apiSecret);
    commandHandler = new CommandHandler(bot, fixedFloat);
    exchangeHandler = new ExchangeHandler(bot, fixedFloat);
  }
  return { bot, commandHandler, exchangeHandler };
}

async function handleUpdate(update) {
  const { bot, commandHandler, exchangeHandler } = initialize();

  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const fakeMsg = { chat: { id: chatId }, from: query.from };

    await bot.answerCallbackQuery(query.id);

    if (query.data === 'start_exchange') {
      await exchangeHandler.startExchange(fakeMsg);
    } else if (query.data === 'show_currencies') {
      await commandHandler.handleCurrencies(fakeMsg);
    } else if (query.data === 'my_orders') {
      await commandHandler.handleMyOrders(fakeMsg);
    } else if (query.data === 'show_help') {
      await commandHandler.handleHelp(fakeMsg);
    } else if (query.data === 'back_to_menu') {
      await commandHandler.handleStart(fakeMsg);
    } else {
      await exchangeHandler.handleCallback(query);
    }
    return;
  }

  if (update.message) {
    const msg = update.message;

    if (msg.text && msg.text.startsWith('/')) {
      const command = msg.text.split(' ')[0].split('@')[0];

      if (command === '/start') {
        await commandHandler.handleStart(msg);
      } else if (command === '/currencies') {
        await commandHandler.handleCurrencies(msg);
      } else if (command === '/myorders') {
        await commandHandler.handleMyOrders(msg);
      } else if (command === '/help') {
        await commandHandler.handleHelp(msg);
      } else if (command === '/exchange') {
        await exchangeHandler.startExchange(msg);
      } else if (command.startsWith('/check_')) {
        const orderId = command.replace('/check_', '');
        await commandHandler.handleCheckOrder(msg, orderId);
      }
      return;
    }

    const userId = msg.from.id;
    const session = exchangeHandler.sessions.get(userId);

    if (session) {
      if (session.stage === 'awaiting_amount') {
        await exchangeHandler.handleAmountInput(msg);
      } else if (session.stage === 'awaiting_address') {
        await exchangeHandler.handleAddressInput(msg);
      } else if (session.stage === 'awaiting_tag') {
        await exchangeHandler.handleTagInput(msg);
      }
    }
  }
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error handling update:', error);
      res.status(200).json({ ok: true });
    }
  } else {
    res.status(200).json({ status: 'Bot is running' });
  }
};
