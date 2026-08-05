/**
 * Note Linker — finds semantic connections between notes based on tags and content
 */
import type { Note } from '@/lib/types'

/**
 * Extract all [[WikiLink]] references from note content
 */
export function extractWikiLinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]]+)\]\]/g) || []
  return matches.map(m => m.slice(2, -2).trim())
}

/**
 * Replace [[WikiLink]] references with clickable spans for rendering
 */
export function renderWikiLinks(
  content: string,
  notes: Note[],
  onNoteClick: (id: string) => void
): { type: 'text' | 'wikilink'; value: string; noteId?: string }[] {
  const parts = content.split(/(\[\[[^\]]+\]\])/g)
  return parts.map(part => {
    const match = part.match(/^\[\[([^\]]+)\]\]$/)
    if (match) {
      const linkTitle = match[1].trim()
      const linkedNote = notes.find(n =>
        n.title.toLowerCase().includes(linkTitle.toLowerCase()) ||
        linkTitle.toLowerCase().includes(n.title.toLowerCase())
      )
      return { type: 'wikilink' as const, value: linkTitle, noteId: linkedNote?.id }
    }
    return { type: 'text' as const, value: part }
  })
}

/**
 * Find notes that are related to a given note based on:
 * 1. Shared tags
 * 2. Wiki links in content
 * 3. Title keyword overlap
 */
export function findRelatedNotes(targetNote: Note, allNotes: Note[]): Note[] {
  const others = allNotes.filter(n => n.id !== targetNote.id)
  const wikiLinks = extractWikiLinks(targetNote.content)
  const targetWords = new Set(
    targetNote.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  )

  const scored = others.map(note => {
    let score = 0

    // 1. Shared tags
    const sharedTags = targetNote.tags.filter(t => note.tags.includes(t))
    score += sharedTags.length * 3

    // 2. Wiki link match
    const isLinked = wikiLinks.some(link =>
      note.title.toLowerCase().includes(link.toLowerCase()) ||
      link.toLowerCase().includes(note.title.toLowerCase())
    )
    if (isLinked) score += 5

    // 3. Title word overlap
    const noteWords = note.title.toLowerCase().split(/\s+/)
    const overlap = noteWords.filter(w => w.length > 3 && targetWords.has(w)).length
    score += overlap * 2

    // 4. Back-links: does the other note link to this one?
    const backLinks = extractWikiLinks(note.content)
    const hasBacklink = backLinks.some(link =>
      targetNote.title.toLowerCase().includes(link.toLowerCase())
    )
    if (hasBacklink) score += 4

    return { note, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.note)
}
