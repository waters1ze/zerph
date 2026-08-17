const https = require('https');

const botToken = '8978820727:AAEjO83eUZZp3Br5CvXhjcMK3OplR3PgA08';
const channel = '@zerph_off';

function callTg(method, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function test() {
  console.log('Testing bot getChat for', channel);
  const chatInfo = await callTg('getChat', { chat_id: channel });
  console.log('getChat result:', JSON.stringify(chatInfo, null, 2));

  console.log('Testing bot getChatMember (bot in channel)...');
  const me = await callTg('getMe', {});
  console.log('getMe:', me);

  if (me?.result?.id) {
    const member = await callTg('getChatMember', { chat_id: channel, user_id: me.result.id });
    console.log('getChatMember for bot:', JSON.stringify(member, null, 2));
  }
}

test().catch(console.error);
