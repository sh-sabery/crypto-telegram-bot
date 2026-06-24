const userStore = require('../database/userStore');

class CommandHandler {
  constructor(bot, fixedFloat) {
    this.bot = bot;
    this.api = fixedFloat;
  }

  async handleStart(msg) {
    const userId = msg.from.id;
    
    // ذخیره اطلاعات کاربر
    userStore.saveUser(userId, msg.from);

    const welcomeText = `
🔄 *به ربات تبادل ارز دیجیتال خوش آمدید*

این ربات از سرویس FixedFloat استفاده می‌کند.

*دستورات موجود:*
/currencies - لیست ارزهای موجود
/exchange - شروع مبادله
/myorders - سفارشات من
/help - راهنما

⚠️ *توجه مهم:*
با ایجاد سفارش، شما با قوانین سرویس FixedFloat موافقت می‌کنید.
سرویس تبادل توسط FixedFloat ارائه می‌شود.
    `;

    await this.bot.sendMessage(userId, welcomeText, { parse_mode: 'Markdown' });
  }

  async handleCurrencies(msg) {
    const userId = msg.from.id;
    
    try {
      await this.bot.sendMessage(userId, '⏳ در حال دریافت لیست ارزها...');
      
      const currencies = await this.api.getCurrencies();
      
      // دسته‌بندی بر اساس شبکه
      const networks = {};
      currencies.forEach(currency => {
        if (!networks[currency.network]) {
          networks[currency.network] = [];
        }
        networks[currency.network].push(currency);
      });

      let responseText = '*💰 ارزهای موجود:*\n\n';
      
      Object.keys(networks).sort().forEach(network => {
        responseText += `*${network}:*\n`;
        networks[network].forEach(c => {
          const recvIcon = c.recv ? '✅' : '❌';
          const sendIcon = c.send ? '✅' : '❌';
          responseText += `  • ${c.code} - ${c.name} (دریافت: ${recvIcon} | ارسال: ${sendIcon})\n`;
        });
        responseText += '\n';
      });

      // تقسیم پیام به چند بخش (محدودیت تلگرام)
      const chunks = this.splitMessage(responseText, 4000);
      for (const chunk of chunks) {
        await this.bot.sendMessage(userId, chunk, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      await this.bot.sendMessage(userId, '❌ خطا در دریافت لیست ارزها: ' + error.message);
    }
  }

  async handleMyOrders(msg) {
    const userId = msg.from.id;
    const orders = userStore.getUserOrders(userId);

    if (orders.length === 0) {
      await this.bot.sendMessage(userId, 'شما هنوز هیچ سفارشی ندارید.\n\n/exchange برای شروع مبادله');
      return;
    }

    let text = '*📋 سفارشات شما:*\n\n';
    
    orders.slice(-10).reverse().forEach(order => {
      const statusEmoji = this.getStatusEmoji(order.status);
      text += `${statusEmoji} *${order.id}*\n`;
      text += `  ${order.from.amount} ${order.from.code} → ${order.to.amount} ${order.to.code}\n`;
      text += `  وضعیت: ${this.translateStatus(order.status)}\n`;
      text += `  /check_${order.id}\n\n`;
    });

    await this.bot.sendMessage(userId, text, { parse_mode: 'Markdown' });
  }

  async handleHelp(msg) {
    const userId = msg.from.id;
    
    const helpText = `
📖 *راهنمای استفاده:*

*1️⃣ مشاهده ارزها:*
از دستور /currencies برای مشاهده لیست کامل ارزهای پشتیبانی شده استفاده کنید.

*2️⃣ شروع مبادله:*
- دستور /exchange را وارد کنید
- ارز مبدا را انتخاب کنید
- ارز مقصد را انتخاب کنید
- مقدار را وارد کنید
- آدرس دریافت را وارد کنید

*3️⃣ پیگیری سفارش:*
از دستور /myorders برای مشاهده سفارشات خود استفاده کنید.

*⚠️ نکات مهم:*
- حداقل و حداکثر مبلغ را رعایت کنید
- آدرس ولت را دقیق وارد کنید
- برای برخی ارزها (XRP, XLM) نیاز به Memo/Tag است

*🔒 امنیت:*
سرویس مبادله توسط FixedFloat ارائه می‌شود.
ربات هیچ دسترسی به کیف پول شما ندارد.

*📞 پشتیبانی:*
در صورت بروز مشکل با پشتیبانی FixedFloat تماس بگیرید.
    `;

    await this.bot.sendMessage(userId, helpText, { parse_mode: 'Markdown' });
  }

  getStatusEmoji(status) {
    const emojis = {
      'NEW': '🆕',
      'PENDING': '⏳',
      'EXCHANGE': '🔄',
      'WITHDRAW': '📤',
      'DONE': '✅',
      'EXPIRED': '⏰',
      'EMERGENCY': '⚠️'
    };
    return emojis[status] || '❓';
  }

  translateStatus(status) {
    const translations = {
      'NEW': 'جدید - در انتظار واریز',
      'PENDING': 'در انتظار تایید',
      'EXCHANGE': 'در حال مبادله',
      'WITHDRAW': 'در حال ارسال',
      'DONE': 'تکمیل شده',
      'EXPIRED': 'منقضی شده',
      'EMERGENCY': 'نیاز به اقدام'
    };
    return translations[status] || status;
  }

  splitMessage(text, maxLength) {
    const chunks = [];
    let currentChunk = '';
    
    text.split('\n').forEach(line => {
      if ((currentChunk + line + '\n').length > maxLength) {
        chunks.push(currentChunk);
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    });
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
}

module.exports = CommandHandler;
