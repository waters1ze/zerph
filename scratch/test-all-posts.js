import 'dotenv/config'
import { fetchMorningNewsContext } from '../lib/backend/news-fetcher'
import { callGroqChatCompletion } from '../lib/backend/groq-pool'
import { GROQ_CHAT_MODEL } from '../lib/config'

async function testAllFourPosts() {
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

  // Release 1: Geopolitics & World
  const geoNewsStr = (context.geoNews || []).map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary}`).join('\n\n')
  const geoPrompt = `Ты — главный редактор Telegram-канала Zerf Note (@zerph_off).
Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ аналитический выпуск "МИРОВАЯ ПОВЕСТКА & ГЕОПОЛИТИКА" за ${context.date}.

НОВОСТИ ДЛЯ РАЗБОРА:
${geoNewsStr || 'Ключевые геополитические события дня.'}

СТРОГИЕ ПРАВИЛА:
1. Под каждым заголовком напиши БОЛЬШОЙ развернутый абзац (3-5 предложений) с цифрами, контекстом, оценками и последствиями.
2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a> (используй ТОЛЬКО URL из данных выше!).
3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <blockquote>, <b>, <code>, <a>).

СТРУКТУРА:
✦ <b>ГЛАВНОЕ: МИРОВАЯ ПОВЕСТКА & ГЕОПОЛИТИКА | ${context.date}</b>

▪ <b>Курсы:</b> <code>${ratesStr}</code>

◈ <b>Ключевые мировые события:</b>
[2-3 новости в формате: ▪ <b>[Заголовок]</b> — [Текст 3-5 предложений] <a href="[URL]">[Источник]</a>]

▫️ <i>Выпуск 1 из 4 | Мировая повестка</i>
▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

  // Release 2: Tech & AI
  const techNewsStr = (context.techNews || []).map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary}`).join('\n\n')
  const techPrompt = `Ты — главный редактор Telegram-канала Zerf Note (@zerph_off).
Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ технический выпуск "ТЕХНОЛОГИИ, ИИ & РАЗРАБОТКА" за ${context.date}.

НОВОСТИ ДЛЯ РАЗБОРА:
${techNewsStr || 'Свежие технологические релизы и разработка.'}

СТРОГИЕ ПРАВИЛА:
1. Под каждым заголовком напиши БОЛЬШОЙ детальный разбор (3-5 предложений) с техническими деталями, архитектурой, стеком и выводами.
2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.
3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <b>, <code>, <a>).

СТРУКТУРА:
◈ <b>ТЕХНОЛОГИИ, ИИ & РАЗРАБОТКА | ${context.date}</b>

[2-3 новости в формате: ▪ <b>[Заголовок]</b> — [Детальный разбор 3-5 предложений] <a href="[URL]">[Источник]</a>]

▫️ <i>Выпуск 2 из 4 | Технологии & ИИ</i>
▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

  // Release 3: Economics & Markets
  const econNewsStr = (context.econNews || []).map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary}`).join('\n\n')
  const econPrompt = `Ты — главный редактор Telegram-канала Zerf Note (@zerph_off).
Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ экономический выпуск "ЭКОНОМИКА, БИЗНЕС & РЫНКИ" за ${context.date}.

НОВОСТИ ДЛЯ РАЗБОРА:
${econNewsStr || 'Ключевые макроэкономические события и рынки.'}

СТРОГИЕ ПРАВИЛА:
1. Под каждым заголовком напиши БОЛЬШОЙ развернутый абзац (3-5 предложений) с цифрами, макропоказателями, анализом рынков и прогнозом.
2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.
3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <b>, <code>, <a>).

СТРУКТУРА:
◈ <b>ЭКОНОМИКА, БИЗНЕС & РЫНКИ | ${context.date}</b>

[2-3 новости в формате: ▪ <b>[Заголовок]</b> — [Развернутый текст 3-5 предложений] <a href="[URL]">[Источник]</a>]

▫️ <i>Выпуск 3 из 4 | Экономика & Рынки</i>
▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

  // Release 4: Science, EdTech & Focus
  const eduNewsStr = (context.eduNews || []).map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary}`).join('\n\n')
  const eduPrompt = `Ты — главный редактор Telegram-канала Zerf Note (@zerph_off).
Напиши БОЛЬШОЙ аналитический выпуск "НАУКА, ОБРАЗОВАНИЕ & ФОКУС ДНЯ" за ${context.date}.

НОВОСТИ ДЛЯ РАЗБОРА:
${eduNewsStr || 'Научные исследования и развитие мышления.'}

СТРОГИЕ ПРАВИЛА:
1. Под каждым заголовком напиши БОЛЬШОЙ содержательный текст (3-5 предложений) о сути исследования, пользе для мышления и когнитивных навыков.
2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.
3. В конце добавь стратегический фокус дня в блоке <blockquote>.
4. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <blockquote>, <b>, <code>, <a>).

СТРУКТУРА:
◈ <b>НАУКА, ОБРАЗОВАНИЕ & ФОКУС ДНЯ | ${context.date}</b>

[2 новости в формате: ▪ <b>[Заголовок]</b> — [Текст 3-5 предложений] <a href="[URL]">[Источник]</a>]

<blockquote><b>Фокус & Прогноз дня:</b> [Стратегический совет по распределению сил, защите внимания и продуктивности в Zerf Note]</blockquote>

▫️ <i>Выпуск 4 из 4 | Наука & Фокус</i>
▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

  console.log('\n--- Generating Post 1 ---')
  const r1 = await callGroqChatCompletion({ model: GROQ_CHAT_MODEL, messages: [{ role: 'user', content: geoPrompt }], temperature: 0.5, max_tokens: 1200 })
  console.log(r1.content)

  console.log('\n--- Generating Post 2 ---')
  const r2 = await callGroqChatCompletion({ model: GROQ_CHAT_MODEL, messages: [{ role: 'user', content: techPrompt }], temperature: 0.5, max_tokens: 1200 })
  console.log(r2.content)

  console.log('\n--- Generating Post 3 ---')
  const r3 = await callGroqChatCompletion({ model: GROQ_CHAT_MODEL, messages: [{ role: 'user', content: econPrompt }], temperature: 0.5, max_tokens: 1200 })
  console.log(r3.content)

  console.log('\n--- Generating Post 4 ---')
  const r4 = await callGroqChatCompletion({ model: GROQ_CHAT_MODEL, messages: [{ role: 'user', content: eduPrompt }], temperature: 0.5, max_tokens: 1200 })
  console.log(r4.content)
}

testAllFourPosts()
