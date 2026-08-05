/**
 * /api/tasks — Per-user tasks/goals/notes, isolated by chatId
 * chatId comes from: ?chatId=xxx OR x-chat-id header
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb, saveDb, completeTaskByTitle } from '@/lib/backend/db'

function getChatId(req: NextRequest): string | null {
  return req.nextUrl.searchParams.get('chatId')
    || req.nextUrl.searchParams.get('chat_id')
    || req.headers.get('x-chat-id')
    || null
}

export async function GET(req: NextRequest) {
  const chatId = getChatId(req)
  const db = getDb(chatId)
  return NextResponse.json({ tasks: db.tasks, goals: db.goals, notes: db.notes })
}

export async function POST(req: NextRequest) {
  try {
    const chatId = getChatId(req)
    const body = await req.json()
    const db = getDb(chatId)
    const now = new Date().toISOString()

    const newTask = {
      id: 't_' + Math.random().toString(36).substring(2, 9),
      title: body.title || 'Новая задача',
      description: body.description || '',
      priority: body.priority || 'medium',
      status: body.status || 'todo',
      dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
      dueTime: body.dueTime || undefined,
      tags: body.tags || [],
      assignees: [],
      isShared: false,
      createdAt: now,
      updatedAt: now,
      subtasks: (body.subtasks || []).map((st: string, i: number) => ({
        id: `st_${i}_${Date.now()}`,
        title: typeof st === 'string' ? st : st,
        done: false,
      })),
    }

    db.tasks.unshift(newTask)
    saveDb(db, chatId)
    return NextResponse.json({ success: true, task: newTask })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const chatId = getChatId(req)
    const body = await req.json()
    const db = getDb(chatId)
    const now = new Date().toISOString()

    if (body.action === 'complete' && body.title) {
      const completed = completeTaskByTitle(body.title, chatId)
      return NextResponse.json({ success: !!completed, task: completed })
    }

    if (body.id) {
      const idx = db.tasks.findIndex(t => t.id === body.id)
      if (idx >= 0) {
        db.tasks[idx] = { ...db.tasks[idx], ...body.updates, updatedAt: now }
        saveDb(db, chatId)
        return NextResponse.json({ success: true, task: db.tasks[idx] })
      }
    }

    return NextResponse.json({ success: false, error: 'Task not found' })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const chatId = getChatId(req)
    const id = req.nextUrl.searchParams.get('id')
    const db = getDb(chatId)
    db.tasks = db.tasks.filter(t => t.id !== id)
    saveDb(db, chatId)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
