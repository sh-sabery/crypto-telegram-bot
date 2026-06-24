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

      const keyboard = this.createCurrencyKeyboard(sendable, 'from');
      
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
        const currencyData = data.substring(5);
        if (currencyData.endsWith('_multi')) {
          await this.showNetworkSelection(userId, query, currencyData.replace('_multi', ''), 'from');
        } else {
          await this.handleFromCurrency(userId, query, currencyData);
        }
      } else if (data.startsWith('to_')) {
        const currencyData = data.substring(3);
        if (currencyData.endsWith('_multi')) {
          await this.showNetworkSelection(userId, query, currencyData.replace('_multi', ''), 'to');
        } else {
          await this.handleToCurrency(userId, query, currencyData);
        }
      } else if (data.startsWith('net_from_')) {
        await this.handleFromCurrency(userId, query, data.substring(9));
      } else if (data.startsWith('net_to_')) {
        await this.handleToCurrency(userId, query, data.substring(7));
      } else if (data === 'back_from_network') {
        await this.backToCurrencySelection(userId, query, 'from');
      } else if (data === 'back_to_network') {
        await this.backToCurrencySelection(userId, query, 'to');
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

  async showNetworkSelection(userId, query, coin, prefix) {
    const session = this.sessions.get(userId);
    const networks = session.currencies.filter(c => c.coin === coin);

    if (prefix === 'from') {
      networks.filter(c => c.recv);
    } else {
      networks.filter(c => c.send);
    }

    const buttons = networks.map(net => [{
      text: `${net.network}${net.send ? ' ✅' : ' ❌'}`,
      callback_data: `net_${prefix}_${coin}_${net.network}`
    }]);

    buttons.push([
      { text: '🔙 بازگشت', callback_data: `back_${prefix}_network` }
    ]);

    const coinName = networks[0].name;
    const stepText = prefix === 'from' ? '1️⃣ ارز مبدا' : '2️⃣ ارز مقصد';

    await this.bot.editMessageText(
      `${stepText}: *${coinName}*\n\n🌐 *شبکه را انتخاب کنید:*\n\n✅ = قابل ارسال/دریافت\n❌ = غیرفعال`,
      {
        chat_id: userId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      }
    );

    await this.bot.answerCallbackQuery(query.id);
  }

  async backToCurrencySelection(userId, query, prefix) {
    const session = this.sessions.get(userId);
    
    if (prefix === 'from') {
      const sendable = session.currencies.filter(c => c.recv);
      const keyboard = this.createCurrencyKeyboard(sendable, 'from');
      
      await this.bot.editMessageText(
        '1️⃣ *ارز مبدا را انتخاب کنید:*\n(ارزی که می‌خواهید بفرستید)',
        {
          chat_id: userId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    } else {
      const receivable = session.currencies.filter(c => c.send && c.code !== session.fromCode);
      const keyboard = this.createCurrencyKeyboard(receivable, 'to');
      
      await this.bot.editMessageText(
        `✅ ارز مبدا: *${session.fromName}* (${session.fromNetwork})\n\n2️⃣ *ارز مقصد را انتخاب کنید:*\n(ارزی که می‌خواهید دریافت کنید)`,
        {
          chat_id: userId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    }

    await this.bot.answerCallbackQuery(query.id);
  }

  async handleFromCurrency(userId, query, currencyData) {
    const session = this.sessions.get(userId);
    const [coin, network] = currencyData.split('_');
    
    const currency = session.currencies.find(c => c.coin === coin && c.network === network);
    if (!currency) {
      await this.bot.answerCallbackQuery(query.id, { text: 'ارز پیدا نشد' });
      return;
    }

    if (!currency.recv) {
      await this.bot.answerCallbackQuery(query.id, { text: '❌ این ارز فعلاً قابل ارسال نیست', show_alert: true });
      return;
    }

    session.fromCoin = coin;
    session.fromNetwork = network;
    session.fromCode = currency.code;
    session.fromName = currency.name;
    session.step = 'select_to';

    const receivable = session.currencies.filter(c => c.send && c.code !== currency.code);
    const keyboard = this.createCurrencyKeyboard(receivable, 'to');

    await this.bot.editMessageText(
      `✅ ارز مبدا: *${currency.name}* (${currency.network})\n\n2️⃣ *ارز مقصد را انتخاب کنید:*\n(ارزی که می‌خواهید دریافت کنید)`,
      {
        chat_id: userId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    await this.bot.answerCallbackQuery(query.id);
  }

  async handleToCurrency(userId, query, currencyData) {
    const session = this.sessions.get(userId);
    const [coin, network] = currencyData.split('_');
    
    const currency = session.currencies.find(c => c.coin === coin && c.network === network);
    if (!currency) {
      await this.bot.answerCallbackQuery(query.id, { text: 'ارز پیدا نشد' });
      return;
    }

    if (!currency.send) {
      await this.bot.answerCallbackQuery(query.id, { text: '❌ این ارز فعلاً قابل دریافت نیست', show_alert: true });
      return;
    }

    session.toCoin = coin;
    session.toNetwork = network;
    session.toCode = currency.code;
    session.toName = currency.name;
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
      `✅ ارز مبدا: *${session.fromName}* (${session.fromNetwork})\n✅ ارز مقصد: *${currency.name}* (${currency.network})\n\n3️⃣ *نوع نرخ را انتخاب کنید:*\n\n📊 نرخ شناور: بهترین نرخ بازار\n🔒 نرخ ثابت: نرخ قطعی`,
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
          { text: `📤 می‌فرستم (${session.fromCode})`, callback_data: 'dir_from' },
          { text: `📥 دریافت می‌کنم (${session.toCode})`, callback_data: 'dir_to' }
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

    const currencyName = direction === 'from' ? session.fromCode : session.toCode;

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
        fromCcy: session.fromCode,
        toCcy: session.toCode,
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

6️⃣ *آدرس کیف پول ${session.toCode} (${session.toNetwork}) خود را وارد کنید:*
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

    const toCurrency = session.currencies.find(c => c.code === session.toCode);
    
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

📤 ارسال: \`${pd.from.amount}\` ${pd.from.code} (${session.fromNetwork})
📥 دریافت: \`${pd.to.amount}\` ${pd.to.code} (${session.toNetwork})
💵 ارزش: $${pd.from.usd.toFixed(2)}

📮 آدرس مقصد:
\`${session.toAddress}\`
    `;

    if (session.tag) {
      confirmText += `\n🏷 Tag/Memo: \`${session.tag}\``;
    }

    confirmText += `\n\n⚠️ *توجه:* با ایجاد سفارش، قوانین را می‌پذیرید.`;

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
        fromCcy: session.fromCode,
        toCcy: session.toCode,
        amount: session.amount,
        direction: session.direction,
        toAddress: session.toAddress,
        type: session.type,
        tag: session.tag
      });

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
    const perRow = 2;

    // گروه‌بندی بر اساس coin
    const grouped = new Map();
    for (const c of currencies) {
      if (!grouped.has(c.coin)) {
        grouped.set(c.coin, []);
      }
      grouped.get(c.coin).push(c);
    }

    // محبوب‌ترین ارزها
    const popular = ['BTC', 'ETH', 'USDT', 'BNB', 'USDC', 'TRX', 'XRP', 'LTC', 'DOGE', 'ADA'];
    const popularCoins = popular.filter(coin => grouped.has(coin));
    const otherCoins = Array.from(grouped.keys()).filter(coin => !popular.includes(coin)).sort();

    const allCoins = [...popularCoins, ...otherCoins];

    for (let i = 0; i < allCoins.length; i += perRow) {
      const row = allCoins.slice(i, i + perRow).map(coin => {
        const networks = grouped.get(coin);
        const firstNetwork = networks[0];
        
        // اگر فقط یک شبکه داره
        if (networks.length === 1) {
          const status = prefix === 'from' ? 
            (firstNetwork.recv ? '' : ' ❌') : 
            (firstNetwork.send ? '' : ' ❌');
          
          return {
            text: `${firstNetwork.name}${status}`,
            callback_data: `${prefix}_${coin}_${firstNetwork.network}`
          };
        }
        
        // اگر چند شبکه داره
        return {
          text: `${firstNetwork.name} (${networks.length} شبکه)`,
          callback_data: `${prefix}_${coin}_multi`
        };
      });
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
