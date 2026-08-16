/**
 * GET  /api/tasks  — tasks + goals + notes for current user
 * POST /api/tasks  — create task
 * PATCH /api/tasks — update/complete task
 * DELETE /api/tasks?id=&type= — delete
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllTasks, getAllGoals, getAllNotes, getFriends, getAllHabits,
  createTask, updateTask, deleteTask,
  completeTaskByTitle, markReminderSent,
  deleteNote, deleteGoal, createNote, updateNote,
  createGoal, updateGoal, getUserUsageAndLimits, incrementUserUsage, syncFriendBirthdays,
  touchUserLastActive, createHabit, updateHabit, deleteHabit,
} from '@/lib/backend/db'
import { startReminderScheduler } from '@/lib/backend/reminder-scheduler'
import { getAuthenticatedUser } from '@/lib/backend/auth'

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

async function getOwnerChatId(req: NextRequest): Promise<string | null> {
  const authUser = await getAuthenticatedUser(req)
  return authUser ? authUser.chatId : null
}

export async function GET(req: NextRequest) {
  try {
    const ownerChatId = await getOwnerChatId(req)
    if (!ownerChatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    
    try {
      await touchUserLastActive(ownerChatId)
      await syncFriendBirthdays(ownerChatId)
      const [tasks, goals, notes, friends, habits] = await Promise.all([
        getAllTasks(ownerChatId),
        getAllGoals(ownerChatId),
        getAllNotes(ownerChatId),
        getFriends(ownerChatId),
        getAllHabits(ownerChatId),
      ])
      return NextResponse.json(serialize({ tasks, goals, notes, friends, habits }), {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    } catch (dbErr) {
      console.error('DB query error in /api/tasks GET:', dbErr)
      return NextResponse.json({ tasks: [], goals: [], notes: [], friends: [], habits: [], _dbOffline: true }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      })
    }
  } catch (err: unknown) {
    return NextResponse.json({ tasks: [], goals: [], notes: [], friends: [], habits: [], _dbOffline: true }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ownerChatId = await getOwnerChatId(req)
    if (!ownerChatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })

    const body = await req.json()

    if (body.itemType === 'goal' || body.type === 'goal') {
      const goal = await createGoal({
        title: body.title || 'Новая цель',
        description: body.description,
        motivation: body.motivation,
        deadline: body.deadline,
        milestones: body.milestones || [],
        color: body.color || '#2d7a4f',
        ownerChatId: ownerChatId,
      })
      return NextResponse.json(serialize({ success: true, goal }))
    }

    if (body.itemType === 'note' || body.type === 'note') {
      if (ownerChatId) {
        const limits = await getUserUsageAndLimits(ownerChatId)
        if (!limits.canCreateNote) {
          return NextResponse.json({
            error: '❌ Дневной лимит создания заметок исчерпан (5 заметок в день на бесплатном тарифе). Оформите подписку Zerf Premium за 99 ₽ в Настройках!',
            limitReached: true,
          }, { status: 403 })
        }
      }

      const note = await createNote({
        title: body.title || 'Новая заметка',
        content: body.content || '',
        originalText: body.originalText,
        tags: body.tags || [],
        dueDate: body.dueDate || null,
        dueTime: body.dueTime || null,
        aiGenerated: body.aiGenerated || false,
        folder: body.folder || 'Общее',
        ownerChatId: ownerChatId,
      })

      if (ownerChatId) {
        await incrementUserUsage(ownerChatId, 'note')
      }

      return NextResponse.json(serialize({ success: true, note }))
    }

    if (body.itemType === 'habit' || body.type === 'habit') {
      const habit = await createHabit({
        title: body.title || 'Новая привычка',
        icon: body.icon,
        frequency: body.frequency || 'daily',
        ownerChatId: ownerChatId,
      })
      return NextResponse.json(serialize({ success: true, habit }))
    }

    const task = await createTask({
      title: body.title || 'Untitled Task',
      description: body.description,
      priority: body.priority || 'medium',
      status: body.status || 'todo',
      dueDate: body.dueDate,
      dueTime: body.dueTime,
      tags: body.tags || [],
      subtasks: body.subtasks || [],
      projectId: body.projectId || null,
      parentTaskId: body.parentTaskId || null,
      ownerChatId: ownerChatId,
    })
    return NextResponse.json(serialize({ success: true, task }))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ownerChatId = await getOwnerChatId(req)
    if (!ownerChatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })

    const body = await req.json()

    // Update goal by ID
    if (body.id && (body.itemType === 'goal' || body.type === 'goal')) {
      const { id, itemType, type, ...updates } = body
      const goal = await updateGoal(id, updates)
      return NextResponse.json(serialize({ success: true, goal }))
    }

    // Update note by ID
    if (body.id && (body.itemType === 'note' || body.type === 'note')) {
      const { id, itemType, type, ...updates } = body
      const note = await updateNote(id, updates)
      return NextResponse.json(serialize({ success: true, note }))
    }

    // Update habit by ID
    if (body.id && (body.itemType === 'habit' || body.type === 'habit')) {
      const { id, itemType, type, ...updates } = body
      const habit = await updateHabit(id, updates)
      return NextResponse.json(serialize({ success: true, habit }))
    }

    // Fuzzy completion by title
    if (body.action === 'complete' && body.targetTitle) {
      const completed = await completeTaskByTitle(body.targetTitle, ownerChatId)
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

    // Update task by ID
    if (body.id) {
      const { id, ...updates } = body
      const task = await updateTask(id, updates)
      return NextResponse.json(serialize({ success: true, task }))
    }

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ownerChatId = await getOwnerChatId(req)
    if (!ownerChatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') || 'task'
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (type === 'note') await deleteNote(id)
    else if (type === 'goal') await deleteGoal(id)
    else if (type === 'habit') await deleteHabit(id)
    else await deleteTask(id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
