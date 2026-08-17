import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { GROQ_CHAT_MODEL } from '@/lib/config'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { callGroqChatCompletion } from '@/lib/backend/groq-pool'

function getDayOfWeek(date: Date) {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
  return days[date.getDay()]
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  }

  const cid = BigInt(authUser.chatId)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  try {
    const tasks = await prisma.task.findMany({
      where: {
        ownerChatId: cid,
        OR: [
          { createdAt: { gte: sevenDaysAgo } },
          { completedAt: { gte: sevenDaysAgo } },
        ]
      }
    })

    const notes = await prisma.note.findMany({
      where: {
        ownerChatId: cid,
        createdAt: { gte: sevenDaysAgo }
      }
    })

    const goals = await prisma.goal.findMany({
      where: {
        ownerChatId: cid,
        updatedAt: { gte: sevenDaysAgo }
      }
    })

    const tasksCreated = tasks.filter(t => new Date(t.createdAt) >= sevenDaysAgo).length
    
    const completedTasks = tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo)
    const tasksCompleted = completedTasks.length

    const notesCreated = notes.length
    const goalsUpdated = goals.length

    const daysCount: Record<string, number> = {}
    for (const t of completedTasks) {
      if (t.completedAt) {
        const day = getDayOfWeek(new Date(t.completedAt))
        daysCount[day] = (daysCount[day] || 0) + 1
      }
    }

    let mostProductiveDay = 'Нет данных'
    let max = -1
    for (const [day, count] of Object.entries(daysCount)) {
      if (count > max) {
        max = count
        mostProductiveDay = day
      }
    }

    const stats = {
      tasksCompleted,
      tasksCreated,
      notesCreated,
      goalsUpdated,
      mostProductiveDay
    }

    let aiAnalysis = 'Анализ недоступен. Продолжайте в том же духе!'
    
    try {
      const prompt = `Ты продуктивный ассистент Zerf. Напиши краткий (3-4 предложения) подбадривающий анализ недели пользователя на основе этих данных. 
Создано задач: ${tasksCreated}
Завершено задач: ${tasksCompleted}
Создано заметок: ${notesCreated}
Обновлено целей: ${goalsUpdated}
Самый продуктивный день: ${mostProductiveDay}
Никаких списков, просто текст.`

      const result = await callGroqChatCompletion({
        model: GROQ_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      })
      if (result.content?.trim()) {
        aiAnalysis = result.content.trim()
      }
    } catch (e) {
      console.error('Groq weekly report error:', e)
    }

    return NextResponse.json({ stats, aiAnalysis, generatedAt: new Date().toISOString() })

  } catch (err) {
    console.error('Weekly report error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
