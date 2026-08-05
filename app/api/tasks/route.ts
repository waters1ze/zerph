/**
 * Next.js API Route — Tasks, Goals, Notes
 * GET    /api/tasks              — fetch all
 * POST   /api/tasks              — create task
 * PATCH  /api/tasks              — update or complete by fuzzy match
 * DELETE /api/tasks?id=xxx       — delete
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb, saveDb, completeTaskByTitle } from '@/lib/backend/db'

export async function GET() {
  const db = getDb()
  return NextResponse.json({ tasks: db.tasks, goals: db.goals, notes: db.notes })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = getDb()
    const now = new Date().toISOString()

    const newTask = {
      id: 't_' + Math.random().toString(36).substring(2, 9),
      title: body.title || 'Untitled Task',
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
    saveDb(db)
    return NextResponse.json({ success: true, task: newTask })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const db = getDb()
    const now = new Date().toISOString()

    // Action: complete by fuzzy title match
    if (body.action === 'complete' && body.targetTitle) {
      const completed = completeTaskByTitle(body.targetTitle)
      if (!completed) {
        return NextResponse.json({ error: 'No matching task found', notFound: true }, { status: 404 })
      }
      return NextResponse.json({ success: true, task: completed, action: 'completed' })
    }

    // Action: update task by ID
    if (body.id) {
      const idx = db.tasks.findIndex(t => t.id === body.id)
      if (idx === -1) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

      db.tasks[idx] = {
        ...db.tasks[idx],
        ...body,
        updatedAt: now,
        ...(body.status === 'done' ? { completedAt: now } : {}),
      }
      saveDb(db)
      return NextResponse.json({ success: true, task: db.tasks[idx] })
    }

    // Action: mark reminder as sent
    if (body.reminderId) {
      const idx = db.tasks.findIndex(t => t.id === body.reminderId)
      if (idx !== -1) {
        db.tasks[idx].reminderSent = true
        db.tasks[idx].updatedAt = now
        saveDb(db)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid PATCH body' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') || 'task'
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = getDb()
    if (type === 'goal') db.goals = db.goals.filter(g => g.id !== id)
    else if (type === 'note') db.notes = db.notes.filter(n => n.id !== id)
    else db.tasks = db.tasks.filter(t => t.id !== id)

    saveDb(db)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
