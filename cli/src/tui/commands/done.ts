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

    const streak = 5 // Default active streak
    return {
      ok: true,
      message: `${GLYPH.mascotJoy} Задача «${match.title}» закрыта! Стрик: ${streak} дн.`,
      details: [`Выполнено в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`],
    }
  } catch (err: any) {
    return {
      ok: false,
      message: `${GLYPH.cancel} Ошибка завершения задачи: ${err.message}`,
    }
  }
}
