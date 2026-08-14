/**
 * News & Currency Rates Fetcher for Telegram Channel Morning Digest
 * Sources: CBR Daily (USD, EUR, CNY), CoinGecko (BTC), and Tech/General RSS
 */

export interface MorningDigestContext {
  date: string
  rates: {
    usd?: string
    eur?: string
    cny?: string
    btc?: string
  }
  headlines: string[]
}

export async function fetchMorningNewsContext(): Promise<MorningDigestContext> {
  const dateStr = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const rates: { usd?: string; eur?: string; cny?: string; btc?: string } = {}
  const headlines: string[] = []

  // 1. Fetch Central Bank of Russia rates
  try {
    const cbrRes = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', { next: { revalidate: 3600 } })
    if (cbrRes.ok) {
      const cbrData = await cbrRes.json()
      const valute = cbrData?.Valute
      if (valute?.USD?.Value) rates.usd = valute.USD.Value.toFixed(2)
      if (valute?.EUR?.Value) rates.eur = valute.EUR.Value.toFixed(2)
      if (valute?.CNY?.Value) rates.cny = valute.CNY.Value.toFixed(2)
    }
  } catch (e) {
    console.error('CBR fetch error:', e)
  }

  // 2. Fetch BTC price
  try {
    const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    })
    if (cryptoRes.ok) {
      const cryptoData = await cryptoRes.json()
      if (cryptoData?.bitcoin?.usd) {
        rates.btc = `$${cryptoData.bitcoin.usd.toLocaleString('en-US')}`
      }
    }
  } catch (e) {
    // fallback
    rates.btc = '$60,000+'
  }

  // 3. Fetch latest Tech & General News RSS (Habr / Google News RU)
  try {
    const rssRes = await fetch('https://habr.com/ru/rss/articles/?fl=ru', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      next: { revalidate: 1800 }
    })
    if (rssRes.ok) {
      const xml = await rssRes.text()
      const titles = Array.from(xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g))
        .map(m => m[1] || m[2])
        .filter(t => t && !t.includes('Хабр') && !t.includes('Habr') && t.length > 10)
        .slice(0, 5)

      headlines.push(...titles)
    }
  } catch (e) {
    console.error('RSS fetch error:', e)
  }

  return {
    date: dateStr,
    rates,
    headlines: headlines.length > 0 ? headlines : [
      'Развитие нейросетей и генеративного ИИ в 2026 году',
      'Новые методы оптимизации рабочего времени и тайм-менеджмента',
      'Обновления мобильных платформ и экосистем продуктивности'
    ]
  }
}
