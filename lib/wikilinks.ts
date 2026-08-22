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
  showTasks?: boolean
  hideOrphanTags?: boolean
  autoClusterTopics?: boolean
  searchQuery?: string
  colorGroups?: ColorGroup[]
  localNoteId?: string | null
  localDepth?: number // default 1 or 2
  tasks?: Array<{ id: string; title: string; tags?: string[]; folder?: string; status?: string; description?: string }>
}

const STOP_WORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она',
  'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее',
  'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда',
  'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до',
  'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей',
  'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем',
  'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже', 'себе', 'под', 'будет',
  'ж', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'совсем', 'ним', 'здесь',
  'этом', 'один', 'почти', 'мой', 'тем', 'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем',
  'всех', 'никогда', 'можно', 'при', 'наконец', 'два', 'об', 'другой', 'хоть', 'после',
  'над', 'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего', 'них', 'какая', 'много',
  'разве', 'три', 'эту', 'моя', 'впрочем', 'хорошо', 'свою', 'этой', 'перед', 'иногда',
  'лучше', 'чуть', 'том', 'нельзя', 'такой', 'им', 'более', 'всегда', 'конечно', 'всю',
  'между', 'помочь', 'сделать', 'делать', 'поехать', 'ехать', 'купить', 'поставить', 'напомнить',
  'пойти', 'просто', 'очень', 'время', 'задача', 'заметки', 'личное', 'общие', 'новое'
])

// Common semantic root mappings to canonical topic tag names
const ROOT_TOPIC_MAP: Record<string, string> = {
  'деревн': 'деревня',
  'огород': 'огород',
  'песок': 'песок',
  'песк': 'песок',
  'костёр': 'костёр',
  'костер': 'костер',
  'шашлык': 'пикник',
  'сосиск': 'пикник',
  'пикник': 'пикник',
  'проект': 'проект',
  'программ': 'разработка',
  'разработк': 'разработка',
  'код': 'разработка',
  'учеб': 'учеба',
  'урок': 'уроки',
  'школ': 'школа',
  'тренировк': 'спорт',
  'зарядк': 'спорт',
  'спорт': 'спорт',
  'покупк': 'покупки',
  'магазин': 'покупки',
  'поездк': 'поездка',
  'дорог': 'поездка',
  'завтрак': 'питание',
  'обед': 'питание',
  'ужин': 'питание',
  'сон': 'режим',
  'спать': 'режим',
  'подъём': 'режим',
  'подъем': 'режим',
  'книг': 'чтение',
  'читать': 'чтение',
  'музык': 'музыка',
  'фильм': 'кино',
  'кино': 'кино',
  'рождени': 'праздник',
}

export function extractSemanticTopics(text: string): string[] {
  if (!text) return []
  const clean = text.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, ' ')
  const words = clean.split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w))
  const topics = new Set<string>()

  for (const word of words) {
    let matched = false
    for (const [prefix, topicName] of Object.entries(ROOT_TOPIC_MAP)) {
      if (word.startsWith(prefix)) {
        topics.add(topicName)
        matched = true
        break
      }
    }
    if (!matched && word.length >= 5) {
      topics.add(word)
    }
  }

  return Array.from(topics)
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
  if (!colorGroups || colorGroups.length === 0) return null

  for (const group of colorGroups) {
    const q = (group.query || '').trim().toLowerCase()
    if (!q) continue

    if (q.startsWith('tag:') || q.startsWith('#')) {
      const targetTag = q.replace(/^tag:/, '').replace(/^#/, '').toLowerCase()
      if (!targetTag) continue
      if (node.type === 'tag' && node.title.toLowerCase().replace(/^#/, '').includes(targetTag)) {
        return group.color
      }
      if (node.tags && node.tags.some(t => t.toLowerCase().includes(targetTag))) {
        return group.color
      }
    } else if (q.startsWith('path:') || q.startsWith('folder:')) {
      const targetPath = q.replace(/^path:/, '').replace(/^folder:/, '').toLowerCase()
      if (!targetPath) continue
      if ((node.folder || '').toLowerCase().includes(targetPath)) {
        return group.color
      }
    } else {
      // Obsidian-style flexible substring match: matches if title, folder, or any tag contains query `q`
      const titleLower = (node.title || '').toLowerCase()
      const folderLower = (node.folder || '').toLowerCase()
      const tagMatch = (node.tags || []).some(t => t.toLowerCase().includes(q))
      if (titleLower.includes(q) || folderLower.includes(q) || tagMatch) {
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
    showTasks = true,
    hideOrphanTags = true,
    autoClusterTopics = true,
    colorGroups = [],
    localNoteId = null,
    localDepth = 1,
    tasks = [],
  } = options

  // 1. Initial filter by folder and filter out invalid/deleted items
  const validNotes = (allNotes || []).filter(n => n && n.id && n.title && !(n as any).deleted)
  let candidateNotes = folderFilter
    ? validNotes.filter(n => (n.folder || 'Общее').startsWith(folderFilter))
    : validNotes

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
          validNotes.forEach(other => {
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

  // 3b. Add Task Nodes if showTasks is true (only active, non-deleted, non-done tasks)
  if (showTasks && tasks && tasks.length > 0) {
    tasks
      .filter(t => t && t.id && t.title && t.status !== 'draft' && t.status !== 'done' && !(t as any).deleted)
      .forEach(t => {
        if (folderFilter && !(t.folder || 'Задачи').startsWith(folderFilter)) return
        const taskId = `task_${t.id}`
        if (!existingNodeIds.has(taskId)) {
          existingNodeIds.add(taskId)
          titleToNodeId.set(t.title.toLowerCase().trim(), taskId)
        const customColor = matchColorGroup({
          id: taskId,
          title: t.title,
          type: 'note',
          folder: t.folder || 'Задачи',
          color: '',
          connectionCount: 0,
          tags: t.tags,
        }, colorGroups)

        nodes.push({
          id: taskId,
          title: `✓ ${t.title}`,
          type: 'note',
          folder: t.folder || 'Задачи',
          color: customColor || '#38bdf8', // Sky blue for tasks
          connectionCount: 0,
          tags: t.tags || [],
        })
      }
    })
  }

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

  // 5. Add Tags as Graph Nodes (Only meaningful multi-item tags when hideOrphanTags is enabled)
  const tagToNodeId = new Map<string, string>()
  if (showTags) {
    const tagSources: Array<{ id: string; tags?: string[] }> = [...candidateNotes]
    if (showTasks && tasks && tasks.length > 0) {
      tagSources.push(
        ...tasks
          .filter(t => t && t.id && t.title && t.status !== 'draft' && t.status !== 'done' && !(t as any).deleted)
          .filter(t => existingNodeIds.has(`task_${t.id}`))
          .map(t => ({ id: `task_${t.id}`, tags: t.tags }))
      )
    }

    // Count how many unique active notes/tasks contain each tag
    const tagItemCounts = new Map<string, Set<string>>()
    tagSources.forEach(item => {
      if (!existingNodeIds.has(item.id)) return
      (item.tags || []).forEach(tag => {
        const cleanTag = tag.trim().replace(/^#/, '').toLowerCase()
        if (!cleanTag) return
        const set = tagItemCounts.get(cleanTag) || new Set<string>()
        set.add(item.id)
        tagItemCounts.set(cleanTag, set)
      })
    })

    tagSources.forEach(item => {
      if (!existingNodeIds.has(item.id)) return
      (item.tags || []).forEach(tag => {
        const rawClean = tag.trim().replace(/^#/, '')
        const cleanTag = rawClean.toLowerCase()
        if (!cleanTag) return

        const uniqueItemsCount = tagItemCounts.get(cleanTag)?.size || 0

        // If hideOrphanTags is enabled: only create a tag node if it connects >= 2 distinct items
        if (hideOrphanTags && uniqueItemsCount < 2) {
          return // Skip isolated, dead, single-item tags completely!
        }

        const tagNodeId = `tag_${cleanTag}`

        if (!tagToNodeId.has(cleanTag)) {
          tagToNodeId.set(cleanTag, tagNodeId)
          const customColor = matchColorGroup({
            id: tagNodeId,
            title: `#${rawClean}`,
            type: 'tag',
            color: '',
            connectionCount: 0,
          }, colorGroups)

          nodes.push({
            id: tagNodeId,
            title: `#${rawClean}`,
            type: 'tag',
            color: customColor || '#a855f7', // Purple for tags
            connectionCount: 0,
          })
          existingNodeIds.add(tagNodeId)
        }

        const edgeKey = [item.id, tagNodeId].sort().join(':::')
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({
            id: `edge_${item.id}_${tagNodeId}`,
            source: item.id,
            target: tagNodeId,
            type: 'tag',
          })
        }
      })
    })
  }

  // 5b. Smart Semantic Topic Auto-Clustering (#хэштеги тем)
  if (showTags && autoClusterTopics) {
    const topicToItems = new Map<string, Set<string>>()
    const allItemSources: Array<{ id: string; text: string }> = [
      ...candidateNotes.map(n => ({ id: n.id, text: `${n.title} ${n.content || ''}` })),
    ]
    if (showTasks && tasks && tasks.length > 0) {
      allItemSources.push(
        ...tasks
          .filter(t => t && t.id && t.title && t.status !== 'draft' && t.status !== 'done' && !(t as any).deleted)
          .filter(t => existingNodeIds.has(`task_${t.id}`))
          .map(t => ({ id: `task_${t.id}`, text: `${t.title} ${t.description || ''}` }))
      )
    }

    allItemSources.forEach(item => {
      const topics = extractSemanticTopics(item.text)
      topics.forEach(topic => {
        const set = topicToItems.get(topic) || new Set<string>()
        set.add(item.id)
        topicToItems.set(topic, set)
      })
    })

    topicToItems.forEach((itemIds, topic) => {
      // If a topic connects 2 or more distinct tasks/notes:
      if (itemIds.size >= 2) {
        const tagNodeId = `autotag_${topic}`

        if (!tagToNodeId.has(topic) && !existingNodeIds.has(tagNodeId)) {
          tagToNodeId.set(topic, tagNodeId)
          const customColor = matchColorGroup({
            id: tagNodeId,
            title: `#${topic}`,
            type: 'tag',
            color: '',
            connectionCount: 0,
          }, colorGroups)

          nodes.push({
            id: tagNodeId,
            title: `#${topic}`,
            type: 'tag',
            color: customColor || '#06b6d4', // Cyan for auto-discovered semantic clusters
            connectionCount: 0,
          })
          existingNodeIds.add(tagNodeId)
        }

        const actualTagNodeId = tagToNodeId.get(topic) || tagNodeId
        itemIds.forEach(itemId => {
          const edgeKey = [itemId, actualTagNodeId].sort().join(':::')
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey)
            edges.push({
              id: `edge_${itemId}_${actualTagNodeId}`,
              source: itemId,
              target: actualTagNodeId,
              type: 'tag',
            })
          }
        })
      }
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

  // Filter out any leftover isolated tag nodes with 0 connections
  const finalNodes = nodes.filter(n => {
    if (n.type === 'tag') {
      return (counts.get(n.id) || 0) >= (hideOrphanTags ? 2 : 1)
    }
    return true
  })

  const validFinalNodeIds = new Set(finalNodes.map(n => n.id))
  const finalEdges = edges.filter(e => validFinalNodeIds.has(e.source) && validFinalNodeIds.has(e.target))

  finalNodes.forEach(n => {
    n.connectionCount = counts.get(n.id) || 0
    const degree = n.connectionCount
    // Obsidian-style dynamic node sizing: nodes grow larger as they connect to more notes
    if (n.type === 'tag') {
      n.radius = Math.max(5, Math.min(22, 5 + Math.sqrt(degree) * 4.8))
    } else if (n.type === 'folder') {
      n.radius = Math.max(8, Math.min(28, 8 + Math.sqrt(degree) * 5.5))
    } else if (n.type === 'unresolved') {
      n.radius = Math.max(4.5, Math.min(14, 4.5 + Math.sqrt(degree) * 3.2))
    } else {
      // Note / Task: scales significantly with degree (from 5.5px up to 30px)
      n.radius = Math.max(5.5, Math.min(30, 5.5 + Math.pow(degree, 0.7) * 5.8))
    }
  })

  return { nodes: finalNodes, edges: finalEdges }
}
