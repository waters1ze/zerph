import { NextRequest, NextResponse } from 'next/server'
import { extractTasksFromImageWithGroq } from '@/lib/backend/vision'
import { createTask, getUserUsageAndLimits } from '@/lib/backend/db'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { incrementDailyCount, COUNTERS } from '@/lib/backend/plans'
import { Buffer } from 'buffer'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }
    const chatId = authUser.chatId

    // Photo recognition is a Plus+ feature (Plus: 10/day, Pro/Corp: unlimited)
    const limits = await getUserUsageAndLimits(chatId)
    if (!limits.canUsePhoto) {
      return NextResponse.json({
        error: limits.photos.max === 0
          ? '❌ Распознавание задач по фото доступно на тарифе Plus (99 ₽/мес) или Pro. Оформите подписку в настройках!'
          : `❌ Дневной лимит распознаваний по фото исчерпан (${limits.photos.max} в день на Plus). На Pro — безлимит!`,
        limitReached: true,
      }, { status: 403 })
    }
    await incrementDailyCount(COUNTERS.photo, chatId)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Файл слишком большой (максимум 15 МБ)' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'image/jpeg'

    const extracted = await extractTasksFromImageWithGroq(buffer, mimeType)

    const createdTasks = []
    for (const t of extracted) {
      const created = await createTask({
        title: t.title,
        description: t.description || 'Распознано из скриншота',
        priority: t.priority || 'medium',
        dueDate: t.dueDate || new Date().toISOString().slice(0, 10),
        dueTime: t.dueTime || undefined,
        tags: ['фото', 'ocr'],
        aiGenerated: true,
        ownerChatId: BigInt(authUser.chatId),
        subtasks: (t.subtasks || []).map((st, i) => ({
          id: `st_vis_${i}_${Date.now()}`,
          title: st,
          done: false,
        }))
      })
      if (created) createdTasks.push(created)
    }

    return NextResponse.json({
      ok: true,
      tasks: createdTasks,
      count: createdTasks.length
    })
  } catch (err: unknown) {
    console.error('Vision API route error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
