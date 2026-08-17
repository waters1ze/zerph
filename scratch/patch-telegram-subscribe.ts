import fs from 'fs'
import path from 'path'

const filePath = path.join(__dirname, '../app/api/telegram/route.ts')
let content = fs.readFileSync(filePath, 'utf-8')

const oldFuncStart = 'async function handleSubscribe(chatId: number) {'
const oldFuncEnd = 'async function handleAdminCommand('

const newFunc = `async function handleSubscribe(chatId: number) {
  const limits = await getUserUsageAndLimits(chatId)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
  const pricingUrl = \`\${appUrl}/#pricing\`

  if (planAtLeast(limits.plan, 'plus')) {
    const exp = limits.subscriptionExpiry
      ? new Date(limits.subscriptionExpiry).toLocaleDateString('ru-RU')
      : 'Бессрочно'
    const planName = limits.plan === 'corp' ? 'Corp' : limits.plan === 'pro' ? 'Pro' : 'Plus'

    await send(chatId,
      \`👑 *У вас активен тариф Zerf \${planName}!*\\n\\n\` +
      \`📅 Активен до: *\${exp}*\\n\\n\` +
      \`◈ *Текущие лимиты и возможности:*\\n\` +
      \`• 🤖 ИИ: *\${limits.plan === 'plus' ? 'Qwen 3.6 27B' : 'OpenAI GPT-OSS 120B Flagship'}*\\n\` +
      \`• 🎙 Голос: *\${limits.plan === 'corp' ? '8 часов (480 мин)' : limits.plan === 'pro' ? '2 часа (120 мин)' : '15 минут'} в день*\\n\` +
      \`• 📌 Заметки: *\${limits.plan === 'corp' ? '25 000' : limits.plan === 'pro' ? '5 000' : '250'} в аккаунте*\\n\` +
      \`• ⏰ Напоминания: *\${limits.plan === 'corp' ? '5 000' : limits.plan === 'pro' ? '1 000' : '100'} активных*\\n\` +
      \`• 🍏 Siri и Быстрые команды: *\${limits.plan === 'corp' ? '25 000' : limits.plan === 'pro' ? '5 000' : '250'} запросов*\\n\` +
      \`• 📷 Vision OCR: *\${limits.plan === 'corp' ? '500' : limits.plan === 'pro' ? '200' : '25'} фото в день*\\n\` +
      \`• 💬 ИИ-сообщения: *\${limits.plan === 'corp' ? '4 000' : limits.plan === 'pro' ? '1 000' : '150'} в день*\\n\` +
      \`• 💻 Zerf CLI: *\${limits.plan === 'corp' ? '8 000' : limits.plan === 'pro' ? '1 500' : '300'} операций в день*\\n\\n\` +
      \`_Управление подпиской и продление доступны на официальном сайте:_\`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⭐ Управление тарифом на сайте', url: pricingUrl }],
            [{ text: '📱 Открыть Zerf Web App', web_app: { url: \`\${appUrl}/tg?chatId=\${chatId}\` } }],
          ]
        }
      }
    )
    return
  }

  await send(chatId,
    \`⭐ *Тарифные планы Zerf*\\n\\n\` +
    \`🆓 *Ваш текущий тариф: Базовый (Free)*\\n\` +
    \`• 🤖 ИИ: Llama 3.1 8B / Qwen 7B\\n\` +
    \`• 🎙 Голос: 1:30 мин в день (\${Math.max(0, 90 - (limits.voice.secondsUsed || 0))} сек осталось)\\n\` +
    \`• 📌 Заметки: до 20 в аккаунте (\${limits.notes.used} / 20)\\n\` +
    \`• ⏰ Напоминания: до 10 активных (\${limits.reminders.used} / 10)\\n\` +
    \`• 🍏 Siri: 10 запросов за всё время (\${Math.max(0, 10 - (limits.siri.used || 0))} осталось)\\n\` +
    \`• 💬 ИИ чат: 10 сообщений в день (\${Math.max(0, 10 - (limits.chat.used || 0))} осталось)\\n\` +
    \`• 🎯 Цели: 5 в день\\n\\n\` +
    \`──────────────\\n\` +
    \`✨ *Тариф Plus (99 ₽/мес | 1009 ₽/год):*\\n\` +
    \`• 🤖 ИИ: Qwen 3.6 27B\\n\` +
    \`• 🎙 Голос: 15 минут в день | 📌 Заметки: 250 | ⏰ Напоминания: 100\\n\` +
    \`• 🍏 Siri: 250 запросов | 📷 Vision OCR: 25 фото/день | 💻 CLI: 300/день\\n\\n\` +
    \`🚀 *Тариф Pro (299 ₽/мес | 3049 ₽/год):*\\n\` +
    \`• 🧠 ИИ: OpenAI GPT-OSS 120B + кастомизация нейросетей под задачи\\n\` +
    \`• 🎙 Голос: 2 часа (120 мин)/день | 📌 Заметки: 5 000 | ⏰ Напоминания: 1 000\\n\` +
    \`• 🍏 Siri: 5 000 | 📷 Vision: 200/день | 💻 CLI: 1 500/день | ⚡ Smart Reschedule\\n\\n\` +
    \`🏢 *Тариф Corp (по запросу):*\\n\` +
    \`• 🧠 GPT-OSS 120B + Local CLI Bridge (agy, claude, gemini, ollama)\\n\` +
    \`• 🎙 Голос: 8 часов (480 мин)/день | 📌 Заметки: 25 000 | 💻 CLI: 8 000/день\\n\\n\` +
    \`🔒 *Оформление подписки происходит безопасно только на официальном сайте:*\`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⭐ Оформить подписку на сайте', url: pricingUrl }],
          [{ text: '📱 Открыть в Telegram Mini App', web_app: { url: \`\${appUrl}/tg?chatId=\${chatId}\` } }],
        ]
      }
    }
  )
}

async function handleAdminCommand(`

const idx1 = content.indexOf(oldFuncStart)
const idx2 = content.indexOf(oldFuncEnd)

if (idx1 !== -1 && idx2 !== -1) {
  content = content.slice(0, idx1) + newFunc + content.slice(idx2 + oldFuncEnd.length)
  fs.writeFileSync(filePath, content, 'utf-8')
  console.log('Successfully patched handleSubscribe in app/api/telegram/route.ts!')
} else {
  console.error('Could not find function bounds:', { idx1, idx2 })
}
