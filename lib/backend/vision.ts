import { Buffer } from 'buffer'
import { callGroqChatCompletion } from './groq-pool'

export interface VisionExtractedTask {
  title: string
  description?: string
  dueDate?: string
  dueTime?: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  subtasks?: string[]
  tags?: string[]
}

export async function extractTasksFromImageWithGroq(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg'
): Promise<VisionExtractedTask[]> {
  const base64Image = imageBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Image}`
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const currentDayOfWeek = now.getDay() // 0=Sunday, 1=Monday...

  const prompt =
    `Ты — интеллектуальный OCR и Vision AI планировщика Zerf AI. Проанализируй изображение (это может быть скриншот школьного расписания уроков, электронного дневника (МЭШ/Дневник.ру), расписания звонков/пар, фото листа с уроками, рукописный чек-лист, таблица или документ) и извлеки ВСЕ задачи, уроки и события.\n\n` +
    `Сегодняшняя дата: ${todayStr} (день недели: ${currentDayOfWeek}).\n\n` +
    `══════════════════════════════════════════\n` +
    `📚 СПЕЦИАЛЬНЫЕ ПРАВИЛА ДЛЯ ШКОЛЬНОГО РАСПИСАНИЯ И УРОКОВ:\n` +
    `══════════════════════════════════════════\n` +
    `1. Если на фото расписание уроков на один или несколько дней (Понедельник, Вторник, Среда, Четверг, Пятница, Суббота):\n` +
    `   - Вычисли точную дату YYYY-MM-DD для каждого дня недели относительно текущей недели или ближайшей будущей недели!\n` +
    `   - Для каждого урока создай задачу с номером и предметом: например "1. Алгебра", "2. Русский язык", "3. Физика", "4. История", "5. Литература".\n` +
    `   - Если указано время урока или звонков (например 08:30-09:15), запиши его в "dueTime" в формате диапазона "08:30 - 09:15" или начала "08:30"!\n` +
    `   - Если в описании есть кабинет или домашнее задание — добавь их в "description".\n` +
    `   - В "tags" ОБЯЗАТЕЛЬНО укажи: ["учеба", "школа", "расписание"].\n` +
    `   - Ни в коем случае НЕ трогай и НЕ удаляй праздники или дни рождения.\n\n` +
    `2. Если на фото общий список дел, чек-лист или записка:\n` +
    `   - Извлеки каждый пункт как отдельную задачу с понятным заголовком, дедлайном и приоритетом.\n\n` +
    `Верни строго JSON объект:\n` +
    `{\n` +
    `  "tasks": [\n` +
    `    {\n` +
    `      "title": "1. Алгебра (каб. 204)",\n` +
    `      "description": "Школьный урок из расписания",\n` +
    `      "dueDate": "YYYY-MM-DD",\n` +
    `      "dueTime": "08:30 - 09:15",\n` +
    `      "priority": "medium",\n` +
    `      "tags": ["учеба", "школа", "расписание"],\n` +
    `      "subtasks": []\n` +
    `    }\n` +
    `  ]\n` +
    `}`

  try {
    const result = await callGroqChatCompletion({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2500,
      fallbackModels: ['llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview'],
    })

    const parsed = JSON.parse(result.content || '{}')
    if (Array.isArray(parsed.tasks)) {
      return parsed.tasks
    }
    return []
  } catch (err) {
    console.error('Groq Vision error:', err)
    throw new Error('Не удалось распознать изображение через Vision AI')
  }
}
