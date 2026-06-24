const userStore = require('../database/userStore');

class ExchangeHandler {
  constructor(bot, fixedFloat) {
    this.bot = bot;
    this.api = fixedFloat;
    this.sessions = new Map();
  }

  async startExchange(msg) {
    const userId = msg.from.id;
    
    try {
      const currencies = await this.api.getCurrencies();
      const sendable = currencies.filter(c => c.recv);

      this.sessions.set(userId, {
        step: 'select_from',
        currencies: currencies
      });

      const keyboard = this.createCurrencyKeyboard(sendable);
      
      await this.bot.sendMessage(
        userId,
        '1️⃣ *ارز مبدا را انتخاب کنید:*\n(ارزی که می‌خواهید بفرستید)',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    } catch (error) {
      await this.bot.sendMessage(userId, '❌ خطا: ' + error.message);
    }
  }

  async handleCallback(query) {
    const userId = query.from.id;
    const data = query.data;
    const session = this.sessions.get(userId);

    if (!session) {
      await this.bot.answerCallbackQuery(query.id, { text: 'جلسه منقضی شده. دوباره /exchange را وارد کنید.' });
      return;
    }

    try {
      if (data.startsWith('from_')) {
        await this.handleFromCurrency(userId, query, data.substring(5));
      } else if (data.startsWith('to_')) {
        await this.handleToCurrency(userId, query, data.substring(3));
      } else if (data.startsWith('type_')) {
        await this.handleType(userId, query, data.substring(5));
      } else if (data.startsWith('dir_')) {
        await this.handleDirection(userId, query, data.substring(4));
      } else if (data === 'confirm_order') {
        await this.confirmOrder(userId, query);
      } else if (data === 'cancel_order') {
        await this.cancelOrder(userId, query);
      }
    } catch (error) {
      await this.bot.answerCallbackQuery(query.id, { text: 'خطا: ' + error.message });
    }
  }

  async handleFromCurrency(userId, query, currencyCode) {
    const session = this.sessions.get(userId);
    session.fromCcy = currencyCode;
    session.step = 'select_to';

    const receivable = session.currencies.filter(c => c.send && c.code !== currencyCode);
    const keyboard = this.createCurrencyKeyboard(receivable, 'to');

    await this.bot.editMessageText(
      `✅ ارز مبدا: *${currencyCode}*\n\n2️⃣ *ارز مقصد را انتخاب کنید:*\n(ارزی که می‌خواهید دریافت کنید)`,
      {
        chat_id: userId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    await this.bot.answerCallbackQuery(query.id);
  }

  async handleToCurrency(userId, query, currencyCode) {
    const session = this.sessions.get(userId);
    session.toCcy = currencyCode;
    session.step = 'select_type';

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 نرخ شناور (Float)', callback_data: 'type_float' },
          { text: '🔒 نرخ ثابت (Fixed)', callback_data: 'type_fixed' }
        ]
      ]
    };

    await this.bot.editMessageText(
      `✅ ارز مبدا: *${session.fromCcy}*\n✅ ارز مقصد: *${currencyCode}*\n\n3️⃣ *نوع نرخ را انتخاب کنید:*\n\n📊 نرخ شناور: بهترین نرخ بازار\n🔒 نرخ ثابت: نرخ قطعی`,
      {
        chat_id: userId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    await this.bot.answerCallbackQuery(query.id);
  }

  async handleType(userId, query, type) {
    const session = this.sessions.get(userId);
    session.type = type;
    session.step = 'select_direction';

    const keyboard = {
      inline_keyboard: [
        [
          { text: `📤 می‌فرستم (${session.fromCcy})`, callback_data: 'dir_from' },
          { text: `📥 دریافت می‌کنم (${session.toCcy})`, callback_data: 'dir_to' }
        ]
      ]
    };

    const typeText = type === 'float' ? 'شناور' : 'ثابت';

    await this.bot.editMessageText(
      `✅ نرخ: *${typeText}*\n\n4️⃣ *جهت محاسبه را انتخاب کنید:*`,
      {
        chat_id: userId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    await this.bot.answerCallbackQuery(query.id);
  }

  async handleDirection(userId, query, direction) {
    const session = this.sessions.get(userId);
    session.direction = direction;
    session.step = 'enter_amount';

    const currencyName = direction === 'from' ? session.fromCcy : session.toCcy;

    await this.bot.editMessageText(
      `5️⃣ *مقدار ${currencyName} را وارد کنید:*`,
      {
        chat_id: userId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      }
    );

    await this.bot.answerCallbackQuery(query.id);
  }

  async handleAmount(msg) {
    const userId = msg.from.id;
    const session = this.sessions.get(userId);

    if (!session || session.step !== 'enter_amount') {
      return;
    }

    const amount = parseFloat(msg.text);
    
    if (isNaN(amount) || amount <= 0) {
      await this.bot.sendMessage(userId, '❌ لطفا یک عدد معتبر وارد کنید.');
      return;
    }

    session.amount = amount;
    
    try {
      await this.bot.sendMessage(userId, '⏳ در حال محاسبه نرخ...');

      const priceData = await this.api.getPrice({
        fromCcy: session.fromCcy,
        toCcy: session.toCcy,
        amount: amount,
        direction: session.direction,
        type: session.type
      });

      if (priceData.errors && priceData.errors.length > 0) {
        const errorText = this.translateErrors(priceData.errors);
        await this.bot.sendMessage(userId, `❌ ${errorText}\n\n💡 حداقل: ${priceData.from.min}\n💡 حداکثر: ${priceData.from.max}`);
        return;
      }

      session.priceData = priceData;
      session.step = 'enter_address';

      const summary = `
📊 *خلاصه مبادله:*

📤 می‌فرستید: \`${priceData.from.amount}\` ${priceData.from.code}
📥 دریافت می‌کنید: \`${priceData.to.amount}\` ${priceData.to.code}

💵 ارزش تقریبی: $${priceData.from.usd.toFixed(2)}
📈 نرخ: ${priceData.from.rate.toFixed(8)}

6️⃣ *آدرس کیف پول ${session.toCcy} خود را وارد کنید:*
      `;

      await this.bot.sendMessage(userId, summary, { parse_mode: 'Markdown' });

    } catch (error) {
      await this.bot.sendMessage(userId, '❌ خطا در محاسبه: ' + error.message);
    }
  }

  async handleAddress(msg) {
    const userId = msg.from.id;
    const session = this.sessions.get(userId);

    if (!session || session.step !== 'enter_address') {
      return;
    }

    const address = msg.text.trim();
    
    if (address.length < 10) {
      await this.bot.sendMessage(userId, '❌ آدرس وارد شده نامعتبر است.');
      return;
    }

    session.toAddress = address;

    // چک کردن اینکه آیا این ارز نیاز به tag/memo داره
    const toCurrency = session.currencies.find(c => c.code === session.toCcy);
    
    if (toCurrency && toCurrency.tag) {
      session.step = 'enter_tag';
      await this.bot.sendMessage(
        userId,
        `7️⃣ *${toCurrency.tag} را وارد کنید:*\n\n(اگر ندارید، عبارت "skip" را بفرستید)`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await this.showOrderConfirmation(userId);
    }
  }

  async handleTag(msg) {
    const userId = msg.from.id;
    const session = this.sessions.get(userId);

    if (!session || session.step !== 'enter_tag') {
      return;
    }

    const tag = msg.text.trim();
    
    if (tag.toLowerCase() !== 'skip') {
      session.tag = tag;
    }

    await this.showOrderConfirmation(userId);
  }

  async showOrderConfirmation(userId) {
    const session = this.sessions.get(userId);
    const pd = session.priceData;

    let confirmText = `
✅ *تایید نهایی سفارش*

📤 ارسال: \`${pd.from.amount}\` ${pd.from.code}
📥 دریافت: \`${pd.to.amount}\` ${pd.to.code}
💵 ارزش: $${pd.from.usd.toFixed(2)}

📮 آدرس مقصد:
\`${session.toAddress}\`
    `;

    if (session.tag) {
      confirmText += `\n🏷 Tag/Memo: \`${session.tag}\``;
    }

    confirmText += `\n\n⚠️ *توجه:* سرویس تبادل توسط FixedFloat ارائه می‌شود. با ایجاد سفارش، قوانین FixedFloat را می‌پذیرید.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ تایید و ایجاد سفارش', callback_data: 'confirm_order' },
          { text: '❌ انصراف', callback_data: 'cancel_order' }
        ]
      ]
    };

    session.step = 'confirm';

    await this.bot.sendMessage(userId, confirmText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async confirmOrder(userId, query) {
    const session = this.sessions.get(userId);

    try {
      await this.bot.editMessageText(
        '⏳ در حال ایجاد سفارش...',
        {
          chat_id: userId,
          message_id: query.message.message_id
        }
      );

      const orderData = await this.api.createOrder({
        fromCcy: session.fromCcy,
        toCcy: session.toCcy,
        amount: session.amount,
        direction: session.direction,
        toAddress: session.toAddress,
        type: session.type,
        tag: session.tag
      });

      // ذخیره سفارش
      userStore.saveOrder(userId, orderData);
      userStore.incrementOrderCount(userId);

      const orderText = `
✅ *سفارش با موفقیت ایجاد شد*

🆔 شناسه سفارش: \`${orderData.id}\`
📊 وضعیت: ${this.translateStatus(orderData.status)}

📤 *مبلغ ارسالی:*
\`${orderData.from.amount}\` ${orderData.from.code}

📮 *به آدرس زیر واریز کنید:*
\`${orderData.from.address}\`
${orderData.from.tag ? `\n🏷 ${orderData.from.tagName}: \`${orderData.from.tag}\`` : ''}

⏰ زمان باقیمانده: ${Math.floor(orderData.time.left / 60)} دقیقه

📥 *دریافت می‌کنید:*
\`${orderData.to.amount}\` ${orderData.to.code}

💡 برای بررسی وضعیت: /check_${orderData.id}
      `;

      await this.bot.editMessageText(orderText, {
        chat_id: userId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      });

      // پاک کردن session
      this.sessions.delete(userId);

    } catch (error) {
      await this.bot.editMessageText(
        '❌ خطا در ایجاد سفارش: ' + error.message,
        {
          chat_id: userId,
          message_id: query.message.message_id
        }
      );
    }

    await this.bot.answerCallbackQuery(query.id);
  }

  async cancelOrder(userId, query) {
    this.sessions.delete(userId);
    
    await this.bot.editMessageText(
      '❌ سفارش لغو شد.\n\nبرای شروع مبادله جدید: /exchange',
      {
        chat_id: userId,
        message_id: query.message.message_id
      }
    );

    await this.bot.answerCallbackQuery(query.id);
  }

  async checkOrder(msg, orderId) {
    const userId = msg.from.id;
    const order = userStore.getOrderById(userId, orderId);

    if (!order) {
      await this.bot.sendMessage(userId, '❌ سفارش پیدا نشد.');
      return;
    }

    try {
      await this.bot.sendMessage(userId, '⏳ در حال بررسی وضعیت...');

      const updatedOrder = await this.api.getOrder(order.id, order.token);

      // آپدیت سفارش در دیتابیس
      userStore.saveOrder(userId, updatedOrder);

      let statusText = `
📊 *وضعیت سفارش ${updatedOrder.id}*

🔄 وضعیت: ${this.translateStatus(updatedOrder.status)}

📤 ارسال: \`${updatedOrder.from.amount}\` ${updatedOrder.from.code}
📥 دریافت: \`${updatedOrder.to.amount}\` ${updatedOrder.to.code}
      `;

      if (updatedOrder.status === 'NEW' || updatedOrder.status === 'PENDING') {
        statusText += `\n\n📮 آدرس واریز:\n\`${updatedOrder.from.address}\``;
        if (updatedOrder.from.tag) {
          statusText += `\n🏷 ${updatedOrder.from.tagName}: \`${updatedOrder.from.tag}\``;
        }
        statusText += `\n\n⏰ زمان باقیمانده: ${Math.floor(updatedOrder.time.left / 60)} دقیقه`;
      }

      if (updatedOrder.status === 'EXCHANGE' || updatedOrder.status === 'WITHDRAW') {
        statusText += `\n\n⏳ سفارش در حال پردازش است...`;
      }

      if (updatedOrder.status === 'DONE') {
        statusText += `\n\n✅ مبادله با موفقیت انجام شد!`;
        if (updatedOrder.to.tx) {
          statusText += `\n\n🔗 تراکنش: \`${updatedOrder.to.tx}\``;
        }
      }

      if (updatedOrder.status === 'EMERGENCY') {
        statusText += `\n\n⚠️ *نیاز به اقدام:*\n`;
        statusText += this.translateEmergency(updatedOrder.emergency.status);
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '🔄 ادامه مبادله', callback_data: `emg_exchange_${orderId}` },
              { text: '↩️ بازگشت وجه', callback_data: `emg_refund_${orderId}` }
            ]
          ]
        };

        await this.bot.sendMessage(userId, statusText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        return;
      }

      await this.bot.sendMessage(userId, statusText, { parse_mode: 'Markdown' });

    } catch (error) {
      await this.bot.sendMessage(userId, '❌ خطا در بررسی وضعیت: ' + error.message);
    }
  }

  createCurrencyKeyboard(currencies, prefix = 'from') {
    const buttons = [];
    const perRow = 3;

    // گروه‌بندی محبوب‌ترین ارزها
    const popular = ['BTC', 'ETH', 'USDT', 'BNB', 'USDC'];
    const popularCurrencies = currencies.filter(c => popular.includes(c.coin));
    const otherCurrencies = currencies.filter(c => !popular.includes(c.coin));

    const allCurrencies = [...popularCurrencies, ...otherCurrencies];

    for (let i = 0; i < allCurrencies.length; i += perRow) {
      const row = allCurrencies.slice(i, i + perRow).map(c => ({
        text: `${c.code}`,
        callback_data: `${prefix}_${c.code}`
      }));
      buttons.push(row);
    }

    return { inline_keyboard: buttons };
  }

  translateStatus(status) {
    const translations = {
      'NEW': 'جدید - در انتظار واریز',
      'PENDING': 'در انتظار تایید شبکه',
      'EXCHANGE': 'در حال مبادله',
      'WITHDRAW': 'در حال ارسال به کیف پول شما',
      'DONE': 'تکمیل شده ✅',
      'EXPIRED': 'منقضی شده',
      'EMERGENCY': 'نیاز به اقدام ⚠️'
    };
    return translations[status] || status;
  }

  translateEmergency(status) {
    const translations = {
      'EXPIRED': 'زمان سفارش به پایان رسید. مبلغ واریزی کمتر یا بیشتر از مقدار سفارش است.',
      'LESS': 'مبلغ واریزی کمتر از مقدار سفارش است.',
      'MORE': 'مبلغ واریزی بیشتر از مقدار سفارش است.',
      'LIMIT': 'مبلغ واریزی خارج از محدوده مجاز است.'
    };
    return translations[status] || status;
  }

  translateErrors(errors) {
    const translations = {
      'MAINTENANCE_FROM': 'ارز مبدا در حال تعمیرات است',
      'MAINTENANCE_TO': 'ارز مقصد در حال تعمیرات است',
      'OFFLINE_FROM': 'ارز مبدا آفلاین است',
      'OFFLINE_TO': 'ارز مقصد آفلاین است',
      'RESERVE_FROM': 'ذخیره ارز مبدا کافی نیست',
      'RESERVE_TO': 'ذخیره ارز مقصد کافی نیست',
      'LIMIT_MIN': 'مبلغ کمتر از حداقل مجاز است',
      'LIMIT_MAX': 'مبلغ بیشتر از حداکثر مجاز است'
    };

    return errors.map(err => translations[err] || err).join('\n');
  }
}

module.exports = ExchangeHandler;