# Crypto Telegram Bot

ربات تلگرام برای تبادل ارزهای دیجیتال با استفاده از FixedFloat API.

## ویژگی‌ها

- 🔄 مبادله خودکار ارزهای دیجیتال
- 📊 نمایش لیست کامل ارزهای پشتیبانی شده
- 💰 محاسبه نرخ لحظه‌ای
- 📋 پیگیری سفارشات
- 🔒 نرخ ثابت و شناور

## الزامات

- Node.js 18+
- حساب کاربری FixedFloat با API Key
- ربات تلگرام (از BotFather)

## نصب و راه‌اندازی (محلی)
```bash
# Clone repository
git clone <your-repo-url>
cd crypto-telegram-bot

# Install dependencies
npm install

# تنظیم متغیرهای محیطی
cp .env.example .env
# فایل .env را ویرایش کنید

# اجرا
npm run dev

## دیپلوی روی Vercel

### مرحله 1: آماده‌سازی

bash
# نصب Vercel CLI
npm i -g vercel

# لاگین به Vercel
vercel login

### مرحله 2: تنظیم متغیرهای محیطی در Vercel

در داشبورد Vercel یا از طریق CLI:

bash
vercel env add TELEGRAM_BOT_TOKEN
vercel env add FIXEDFLOAT_API_KEY
vercel env add FIXEDFLOAT_API_SECRET
vercel env add FIXEDFLOAT_REF_CODE

### مرحله 3: دیپلوی

bash
vercel --prod

### مرحله 4: تنظیم Webhook

بعد از دیپلوی، URL پروژه شما مثل این خواهد بود:
`https://your-project.vercel.app`

Webhook را تنظیم کنید:

bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-project.vercel.app/api/webhook"

یا از این اسکریپت استفاده کنید:

javascript
// setup-webhook.js
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;

axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
  url: webhookUrl
})
.then(res => console.log('✅ Webhook set:', res.data))
.catch(err => console.error('❌ Error:', err.response.data));

## ساختار پروژه


fixedfloat-telegram-bot/
├── api/
│   └── webhook.js          # Vercel serverless function
├── src/
│   ├── services/
│   │   └── fixedfloat.js   # FixedFloat API client
│   ├── handlers/
│   │   ├── commands.js     # Command handlers
│   │   └── exchange.js     # Exchange flow handler
│   ├── database/
│   │   └── userStore.js    # User data storage
│   └── index.js            # Local development entry
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md

## دستورات ربات

- `/start` - شروع و خوش‌آمدگویی
- `/currencies` - لیست ارزهای موجود
- `/exchange` - شروع مبادله
- `/myorders` - سفارشات من
- `/check_ORDERID` - بررسی وضعیت سفارش
- `/help` - راهنما

## Compliance با FixedFloat

طبق درخواست FixedFloat، اطلاعات زیر برای هر کاربر ذخیره می‌شود:
- `user_id` (Telegram)
- `username`
- `language`
- سابقه سفارشات

این اطلاعات برای حداقل 1 سال نگهداری می‌شوند.

## امنیت

- 🔒 API keys در environment variables
- ✅ تایید آدرس کیف پول
- 🛡️ مدیریت خطا
- 📝 لاگ تراکنش‌ها

## متن اطلاع‌رسانی (طبق درخواست FixedFloat)

در ربات، متن زیر نمایش داده می‌شود:

> "سرویس تبادل توسط FixedFloat ارائه می‌شود. با ایجاد سفارش، شما با قوانین FixedFloat موافقت می‌کنید."

لینک‌های مرتبط:
- [Terms of Service](https://fixedfloat.com/terms-of-service)
- [API Terms](https://fixedfloat.com/api-terms)

## مشکلات رایج

### Webhook کار نمی‌کند
bash
# بررسی وضعیت webhook
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

### خطای Environment Variables
مطمئن شوید تمام متغیرها در Vercel تنظیم شده‌اند.

## لایسنس

MIT

## پشتیبانی

برای مشکلات مربوط به API، با [FixedFloat Support](https://fixedfloat.com) تماس بگیرید.
