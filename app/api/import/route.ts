import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

interface ImportTaskData {
  title: string
  description?: string
  priority?: string
  status?: string
  dueDate?: string
  dueTime?: string
  tags?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chatId = BigInt(authUser.chatId)
    const body = await req.json().catch(() => ({}))
    const { format = 'csv', content = '' } = body

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Файл или содержимое для импорта пусто' }, { status: 400 })
    }

    let parsedTasks: ImportTaskData[] = []

    // ── 1. JSON Backup Format ──
    if (format === 'json') {
      try {
        const jsonData = JSON.parse(content)
        if (Array.isArray(jsonData.tasks)) {
          parsedTasks = jsonData.tasks.map((t: any) => ({
            title: String(t.title || 'Задача').trim(),
            description: t.description ? String(t.description) : undefined,
            priority: ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
            status: ['todo', 'inprogress', 'done'].includes(t.status) ? t.status : 'todo',
            dueDate: t.dueDate || undefined,
            dueTime: t.dueTime || undefined,
            tags: Array.isArray(t.tags) ? t.tags : [],
          }))
        } else if (Array.isArray(jsonData)) {
          parsedTasks = jsonData.map((t: any) => ({
            title: String(t.title || t.name || t.text || 'Задача').trim(),
            description: t.description || t.desc || undefined,
            priority: t.priority || 'medium',
            status: t.status === 'completed' || t.completed ? 'done' : 'todo',
            dueDate: t.dueDate || t.date || undefined,
            dueTime: t.dueTime || t.time || undefined,
            tags: Array.isArray(t.tags) ? t.tags : [],
          }))
        }
      } catch (err) {
        return NextResponse.json({ error: 'Неверный JSON формат файла' }, { status: 400 })
      }
    }

    // ── 2. Todoist CSV Export ──
    else if (format === 'todoist') {
      parsedTasks = parseTodoistCsv(content)
    }

    // ── 3. Notion Tasks CSV Export ──
    else if (format === 'notion') {
      parsedTasks = parseNotionCsv(content)
    }

    // ── 4. Apple Reminders / Plain Checklist Text ──
    else if (format === 'apple') {
      parsedTasks = parseAppleReminders(content)
    }

    // ── 5. Standard / Generic CSV ──
    else {
      parsedTasks = parseGenericCsv(content)
    }

    if (parsedTasks.length === 0) {
      return NextResponse.json({ error: 'Не удалось распознать задачи в файле. Проверьте формат.' }, { status: 400 })
    }

    // Cap the batch so a giant pasted file cannot hammer the DB row-by-row
    if (parsedTasks.length > 500) {
      parsedTasks = parsedTasks.slice(0, 500)
    }

    // Insert parsed tasks into Prisma DB (batch insert)
    let createdCount = 0
    for (const t of parsedTasks) {
      if (!t.title) continue
      try {
        await prisma.task.create({
          data: {
            title: t.title.slice(0, 500),
            description: t.description?.slice(0, 2000),
            priority: t.priority || 'medium',
            status: t.status || 'todo',
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            tags: t.tags || [],
            ownerChatId: chatId,
            authorChatId: chatId,
            visibility: 'private',
          },
        })
        createdCount++
      } catch (e) {
        console.error('Error inserting imported task:', e)
      }
    }

    return NextResponse.json({
      success: true,
      count: createdCount,
      message: `Успешно импортировано ${createdCount} задач${getPluralEnding(createdCount)}`,
    })
  } catch (error: any) {
    console.error('[Import API] Error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка импорта данных' }, { status: 500 })
  }
}

// ─── CSV Parsers ─────────────────────────────────────────────────────────────

function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '') // remove BOM
  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0)
  return lines.map(line => {
    const row: string[] = []
    let inQuotes = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    row.push(current.trim())
    return row
  })
}

function parseGenericCsv(content: string): ImportTaskData[] {
  const rows = parseCsvRows(content)
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.toLowerCase().replace(/['"]/g, ''))
  const titleIdx = headers.findIndex(h => h.includes('название') || h.includes('title') || h.includes('задача') || h.includes('name') || h.includes('task'))
  const statusIdx = headers.findIndex(h => h.includes('статус') || h.includes('status'))
  const priorityIdx = headers.findIndex(h => h.includes('приоритет') || h.includes('priority'))
  const dueDateIdx = headers.findIndex(h => h.includes('дата') || h.includes('due') || h.includes('date') || h.includes('срок'))
  const dueTimeIdx = headers.findIndex(h => h.includes('время') || h.includes('time'))
  const tagsIdx = headers.findIndex(h => h.includes('тег') || h.includes('tag') || h.includes('категор') || h.includes('category'))
  const descIdx = headers.findIndex(h => h.includes('описание') || h.includes('desc') || h.includes('заметка') || h.includes('note'))

  const tasks: ImportTaskData[] = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const title = titleIdx !== -1 ? r[titleIdx] : r[0]
    if (!title || !title.trim()) continue

    let status = 'todo'
    if (statusIdx !== -1 && r[statusIdx]) {
      const s = r[statusIdx].toLowerCase()
      if (s.includes('выполнен') || s.includes('done') || s.includes('complete') || s.includes('1') || s.includes('да')) status = 'done'
      else if (s.includes('процесс') || s.includes('progress')) status = 'inprogress'
    }

    let priority = 'medium'
    if (priorityIdx !== -1 && r[priorityIdx]) {
      const p = r[priorityIdx].toLowerCase()
      if (p.includes('срочн') || p.includes('urgent') || p.includes('critical') || p === '1' || p === 'p1') priority = 'urgent'
      else if (p.includes('высок') || p.includes('high') || p === '2' || p === 'p2') priority = 'high'
      else if (p.includes('низк') || p.includes('low') || p === '4' || p === 'p4') priority = 'low'
    }

    let dueDate = dueDateIdx !== -1 ? normalizeDate(r[dueDateIdx]) : undefined
    let dueTime = dueTimeIdx !== -1 ? normalizeTime(r[dueTimeIdx]) : undefined
    let tags: string[] = []
    if (tagsIdx !== -1 && r[tagsIdx]) {
      tags = r[tagsIdx].split(/[,;]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    }

    tasks.push({
      title: title.trim(),
      description: descIdx !== -1 ? r[descIdx]?.trim() : undefined,
      status,
      priority,
      dueDate,
      dueTime,
      tags,
    })
  }

  return tasks
}

function parseTodoistCsv(content: string): ImportTaskData[] {
  const rows = parseCsvRows(content)
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.toUpperCase().replace(/['"]/g, ''))
  const contentIdx = headers.indexOf('CONTENT')
  const descIdx = headers.indexOf('DESCRIPTION')
  const priorityIdx = headers.indexOf('PRIORITY')
  const dateIdx = headers.indexOf('DATE')

  const tasks: ImportTaskData[] = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const title = contentIdx !== -1 ? r[contentIdx] : r[0]
    if (!title || !title.trim()) continue

    let priority = 'medium'
    if (priorityIdx !== -1 && r[priorityIdx]) {
      const p = r[priorityIdx].trim()
      if (p === '4') priority = 'urgent' // Todoist P4 is highest
      else if (p === '3') priority = 'high'
      else if (p === '1') priority = 'low'
    }

    const dueDate = dateIdx !== -1 ? normalizeDate(r[dateIdx]) : undefined

    tasks.push({
      title: title.trim(),
      description: descIdx !== -1 ? r[descIdx]?.trim() : undefined,
      priority,
      status: 'todo',
      dueDate,
    })
  }

  return tasks
}

function parseNotionCsv(content: string): ImportTaskData[] {
  return parseGenericCsv(content)
}

function parseAppleReminders(content: string): ImportTaskData[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  const tasks: ImportTaskData[] = []

  for (const line of lines) {
    let cleanLine = line.trim()
    let status = 'todo'

    // Check for markdown checkbox syntax: - [ ] or - [x]
    if (cleanLine.startsWith('- [x]') || cleanLine.startsWith('* [x]') || cleanLine.startsWith('[x]')) {
      status = 'done'
      cleanLine = cleanLine.replace(/^[-*]?\s*\[x\]\s*/i, '')
    } else if (cleanLine.startsWith('- [ ]') || cleanLine.startsWith('* [ ]') || cleanLine.startsWith('[ ]')) {
      cleanLine = cleanLine.replace(/^[-*]?\s*\[ \]\s*/i, '')
    } else if (cleanLine.startsWith('-') || cleanLine.startsWith('*') || cleanLine.startsWith('•')) {
      cleanLine = cleanLine.replace(/^[-*•]\s*/, '')
    }

    // Check for priority marks: !!!, !!, !
    let priority = 'medium'
    if (cleanLine.includes('!!!')) {
      priority = 'urgent'
      cleanLine = cleanLine.replace(/!!!/g, '').trim()
    } else if (cleanLine.includes('!!')) {
      priority = 'high'
      cleanLine = cleanLine.replace(/!!/g, '').trim()
    } else if (cleanLine.includes('!')) {
      priority = 'high'
      cleanLine = cleanLine.replace(/!/g, '').trim()
    }

    // Extract tags: #tag
    const tags = (cleanLine.match(/#([\w\u0400-\u04FF]+)/g) || []).map(t => t.replace('#', ''))
    cleanLine = cleanLine.replace(/#([\w\u0400-\u04FF]+)/g, '').trim()

    if (cleanLine) {
      tasks.push({
        title: cleanLine,
        status,
        priority,
        tags,
      })
    }
  }

  return tasks
}

function normalizeDate(raw: string): string | undefined {
  if (!raw) return undefined
  const clean = raw.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  // DD.MM.YYYY
  const ruMatch = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (ruMatch) {
    const d = ruMatch[1].padStart(2, '0')
    const m = ruMatch[2].padStart(2, '0')
    return `${ruMatch[3]}-${m}-${d}`
  }
  // Try ISO parse
  const parsed = Date.parse(clean)
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10)
  }
  return undefined
}

function normalizeTime(raw: string): string | undefined {
  if (!raw) return undefined
  const clean = raw.trim()
  if (/^\d{2}:\d{2}$/.test(clean)) return clean
  const m = clean.match(/^(\d{1,2}):(\d{2})/)
  if (m) {
    return `${m[1].padStart(2, '0')}:${m[2]}`
  }
  return undefined
}

function getPluralEnding(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'у'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'и'
  return ''
}
