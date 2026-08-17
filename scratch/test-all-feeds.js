async function testAllFeeds() {
  const categories = {
    world: [
      'https://lenta.ru/rss/news/world',
      'https://www.kommersant.ru/RSS/news.xml',
      'https://lenta.ru/rss/news'
    ],
    tech: [
      'https://habr.com/ru/rss/hub/artificial_intelligence/all/?fl=ru',
      'https://3dnews.ru/news/rss/',
      'https://habr.com/ru/rss/hub/programming/all/?fl=ru'
    ],
    econ: [
      'https://lenta.ru/rss/news/economics',
      'https://www.kommersant.ru/RSS/section-business.xml'
    ],
    sci: [
      'https://habr.com/ru/rss/hub/popular_science/all/?fl=ru',
      'https://habr.com/ru/rss/hub/education/all/?fl=ru'
    ]
  }

  for (const [cat, urls] of Object.entries(categories)) {
    console.log(`\n=== Category: ${cat} ===`)
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000)
        })
        console.log(`${url} -> ${res.status}`)
      } catch (e) {
        console.log(`${url} -> ERROR:`, e.message)
      }
    }
  }
}

testAllFeeds()
