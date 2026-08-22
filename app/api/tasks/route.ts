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
  touchUserLastActive, createHabit, updateHabit, deleteHabit, isBirthdayOrHolidayTask,
} from '@/lib/backend/db'
import { startReminderScheduler } from '@/lib/backend/reminder-scheduler'
import { runAllCronTasks } from '@/lib/backend/cron-runner'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { incrementDailyCount, COUNTERS } from '@/lib/backend/plans'
import { notifyDataChanged } from '@/lib/backend/sse'

import { prisma } from '@/lib/backend/prisma'
import { getUserInstalledExtensions, getUserEnabledExtensions } from '@/lib/backend/extensions'

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
    if (!ownerChatId) {
      // 401 (not a silent 200 with empty lists): an empty-200 would make the
      // client's periodic sync wipe all local data on any transient auth gap.
      return NextResponse.json(
        { error: 'Unauthorized', tasks: [], goals: [], notes: [], friends: [], habits: [] },
        { status: 401 }
      )
    }
    
    try {
      // Run background maintenance asynchronously without blocking the user query
      touchUserLastActive(ownerChatId).catch(() => {})
      syncFriendBirthdays(ownerChatId).catch(() => {})
      runAllCronTasks().catch(e => console.error('[Background Cron Error]:', e))

      const cid = String(ownerChatId)
      const [tasks, goals, notes, friends, habits, groupsRow, friendGroupsRow, chatRow, zerficRow, instExts, enExts] = await Promise.all([
        getAllTasks(ownerChatId),
        getAllGoals(ownerChatId),
        getAllNotes(ownerChatId),
        getFriends(ownerChatId),
        getAllHabits(ownerChatId),
        prisma.config.findUnique({ where: { key: `user_schedule_groups_${cid}` } }),
        prisma.config.findUnique({ where: { key: `friend_groups_${cid}` } }),
        prisma.config.findUnique({ where: { key: `user_chat_history_${cid}` } }),
        prisma.config.findUnique({ where: { key: `user_zerfic_live_history_${cid}` } }),
        getUserInstalledExtensions(cid),
        getUserEnabledExtensions(cid),
      ])

      let scheduleGroups: any[] = []
      let friendGroups: any[] = []
      let chat: any[] = []
      let zerficHistory: any[] = []
      try { if (groupsRow?.value) scheduleGroups = JSON.parse(groupsRow.value) } catch {}
      try { if (friendGroupsRow?.value) friendGroups = JSON.parse(friendGroupsRow.value) } catch {}
      try { if (chatRow?.value) chat = JSON.parse(chatRow.value) } catch {}
      try { if (zerficRow?.value) zerficHistory = JSON.parse(zerficRow.value) } catch {}

      return NextResponse.json(serialize({
        tasks,
        goals,
        notes,
        friends,
        habits,
        scheduleGroups,
        friendGroups,
        chat,
        zerficHistory,
        installedExtensions: instExts,
        enabledExtensions: enExts,
      }), {
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
    const cid = String(ownerChatId)

    // Sync Chat History
    if (body.syncType === 'chat' && Array.isArray(body.chat)) {
      await prisma.config.upsert({
        where: { key: `user_chat_history_${cid}` },
        update: { value: JSON.stringify(body.chat.slice(-50)) },
        create: { key: `user_chat_history_${cid}`, value: JSON.stringify(body.chat.slice(-50)) },
      })
      notifyDataChanged(ownerChatId, 'all')
      return NextResponse.json({ success: true })
    }

    // Sync Zerfic Live Chat History
    if (body.syncType === 'zerfic_history' && Array.isArray(body.messages)) {
      await prisma.config.upsert({
        where: { key: `user_zerfic_live_history_${cid}` },
        update: { value: JSON.stringify(body.messages.slice(-50)) },
        create: { key: `user_zerfic_live_history_${cid}`, value: JSON.stringify(body.messages.slice(-50)) },
      })
      notifyDataChanged(ownerChatId, 'all')
      return NextResponse.json({ success: true })
    }

    // Sync Schedule Groups
    if (body.syncType === 'schedule_groups' && Array.isArray(body.scheduleGroups)) {
      await prisma.config.upsert({
        where: { key: `user_schedule_groups_${cid}` },
        update: { value: JSON.stringify(body.scheduleGroups) },
        create: { key: `user_schedule_groups_${cid}`, value: JSON.stringify(body.scheduleGroups) },
      })
      notifyDataChanged(ownerChatId, 'all')
      return NextResponse.json({ success: true })
    }

    if (body.itemType === 'goal' || body.type === 'goal') {
      // Free plan: max 5 goals per day
      const limits = await getUserUsageAndLimits(ownerChatId)
      if (!limits.canCreateGoal) {
        return NextResponse.json({
          error: `❌ Дневной лимит создания целей исчерпан (${limits.goals.max} в день на бесплатном тарифе). Оформите Zerf Plus — там цели без ограничений!`,
          limitReached: true,
        }, { status: 403 })
      }
      await incrementDailyCount(COUNTERS.goal, ownerChatId)

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
            error: `❌ Лимит заметок для бесплатного тарифа исчерпан (${limits.notes.max} заметок). Удалите старые заметки или оформите Zerf Plus для безлимита!`,
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

      // NOTE: usage counter is incremented inside createNote() itself —
      // incrementing here as well would double-count against the daily limit.
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

    if (ownerChatId && (body.dueTime || body.dueDate)) {
      const isHoliday = isBirthdayOrHolidayTask(body)
      if (!isHoliday) {
        const limits = await getUserUsageAndLimits(ownerChatId)
        if (!limits.canCreateReminder) {
          return NextResponse.json({
            error: `❌ Достигнут лимит активных напоминаний (${limits.reminders.max} одновременно на бесплатном тарифе). Выполните или удалите старые напоминания либо оформите Zerf Plus!`,
            limitReached: true,
          }, { status: 403 })
        }
      }
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
    notifyDataChanged(ownerChatId, 'tasks')
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
      const goal = await updateGoal(id, updates, ownerChatId)
      notifyDataChanged(ownerChatId, 'goals')
      return NextResponse.json(serialize({ success: true, goal }))
    }

    // Update note by ID
    if (body.id && (body.itemType === 'note' || body.type === 'note')) {
      const { id, itemType, type, ...updates } = body
      const note = await updateNote(id, updates, ownerChatId)
      notifyDataChanged(ownerChatId, 'notes')
      return NextResponse.json(serialize({ success: true, note }))
    }

    // Update habit by ID
    if (body.id && (body.itemType === 'habit' || body.type === 'habit')) {
      const { id, itemType, type, ...updates } = body
      const habit = await updateHabit(id, updates, ownerChatId)
      notifyDataChanged(ownerChatId, 'habits')
      return NextResponse.json(serialize({ success: true, habit }))
    }

    // Fuzzy completion by title
    if (body.action === 'complete' && body.targetTitle) {
      const completed = await completeTaskByTitle(body.targetTitle, ownerChatId)
      if (!completed) {
        return NextResponse.json({ error: 'No matching task found', notFound: true }, { status: 404 })
      }
      notifyDataChanged(ownerChatId, 'tasks')
      return NextResponse.json(serialize({ success: true, task: completed, action: 'completed' }))
    }

    // Mark reminder sent
    if (body.reminderId) {
      await markReminderSent(body.reminderId, ownerChatId)
      return NextResponse.json({ success: true })
    }

    // Update task by ID
    if (body.id) {
      const { id, ...updates } = body
      const task = await updateTask(id, updates, ownerChatId)
      notifyDataChanged(ownerChatId, 'tasks')
      return NextResponse.json(serialize({ success: true, task }))
    }

    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('access denied')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
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

    if (type === 'note') await deleteNote(id, ownerChatId)
    else if (type === 'goal') await deleteGoal(id, ownerChatId)
    else if (type === 'habit') await deleteHabit(id, ownerChatId)
    else await deleteTask(id, ownerChatId)

    notifyDataChanged(ownerChatId, 'all')
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
