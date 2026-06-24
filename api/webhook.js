const TelegramBot = require('node-telegram-bot-api');
const FixedFloatAPI = require('../src/services/fixedfloat');
const CommandHandler = require('../src/handlers/commands');
const ExchangeHandler = require('../src/handlers/exchange');

// Instance های global (برای حفظ session ها)
let bot;
let fixedFloat;
let commandHandler;
let exchangeHandler;

// Initialize
function initialize() {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    fixedFloat = new FixedFloatAPI(
      process.env.FIXEDFLOAT_API_KEY,
      process.env.FIXEDFLOAT_API_SECRET,
      process.env.FIXEDFLOAT_REF_CODE
    );
    commandHandler = new CommandHandler(bot, fixedFloat);
    exchangeHandler = new ExchangeHandler(bot, fixedFloat);
  }
}

// Handler function
async function handleUpdate(update) {
  try {
    if (update.message) {
      const msg = update.message;
      
      // Commands
      if (msg.text) {
        if (msg.text === '/start') {
          await commandHandler.handleStart(msg);
        } else if (msg.text === '/currencies') {
          await commandHandler.handleCurrencies(msg);
        } else if (msg.text === '/myorders') {
          await commandHandler.handleMyOrders(msg);
        } else if (msg.text === '/help') {
          await commandHandler.handleHelp(msg);
        } else if (msg.text === '/exchange') {
          await exchangeHandler.startExchange(msg);
        } else if (msg.text.startsWith('/check_')) {
          const orderId = msg.text.substring(7);
          await exchangeHandler.checkOrder(msg, orderId);
        } else {
          // Text message (برای فرآیند مبادله)
          const userId = msg.from.id;
          const session = exchangeHandler.sessions.get(userId);

          if (session) {
            if (session.step === 'enter_amount') {
              await exchangeHandler.handleAmount(msg);
            } else if (session.step === 'enter_address') {
              await exchangeHandler.handleAddress(msg);
            } else if (session.step === 'enter_tag') {
              await exchangeHandler.handleTag(msg);
            }
          }
        }
      }
    } else if (update.callback_query) {
      await exchangeHandler.handleCallback(update.callback_query);
    }
  } catch (error) {
    console.error('Error handling update:', error);
  }
}

// Vercel serverless function
module.exports = async (req, res) => {
  try {
    // فقط POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Initialize bot
    initialize();

    // Process update
    await handleUpdate(req.body);

    // پاسخ سریع به تلگرام
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
