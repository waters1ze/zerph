/**
 * Live Open Knowledge & Search Source Fetchers for Entropy AI Search
 * Queries Google News RSS, DuckDuckGo HTML, Wikipedia, arXiv, GitHub, HackerNews and OpenAlex
 * without requiring paid API keys, delivering real-time factual grounding.
 */

export interface LiveSource {
  id: number
  title: string
  url: string
  domain: string
  snippet: string
}

/**
 * Fetch real-time live news and recent articles via Google News RSS
 */
async function fetchGoogleNews(query: string): Promise<LiveSource[]> {
  try {
    const encoded = encodeURIComponent(query.trim())
    // Russian news feed
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encoded}&hl=ru&gl=RU&ceid=RU:ru`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(4000),
      }
    )
    if (!res.ok) return []
    const xml = await res.text()

    const items = xml.split('<item>')
    const sources: LiveSource[] = []

    for (let i = 1; i < Math.min(items.length, 5); i++) {
      const chunk = items[i]
      const titleMatch = chunk.match(/<title>([^<]+)<\/title>/)
      const linkMatch = chunk.match(/<link>([^<]+)<\/link>/)
      const sourceMatch = chunk.match(/<source[^>]*>([^<]+)<\/source>/)
      const pubDateMatch = chunk.match(/<pubDate>([^<]+)<\/pubDate>/)

      if (titleMatch && linkMatch) {
        const fullTitle = titleMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
        const sourceName = sourceMatch ? sourceMatch[1].trim() : 'Новости'
        const rawUrl = linkMatch[1].trim()
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toLocaleDateString('ru-RU') : ''

        let domain = 'news.google.com'
        try {
          if (sourceName) domain = sourceName.toLowerCase().replace(/\s+/g, '') + '.ru'
        } catch {}

        sources.push({
          id: sources.length + 1,
          title: fullTitle,
          url: rawUrl,
          domain,
          snippet: `Актуальная новость (${pubDate || 'Свежее'}): ${fullTitle}`,
        })
      }
    }

    return sources
  } catch {
    return []
  }
}

/**
 * Fetch encyclopedic summary from Wikipedia (RU + EN fallback)
 */
async function fetchWikipedia(query: string): Promise<LiveSource[]> {
  try {
    const encoded = encodeURIComponent(query.trim())
    const searchRes = await fetch(
      `https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&utf8=1&srlimit=2`,
      { signal: AbortSignal.timeout(3500) }
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const hits = searchData?.query?.search || []

    if (hits.length === 0) {
      const enRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&utf8=1&srlimit=2`,
        { signal: AbortSignal.timeout(3500) }
      )
      if (!enRes.ok) return []
      const enData = await enRes.json()
      const enHits = enData?.query?.search || []
      return enHits.map((h: any, idx: number) => ({
        id: idx + 1,
        title: h.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/\s+/g, '_'))}`,
        domain: 'en.wikipedia.org',
        snippet: h.snippet?.replace(/<[^>]+>/g, '') || '',
      }))
    }

    return hits.map((h: any, idx: number) => ({
      id: idx + 1,
      title: h.title,
      url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/\s+/g, '_'))}`,
      domain: 'ru.wikipedia.org',
      snippet: h.snippet?.replace(/<[^>]+>/g, '') || '',
    }))
  } catch {
    return []
  }
}

/**
 * Fetch live search results via DuckDuckGo HTML / Instant Answers
 */
async function fetchDuckDuckGo(query: string): Promise<LiveSource[]> {
  try {
    const encoded = encodeURIComponent(query.trim())
    // Try DuckDuckGo Instant Answers API first
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=0`,
      { signal: AbortSignal.timeout(3500) }
    )
    const sources: LiveSource[] = []

    if (res.ok) {
      const data = await res.json()
      if (data.Abstract && data.AbstractURL) {
        sources.push({
          id: 1,
          title: data.Heading || query,
          url: data.AbstractURL,
          domain: new URL(data.AbstractURL).hostname.replace('www.', ''),
          snippet: data.Abstract.slice(0, 300),
        })
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic.Text && topic.FirstURL) {
            sources.push({
              id: sources.length + 1,
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
              url: topic.FirstURL,
              domain: new URL(topic.FirstURL).hostname.replace('www.', ''),
              snippet: topic.Text.slice(0, 250),
            })
          }
        }
      }
    }

    // If zero results, query DuckDuckGo HTML Lite for rich organic search results
    if (sources.length === 0) {
      const liteRes = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(3500),
      })

      if (liteRes.ok) {
        const html = await liteRes.text()
        const resultChunks = html.split('class="result__body')

        for (let i = 1; i < Math.min(resultChunks.length, 4); i++) {
          const chunk = resultChunks[i]
          const titleMatch = chunk.match(/class="result__snippet[^>]*>([^<]+)<\/a>/i) || chunk.match(/class="result__title"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
          const urlMatch = chunk.match(/class="result__url"[^>]*href="([^"]+)"/i) || chunk.match(/href="\/\/duckduckgo\.com\/l\/\?uddg=([^&"]+)/i)
          const snippetMatch = chunk.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)

          if (titleMatch) {
            const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim()
            let rawUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : `https://duckduckgo.com/?q=${encoded}`
            if (rawUrl.startsWith('//')) rawUrl = 'https:' + rawUrl

            let domain = 'web'
            try {
              domain = new URL(rawUrl).hostname.replace('www.', '')
            } catch {}

            const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : rawTitle

            if (rawTitle && !rawTitle.includes('DuckDuckGo')) {
              sources.push({
                id: sources.length + 1,
                title: rawTitle,
                url: rawUrl,
                domain,
                snippet: rawSnippet.slice(0, 300),
              })
            }
          }
        }
      }
    }

    return sources
  } catch {
    return []
  }
}

/**
 * Fetch scientific preprints & research papers from arXiv
 */
async function fetchArxiv(query: string): Promise<LiveSource[]> {
  try {
    const cleanQ = query.replace(/[^a-zA-Z0-9\s]/g, '').trim() || query
    const encoded = encodeURIComponent(cleanQ)
    const res = await fetch(
      `https://export.arxiv.org/api/query?search_query=all:${encoded}&start=0&max_results=3`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return []
    const xml = await res.text()

    const entries = xml.split('<entry>')
    const sources: LiveSource[] = []

    for (let i = 1; i < entries.length; i++) {
      const chunk = entries[i]
      const titleMatch = chunk.match(/<title>([^<]+)<\/title>/)
      const summaryMatch = chunk.match(/<summary>([^<]+)<\/summary>/)
      const idMatch = chunk.match(/<id>([^<]+)<\/id>/)

      if (titleMatch && idMatch) {
        const title = titleMatch[1].replace(/\n/g, ' ').trim()
        const url = idMatch[1].trim()
        const snippet = summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').slice(0, 280).trim() : ''
        sources.push({
          id: sources.length + 1,
          title: `arXiv: ${title}`,
          url,
          domain: 'arxiv.org',
          snippet,
        })
      }
    }
    return sources
  } catch {
    return []
  }
}

/**
 * Fetch open source repositories and code from GitHub
 */
async function fetchGitHub(query: string): Promise<LiveSource[]> {
  try {
    const cleanQ = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${cleanQ}&sort=stars&order=desc&per_page=3`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Zerf-AI-Research-Engine',
        },
        signal: AbortSignal.timeout(3500),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    const items = data?.items || []

    return items.map((repo: any, idx: number) => ({
      id: idx + 1,
      title: `${repo.full_name} (${repo.stargazers_count?.toLocaleString()} ★)`,
      url: repo.html_url,
      domain: 'github.com',
      snippet: repo.description ? `${repo.description} [Язык: ${repo.language || 'Code'}]` : 'Open Source репозиторий на GitHub',
    }))
  } catch {
    return []
  }
}

/**
 * Fetch tech news, startup insights and engineering discussions from HackerNews (Algolia)
 */
async function fetchHackerNews(query: string): Promise<LiveSource[]> {
  try {
    const encoded = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&hitsPerPage=3`,
      { signal: AbortSignal.timeout(3500) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const hits = data?.hits || []

    return hits.map((h: any, idx: number) => ({
      id: idx + 1,
      title: h.title || 'HackerNews Story',
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      domain: h.url ? new URL(h.url).hostname.replace('www.', '') : 'news.ycombinator.com',
      snippet: `HackerNews обсуждение (${h.points || 0} pts, ${h.num_comments || 0} комментариев)`,
    }))
  } catch {
    return []
  }
}

/**
 * Fetch academic publications from OpenAlex
 */
async function fetchOpenAlex(query: string): Promise<LiveSource[]> {
  try {
    const encoded = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://api.openalex.org/works?search=${encoded}&per-page=3`,
      { signal: AbortSignal.timeout(3500) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const results = data?.results || []

    return results.map((w: any, idx: number) => ({
      id: idx + 1,
      title: w.display_name || 'Научная публикация',
      url: w.doi ? `https://doi.org/${w.doi.replace('https://doi.org/', '')}` : (w.landing_page_url || `https://openalex.org/${w.id}`),
      domain: 'openalex.org',
      snippet: `Год: ${w.publication_year || 2024} · Цитирований: ${w.cited_by_count || 0}`,
    }))
  } catch {
    return []
  }
}

/**
 * Master multi-source aggregator based on search mode
 */
export async function aggregateLiveKnowledgeSources(
  query: string,
  mode: 'web' | 'academic' | 'code' | 'notes' | 'fast' | string = 'web',
  isPro: boolean = false
): Promise<LiveSource[]> {
  const tasks: Promise<LiveSource[]>[] = []

  // Always query Google News and DuckDuckGo for live facts
  tasks.push(fetchGoogleNews(query))
  tasks.push(fetchDuckDuckGo(query))

  if (mode === 'academic') {
    tasks.push(fetchArxiv(query))
    tasks.push(fetchOpenAlex(query))
    tasks.push(fetchWikipedia(query))
  } else if (mode === 'code') {
    tasks.push(fetchGitHub(query))
    tasks.push(fetchHackerNews(query))
  } else {
    // 'web', 'fast', or general
    tasks.push(fetchWikipedia(query))
    if (isPro) {
      tasks.push(fetchArxiv(query))
      tasks.push(fetchGitHub(query))
      tasks.push(fetchHackerNews(query))
    }
  }

  const results = await Promise.allSettled(tasks)
  const allSources: LiveSource[] = []
  const seenUrls = new Set<string>()

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const s of r.value) {
        if (s.url && !seenUrls.has(s.url) && s.title) {
          seenUrls.add(s.url)
          allSources.push(s)
        }
      }
    }
  }

  // Renumber IDs 1..N and cap to 8 (or 10 for Pro Search)
  const maxSources = isPro ? 10 : 7
  return allSources.slice(0, maxSources).map((s, idx) => ({
    ...s,
    id: idx + 1,
  }))
}
