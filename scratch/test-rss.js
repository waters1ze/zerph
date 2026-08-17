async function testFeeds() {
  const feeds = [
    { name: 'Lenta News', url: 'https://lenta.ru/rss/news' },
    { name: 'Lenta World', url: 'https://lenta.ru/rss/news/world' },
    { name: 'Lenta Economics', url: 'https://lenta.ru/rss/news/economics' },
    { name: 'Habr AI', url: 'https://habr.com/ru/rss/hub/artificial_intelligence/all/?fl=ru' },
    { name: 'Habr Dev', url: 'https://habr.com/ru/rss/hub/programming/all/?fl=ru' },
    { name: 'Habr Science', url: 'https://habr.com/ru/rss/hub/popular_science/all/?fl=ru' },
    { name: '3DNews', url: 'https://3dnews.ru/news/rss/' },
    { name: 'Kommersant', url: 'https://www.kommersant.ru/RSS/news.xml' },
    { name: 'RBC Tech', url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss' }
  ]

  for (const f of feeds) {
    try {
      const res = await fetch(f.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4000)
      })
      console.log(`${f.name}: status ${res.status}, ok: ${res.ok}`)
      if (res.ok) {
        const text = await res.text()
        const items = text.split('<item>').slice(1, 4)
        for (const item of items) {
          const t = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]
          const l = item.match(/<link>(?:<!\[CDATA\[)?(https?:\/\/[^\s<\]]+)(?:\]\]>)?<\/link>/i)?.[1] || item.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/i)?.[1]
          console.log(`  - [${l}] ${t?.slice(0, 60)}`)
        }
      }
    } catch (e) {
      console.log(`${f.name}: ERROR`, e.message)
    }
  }
}

testFeeds()
