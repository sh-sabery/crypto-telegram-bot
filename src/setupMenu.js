require('dotenv').config();
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const commands = [
  { command: 'start', description: '🏠 شروع و خوش‌آمدگویی' },
  { command: 'exchange', description: '💱 تبدیل ارز دیجیتال' },
  { command: 'currencies', description: '💰 لیست ارزهای موجود' },
  { command: 'myorders', description: '📋 سفارش‌های من' },
  { command: 'help', description: '❓ راهنما' }
];

async function setupMenu() {
  try {
    console.log('در حال تنظیم منوی ربات...');
    
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`,
      {
        commands: commands,
        scope: { type: 'default' },
        language_code: 'fa'
      }
    );

    if (response.data.ok) {
      console.log('✓ منوی ربات با موفقیت تنظیم شد!');
      console.log('کامندهای ثبت شده:');
      commands.forEach(cmd => {
        console.log(`  /${cmd.command} - ${cmd.description}`);
      });
    } else {
      console.error('✗ خطا در تنظیم منو:', response.data);
    }
  } catch (error) {
    console.error('✗ خطا در ارتباط با تلگرام:', error.message);
  }
}

setupMenu();
