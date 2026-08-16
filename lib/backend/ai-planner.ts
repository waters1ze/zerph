/**
 * AI Day Planner — distributes today's tasks across time slots 09:00–19:00.
 * Uses Groq (fast model) to produce a JSON schedule respecting task priorities,
 * existing time assignments, estimated durations, and workday boundaries.
 */

import { callGroqChatCompletion } from './groq-pool'

export interface TaskForPlanning {
  id: string
  title: string
  priority: string          // 'high' | 'medium' | 'low' | 'urgent'
  dueTime?: string | null   // existing time HH:MM or null
  estimatedMinutes?: number // optional hint
  tags?: string[]
}

export interface PlannedSlot {
  taskId: string
  startTime: string   // HH:MM
  endTime: string     // HH:MM
  dueTime: string     // HH:MM  (= startTime, for setting task.dueTime)
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function sortByPriority(tasks: TaskForPlanning[]) {
  return [...tasks].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
  )
}

export async function generateDayPlan(
  tasks: TaskForPlanning[],
  todayStr: string,           // YYYY-MM-DD
  workdayStart = '09:00',
  workdayEnd   = '19:00'
): Promise<PlannedSlot[]> {
  // Tasks that already have a time are kept, only rearrange the rest
  const unscheduled = tasks.filter(t => !t.dueTime)
  const scheduled   = tasks.filter(t => t.dueTime)

  if (unscheduled.length === 0) {
    // Nothing to plan
    return scheduled.map(t => ({
      taskId: t.id,
      startTime: t.dueTime!,
      endTime: t.dueTime!,
      dueTime: t.dueTime!,
    }))
  }

  const sorted = sortByPriority(unscheduled)

  // Build the existing schedule as context for the AI
  const existingScheduleText = scheduled.length > 0
    ? 'Already scheduled (do NOT move):\n' + scheduled.map(t => `  ${t.dueTime} – ${t.title}`).join('\n')
    : 'No tasks are scheduled yet.'

  const taskList = sorted.map((t, i) =>
    `${i + 1}. [${t.id}] ${t.title} (priority: ${t.priority}${t.estimatedMinutes ? `, ~${t.estimatedMinutes} min` : ''})`
  ).join('\n')

  const systemPrompt = `You are a productivity expert. Given a list of tasks and a workday window, produce a realistic daily schedule.

Rules:
- Schedule tasks in the window ${workdayStart}–${workdayEnd} on ${todayStr}
- Prioritize urgent > high > medium > low
- Each task gets a realistic duration: urgent/high ~30–60 min, medium ~20–45 min, low ~15–30 min
- Add 5–10 min breaks between tasks
- Do NOT overlap slots
- Output ONLY valid JSON — an array of objects with fields: taskId, startTime, endTime
- Times in HH:MM 24h format

${existingScheduleText}`

  const userMessage = `Tasks to schedule:\n${taskList}\n\nReturn JSON array only.`

  try {
    const { content: raw } = await callGroqChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 1024,
    })

    // Extract JSON from the response (might have markdown fences)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in AI response')

    const parsed: Array<{ taskId: string; startTime: string; endTime: string }> = JSON.parse(jsonMatch[0])

    const result: PlannedSlot[] = parsed
      .filter(s => s.taskId && s.startTime && /^\d{2}:\d{2}$/.test(s.startTime))
      .map(s => ({
        taskId:    s.taskId,
        startTime: s.startTime,
        endTime:   s.endTime || s.startTime,
        dueTime:   s.startTime,
      }))

    return result
  } catch (err) {
    console.error('[AI Planner] Error generating day plan:', err)
    // Fallback: simple sequential scheduling starting at workdayStart
    return fallbackSchedule(sorted, workdayStart)
  }
}

function fallbackSchedule(tasks: TaskForPlanning[], startTime: string): PlannedSlot[] {
  const slots: PlannedSlot[] = []
  let [h, m] = startTime.split(':').map(Number)

  for (const t of tasks) {
    const duration = t.priority === 'urgent' || t.priority === 'high' ? 45
      : t.priority === 'medium' ? 30 : 20
    const sTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const eMinutes = h * 60 + m + duration
    const eH = Math.floor(eMinutes / 60)
    const eM = eMinutes % 60
    if (eH >= 20) break // don't schedule past 8pm

    const eTime = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`
    slots.push({ taskId: t.id, startTime: sTime, endTime: eTime, dueTime: sTime })

    // next slot: add duration + 5 min break
    const nextMinutes = eMinutes + 5
    h = Math.floor(nextMinutes / 60)
    m = nextMinutes % 60
  }
  return slots
}
