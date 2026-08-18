import { setScreen, updateReplState, type ScreenName } from './state.js'
import { handleAddCommand } from './commands/add.js'
import { handleDoneCommand } from './commands/done.js'
import { handleNoteCommand } from './commands/note.js'
import { handleChatCommand } from './commands/chat.js'
import { sendAiQuery, type ZerfCredentials, type ZerfConfig } from '../api.js'
import { dispatchCommand } from '../extensions/loader.js'
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
  category: 'general' | 'tasks' | 'productivity' | 'system' | 'ai' | 'team' | 'extension'
  minPlan: PlanTier
  glyph: string
  usage?: string
  screen?: ScreenName
  handler?: (args: string, ctx: CommandContext) => Promise<CommandResult | void> | CommandResult | void
}

export const BASE_COMMAND_REGISTRY: CommandDefinition[] = [
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
 * Generic execution runner for ANY extension created by ANY author or user.
 */
export async function executeExtensionAction(
  ext: any,
  cmd: string,
  args: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const query = args.trim()
  const extTitle = ext.title || ext.name || 'Плагин'

  // If user just typed command without arguments, show friendly extension info & commands
  if (!query) {
    const commandsList = (ext.content?.commands || ext.commands || []).map((c: any) => `• ${c.cmd} — ${c.description || 'Действие'}`)
    const triggers = (ext.triggers || []).join(', ')

    const details: string[] = [
      `• Описание: ${ext.description || 'Пользовательский модуль'}`,
      `• Автор: @${ext.authorName || ext.authorGithub || 'сообщество'}`,
    ]
    if (commandsList.length > 0) {
      details.push('Команды расширения:')
      details.push(...commandsList.map((c: string) => `  ${c}`))
    }
    if (triggers) {
      details.push(`• Ключевые слова: ${triggers}`)
    }
    details.push(`• Использование: ${cmd} <ваш запрос>`)

    return {
      ok: true,
      message: `${ext.icon || '◈'} Расширение: ${extTitle} (v${ext.version || '1.0.0'})`,
      details,
    }
  }

  // 1. Dedicated Search / Entropy AI Engine
  if (ext.id === 'ext_entropy_search' || ext.content?.engine === 'entropy_deep_search') {
    const apiBase = (ctx.creds.serverUrl || 'https://zeprh.vercel.app').replace(/\/$/, '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (ctx.creds.token) headers['x-telegram-auth'] = ctx.creds.token
    if (ctx.creds.chatId) headers['x-telegram-chat-id'] = ctx.creds.chatId

    try {
      const res = await fetch(`${apiBase}/api/entropy/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, mode: 'web' }),
      })
      const searchData = await res.json()

      if (searchData.success && searchData.result) {
        const r = searchData.result
        const details: string[] = []
        details.push(`◈ Маскот: «${r.tikhonyaComment || 'Синтезировал первоисточники [ ˘ ᴗ ˘ ]'}»`)
        if (r.sources && r.sources.length > 0) {
          details.push('─'.repeat(50))
          details.push('📚 Верифицированные первоисточники:')
          r.sources.forEach((s: any) => details.push(`  [${s.id}] ${s.title} (${s.domain})`))
          details.push('─'.repeat(50))
        }
        details.push('')
        r.answer.split('\n').forEach((line: string) => details.push(line))
        if (r.takeaways && r.takeaways.length > 0) {
          details.push('')
          details.push('💡 Главные выводы:')
          r.takeaways.forEach((t: string) => details.push(`  ◈ ${t}`))
        }

        return {
          ok: true,
          message: `🔮 Entropy AI: «${query}»`,
          details,
        }
      }
    } catch {}
  }

  // 2. Custom Webhook / Self-Hosted Endpoint
  const customEndpoint = ext.hostingUrl || ext.content?.aiEndpoint || ext.content?.endpoint
  if (customEndpoint && customEndpoint.startsWith('http')) {
    try {
      const res = await fetch(customEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmd,
          query,
          chatId: ctx.creds.chatId,
          userName: ctx.creds.userName,
          extensionId: ext.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const replyText = data.text || data.message || data.result || JSON.stringify(data, null, 2)
        return {
          ok: true,
          message: `${ext.icon || '◈'} [${extTitle}] Ответ сервиса:`,
          details: typeof replyText === 'string' ? replyText.split('\n') : [String(replyText)],
        }
      }
    } catch (e: any) {
      return {
        ok: false,
        message: `${GLYPH.cancel} Ошибка обращения к эндпоинту расширения: ${e.message}`,
      }
    }
  }

  // 3. Local Extension Runtime Bridge
  try {
    const localDispatched = await dispatchCommand(cmd, query.split(' '), {
      api: {
        getTasks: async () => ctx.userData?.tasks || [],
        createTask: async (title) => ({ title }),
        getNotes: async () => ctx.userData?.notes || [],
        createNote: async (title, body) => ({ title, body }),
      },
      log: {
        info: () => {},
        success: () => {},
        error: () => {},
      },
      config: {
        get: () => null,
        set: () => {},
      },
    })
    if (localDispatched) {
      return {
        ok: true,
        message: `${GLYPH.ok} Команда «${cmd}» выполнена локальным модулем ${extTitle}`,
      }
    }
  } catch {}

  // 4. AI Prompt / Custom Skill Execution with Author's AI Instructions
  const systemPrompt = ext.aiInstructions || ext.content?.aiInstructions || ext.content?.systemPrompt
  const promptToRun = systemPrompt
    ? `Ты исполняешь расширение «${extTitle}» для Zerf Note.\nИнструкция автора расширения:\n${systemPrompt}\n\nЗапрос пользователя: ${query}`
    : `Запрос для модуля «${extTitle}»: ${query}`

  try {
    const activeModel = ctx.config?.model || 'openai/gpt-oss-120b'
    const aiRes = await sendAiQuery(ctx.creds, promptToRun, activeModel)
    return {
      ok: true,
      message: `${ext.icon || '◈'} [${extTitle}] Результат:`,
      details: aiRes.message ? aiRes.message.split('\n') : (aiRes.details || []),
    }
  } catch (err: any) {
    return {
      ok: false,
      message: `${GLYPH.cancel} Ошибка выполнения расширения: ${err.message}`,
    }
  }
}

/**
 * Dynamically extracts all custom commands, triggers, and skills from ANY installed user extensions.
 */
export function extractExtensionCommands(extensions: any[]): CommandDefinition[] {
  if (!Array.isArray(extensions) || extensions.length === 0) return []

  const result: CommandDefinition[] = []
  for (const ext of extensions) {
    if (!ext || typeof ext !== 'object') continue

    const extTitle = ext.title || ext.name || 'Плагин'
    const extDesc = ext.description || 'Пользовательский модуль'
    const extIcon = ext.icon || '◈'
    const extPlan = (ext.minPlan || 'free').toLowerCase() as PlanTier

    const explicitCmds: Array<{ cmd: string; description?: string }> =
      ext.content?.commands || ext.commands || []
    const triggers: string[] = ext.triggers || ext.content?.triggers || []

    const commandsToRegister: Array<{ cmd: string; desc: string }> = []

    if (explicitCmds.length > 0) {
      explicitCmds.forEach(c => {
        if (c.cmd) {
          const cleanCmd = c.cmd.startsWith('/') ? c.cmd : `/${c.cmd}`
          commandsToRegister.push({
            cmd: cleanCmd,
            desc: `[${extTitle}] ${c.description || extDesc}`,
          })
        }
      })
    }

    // Add slash triggers as commands if not already added
    triggers.forEach(t => {
      if (t.startsWith('/')) {
        if (!commandsToRegister.some(c => c.cmd.toLowerCase() === t.toLowerCase())) {
          commandsToRegister.push({
            cmd: t,
            desc: `[${extTitle}] ${extDesc}`,
          })
        }
      }
    })

    // If no explicit slash command was found, auto-generate standard slash command from ext id/name
    if (commandsToRegister.length === 0) {
      const slug = (ext.name || ext.id || 'ext').replace(/^ext_/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      commandsToRegister.push({
        cmd: `/${slug}`,
        desc: `[${extTitle}] ${extDesc}`,
      })
    }

    // Convert to CommandDefinition
    for (const item of commandsToRegister) {
      const cleanName = item.cmd.replace(/^\//, '')
      const aliases = [
        cleanName,
        ...(triggers.filter(t => !t.startsWith('/')).map(t => t.toLowerCase())),
      ]

      result.push({
        id: `ext_${ext.id}_${cleanName}`,
        name: item.cmd,
        aliases,
        description: item.desc,
        category: 'extension',
        minPlan: extPlan,
        glyph: extIcon,
        usage: `${item.cmd} <запрос>`,
        handler: async (args, ctx) => {
          return await executeExtensionAction(ext, item.cmd, args, ctx)
        },
      })
    }
  }

  return result
}

/**
 * Returns full combined command list (built-in commands + any installed user extension commands).
 */
export function getAllCommands(userExtensions: any[] = []): CommandDefinition[] {
  const extCmds = extractExtensionCommands(userExtensions)
  const map = new Map<string, CommandDefinition>()

  // Register extension commands first (giving them priority for their unique commands)
  for (const cmd of extCmds) {
    map.set(cmd.name.toLowerCase(), cmd)
  }

  // Register base commands
  for (const cmd of BASE_COMMAND_REGISTRY) {
    if (!map.has(cmd.name.toLowerCase())) {
      map.set(cmd.name.toLowerCase(), cmd)
    }
  }

  return Array.from(map.values())
}

/**
 * Normalizes user input and matches it against the combined command registry.
 */
export function matchCommand(
  raw: string,
  userExtensions: any[] = []
): { command: CommandDefinition; args: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const firstSpaceIdx = trimmed.indexOf(' ')
  const leadWord = firstSpaceIdx === -1 ? trimmed : trimmed.slice(0, firstSpaceIdx)
  const args = firstSpaceIdx === -1 ? '' : trimmed.slice(firstSpaceIdx + 1).trim()

  const normalizedLead = leadWord.toLowerCase().replace(/^\//, '')
  const allCommands = getAllCommands(userExtensions)

  for (const cmd of allCommands) {
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
 * Searches for command suggestions matching query across all base and extension commands.
 */
export function getCommandSuggestions(
  query: string,
  userPlan: string = 'free',
  userExtensions: any[] = []
): CommandDefinition[] {
  const normalized = query.trim().toLowerCase().replace(/^\//, '')
  const allCommands = getAllCommands(userExtensions)

  if (!normalized) {
    return allCommands
  }

  return allCommands.filter(cmd => {
    const nameMatch = cmd.name.toLowerCase().replace(/^\//, '').startsWith(normalized)
    const idMatch = cmd.id.toLowerCase().startsWith(normalized)
    const aliasMatch = cmd.aliases.some(a => a.toLowerCase().replace(/^\//, '').startsWith(normalized))
    const descMatch = cmd.description.toLowerCase().includes(normalized)
    return nameMatch || idMatch || aliasMatch || descMatch
  })
}
