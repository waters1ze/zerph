import type { Note } from '@/lib/types'

// Regular expression to match Obsidian-style [[Note Title]] or [[Note Title|Custom Alias]]
export const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export interface ParsedWikilink {
  raw: string
  targetTitle: string
  alias?: string
}

/**
 * Extracts all [[Wikilinks]] from a given markdown string
 */
export function extractWikilinks(text: string): ParsedWikilink[] {
  if (!text) return []
  const links: ParsedWikilink[] = []
  const matches = text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)
  for (const m of matches) {
    links.push({
      raw: m[0],
      targetTitle: m[1].trim(),
      alias: m[2]?.trim(),
    })
  }
  return links
}

/**
 * Finds all notes that link to the given target note title (Backlinks)
 */
export function findBacklinks(targetTitle: string, allNotes: Note[]): { note: Note; contextSnippet: string }[] {
  if (!targetTitle || !allNotes.length) return []
  const normalizedTarget = targetTitle.toLowerCase().trim()
  const results: { note: Note; contextSnippet: string }[] = []

  for (const note of allNotes) {
    if (note.title.toLowerCase().trim() === normalizedTarget) continue
    if (!note.content) continue

    const links = extractWikilinks(note.content)
    const hasLink = links.some(l => l.targetTitle.toLowerCase() === normalizedTarget)

    if (hasLink) {
      // Extract a short sentence/line snippet around the link
      const lines = note.content.split('\n')
      const matchingLine = lines.find(line => {
        const lineLinks = extractWikilinks(line)
        return lineLinks.some(l => l.targetTitle.toLowerCase() === normalizedTarget)
      }) || ''

      results.push({
        note,
        contextSnippet: matchingLine.slice(0, 140),
      })
    }
  }

  return results
}

/**
 * Finds all outgoing links from a given note
 */
export function findOutgoingLinks(note: Note, allNotes: Note[]): { targetTitle: string; targetNote: Note | null }[] {
  if (!note.content) return []
  const links = extractWikilinks(note.content)
  const uniqueTargets = Array.from(new Set(links.map(l => l.targetTitle)))

  return uniqueTargets.map(targetTitle => {
    const norm = targetTitle.toLowerCase().trim()
    const targetNote = allNotes.find(n => n.title.toLowerCase().trim() === norm) || null
    return {
      targetTitle,
      targetNote,
    }
  })
}

export interface GraphNode {
  id: string
  title: string
  type: 'note' | 'folder' | 'tag'
  folder?: string
  color: string
  connectionCount: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  radius?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: 'wikilink' | 'folder' | 'tag'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const FOLDER_COLORS = [
  '#f59e0b', // Amber / Gold
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#14b8a6', // Teal
]

export function getFolderColor(folderPath: string = ''): string {
  if (!folderPath || folderPath === 'Общее') return '#64748b' // Slate
  const root = folderPath.split('/')[0]
  let hash = 0
  for (let i = 0; i < root.length; i++) {
    hash = (hash << 5) - hash + root.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % FOLDER_COLORS.length
  return FOLDER_COLORS[idx]
}

/**
 * Generates nodes and edges for Obsidian-style Interactive Graph
 */
export function buildGraphData(allNotes: Note[], folderFilter?: string | null): GraphData {
  const notesToInclude = folderFilter
    ? allNotes.filter(n => (n.folder || 'Общее').startsWith(folderFilter))
    : allNotes

  const titleToNodeId = new Map<string, string>()
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>()

  // 1. Create note nodes
  notesToInclude.forEach(n => {
    const nodeId = n.id
    titleToNodeId.set(n.title.toLowerCase().trim(), nodeId)

    nodes.push({
      id: nodeId,
      title: n.title || 'Без названия',
      type: 'note',
      folder: n.folder || 'Общее',
      color: getFolderColor(n.folder || 'Общее'),
      connectionCount: 0,
    })
  })

  // 2. Build Wikilink edges
  notesToInclude.forEach(sourceNote => {
    const links = extractWikilinks(sourceNote.content || '')
    links.forEach(link => {
      const targetId = titleToNodeId.get(link.targetTitle.toLowerCase().trim())
      if (targetId && targetId !== sourceNote.id) {
        const edgeKey = [sourceNote.id, targetId].sort().join(':::')
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({
            id: `edge_${sourceNote.id}_${targetId}`,
            source: sourceNote.id,
            target: targetId,
            type: 'wikilink',
          })
        }
      }
    })
  })

  // 3. Compute connection counts for node sizing
  const counts = new Map<string, number>()
  edges.forEach(e => {
    counts.set(e.source, (counts.get(e.source) || 0) + 1)
    counts.set(e.target, (counts.get(e.target) || 0) + 1)
  })

  nodes.forEach(n => {
    n.connectionCount = counts.get(n.id) || 0
    n.radius = Math.max(5, Math.min(18, 5 + n.connectionCount * 2.5))
  })

  return { nodes, edges }
}
