/**
 * Next.js API Route — AI Schedule & Lesson Group Generator
 * POST /api/schedule/ai-generate
 */
import { NextRequest, NextResponse } from 'next/server'
import { callGroqChatCompletion, groqPool, getHuggingFaceTokens } from '@/lib/backend/groq-pool'
import { GROQ_API_KEY } from '@/lib/config'
import { getAuthenticatedUser } from '@/lib/backend/auth'

const SYSTEM_PROMPT = `Ты — специализированный интеллектуальный генератор расписания и групп уроков/занятий для приложения Zerf (zerph).
Твоя задача — понять ЛЮБУЮ, даже самую короткую, разговорную, неполную или обобщённую формулировку пользователя и сгенерировать готовую группу расписания.

ПРИМЕРЫ ФОРМУЛИРОВОК, КОТОРЫЕ ТЫ ОБЯЗАН ПОНИМАТЬ:
1. «сделай группу расписание для понедельника» -> создаёт группу "Понедельник" или "Расписание понедельника", активен день 1 (Понедельник) со стандартными блоками занятий (08:30-09:15, 09:25-10:10, 10:20-11:05, 11:20-12:05).
2. «обобщи расписание отдельным словом» -> создаёт общую группу "Расписание" со сбалансированными днями.
3. «пары во вторник и четверг с 9 утра: матан, физика, инглиш» -> активны дни 2 и 4 с указанными парами.
4. «тренировки пн ср пт в 19:00 бокс» -> активны дни 1, 3, 5 с уроком "Бокс" 19:00-20:30, иконка Dumbbell.
5. «школа 5 уроков на будни» -> активны дни 1-5 с 5 уроками каждый день.

ВЫВОД ТОЛЬКО В ФОРМАТЕ СТРОГОГО JSON:
{
  "understood": true | false,
  "replyMessage": "Понятное вежливое объяснение на русском языке (например: ✨ Создал группу «Расписание понедельника» с 4 уроками.)",
  "group": {
    "title": "Название группы (например: Понедельник, Школа, Университет, Тренировки)",
    "description": "Краткое описание расписания",
    "icon": "GraduationCap" | "BookOpen" | "Activity" | "Dumbbell" | "Palette" | "Music" | "Trophy" | "Sparkles",
    "color": "#f59e0b" | "#10b981" | "#6366f1" | "#3b82f6" | "#8b5cf6" | "#ec4899" | "#ef4444" | "#06b6d4",
    "days": [
      {
        "dayOfWeek": 1,
        "enabled": true,
        "lessons": [
          {
            "id": "les_1",
            "name": "Название предмета/занятия",
            "startTime": "08:30",
            "endTime": "09:15",
            "room": "каб. 201",
            "teacher": "Преподаватель"
          }
        ]
      }
    ]
  }
}

ПРАВИЛО НЕПОНИМАНИЯ:
Если пользователь ввёл полную бессмыслицу или случайный набор букв (например: «аывжлао», «asdfgh»), установи:
"understood": false,
"group": null,
"replyMessage": "Не совсем понял, какое расписание требуется составить. Укажите день недели, список предметов или время занятий (например: «Сделай группу расписание для понедельника: 4 урока» или «Тренировки вт и чт в 19:00»)."
`

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const prompt = (body.prompt || '').trim()

    if (!prompt) {
      return NextResponse.json({
        understood: false,
        replyMessage: 'Пожалуйста, опишите, какое расписание или группу вы хотите создать.',
        group: null,
      })
    }

    const groqApiKey = req.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY || GROQ_API_KEY
    const hasKeys = groqPool.getKeysCount() > 0 || getHuggingFaceTokens().length > 0 || Boolean(groqApiKey)

    if (!hasKeys) {
      return NextResponse.json({
        error: 'API ключ не настроен',
      }, { status: 400 })
    }

    const completion = await callGroqChatCompletion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      apiKey: groqApiKey,
    })

    const raw = completion.content || '{}'
    let data: any = {}
    try {
      data = JSON.parse(raw)
    } catch {
      data = {
        understood: false,
        replyMessage: 'Не удалось обработать ответ нейросети. Попробуйте сформулировать запрос иначе.',
        group: null,
      }
    }

    // Ensure IDs and structure integrity if understood
    if (data.understood && data.group) {
      const nowId = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
      data.group.id = nowId
      data.group.isActive = true
      data.group.createdAt = new Date().toISOString()
      data.group.updatedAt = new Date().toISOString()

      // Ensure all 7 days exist in array
      const allDays = [1, 2, 3, 4, 5, 6, 7]
      const providedDays = Array.isArray(data.group.days) ? data.group.days : []
      data.group.days = allDays.map(dayNum => {
        const found = providedDays.find((d: any) => d.dayOfWeek === dayNum)
        if (found) {
          return {
            dayOfWeek: dayNum,
            enabled: Boolean(found.enabled),
            lessons: Array.isArray(found.lessons)
              ? found.lessons.map((l: any, idx: number) => ({
                  id: l.id || `les_${dayNum}_${idx + 1}_${Date.now()}`,
                  name: l.name || `Урок ${idx + 1}`,
                  startTime: l.startTime || '08:30',
                  endTime: l.endTime || '09:15',
                  room: l.room || '',
                  teacher: l.teacher || '',
                }))
              : [],
          }
        }
        return {
          dayOfWeek: dayNum,
          enabled: false,
          lessons: [],
        }
      })
    }

    return NextResponse.json({
      success: true,
      understood: Boolean(data.understood),
      replyMessage: data.replyMessage || (data.understood ? '✨ Расписание успешно создано!' : 'Не совсем понял запрос.'),
      group: data.group || null,
    })
  } catch (err: any) {
    console.error('[Schedule AI Generate API] Error:', err)
    return NextResponse.json({
      understood: false,
      replyMessage: 'Произошла ошибка при обработке запроса. Попробуйте еще раз.',
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
