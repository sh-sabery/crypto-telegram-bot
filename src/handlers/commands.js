const userStore = require('../database/userStore');

class CommandHandler {
  constructor(bot, fixedFloat) {
    this.bot = bot;
    this.fixedFloat = fixedFloat;
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    userStore.saveUser(user.id, user);

    const welcomeMessage = `🎉 خوش آمدید به ربات تبادل ارز دیجیتال!

🔹 برای شروع، از دکمه‌های زیر استفاده کنید:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '💱 شروع تبادل', callback_data: 'start_exchange' }],
        [{ text: '💰 ارزهای موجود', callback_data: 'show_currencies' }],
        [{ text: '📋 سفارش‌های من', callback_data: 'my_orders' }],
        [{ text: '❓ راهنما', callback_data: 'show_help' }]
      ]
    };

    await this.bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: keyboard
    });
  }

  async handleCurrencies(msg) {
    const chatId = msg.chat.id;
    
    try {
      await this.bot.sendMessage(chatId, '⏳ در حال دریافت لیست ارزها...');
      
      const currencies = await this.fixedFloat.getCurrencies();
      
      const grouped = {};
      currencies.forEach(currency => {
        const network = currency.network || 'سایر';
        if (!grouped[network]) {
          grouped[network] = [];
        }
        grouped[network].push(currency);
      });

      let message = '💰 لیست ارزهای موجود:\n\n';
      
      for (const [network, coins] of Object.entries(grouped)) {
        message += `🔸 ${network}:\n`;
        coins.forEach(coin => {
          const send = coin.send ? '✅' : '❌';
          const recv = coin.recv ? '✅' : '❌';
          message += `  • ${coin.code.toUpperCase()} - ${coin.coin}\n`;
          message += `    ارسال: ${send} | دریافت: ${recv}\n`;
        });
        message += '\n';
      }

      const messages = this.splitMessage(message);
      for (const msg of messages) {
        await this.bot.sendMessage(chatId, msg);
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
        ]
      };

      await this.bot.sendMessage(chatId, '✅ لیست ارزها دریافت شد.', {
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error fetching currencies:', error);
      await this.bot.sendMessage(
        chatId,
        '❌ خطا در دریافت لیست ارزها. لطفاً بعداً تلاش کنید.'
      );
    }
  }

  async handleMyOrders(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const orders = userStore.getUserOrders(userId);
    
    if (!orders || orders.length === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: '💱 ایجاد اولین سفارش', callback_data: 'start_exchange' }],
          [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
        ]
      };

      return this.bot.sendMessage(
        chatId,
        '📋 شما هنوز هیچ سفارشی ثبت نکرده‌اید.',
        { reply_markup: keyboard }
      );
    }

    let message = '📋 سفارش‌های شما:\n\n';
    
    orders.forEach((order, index) => {
      const status = this.translateStatus(order.status);
      const emoji = this.getStatusEmoji(order.status);
      
      message += `${index + 1}. ${emoji} ${order.from.toUpperCase()} → ${order.to.toUpperCase()}\n`;
      message += `   وضعیت: ${status}\n`;
      message += `   شناسه: /check_${order.id}\n`;
      message += `   تاریخ: ${new Date(order.createdAt).toLocaleString('fa-IR')}\n\n`;
    });

    const keyboard = {
      inline_keyboard: [
        [{ text: '💱 سفارش جدید', callback_data: 'start_exchange' }],
        [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
      ]
    };

    await this.bot.sendMessage(chatId, message, { reply_markup: keyboard });
  }

  async handleHelp(msg) {
    const chatId = msg.chat.id;
    
    const helpMessage = `📖 راهنمای استفاده از ربات

🔹 دستورات موجود:

/start - نمایش منوی اصلی
/exchange - شروع فرآیند تبادل ارز
/currencies - مشاهده لیست ارزهای موجود
/myorders - مشاهده سفارش‌های ثبت شده
/help - نمایش این راهنما

🔹 نحوه استفاده:

1️⃣ با دستور /exchange فرآیند تبادل را شروع کنید
2️⃣ ارز مبدا و مقصد را انتخاب کنید
3️⃣ نوع سفارش (Fixed یا Float) را انتخاب کنید
4️⃣ مقدار و آدرس مقصد را وارد کنید
5️⃣ سفارش خود را تأیید کنید
6️⃣ ارز را به آدرس نمایش داده شده ارسال کنید

⚠️ نکات مهم:
• برای هر سفارش محدودیت زمانی وجود دارد
• وضعیت سفارش خود را با /check_ORDERID بررسی کنید`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '💱 شروع تبادل', callback_data: 'start_exchange' }],
        [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }]
      ]
    };

    await this.bot.sendMessage(chatId, helpMessage, {
      reply_markup: keyboard
    });
  }

  async handleCheckOrder(msg, orderId) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const order = userStore.getOrder(userId, orderId);
      
      if (!order) {
        return this.bot.sendMessage(
          chatId,
          '❌ سفارش یافت نشد یا متعلق به شما نیست.'
        );
      }

      await this.bot.sendMessage(chatId, '⏳ در حال بررسی وضعیت سفارش...');
      
      const orderStatus = await this.fixedFloat.getOrder(orderId, order.token);
      
      userStore.updateOrderStatus(userId, orderId, orderStatus.status);

      const status = this.translateStatus(orderStatus.status);
      const emoji = this.getStatusEmoji(orderStatus.status);
      
      let statusMessage = `${emoji} وضعیت سفارش: ${status}\n\n`;
      statusMessage += `🔸 شناسه: ${orderId}\n`;
      statusMessage += `🔸 از: ${orderStatus.from.toUpperCase()}\n`;
      statusMessage += `🔸 به: ${orderStatus.to.toUpperCase()}\n`;
      statusMessage += `🔸 مقدار ارسالی: ${orderStatus.amountFrom} ${orderStatus.from.toUpperCase()}\n`;
      statusMessage += `🔸 مقدار دریافتی: ${orderStatus.amountTo} ${orderStatus.to.toUpperCase()}\n`;
      
      if (orderStatus.status === 'NEW' || orderStatus.status === 'PENDING') {
        statusMessage += `\n⏰ زمان باقی‌مانده: ${Math.floor(orderStatus.time / 60)} دقیقه\n`;
        statusMessage += `\n💡 لطفاً ${orderStatus.amountFrom} ${orderStatus.from.toUpperCase()} را به آدرس زیر ارسال کنید:\n`;
        statusMessage += `\`${orderStatus.addressFrom}\`\n`;
        
        if (orderStatus.tagFrom) {
          statusMessage += `\nTag/Memo: \`${orderStatus.tagFrom}\`\n`;
        }
      }

      await this.bot.sendMessage(chatId, statusMessage, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error checking order:', error);
      await this.bot.sendMessage(
        chatId,
        '❌ خطا در بررسی وضعیت سفارش. لطفاً بعداً تلاش کنید.'
      );
    }
  }

  getStatusEmoji(status) {
    const statusEmojis = {
      'NEW': '🆕',
      'PENDING': '⏳',
      'EXCHANGE': '🔄',
      'WITHDRAW': '📤',
      'DONE': '✅',
      'EXPIRED': '⏰',
      'EMERGENCY': '⚠️'
    };
    return statusEmojis[status] || '❓';
  }

  translateStatus(status) {
    const statusTranslations = {
      'NEW': 'جدید',
      'PENDING': 'در انتظار واریز',
      'EXCHANGE': 'در حال تبادل',
      'WITHDRAW': 'در حال ارسال',
      'DONE': 'تکمیل شده',
      'EXPIRED': 'منقضی شده',
      'EMERGENCY': 'نیاز به پشتیبانی'
    };
    return statusTranslations[status] || status;
  }

  splitMessage(text, maxLength = 4000) {
    if (text.length <= maxLength) {
      return [text];
    }

    const messages = [];
    let currentMessage = '';
    const lines = text.split('\n');

    for (const line of lines) {
      if ((currentMessage + line + '\n').length > maxLength) {
        if (currentMessage) {
          messages.push(currentMessage.trim());
          currentMessage = '';
        }
        
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength) {
            messages.push(line.substring(i, i + maxLength));
          }
        } else {
          currentMessage = line + '\n';
        }
      } else {
        currentMessage += line + '\n';
      }
    }

    if (currentMessage) {
      messages.push(currentMessage.trim());
    }

    return messages;
  }
}

module.exports = CommandHandler;
