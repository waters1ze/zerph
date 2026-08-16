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

export interface ColorGroup {
  id: string
  query: string // e.g. "tag:#физика" or "path:Школа" or "теорема"
  color: string // hex code
  label: string
}

export interface GraphFilterOptions {
  folderFilter?: string | null
  showTags?: boolean
  showFolders?: boolean
  showUnresolved?: boolean
  searchQuery?: string
  colorGroups?: ColorGroup[]
  localNoteId?: string | null
  localDepth?: number // default 1 or 2
}

export interface GraphNode {
  id: string
  title: string
  type: 'note' | 'folder' | 'tag' | 'unresolved'
  folder?: string
  color: string
  connectionCount: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  radius?: number
  tags?: string[]
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: 'wikilink' | 'folder' | 'tag' | 'unresolved'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const DEFAULT_COLOR_PALETTE = [
  '#f59e0b', // Amber / Gold
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#f97316', // Orange
]

export function getFolderColor(folderPath: string = ''): string {
  if (!folderPath || folderPath === 'Общее') return '#64748b' // Slate
  const root = folderPath.split('/')[0]
  let hash = 0
  for (let i = 0; i < root.length; i++) {
    hash = (hash << 5) - hash + root.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % DEFAULT_COLOR_PALETTE.length
  return DEFAULT_COLOR_PALETTE[idx]
}

function matchColorGroup(node: GraphNode, colorGroups: ColorGroup[]): string | null {
  for (const group of colorGroups) {
    const q = group.query.trim().toLowerCase()
    if (!q) continue

    if (q.startsWith('tag:') || q.startsWith('#')) {
      const targetTag = q.replace(/^tag:/, '').replace(/^#/, '').toLowerCase()
      if (node.type === 'tag' && node.title.toLowerCase().replace(/^#/, '') === targetTag) {
        return group.color
      }
      if (node.tags && node.tags.some(t => t.toLowerCase() === targetTag)) {
        return group.color
      }
    } else if (q.startsWith('path:') || q.startsWith('folder:')) {
      const targetPath = q.replace(/^path:/, '').replace(/^folder:/, '').toLowerCase()
      if ((node.folder || '').toLowerCase().includes(targetPath)) {
        return group.color
      }
    } else {
      if (node.title.toLowerCase().includes(q) || (node.folder || '').toLowerCase().includes(q)) {
        return group.color
      }
    }
  }
  return null
}

/**
 * Generates full-featured nodes and edges for Obsidian-style Interactive Graph
 */
export function buildGraphData(
  allNotes: Note[],
  options: GraphFilterOptions = {}
): GraphData {
  const {
    folderFilter = null,
    showTags = true,
    showFolders = false,
    showUnresolved = true,
    colorGroups = [],
    localNoteId = null,
    localDepth = 1,
  } = options

  // 1. Initial filter by folder
  let candidateNotes = folderFilter
    ? allNotes.filter(n => (n.folder || 'Общее').startsWith(folderFilter))
    : allNotes

  const titleToNodeId = new Map<string, string>()
  const noteMap = new Map<string, Note>()
  candidateNotes.forEach(n => {
    titleToNodeId.set(n.title.toLowerCase().trim(), n.id)
    noteMap.set(n.id, n)
  })

  // 2. Local note filtering if localNoteId is specified
  if (localNoteId) {
    const visited = new Set<string>([localNoteId])
    let currentLevel = new Set<string>([localNoteId])

    for (let d = 0; d < localDepth; d++) {
      const nextLevel = new Set<string>()
      currentLevel.forEach(nId => {
        const note = noteMap.get(nId)
        if (note) {
          // Outgoing links
          extractWikilinks(note.content || '').forEach(l => {
            const tId = titleToNodeId.get(l.targetTitle.toLowerCase().trim())
            if (tId && !visited.has(tId)) {
              visited.add(tId)
              nextLevel.add(tId)
            }
          })
          // Backlinks
          allNotes.forEach(other => {
            if (other.id !== note.id && !visited.has(other.id)) {
              const links = extractWikilinks(other.content || '')
              if (links.some(l => l.targetTitle.toLowerCase().trim() === note.title.toLowerCase().trim())) {
                visited.add(other.id)
                nextLevel.add(other.id)
              }
            }
          })
        }
      })
      currentLevel = nextLevel
    }

    candidateNotes = candidateNotes.filter(n => visited.has(n.id))
  }

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>()
  const existingNodeIds = new Set<string>()

  // 3. Create Note Nodes
  candidateNotes.forEach(n => {
    const customColor = matchColorGroup({
      id: n.id,
      title: n.title,
      type: 'note',
      folder: n.folder || 'Общее',
      color: '',
      connectionCount: 0,
      tags: n.tags,
    }, colorGroups)

    nodes.push({
      id: n.id,
      title: n.title || 'Без названия',
      type: 'note',
      folder: n.folder || 'Общее',
      color: customColor || getFolderColor(n.folder || 'Общее'),
      connectionCount: 0,
      tags: n.tags || [],
    })
    existingNodeIds.add(n.id)
  })

  // 4. Build Wikilink Edges & Ghost / Unresolved Nodes
  candidateNotes.forEach(sourceNote => {
    const links = extractWikilinks(sourceNote.content || '')
    links.forEach(link => {
      const normTarget = link.targetTitle.toLowerCase().trim()
      const targetId = titleToNodeId.get(normTarget)

      if (targetId && existingNodeIds.has(targetId) && targetId !== sourceNote.id) {
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
      } else if (showUnresolved && !targetId && normTarget) {
        // Ghost/Unresolved node
        const ghostId = `ghost_${normTarget}`
        if (!existingNodeIds.has(ghostId)) {
          existingNodeIds.add(ghostId)
          nodes.push({
            id: ghostId,
            title: link.targetTitle,
            type: 'unresolved',
            folder: sourceNote.folder || 'Общее',
            color: '#64748b',
            connectionCount: 0,
          })
        }
        const edgeKey = [sourceNote.id, ghostId].sort().join(':::')
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({
            id: `edge_${sourceNote.id}_${ghostId}`,
            source: sourceNote.id,
            target: ghostId,
            type: 'unresolved',
          })
        }
      }
    })
  })

  // 5. Add Tags as Graph Nodes
  if (showTags) {
    const tagToNodeId = new Map<string, string>()
    candidateNotes.forEach(note => {
      (note.tags || []).forEach(tag => {
        const cleanTag = tag.trim().replace(/^#/, '')
        if (!cleanTag) return
        const tagNodeId = `tag_${cleanTag.toLowerCase()}`

        if (!tagToNodeId.has(cleanTag.toLowerCase())) {
          tagToNodeId.set(cleanTag.toLowerCase(), tagNodeId)
          const customColor = matchColorGroup({
            id: tagNodeId,
            title: `#${cleanTag}`,
            type: 'tag',
            color: '',
            connectionCount: 0,
          }, colorGroups)

          nodes.push({
            id: tagNodeId,
            title: `#${cleanTag}`,
            type: 'tag',
            color: customColor || '#a855f7', // Purple for tags
            connectionCount: 0,
          })
        }

        const edgeKey = [note.id, tagNodeId].sort().join(':::')
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({
            id: `edge_${note.id}_${tagNodeId}`,
            source: note.id,
            target: tagNodeId,
            type: 'tag',
          })
        }
      })
    })
  }

  // 6. Add Folders as Cluster Nodes
  if (showFolders) {
    const folderToNodeId = new Map<string, string>()
    candidateNotes.forEach(note => {
      const folderName = note.folder || 'Общее'
      const folderNodeId = `folder_${folderName.toLowerCase()}`

      if (!folderToNodeId.has(folderName.toLowerCase())) {
        folderToNodeId.set(folderName.toLowerCase(), folderNodeId)
        nodes.push({
          id: folderNodeId,
          title: `📁 ${folderName}`,
          type: 'folder',
          folder: folderName,
          color: getFolderColor(folderName),
          connectionCount: 0,
        })
      }

      const edgeKey = [note.id, folderNodeId].sort().join(':::')
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey)
        edges.push({
          id: `edge_${note.id}_${folderNodeId}`,
          source: note.id,
          target: folderNodeId,
          type: 'folder',
        })
      }
    })
  }

  // 7. Compute connection counts and node radii
  const counts = new Map<string, number>()
  edges.forEach(e => {
    counts.set(e.source, (counts.get(e.source) || 0) + 1)
    counts.set(e.target, (counts.get(e.target) || 0) + 1)
  })

  nodes.forEach(n => {
    n.connectionCount = counts.get(n.id) || 0
    if (n.type === 'tag') {
      n.radius = Math.max(4, Math.min(14, 4 + n.connectionCount * 1.8))
    } else if (n.type === 'folder') {
      n.radius = Math.max(7, Math.min(22, 7 + n.connectionCount * 2.2))
    } else if (n.type === 'unresolved') {
      n.radius = 4.5
    } else {
      n.radius = Math.max(5, Math.min(18, 5 + n.connectionCount * 2.5))
    }
  })

  return { nodes, edges }
}
