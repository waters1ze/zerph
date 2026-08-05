/**
 * GET  /api/tasks  — all tasks + goals + notes
 * POST /api/tasks  — create task
 * PATCH /api/tasks — update/complete task
 * DELETE /api/tasks?id=&type= — delete
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllTasks, getAllGoals, getAllNotes,
  createTask, updateTask, deleteTask,
  completeTaskByTitle, markReminderSent,
  deleteNote, updateGoal,
} from '@/lib/backend/db'
import { startReminderScheduler } from '@/lib/backend/reminder-scheduler'

// Start background interval for Telegram reminders
startReminderScheduler()

function serialize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString()
  if (typeof obj === 'bigint') return Number(obj)
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serialize(v)])
    )
  }
  return obj
}

export async function GET() {
  try {
    const [tasks, goals, notes] = await Promise.all([
      getAllTasks(),
      getAllGoals(),
      getAllNotes(),
    ])
    return NextResponse.json(serialize({ tasks, goals, notes }))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const task = await createTask({
      title: body.title || 'Untitled Task',
      description: body.description,
      priority: body.priority || 'medium',
      status: body.status || 'todo',
      dueDate: body.dueDate,
      dueTime: body.dueTime,
      tags: body.tags || [],
      subtasks: body.subtasks || [],
    })
    return NextResponse.json(serialize({ success: true, task }))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    // Fuzzy completion by title
    if (body.action === 'complete' && body.targetTitle) {
      const completed = await completeTaskByTitle(body.targetTitle)
      if (!completed) {
        return NextResponse.json({ error: 'No matching task found', notFound: true }, { status: 404 })
      }
      return NextResponse.json(serialize({ success: true, task: completed, action: 'completed' }))
    }

    // Mark reminder sent
    if (body.reminderId) {
      await markReminderSent(body.reminderId)
      return NextResponse.json({ success: true })
    }

    // Update by ID
    if (body.id) {
      const task = await updateTask(body.id, body)
      return NextResponse.json(serialize({ success: true, task }))
    }

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') || 'task'
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (type === 'note') await deleteNote(id)
    else if (type === 'goal') await updateGoal(id, { status: 'completed' })
    else await deleteTask(id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
