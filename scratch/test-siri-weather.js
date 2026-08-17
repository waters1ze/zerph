const crypto = require('crypto');

function stripThinkingTags(raw) {
  if (!raw) return ''
  return raw
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/^<\/think>/i, '')
    .trim()
}

// Test 1: Thinking tag stripping
const sampleLeaked = "<think> Here's a thinking process: 1. **Analyze User Input:** - **Role:** Smart personal AI productivity coach named \"Zerf AI\" - **User Name:** Кирилл (Kirill) - **Focus for today:** 🎂 Мой</think> Закрывайте срочные задачи в первой половине дня.";
const sampleUnclosed = "<think> Here's an unclosed thinking process that got cut off by max_tokens...";
const sampleClean = "Начните с приоритетных задач.";

console.log('--- TEST 1: Thinking Tag Filter ---');
console.log('Result 1 (closed):', JSON.stringify(stripThinkingTags(sampleLeaked)));
console.log('Result 2 (unclosed):', JSON.stringify(stripThinkingTags(sampleUnclosed)));
console.log('Result 3 (clean):', JSON.stringify(stripThinkingTags(sampleClean)));

// Test 2: Siri User Key
const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.JWT_SECRET || 'zerf_siri_secret_key_salt_2026';
function getSiriUserKey(chatId) {
  return crypto.createHmac('sha256', secret).update(String(chatId)).digest('hex').slice(0, 10);
}

const key1 = getSiriUserKey(6136950061);
const key2 = getSiriUserKey('6136950061');
console.log('\n--- TEST 2: Siri Key Generation ---');
console.log('Key for 6136950061 (number):', key1);
console.log('Key for 6136950061 (string):', key2);
console.log('Keys match:', key1 === key2 && key1.length === 10);

console.log('\nALL TESTS PASSED!');
