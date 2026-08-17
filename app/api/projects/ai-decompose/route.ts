/**
 * POST /api/projects/ai-decompose
 * AI Project Decomposition — generates a tree of milestone tasks and subtasks for a project.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { callGroqChatCompletion } from '@/lib/backend/groq-pool'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }
    const chatId = BigInt(authUser.chatId)

    const body = await req.json().catch(() => ({}))
    const { projectId, customPrompt } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const project = await (prisma as any).projectDB.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    // Verify access
    const isOwner = project.ownerChatId === chatId
    const isMember = (project.memberIds || []).includes(chatId)
    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    const systemPrompt = `Ты — профессиональный ИИ-архитектор проектов и Scrum-мастер.
Твоя цель: разбить проект на 4–6 ключевых взаимосвязанных этапов/задач с подзадачами и дедлайнами.

Название проекта: "${project.title}"
Описание проекта: "${project.description || 'Не указано'}"
${customPrompt ? `Дополнительные пожелания: "${customPrompt}"` : ''}

ОТВЕТЬ ИСКЛЮЧИТЕЛЬНО ВАЛИДНЫМ JSON СЛЕДУЮЩЕГО ФОРМАТА (БЕЗ MARKDOWN И ЛИШНЕГО ТЕКСТА):
{
  "tasks": [
    {
      "title": "Краткое название этапа 1",
      "description": "Понятное описание действий",
      "priority": "high",
      "daysOffset": 2,
      "subtasks": ["Подзадача 1", "Подзадача 2"],
      "children": [
        {
          "title": "Дочерняя задача 1.1",
          "description": "Детали выполнения",
          "priority": "medium",
          "daysOffset": 3
        }
      ]
    }
  ]
}

Приоритеты: 'urgent', 'high', 'medium', 'low'.
daysOffset: смещение в днях от сегодняшнего дня (от 1 до 14).`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: 'Создай четкую структуру задач для этого проекта.' }
    ]

    const responseObj = await callGroqChatCompletion({
      messages,
      temperature: 0.3,
      max_tokens: 1500,
    })
    const responseText = responseObj.content || ''

    // Parse JSON
    let parsed: { tasks?: any[] } = {}
    try {
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // Fallback simple extraction
      const match = responseText.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      }
    }

    const generatedTasks = parsed.tasks || []
    if (generatedTasks.length === 0) {
      return NextResponse.json({ error: 'ИИ не смог сформировать задачи' }, { status: 500 })
    }

    const createdIds: string[] = []
    const today = new Date()

    // Helper to calculate date string
    const getDateStr = (offsetDays: number = 2) => {
      const d = new Date(today)
      d.setDate(d.getDate() + offsetDays)
      return d.toISOString().slice(0, 10)
    }

    // Insert root tasks and their children
    for (const t of generatedTasks) {
      const rootTask = await prisma.task.create({
        data: {
          title: t.title?.trim() || 'Этап проекта',
          description: t.description?.trim() || null,
          priority: ['urgent', 'high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
          status: 'todo',
          dueDate: getDateStr(t.daysOffset || 2),
          dueTime: '12:00',
          projectId: project.id,
          parentTaskId: null,
          tags: ['AI-План', project.title.slice(0, 15)],
          subtasks: Array.isArray(t.subtasks)
            ? t.subtasks.map((st: string, idx: number) => ({ id: `st_${Date.now()}_${idx}`, title: String(st), done: false }))
            : [],
          ownerChatId: chatId,
          authorChatId: chatId,
        }
      })
      createdIds.push(rootTask.id)

      if (Array.isArray(t.children)) {
        for (const child of t.children) {
          const childTask = await prisma.task.create({
            data: {
              title: child.title?.trim() || 'Подзадача',
              description: child.description?.trim() || null,
              priority: ['urgent', 'high', 'medium', 'low'].includes(child.priority) ? child.priority : 'medium',
              status: 'todo',
              dueDate: getDateStr(child.daysOffset || (t.daysOffset ? t.daysOffset + 2 : 4)),
              dueTime: '15:00',
              projectId: project.id,
              parentTaskId: rootTask.id,
              tags: ['AI-План'],
              subtasks: [],
              ownerChatId: chatId,
              authorChatId: chatId,
            }
          })
          createdIds.push(childTask.id)
        }
      }
    }

    // Fetch all updated tasks for this project
    const allProjectTasks = await prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      count: createdIds.length,
      tasks: allProjectTasks.map(t => ({
        ...t,
        ownerChatId: t.ownerChatId ? String(t.ownerChatId) : null,
        authorChatId: t.authorChatId ? String(t.authorChatId) : null,
      }))
    })
  } catch (err: any) {
    console.error('Error in /api/projects/ai-decompose:', err)
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}
