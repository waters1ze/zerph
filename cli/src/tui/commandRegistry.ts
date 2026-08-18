import { setScreen, updateReplState, type ScreenName } from './state.js'
import { handleAddCommand } from './commands/add.js'
import { handleDoneCommand } from './commands/done.js'
import { handleNoteCommand } from './commands/note.js'
import { handleChatCommand } from './commands/chat.js'
import type { ZerfCredentials, ZerfConfig } from '../api.js'
import { GLYPH } from './theme.js'

export type PlanTier = 'free' | 'plus' | 'pro' | 'corp'

export const PLAN_RANKS: Record<PlanTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
  corp: 3,
}

export function isPlanAllowed(userPlan: string = 'free', minPlan: PlanTier = 'free'): boolean {
  const normalizedUserPlan = (userPlan || 'free').toLowerCase() as PlanTier
  const userRank = PLAN_RANKS[normalizedUserPlan] ?? 0
  const requiredRank = PLAN_RANKS[minPlan] ?? 0
  return userRank >= requiredRank
}

export interface CommandContext {
  creds: ZerfCredentials
  config: ZerfConfig
  userData: any
  onRefresh?: () => void
  rawInput: string
  exitApp?: () => void
}

export interface CommandResult {
  ok: boolean
  message: string
  details?: string[]
}

export interface CommandDefinition {
  id: string
  name: string
  aliases: string[]
  description: string
  category: 'general' | 'tasks' | 'productivity' | 'system' | 'ai' | 'team'
  minPlan: PlanTier
  glyph: string
  usage?: string
  screen?: ScreenName
  handler?: (args: string, ctx: CommandContext) => Promise<CommandResult | void> | CommandResult | void
}

export const COMMAND_REGISTRY: CommandDefinition[] = [
  // ── Navigation & Screens ──
  {
    id: 'settings',
    name: '/settings',
    aliases: ['settings', 'config', 'настройки', 'параметры', 'сеттингс', 'опции'],
    description: 'Настройки профиля, параметров и подключений',
    category: 'system',
    minPlan: 'free',
    glyph: '⚙',
    usage: '/settings',
    screen: 'settings',
  },
  {
    id: 'today',
    name: '/today',
    aliases: ['today', 'сегодня', 'задачи_сегодня', 'таски'],
    description: 'Задачи, привычки и цели на сегодня с таймером',
    category: 'tasks',
    minPlan: 'free',
    glyph: '❖',
    usage: '/today',
    screen: 'today',
  },
  {
    id: 'cal',
    name: '/cal',
    aliases: ['cal', 'calendar', 'календарь', 'расписание', 'неделя'],
    description: 'Календарь задач по дням недели с расписанием',
    category: 'tasks',
    minPlan: 'free',
    glyph: '◫',
    usage: '/cal',
    screen: 'cal',
  },
  {
    id: 'friends',
    name: '/friends',
    aliases: ['friends', 'друзья', 'команда', 'тиммейты', 'invite'],
    description: 'Список команды/друзей и ссылка-приглашение',
    category: 'team',
    minPlan: 'free',
    glyph: '◈',
    usage: '/friends',
    screen: 'friends',
  },
  {
    id: 'limits',
    name: '/limits',
    aliases: ['limits', 'лимиты', 'квоты', 'квота', 'статус_лимитов'],
    description: 'Статус лимитов и квот на текущие сутки',
    category: 'system',
    minPlan: 'free',
    glyph: '●',
    usage: '/limits',
    screen: 'limits',
  },
  {
    id: 'stats',
    name: '/stats',
    aliases: ['stats', 'статистика', 'аналитика', 'отчет', 'стата'],
    description: 'Аналитика продуктивности за 7 дней',
    category: 'productivity',
    minPlan: 'plus',
    glyph: '●',
    usage: '/stats',
    screen: 'stats',
  },
  {
    id: 'help',
    name: '/help',
    aliases: ['help', 'помощь', 'справка', 'команды', '?', 'хелп'],
    description: 'Справка по всем возможностям и горячим клавишам',
    category: 'general',
    minPlan: 'free',
    glyph: '?',
    usage: '/help',
    screen: 'help',
  },
  {
    id: 'ext',
    name: '/ext',
    aliases: ['ext', 'extensions', 'расширения', 'плагины', 'маркет'],
    description: 'Каталог расширений и маркетплейс Zerf Ext',
    category: 'system',
    minPlan: 'plus',
    glyph: '◈',
    usage: '/ext',
    screen: 'extensions',
  },
  {
    id: 'model',
    name: '/model',
    aliases: ['model', 'модель', 'модели', 'ai', 'нейросеть', 'выбор_модели'],
    description: 'Выбор нейросети (GPT-OSS, Compound) или CLI агента',
    category: 'ai',
    minPlan: 'free',
    glyph: '◈',
    usage: '/model',
    screen: 'model',
  },

  // ── Actions & Handlers ──
  {
    id: 'focus',
    name: '/focus',
    aliases: ['focus', 'фокус', 'помодоро', 'таймер', 'pomodoro'],
    description: 'Сфера концентрации Pomodoro с таймером',
    category: 'productivity',
    minPlan: 'free',
    glyph: '⊘',
    usage: '/focus [минуты]',
    handler: (args) => {
      const parsedMins = parseInt(args, 10)
      const minutes = !isNaN(parsedMins) && parsedMins > 0 ? parsedMins : 25
      updateReplState({ screen: 'focus', focusMinutes: minutes })
    },
  },
  {
    id: 'add',
    name: '/add',
    aliases: ['add', 'добавить', 'создать', 'новая_задача', '+'],
    description: 'Создать задачу с умным распознаванием даты',
    category: 'tasks',
    minPlan: 'free',
    glyph: '▸',
    usage: '/add <текст задачи>',
    handler: async (args, ctx) => {
      if (!args) {
        return { ok: false, message: 'Укажите текст задачи. Пример: /add Созвон в 15:00' }
      }
      return await handleAddCommand(`/add ${args}`, ctx.creds)
    },
  },
  {
    id: 'done',
    name: '/done',
    aliases: ['done', 'готов', 'выполнено', 'закрыть', 'чек'],
    description: 'Завершить задачу по названию (нечёткий поиск)',
    category: 'tasks',
    minPlan: 'free',
    glyph: '✔',
    usage: '/done <название задачи>',
    handler: async (args, ctx) => {
      if (!args) {
        return { ok: false, message: 'Укажите название задачи для завершения: /done <текст>' }
      }
      const tasks = ctx.userData?.tasks || []
      return await handleDoneCommand(`/done ${args}`, tasks, ctx.creds)
    },
  },
  {
    id: 'note',
    name: '/note',
    aliases: ['note', 'заметка', 'записать', 'мысль', 'памятка'],
    description: 'Быстрая заметка в базу знаний Zerf Note',
    category: 'tasks',
    minPlan: 'free',
    glyph: '≡',
    usage: '/note <текст заметки>',
    handler: async (args, ctx) => {
      if (!args) {
        return { ok: false, message: 'Укажите текст заметки. Пример: /note Идея нового модуля' }
      }
      return await handleNoteCommand(`/note ${args}`, ctx.creds)
    },
  },
  {
    id: 'tasks',
    name: '/tasks',
    aliases: ['tasks', 'задачи', 'список_задач', 'все_задачи'],
    description: 'Полный список всех активных и завершенных задач',
    category: 'tasks',
    minPlan: 'free',
    glyph: '❖',
    usage: '/tasks',
    handler: (_args, ctx) => {
      const tasks = ctx.userData?.tasks || []
      if (tasks.length === 0) {
        return { ok: true, message: 'Задач пока нет. Добавьте первую через /add <текст>' }
      }
      const pending = tasks.filter((t: any) => t.status !== 'done')
      const done = tasks.filter((t: any) => t.status === 'done')
      const lines: string[] = []
      lines.push(`Активные задачи (${pending.length}):`)
      pending.slice(0, 10).forEach((t: any) => {
        const due = t.dueDate ? ` [на ${t.dueDate}${t.dueTime ? ` в ${t.dueTime}` : ''}]` : ''
        lines.push(`  • [◌] ${t.title}${due}`)
      })
      if (done.length > 0) {
        lines.push(`Завершенные задачи (${done.length}):`)
        done.slice(0, 5).forEach((t: any) => {
          lines.push(`  • [✔] ${t.title}`)
        })
      }
      return {
        ok: true,
        message: `❖ База задач Zerf (${tasks.length} всего):`,
        details: lines,
      }
    },
  },
  {
    id: 'notes',
    name: '/notes',
    aliases: ['notes', 'заметки', 'все_заметки'],
    description: 'Все сохранённые заметки и конспекты',
    category: 'tasks',
    minPlan: 'free',
    glyph: '≡',
    usage: '/notes',
    handler: (_args, ctx) => {
      const notes = ctx.userData?.notes || []
      if (notes.length === 0) {
        return { ok: true, message: 'Заметок пока нет. Создайте через /note <текст>' }
      }
      const lines = notes.slice(0, 10).map((n: any) => `• ≡ ${n.title || n.body} (${n.createdAt ? n.createdAt.slice(0, 10) : 'сегодня'})`)
      return {
        ok: true,
        message: `≡ Сохранённые заметки (${notes.length}):`,
        details: lines,
      }
    },
  },
  {
    id: 'goals',
    name: '/goals',
    aliases: ['goals', 'цели', 'все_цели'],
    description: 'Трекинг долгосрочных целей и шкала прогресса',
    category: 'productivity',
    minPlan: 'plus',
    glyph: '◈',
    usage: '/goals',
    handler: (_args, ctx) => {
      const goals = ctx.userData?.goals || []
      if (goals.length === 0) {
        return { ok: true, message: 'Цели пока не заданы.' }
      }
      const lines = goals.map((g: any) => {
        const prog = typeof g.progress === 'number' ? g.progress : 50
        return `• ◈ ${g.title.padEnd(24)} [${'▓'.repeat(Math.round(prog / 12.5))}${'░'.repeat(8 - Math.round(prog / 12.5))}] ${prog}%`
      })
      return {
        ok: true,
        message: `◈ Долгосрочные цели (${goals.length}):`,
        details: lines,
      }
    },
  },
  {
    id: 'habits',
    name: '/habits',
    aliases: ['habits', 'привычки', 'трекер_привычек'],
    description: 'Привычки, прогресс-бары и серии дней',
    category: 'productivity',
    minPlan: 'plus',
    glyph: '●',
    usage: '/habits',
    handler: (_args, ctx) => {
      const habits = ctx.userData?.habits || []
      if (habits.length === 0) {
        return { ok: true, message: 'Привычки пока не настроены.' }
      }
      const lines = habits.map((hb: any) => {
        const cur = hb.currentStreak || hb.progress || 3
        const target = hb.targetDays || 10
        const ratio = Math.max(0, Math.min(1, cur / target))
        const filled = Math.round(ratio * 8)
        return `• ● ${hb.title.padEnd(18)} [${'▓'.repeat(filled)}${'░'.repeat(8 - filled)}] ${cur}/${target} · стрик ${cur} дн.`
      })
      return {
        ok: true,
        message: `● Трекер привычек (${habits.length}):`,
        details: lines,
      }
    },
  },
  {
    id: 'chat',
    name: '/chat',
    aliases: ['chat', 'чат', 'спросить', 'сообщение', 'поручить'],
    description: 'Диалог с друзьями / поручение задачи',
    category: 'team',
    minPlan: 'free',
    glyph: '◈',
    usage: '/chat [@username] <текст>',
    handler: async (args, ctx) => {
      const friends = ctx.userData?.friends || []
      const activeModel = ctx.config?.model || 'openai/gpt-oss-120b'
      return await handleChatCommand(`/chat ${args}`, ctx.creds, activeModel, friends)
    },
  },
]

/**
 * Normalizes user input and matches it against the command registry.
 * Supports commands with or without leading '/', Russian aliases, and argument splitting.
 */
export function matchCommand(raw: string): { command: CommandDefinition; args: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const firstSpaceIdx = trimmed.indexOf(' ')
  const leadWord = firstSpaceIdx === -1 ? trimmed : trimmed.slice(0, firstSpaceIdx)
  const args = firstSpaceIdx === -1 ? '' : trimmed.slice(firstSpaceIdx + 1).trim()

  const normalizedLead = leadWord.toLowerCase().replace(/^\//, '')

  for (const cmd of COMMAND_REGISTRY) {
    const cmdNameNoSlash = cmd.name.toLowerCase().replace(/^\//, '')
    if (normalizedLead === cmdNameNoSlash) {
      return { command: cmd, args }
    }
    for (const alias of cmd.aliases) {
      if (normalizedLead === alias.toLowerCase().replace(/^\//, '') || leadWord.toLowerCase() === alias.toLowerCase()) {
        return { command: cmd, args }
      }
    }
  }

  return null
}

/**
 * Searches for command suggestions matching query.
 */
export function getCommandSuggestions(query: string, userPlan: string = 'free'): CommandDefinition[] {
  const normalized = query.trim().toLowerCase().replace(/^\//, '')
  if (!normalized) {
    return COMMAND_REGISTRY
  }

  return COMMAND_REGISTRY.filter(cmd => {
    const nameMatch = cmd.name.toLowerCase().replace(/^\//, '').startsWith(normalized)
    const idMatch = cmd.id.toLowerCase().startsWith(normalized)
    const aliasMatch = cmd.aliases.some(a => a.toLowerCase().replace(/^\//, '').startsWith(normalized))
    return nameMatch || idMatch || aliasMatch
  })
}
