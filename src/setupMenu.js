const userStore = require('../database/userStore');

class CommandHandler {
  constructor(bot, fixedFloatAPI) {
    this.bot = bot;
    this.api = fixedFloatAPI;
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    // ذخیره اطلاعات کاربر برای compliance
    userStore.saveUser({
      user_id: user.id,
      username: user.username || 'N/A',
      language: user.language_code || 'fa'
    });

    const welcomeMessage = `🎉 خوش آمدید به ربات تبادل ارز دیجیتال!

این ربات به شما امکان می‌دهد به راحتی ارزهای دیجیتال خود را تبادل کنید.

🔹 برای شروع تبادل، دکمه زیر را بزنید:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💱 شروع تبادل', callback_data: 'start_exchange' }
        ],
        [
          { text: '💰 ارزهای موجود', callback_data: 'show_currencies' },
          { text: '📋 سفارش‌های من', callback_data: 'my_orders' }
        ],
        [
          { text: '❓ راهنما', callback_data: 'show_help' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleCurrencies(msg) {
    const chatId = msg.chat.id;

    try {
      await this.bot.sendMessage(chatId, '⏳ در حال دریافت لیست ارزها...');

      const currencies = await this.api.getCurrencies();

      if (!currencies || currencies.length === 0) {
        return await this.bot.sendMessage(chatId, '❌ خطا در دریافت لیست ارزها. لطفاً بعداً تلاش کنید.');
      }

      // گروه‌بندی بر اساس شبکه
      const networks = {};
      currencies.forEach(ccy => {
        const net = ccy.network || 'OTHER';
        if (!networks[net]) networks[net] = [];
        networks[net].push(ccy);
      });

      let message = '💰 *ارزهای دیجیتال موجود:*\n\n';

      for (const [network, ccies] of Object.entries(networks)) {
        message += `📡 *${network}*\n`;
        ccies.forEach(c => {
          const sendIcon = c.send ? '✅' : '❌';
          const recvIcon = c.recv ? '✅' : '❌';
          message += `  • ${c.code.toUpperCase()} - ${c.name}\n`;
          message += `    ارسال: ${sendIcon} | دریافت: ${recvIcon}\n`;
        });
        message += '\n';
      }

      const messages = this.splitMessage(message);
      
      for (const msg of messages) {
        await this.bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      }

      // دکمه بازگشت
      const keyboard = {
        inline_keyboard: [
          [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
        ]
      };

      await this.bot.sendMessage(chatId, '🔹 برای بازگشت:', { reply_markup: keyboard });

    } catch (error) {
      console.error('Error fetching currencies:', error);
      await this.bot.sendMessage(chatId, '❌ خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.');
    }
  }

  async handleMyOrders(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
      const orders = userStore.getUserOrders(userId);

      if (!orders || orders.length === 0) {
        const keyboard = {
          inline_keyboard: [
            [{ text: '💱 ایجاد اولین سفارش', callback_data: 'start_exchange' }],
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
          ]
        };

        return await this.bot.sendMessage(
          chatId,
          '📋 شما هنوز سفارشی ثبت نکرده‌اید.',
          { reply_markup: keyboard }
        );
      }

      let message = '📋 *سفارش‌های شما:*\n\n';

      orders.forEach(order => {
        const statusEmoji = this.getStatusEmoji(order.status);
        const statusText = this.translateStatus(order.status);

        message += `${statusEmoji} *سفارش ${order.id}*\n`;
        message += `   ${order.fromAmount} ${order.fromCcy.toUpperCase()} → ${order.toAmount} ${order.toCcy.toUpperCase()}\n`;
        message += `   وضعیت: ${statusText}\n`;
        message += `   /check_${order.id}\n\n`;
      });

      const keyboard = {
        inline_keyboard: [
          [{ text: '💱 سفارش جدید', callback_data: 'start_exchange' }],
          [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error fetching orders:', error);
      await this.bot.sendMessage(chatId, '❌ خطا در دریافت سفارش‌ها.');
    }
  }

  async handleHelp(msg) {
    const chatId = msg.chat.id;

    const helpMessage = `📖 *راهنمای استفاده از ربات*

🔹 *دستورات موجود:*

/start - نمایش منوی اصلی
/exchange - شروع فرآیند تبادل ارز
/currencies - مشاهده لیست ارزهای موجود
/myorders - مشاهده سفارش‌های ثبت شده
/help - نمایش این راهنما

🔹 *نحوه استفاده:*

1️⃣ با دستور /exchange فرآیند تبادل را شروع کنید
2️⃣ ارز مبدا و مقصد را انتخاب کنید
3️⃣ نوع سفارش (Fixed یا Float) را انتخاب کنید
4️⃣ مقدار و آدرس مقصد را وارد کنید
5️⃣ سفارش خود را تأیید کنید
6️⃣ ارز را به آدرس نمایش داده شده ارسال کنید

⚠️ *نکات مهم:*
• برای هر سفارش محدودیت زمانی وجود دارد
• وضعیت سفارش خود را با /check_ORDERID بررسی کنید

    const keyboard = {
      inline_keyboard: [
        [{ text: '💱 شروع تبادل', callback_data: 'start_exchange' }],
        [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
      ]
    };

    await this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  getStatusEmoji(status) {
    const statusMap = {
      'NEW': '🆕',
      'PENDING': '⏳',
      'EXCHANGE': '🔄',
      'WITHDRAW': '💸',
      'DONE': '✅',
      'EXPIRED': '⏰',
      'EMERGENCY': '🚨'
    };
    return statusMap[status] || '❓';
  }

  translateStatus(status) {
    const translations = {
      'NEW': 'جدید - در انتظار واریز',
      'PENDING': 'در حال بررسی',
      'EXCHANGE': 'در حال تبادل',
      'WITHDRAW': 'در حال واریز',
      'DONE': 'تکمیل شده',
      'EXPIRED': 'منقضی شده',
      'EMERGENCY': 'نیاز به اقدام'
    };
    return translations[status] || status;
  }

  splitMessage(text, maxLength = 4000) {
    const messages = [];
    let current = '';

    const lines = text.split('\n');

    for (const line of lines) {
      if ((current + line + '\n').length > maxLength) {
        messages.push(current);
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }

    if (current) messages.push(current);

    return messages;
  }
}

module.exports = CommandHandler;