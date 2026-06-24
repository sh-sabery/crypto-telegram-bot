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
    const currencies = await this.fixedFloat.getCurrencies();

    const both = [];
    const sendOnly = [];
    const recvOnly = [];
    const inactive = [];

    for (const currency of currencies) {
      const send = currency.send === true || currency.send === 1;
      const recv = currency.recv === true || currency.recv === 1;
      const network = currency.network || '';
      const code = currency.code || currency.coin || '';

      const item = { code, network, send, recv };

      if (send && recv) both.push(item);
      else if (send) sendOnly.push(item);
      else if (recv) recvOnly.push(item);
      else inactive.push(item);
    }

    // گروه‌بندی ارزهای فعال بر اساس شبکه
    const groupByNetwork = (list) => {
      const groups = {};
      for (const item of list) {
        const net = item.network || 'سایر';
        if (!groups[net]) groups[net] = [];
        groups[net].push(item.code);
      }
      return groups;
    };

    const formatGrouped = (list) => {
      const groups = groupByNetwork(list);
      return Object.keys(groups)
        .sort()
        .map((net) => `  ${net}: ${groups[net].join(', ')}`)
        .join('\n');
    };

    const formatFlat = (list) =>
      list.map((i) => i.code).join(' • ');

    let message = '💰 لیست ارزهای موجود:\n';

    if (both.length) {
      message += `\n✅ ارزهای فعال (ارسال و دریافت):\n${formatGrouped(both)}\n`;
    }
    if (sendOnly.length) {
      message += `\n📤 فقط ارسال:\n${formatFlat(sendOnly)}\n`;
    }
    if (recvOnly.length) {
      message += `\n📥 فقط دریافت:\n${formatFlat(recvOnly)}\n`;
    }
    if (inactive.length) {
      message += `\n⏸ غیرفعال:\n${formatFlat(inactive)}\n`;
    }

    const parts = this.splitMessage(message);
    for (const part of parts) {
      await this.bot.sendMessage(chatId, part);
    }

    await this.bot.sendMessage(chatId, 'برای بازگشت:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_menu' }],
        ],
      },
    });
  } catch (error) {
    console.error('Error in handleCurrencies:', error);
    await this.bot.sendMessage(chatId, '❌ خطا در دریافت لیست ارزها.');
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
