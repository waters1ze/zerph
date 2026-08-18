/**
 * Live Open Knowledge & Search Source Fetchers for Entropy AI Search
 * Queries Wikipedia, DuckDuckGo, arXiv, GitHub, HackerNews and OpenAlex
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
 * Fetch encyclopedic summary from Wikipedia (RU + EN fallback)
 */
async function fetchWikipedia(query: string): Promise<LiveSource[]> {
  try {
    const encoded = encodeURIComponent(query.trim())
    // 1. Search for closest page title on Russian Wikipedia
    const searchRes = await fetch(
      `https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&utf8=1&srlimit=2`,
      { signal: AbortSignal.timeout(3500) }
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const hits = searchData?.query?.search || []

    if (hits.length === 0) {
      // Fallback to EN Wikipedia
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
 * Fetch instant answers and related topics from DuckDuckGo
 */
async function fetchDuckDuckGo(query: string): Promise<LiveSource[]> {
  try {
    const encoded = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=0`,
      { signal: AbortSignal.timeout(3500) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const sources: LiveSource[] = []

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

  if (mode === 'academic') {
    tasks.push(fetchArxiv(query))
    tasks.push(fetchOpenAlex(query))
    tasks.push(fetchWikipedia(query))
  } else if (mode === 'code') {
    tasks.push(fetchGitHub(query))
    tasks.push(fetchHackerNews(query))
    tasks.push(fetchDuckDuckGo(query))
  } else {
    // 'web', 'fast', or general
    tasks.push(fetchWikipedia(query))
    tasks.push(fetchDuckDuckGo(query))
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
        if (s.url && !seenUrls.has(s.url)) {
          seenUrls.add(s.url)
          allSources.push(s)
        }
      }
    }
  }

  // Renumber IDs 1..N and cap to 6 (or 8 for Pro Search)
  const maxSources = isPro ? 8 : 5
  return allSources.slice(0, maxSources).map((s, idx) => ({
    ...s,
    id: idx + 1,
  }))
}
