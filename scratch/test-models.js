require('dotenv').config();
const https = require('https');

const apiKey = process.env.GROQ_API_KEY;

const req = https.request('https://api.groq.com/openai/v1/models', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Available Groq models:', data.data?.map(m => m.id));
    } catch (e) {
      console.error(body);
    }
  });
});

req.on('error', console.error);
req.end();
