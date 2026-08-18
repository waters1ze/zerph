import { mutateItem, type ZerfCredentials } from '../../api.js'
import { GLYPH } from '../theme.js'
import { fuzzyMatch } from '../utils.js'

export async function handleDoneCommand(
  rawText: string,
  tasks: any[],
  creds: ZerfCredentials
): Promise<{ ok: boolean; message: string; details?: string[] }> {
  const query = rawText.replace(/^\/done\s*/i, '').trim()
  if (!query) {
    return { ok: false, message: 'Укажите название задачи. Пример: /done созвон' }
  }

  // Find incomplete tasks matching query
  const pendingTasks = tasks.filter((t: any) => t.status !== 'done')
  const match = pendingTasks.find((t: any) => fuzzyMatch(query, t.title))

  if (!match) {
    return {
      ok: false,
      message: `Не нашёл «${query}». /add «${query}» — создать?`,
    }
  }

  try {
    await mutateItem(creds, {
      action: 'toggle_task',
      id: match.id,
    })

    // Calculate real streak
    const completedDates = new Set<string>()
    tasks.forEach(t => {
      if (t.status === 'done' || t.id === match.id) {
        if (t.completedAt) {
          try { completedDates.add(new Date(t.completedAt).toISOString().slice(0, 10)) } catch {}
        }
        if (t.dueDate) completedDates.add(String(t.dueDate).slice(0, 10))
      }
    })
    completedDates.add(new Date().toISOString().slice(0, 10))

    let streak = 0
    let cur = new Date()
    while (true) {
      const dStr = cur.toISOString().slice(0, 10)
      if (completedDates.has(dStr)) {
        streak++
        cur = new Date(cur.getTime() - 86400000)
      } else {
        break
      }
    }

    const realStreak = Math.max(1, streak)
    return {
      ok: true,
      message: `${GLYPH.mascotJoy} Задача «${match.title}» закрыта! Стрик: ${realStreak} дн.`,
      details: [`Выполнено в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`],
    }
  } catch (err: any) {
    return {
      ok: false,
      message: `${GLYPH.cancel} Ошибка завершения задачи: ${err.message}`,
    }
  }
}
