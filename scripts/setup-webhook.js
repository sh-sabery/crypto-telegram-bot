const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}

if (!webhookUrl) {
  console.error('❌ WEBHOOK_URL is not set');
  process.exit(1);
}

console.log('🔧 Setting up webhook...');
console.log('URL:', webhookUrl);

axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
  url: webhookUrl,
  allowed_updates: ['message', 'callback_query']
})
.then(res => {
  console.log('✅ Webhook set successfully');
  console.log(res.data);
  
  // Check webhook info
  return axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);
})
.then(res => {
  console.log('\n📊 Webhook info:');
  console.log(res.data.result);
})
.catch(err => {
  console.error('❌ Error:', err.response?.data || err.message);
  process.exit(1);
});
