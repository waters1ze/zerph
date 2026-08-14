import { NextRequest, NextResponse } from 'next/server'
import { extractTasksFromImageWithGroq } from '@/lib/backend/vision'
import { createTask } from '@/lib/backend/db'
import { Buffer } from 'buffer'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const chatId = formData.get('chatId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
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
        ownerChatId: chatId ? BigInt(chatId) : null,
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
