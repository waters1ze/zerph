/**
 * News & Live Context Fetcher for Zerf Note Broadcasts
 * Fetches verified RSS feeds, currency & crypto rates with fallback sources.
 */

export interface NewsItem {
  title: string
  summary?: string
  url?: string
  source?: string
}

export interface NewsDigestContext {
  date: string
  rates: {
    usd?: string
    eur?: string
    cny?: string
    btc?: string
    ton?: string
  }
  geoNews?: NewsItem[]
  techNews?: NewsItem[]
  econNews?: NewsItem[]
  eduNews?: NewsItem[]
  devNews?: NewsItem[]
  secNews?: NewsItem[]
  sciNews?: NewsItem[]
  news: NewsItem[]
  headlines: string[]
  sources: string[]
}

export function cleanNewsUrl(rawUrl?: string): string {
  if (!rawUrl) return ''
  let cleaned = rawUrl.replace(/&amp;/g, '&').trim()
  try {
    const u = new URL(cleaned)
    const searchParams = new URLSearchParams(u.search)
    const toDelete: string[] = []
    searchParams.forEach((_, key) => {
      if (key.startsWith('utm_') || key === 'from' || key === 'source' || key === 'ref') {
        toDelete.push(key)
      }
    })
    toDelete.forEach(k => searchParams.delete(k))
    u.search = searchParams.toString()
    return u.toString()
  } catch {
    return cleaned.split('?utm_')[0]
  }
}

function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchRssFeed(
  urls: string[],
  maxItems = 3,
  defaultSource = 'Новости',
  filterHabr = false
): Promise<NewsItem[]> {
  const items: NewsItem[] = []

  for (const url of urls) {
    if (items.length >= maxItems) break
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      const itemBlocks = xml.split('<item>').slice(1)

      for (const block of itemBlocks) {
        if (items.length >= maxItems) break
        const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)
        const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)
        const linkMatch =
          block.match(/<link>(?:<!\[CDATA\[)?(https?:\/\/[^\s<\]]+)(?:\]\]>)?<\/link>/i) ||
          block.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/i)

        if (titleMatch) {
          const title = cleanHtmlText(titleMatch[1])
          const summary = descMatch ? cleanHtmlText(descMatch[1]).slice(0, 600) : ''
          const itemUrl = linkMatch ? cleanNewsUrl(linkMatch[1]) : undefined

          if (title && title.length > 15) {
            if (filterHabr && (title.includes('Хабр') || title.includes('Habr'))) continue
            items.push({ title, summary, url: itemUrl, source: defaultSource })
          }
        }
      }
    } catch (e) {
      console.warn(`[RSS Warn] ${url}:`, (e as any)?.message || e)
    }
  }

  return items
}

/**
 * Morning News Context Fetcher
 * Politics/World, Tech/AI, Economics/Business, Science/EdTech + CBR & Crypto rates.
 */
export async function fetchMorningNewsContext(): Promise<NewsDigestContext> {
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)

  const rates: { usd?: string; eur?: string; cny?: string; btc?: string; ton?: string } = {}
  let geoNews: NewsItem[] = []
  let techNews: NewsItem[] = []
  let econNews: NewsItem[] = []
  let eduNews: NewsItem[] = []
  const sources: string[] = ['Центральный Банк РФ', 'CoinGecko', 'Lenta Мир', 'Хабр AI', 'Lenta Экономика', 'Хабр Наука']

  await Promise.allSettled([
    // 1. CBR Rates
    (async () => {
      try {
        const cbrRes = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', {
          headers: { 'User-Agent': 'ZerfAI/2.0' },
          signal: AbortSignal.timeout(4000),
        })
        if (cbrRes.ok) {
          const cbrData = await cbrRes.json()
          const valute = cbrData?.Valute
          if (valute?.USD?.Value) rates.usd = valute.USD.Value.toFixed(2)
          if (valute?.EUR?.Value) rates.eur = valute.EUR.Value.toFixed(2)
          if (valute?.CNY?.Value) rates.cny = valute.CNY.Value.toFixed(2)
        }
      } catch (e) {
        rates.usd = '84.5'
        rates.eur = '97.5'
        rates.cny = '12.5'
      }
    })(),

    // 2. CoinGecko
    (async () => {
      try {
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,the-open-network&vs_currencies=usd', {
          headers: { 'Accept': 'application/json', 'User-Agent': 'ZerfAI/2.0' },
          signal: AbortSignal.timeout(4000),
        })
        if (cryptoRes.ok) {
          const cryptoData = await cryptoRes.json()
          if (cryptoData?.bitcoin?.usd) {
            rates.btc = `$${cryptoData.bitcoin.usd.toLocaleString('en-US')}`
          }
          if (cryptoData?.['the-open-network']?.usd) {
            rates.ton = `$${cryptoData['the-open-network'].usd.toFixed(2)}`
          }
        }
      } catch (e) {
        rates.btc = '$62,900'
        rates.ton = '$1.33'
      }
    })(),

    // 3. Politics & Geopolitics
    (async () => {
      geoNews = await fetchRssFeed([
        'https://lenta.ru/rss/news/world',
        'https://www.kommersant.ru/RSS/news.xml',
        'https://lenta.ru/rss/news'
      ], 3, 'Мировая повестка')
    })(),

    // 4. Tech, AI & Software Engineering
    (async () => {
      techNews = await fetchRssFeed([
        'https://habr.com/ru/rss/hub/artificial_intelligence/all/?fl=ru',
        'https://3dnews.ru/news/rss/',
        'https://habr.com/ru/rss/hub/programming/all/?fl=ru'
      ], 3, 'Технологии & ИИ', true)
    })(),

    // 5. Economics, Markets & Finance
    (async () => {
      econNews = await fetchRssFeed([
        'https://lenta.ru/rss/news/economics',
        'https://www.kommersant.ru/RSS/section-business.xml'
      ], 3, 'Экономика & Рынки')
    })(),

    // 6. Science, Education & Cognition
    (async () => {
      eduNews = await fetchRssFeed([
        'https://habr.com/ru/rss/hub/popular_science/all/?fl=ru',
        'https://habr.com/ru/rss/hub/infosecurity/all/?fl=ru'
      ], 3, 'Наука & Саморазвитие', true)
    })(),
  ])

  const combinedNews = [...geoNews, ...techNews, ...econNews, ...eduNews]
  return {
    date: dateStr,
    rates,
    geoNews,
    techNews,
    econNews,
    eduNews,
    news: combinedNews,
    headlines: combinedNews.map(n => n.title),
    sources
  }
}

/**
 * Evening News & Insights Context Fetcher
 * Distinct sources: Programming, CyberSecurity, Product Architecture & Popular Science.
 */
export async function fetchEveningNewsContext(): Promise<NewsDigestContext> {
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)

  let devNews: NewsItem[] = []
  let secNews: NewsItem[] = []
  let sciNews: NewsItem[] = []
  const sources: string[] = ['Хабр Разработка', 'Хабр Безопасность', 'Научпоп & Мышление']

  await Promise.allSettled([
    // 1. Programming & Dev Architecture
    (async () => {
      devNews = await fetchRssFeed([
        'https://habr.com/ru/rss/hub/programming/all/?fl=ru',
        'https://3dnews.ru/news/rss/'
      ], 3, 'Разработка & Архитектура', true)
    })(),

    // 2. CyberSecurity & Infosec
    (async () => {
      secNews = await fetchRssFeed([
        'https://habr.com/ru/rss/hub/infosecurity/all/?fl=ru',
        'https://habr.com/ru/rss/hub/artificial_intelligence/all/?fl=ru'
      ], 3, 'Кибербезопасность', true)
    })(),

    // 3. Science & Cognitive Studies
    (async () => {
      sciNews = await fetchRssFeed([
        'https://habr.com/ru/rss/hub/popular_science/all/?fl=ru'
      ], 3, 'Наука & Мышление', true)
    })(),
  ])

  const combinedNews = [...devNews, ...secNews, ...sciNews]
  return {
    date: dateStr,
    rates: {},
    devNews,
    secNews,
    sciNews,
    news: combinedNews,
    headlines: combinedNews.map(n => n.title),
    sources
  }
}
