import { Buffer } from 'buffer'
import { callGroqChatCompletion } from './groq-pool'

export interface VisionExtractedTask {
  title: string
  description?: string
  dueDate?: string
  dueTime?: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  subtasks?: string[]
}

export async function extractTasksFromImageWithGroq(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg'
): Promise<VisionExtractedTask[]> {
  const base64Image = imageBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Image}`
  const todayStr = new Date().toISOString().slice(0, 10)

  const prompt =
    `Ты — интеллектуальный OCR и Vision AI планировщика Zerf AI. Проанализируй изображение (это может быть скриншот чата, рукописный чек-лист, таблица расписания, календарь или фото документа) и извлеки ВСЕ задачи, дела, дедлайны и встречи.\n\n` +
    `Сегодняшняя дата: ${todayStr}.\n\n` +
    `Верни строго JSON объект с массивом задач:\n` +
    `{\n` +
    `  "tasks": [\n` +
    `    {\n` +
    `      "title": "Название задачи",\n` +
    `      "description": "Пояснение или детали (если есть)",\n` +
    `      "dueDate": "YYYY-MM-DD",\n` +
    `      "dueTime": "HH:MM",\n` +
    `      "priority": "urgent" | "high" | "medium" | "low",\n` +
    `      "subtasks": ["подпункт 1", "подпункт 2"]\n` +
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
      temperature: 0.2,
      max_tokens: 1000,
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
