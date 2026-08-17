import { fetchMorningNewsContext } from '../lib/backend/news-fetcher'
import { callGroqChatCompletion } from '../lib/backend/groq-pool'
import { GROQ_CHAT_MODEL } from '../lib/config'

async function testMorningMultiPosts() {
  const context = await fetchMorningNewsContext()
  console.log('Date:', context.date)
  console.log('Rates:', context.rates)
  console.log('Geo news count:', context.geoNews?.length)
  console.log('Tech news count:', context.techNews?.length)
  console.log('Econ news count:', context.econNews?.length)
  console.log('Edu news count:', context.eduNews?.length)

  const ratesStr = [
    context.rates.usd ? `$ ${context.rates.usd} ₽` : '',
    context.rates.eur ? `€ ${context.rates.eur} ₽` : '',
    context.rates.cny ? `¥ ${context.rates.cny} ₽` : '',
    context.rates.btc ? `₿ ${context.rates.btc}` : '',
    context.rates.ton ? `💎 ${context.rates.ton}` : '',
  ].filter(Boolean).join('  |  ')

  // Post 1: Politics & World
  const geoPrompt = `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).
Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ и глубокий выпуск "МИРОВАЯ ПОВЕСТКА & ГЕОПОЛИТИКА" за ${context.date}.

НОВОСТИ ДЛЯ РАЗБОРА:
${(context.geoNews || []).map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary}`).join('\n\n')}

СТРОГИЕ ПРАВИЛА:
1. Под каждым заголовком напиши БОЛЬШОЙ развернутый абзац (3-5 предложений) с цифрами, контекстом, оценками и последствиями.
2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную кликабельную ссылку на источник: <a href="ТОЧНЫЙ_URL">[Источник]</a> (используй ТОЛЬКО URL из данных выше!).
3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <blockquote>, <b>, <code>, <a>).

СТРУКТУРА:
✦ <b>ГЛАВНОЕ: МИРОВАЯ ПОВЕСТКА & ГЕОПОЛИТИКА | ${context.date}</b>

▪ <b>Курсы:</b> <code>${ratesStr}</code>

◈ <b>Ключевые мировые события:</b>
[2-3 новости в формате: ▪ <b>[Заголовок]</b> — [Большой текст 3-5 предложений] <a href="[URL]">[Источник]</a>]

▫️ <i>Выпуск 1 из 4 | Повестка дня</i>
▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

  const res1 = await callGroqChatCompletion({
    model: GROQ_CHAT_MODEL,
    messages: [{ role: 'user', content: geoPrompt }],
    temperature: 0.5,
    max_tokens: 1200,
  })

  console.log('\n--- POST 1 (POLITICS) ---')
  console.log(res1.content)
}

testMorningMultiPosts()
