import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import TextInput from 'ink-text-input'
import {
  fetchUserData,
  loadCredentials,
  mutateItem,
  sendAiQuery,
  loadConfig,
  saveConfig,
  type ZerfCredentials,
  type ZerfConfig,
} from '../api.js'
import { detectInstalledClis, runLocalCliBridge, type DetectedCli } from '../local-cli.js'
import { getAllaySpriteLines, GLYPHS } from '../mascot.js'
import { makeUniqueId } from './utils.js'
import { scaffoldExtension, installExtensionPackage, getInstalledExtensions } from '../extensions/registry.js'
import { setScreen, updateReplState } from './state.js'
import {
  matchCommand,
  getCommandSuggestions,
  getAllCommands,
  isPlanAllowed,
  type CommandDefinition,
} from './commandRegistry.js'
import { GLYPH } from './theme.js'

export interface LogEntry {
  id: string
  type: 'user' | 'assistant' | 'error' | 'system'
  text: string
  details?: string[]
}

export interface MenuItem {
  cmd: string
  label: string
  desc: string
  glyph: string
  minPlan?: string
}

export interface AiModelOption {
  id: string
  name: string
  desc: string
  type: 'cloud' | 'local_cli'
  status?: string
}

export const CLOUD_MODELS: AiModelOption[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Флагман скорости и глубокой логики (120–200 мс)', type: 'cloud' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: 'Молниеносный отклик для быстрых задач', type: 'cloud' },
  { id: 'groq/compound', name: 'Groq Compound Router', desc: 'Авто-роутинг оптимальной модели под контекст', type: 'cloud' },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instant', desc: 'Лёгкая модель для быстрых сводок и заметок', type: 'cloud' },
]

function renderProgressBar(ratio: number, length = 12): string {
  const clamped = Math.max(0, Math.min(1, isNaN(ratio) ? 0 : ratio))
  const filled = Math.round(clamped * length)
  const empty = length - filled
  return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}]`
}

export function Repl({ initialData }: { initialData?: any }) {
  const { exit } = useApp()
  const [creds] = useState<ZerfCredentials>(() => loadCredentials())
  const [config, setConfig] = useState<ZerfConfig>(() => loadConfig())
  const [data, setData] = useState<any>(initialData || null)
  const [inputVal, setInputVal] = useState('')
  const [history, setHistory] = useState<LogEntry[]>([])
  const [cliCount, setCliCount] = useState<number>(initialData?.limits?.cliUsed || 0)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [menuForced, setMenuForced] = useState(false)
  const [pickingModel, setPickingModel] = useState(false)
  const [selectedModelIdx, setSelectedModelIdx] = useState(0)
  const [pickingChatFriend, setPickingChatFriend] = useState(false)
  const [selectedFriendIdx, setSelectedFriendIdx] = useState(0)
  const [activeChatTarget, setActiveChatTarget] = useState<any>(null)
  const [detectedClis, setDetectedClis] = useState<DetectedCli[]>([])
  const [wingFrame, setWingFrame] = useState(0)
  const [actionProgress, setActionProgress] = useState<{ label: string; ratio: number } | null>(null)

  const userPlan = (data?.user?.plan || creds.plan || 'corp').toLowerCase()

  useEffect(() => {
    try {
      const found = detectInstalledClis()
      setDetectedClis(found)
    } catch {}

    const timer = setInterval(() => {
      setWingFrame(w => (w + 1) % 4)
    }, 400)
    return () => clearInterval(timer)
  }, [])

  const allAvailableModels: AiModelOption[] = [
    ...CLOUD_MODELS,
    ...detectedClis.map(c => ({
      id: c.id,
      name: c.name,
      desc: c.desc,
      type: 'local_cli' as const,
      status: c.installed ? 'Готов к работе' : 'Не установлен в PATH',
    })),
  ]

  // Dynamic combined commands (built-in + all installed user extensions)
  const userExtensions = data?.extensions || []
  const allCommands = getAllCommands(userExtensions)
  const allMenuItems: MenuItem[] = allCommands.map(c => ({
    cmd: c.name,
    label: c.name,
    desc: c.description,
    glyph: c.glyph,
    minPlan: c.minPlan !== 'free' ? c.minPlan.toUpperCase() : undefined,
  }))

  const isSlashOrTyping = (inputVal.startsWith('/') || menuForced || (inputVal.length >= 2 && !inputVal.includes(' '))) && !pickingModel && !pickingChatFriend
  const filterQuery = (menuForced || inputVal === '/menu' || inputVal === '/') ? '' : inputVal.toLowerCase().trim().replace(/^\//, '')
  
  const filteredCommands = isSlashOrTyping
    ? getCommandSuggestions(filterQuery, userPlan, userExtensions).map(c => ({
        cmd: c.name,
        label: c.name,
        desc: c.description,
        glyph: c.glyph,
        minPlan: c.minPlan !== 'free' ? c.minPlan.toUpperCase() : undefined,
      }))
    : []

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit()
      return
    }

    if (key.ctrl && input === 'l') {
      console.clear()
      setHistory([])
      return
    }

    if (pickingModel) {
      if (key.upArrow) {
        setSelectedModelIdx(prev => (prev > 0 ? prev - 1 : allAvailableModels.length - 1))
        return
      }
      if (key.downArrow) {
        setSelectedModelIdx(prev => (prev < allAvailableModels.length - 1 ? prev + 1 : 0))
        return
      }
      if (key.return) {
        const chosen = allAvailableModels[selectedModelIdx]
        if (chosen) {
          setActionProgress({ label: `Применение модели ${chosen.name}...`, ratio: 0.8 })
          const updated = saveConfig({ model: chosen.id })
          setConfig(updated)
          setTimeout(() => {
            setActionProgress({ label: `Активна модель: ${chosen.name}`, ratio: 1.0 })
            setTimeout(() => setActionProgress(null), 1200)
          }, 200)
          setHistory(h => [
            ...h,
            {
              id: makeUniqueId(),
              type: 'assistant',
              text: `◈ Активная нейросеть / CLI агент: ${chosen.name}`,
              details: [chosen.desc],
            },
          ])
        }
        setPickingModel(false)
        return
      }
      if (key.escape) {
        setPickingModel(false)
        return
      }
    }

    if (pickingChatFriend) {
      const friends = data?.friends || []
      if (key.upArrow) {
        setSelectedFriendIdx(prev => (prev > 0 ? prev - 1 : (friends.length > 0 ? friends.length - 1 : 0)))
        return
      }
      if (key.downArrow) {
        setSelectedFriendIdx(prev => (prev < friends.length - 1 ? prev + 1 : 0))
        return
      }
      if (key.return) {
        const chosen = friends[selectedFriendIdx]
        if (chosen) {
          setActiveChatTarget(chosen)
          const targetName = chosen.username ? `@${chosen.username}` : chosen.name
          setInputVal(`/chat ${targetName} `)
          setHistory(h => [
            ...h,
            {
              id: makeUniqueId(),
              type: 'assistant',
              text: `◈ Выбран собеседник: ${chosen.name} (${targetName})`,
              details: ['Введите сообщение или задачу для отправки.'],
            },
          ])
        }
        setPickingChatFriend(false)
        return
      }
      if (key.escape) {
        setPickingChatFriend(false)
        return
      }
    }

    if (isSlashOrTyping && filteredCommands.length > 0) {
      if (key.upArrow) {
        setSelectedIdx(prev => (prev > 0 ? prev - 1 : filteredCommands.length - 1))
        return
      }
      if (key.downArrow) {
        setSelectedIdx(prev => (prev < filteredCommands.length - 1 ? prev + 1 : 0))
        return
      }
      if (key.tab) {
        const item = filteredCommands[selectedIdx]
        if (item) {
          setInputVal(item.cmd.trim() + ' ')
          setMenuForced(false)
        }
        return
      }
      if (key.escape) {
        setInputVal('')
        setMenuForced(false)
        return
      }
    }

    if ((key.backspace || key.delete) && inputVal.length <= 1) {
      setInputVal('')
      setMenuForced(false)
      return
    }

    if (input === '?' && !inputVal) {
      setMenuForced(prev => !prev)
      return
    }
  })

  const executeCommand = async (val: string) => {
    let raw = val.trim()
    if (!raw) return

    // If dropdown menu was open and user pressed enter on an autocomplete item
    if (isSlashOrTyping && filteredCommands.length > 0 && (menuForced || raw === '/menu' || raw === '/' || raw === 'menu')) {
      const selectedItem = filteredCommands[selectedIdx]
      if (selectedItem) {
        if (selectedItem.cmd.endsWith(' ')) {
          setInputVal(selectedItem.cmd)
          setMenuForced(false)
          return
        }
        raw = selectedItem.cmd.trim()
      }
    }

    setInputVal('')
    setMenuForced(false)
    setHistory(h => [...h, { id: makeUniqueId(), type: 'user', text: raw }])
    setCliCount(c => c + 1)

    // 1. Built-in exit & clear
    if (raw === '/exit' || raw === '/quit' || raw === 'exit' || raw === 'quit') {
      exit()
      return
    }

    if (raw === '/clear' || raw === 'clear' || raw === 'cls') {
      console.clear()
      setHistory([])
      return
    }

    if (raw === '/menu' || raw === 'menu') {
      setMenuForced(true)
      setSelectedIdx(0)
      return
    }

    // 2. Command Registry Match (handles /settings, settings, /today, today, /cal, cal, /friends, and any extension command)
    const matched = matchCommand(raw, userExtensions)
    if (matched) {
      const { command, args } = matched

      // Check subscription plan access
      if (!isPlanAllowed(userPlan, command.minPlan)) {
        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'error',
            text: `${GLYPH.cancel} Команда «${command.name}» доступна на тарифе ${command.minPlan.toUpperCase()}`,
            details: [
              `Ваш текущий тариф: ${userPlan.toUpperCase()}`,
              `Оформить подписку для снятия ограничений: https://t.me/Zerph_bot?start=buy`,
            ],
          },
        ])
        return
      }

      // If command maps directly to a full-screen TUI view
      if (command.screen) {
        setScreen(command.screen)
        return
      }

      // If command has an action handler
      if (command.handler) {
        setActionProgress({ label: `Выполнение ${command.name}...`, ratio: 0.5 })
        try {
          const res = await command.handler(args, {
            creds,
            config,
            userData: data,
            rawInput: raw,
            exitApp: exit,
          })
          setActionProgress({ label: 'Готово', ratio: 1.0 })
          setTimeout(() => setActionProgress(null), 600)

          if (res) {
            setHistory(h => [
              ...h,
              {
                id: makeUniqueId(),
                type: res.ok ? 'assistant' : 'error',
                text: res.message,
                details: res.details,
              },
            ])
          }
        } catch (err: any) {
          setActionProgress(null)
          setHistory(h => [
            ...h,
            { id: makeUniqueId(), type: 'error', text: `Ошибка выполнения: ${err.message}` },
          ])
        }
        return
      }
    }

    // 3. Extension Management commands: /ext create, /ext install
    if (raw.startsWith('/ext create') || raw.startsWith('ext create')) {
      const name = raw.replace(/^(\/ext|ext)\s+create\s*/i, '').trim() || 'my-plugin'
      const { dir } = scaffoldExtension(name, 'Пользовательский модуль расширения Zerf')
      setHistory(h => [
        ...h,
        {
          id: makeUniqueId(),
          type: 'assistant',
          text: `✔ Расширение ${name} успешно создано!`,
          details: [`Директория: ${dir}`, 'Файлы: zerf.manifest.json, index.js', 'Команда добавлена в локальный реестр.'],
        },
      ])
      return
    }

    if (raw.startsWith('/ext install') || raw.startsWith('ext install')) {
      const name = raw.replace(/^(\/ext|ext)\s+install\s*/i, '').trim()
      if (!name) {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: 'Укажите название расширения: /ext install <name>' }])
        return
      }
      setActionProgress({ label: `Установка ${name}...`, ratio: 0.5 })
      try {
        await installExtensionPackage(name)
        setActionProgress({ label: `${name} установлено`, ratio: 1.0 })
        setTimeout(() => setActionProgress(null), 1000)
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `✔ Расширение ${name} установлено и готово к использованию!` },
        ])
      } catch (e: any) {
        setActionProgress(null)
        setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${e.message}` }])
      }
      return
    }

    // 4. Entropy AI Search & Deep Research (Perplexity style)
    if (raw.startsWith('/search') || raw.startsWith('/entropy') || raw.startsWith('/энтропия') || raw.startsWith('/серч') || raw.startsWith('/поиск')) {
      const query = raw.replace(/^(\/search|\/entropy|\/энтропия|\/серч|\/поиск)\s*/i, '').trim()
      if (!query) {
        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'assistant',
            text: '🔮 Расширение: Entropy AI Search & Deep Research (v1.0.0)',
            details: [
              '• Использование: /search <запрос> или /entropy <запрос>',
              '• Пример: /search архитектура MoE vs Dense в LLM 2026',
              '• Тихоня выполнит глубокий поиск, верификацию первоисточников и синтез цитат [1][2].',
            ],
          },
        ])
        return
      }

      setActionProgress({ label: `[Entropy AI] Тихоня краулит первоисточники по «${query}»...`, ratio: 0.4 })
      const progTimer = setTimeout(() => {
        setActionProgress({ label: '[Entropy AI] Тихоня синтезирует факты и проверяет цитаты...', ratio: 0.8 })
      }, 500)

      try {
        let details: string[] = []
        let answerText = ''

        try {
          const apiBase = (creds.serverUrl || 'https://zerph.vercel.app').replace(/\/$/, '')
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (creds.token) headers['x-telegram-auth'] = creds.token
          if (creds.chatId) headers['x-telegram-chat-id'] = creds.chatId

          const res = await fetch(`${apiBase}/api/entropy/search`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, mode: 'web' }),
          })
          const searchData = await res.json()

          if (searchData.success && searchData.result) {
            const r = searchData.result
            answerText = `🔮 Entropy AI: «${query}»`
            details.push(`◈ Тихоня: «${r.tikhonyaComment || 'Синтезировал первоисточники [ ˘ ᴗ ˘ ]'}»`)
            if (r.sources && r.sources.length > 0) {
              details.push('─'.repeat(50))
              details.push('📚 Верифицированные первоисточники:')
              r.sources.forEach((s: any) => {
                details.push(`  [${s.id}] ${s.title} (${s.domain})`)
              })
              details.push('─'.repeat(50))
            }
            details.push('')
            r.answer.split('\n').forEach((line: string) => details.push(line))

            if (r.takeaways && r.takeaways.length > 0) {
              details.push('')
              details.push('💡 Главные выводы:')
              r.takeaways.forEach((t: string) => details.push(`  ◈ ${t}`))
            }
          }
        } catch {}

        if (details.length === 0) {
          const searchPrompt = `Ты — ведущий исследовательский поисково-аналитический движок Entropy AI с маскотом Тихоня.
Пользователь ищет: "${query}".

Сформируй глубокий структурированный ответ со следующей структурой:
1. Краткий прямой ответ (Direct Summary).
2. Подробный разбор с цитатами и фактами. Помечай факты сносками [1], [2], [3].
3. Список проверенных источников (Sources & References).
4. Ключевые выводы (Key takeaways).
5. Реплика Тихони [ ˘ ᴗ ˘ ].`

          const aiRes = await sendAiQuery(creds, searchPrompt, 'openai/gpt-oss-120b')
          answerText = `🔮 Entropy AI Search: «${query}»`
          details = aiRes.message ? aiRes.message.split('\n') : (aiRes.details || [])
        }

        clearTimeout(progTimer)
        setActionProgress({ label: '[Entropy AI] Тихоня завершил поиск', ratio: 1.0 })
        setTimeout(() => setActionProgress(null), 800)

        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'assistant',
            text: answerText,
            details,
          },
        ])
      } catch (err: any) {
        clearTimeout(progTimer)
        setActionProgress(null)
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'error', text: `Entropy Search ошибка: ${err.message}` },
        ])
      }
      return
    }

    // 5. Smart Natural Language Summaries Detection (e.g. "выдай мне сводку на след месяц по задачам")
    const lower = raw.toLowerCase()
    const isSummaryRequest =
      (lower.includes('сводк') || lower.includes('отчет') || lower.includes('итог') || lower.includes('план')) &&
      (lower.includes('задач') || lower.includes('месяц') || lower.includes('недел') || lower.includes('календар'))

    if (isSummaryRequest) {
      setActionProgress({ label: 'Формирование сводки задач...', ratio: 0.7 })
      const allTasks = data?.tasks || []
      const goals = data?.goals || []
      const habits = data?.habits || []
      const pendingTasks = allTasks.filter((t: any) => t.status !== 'done')
      const doneTasks = allTasks.filter((t: any) => t.status === 'done')

      const details: string[] = [
        `📊 Аналитика расписания:`,
        `  • Всего задач: ${allTasks.length} (активно: ${pendingTasks.length}, завершено: ${doneTasks.length})`,
        '',
        `📅 Ближайшие запланированные задачи:`,
      ]

      if (pendingTasks.length === 0) {
        details.push('  • Нет невыполненных задач')
      } else {
        pendingTasks.slice(0, 8).forEach((t: any) => {
          const due = t.dueDate ? ` [${t.dueDate}${t.dueTime ? ` в ${t.dueTime}` : ''}]` : ' [без даты]'
          details.push(`  • [◌] ${t.title}${due}`)
        })
      }

      if (goals.length > 0) {
        details.push('')
        details.push(`◈ Прогресс ключевых целей:`)
        goals.slice(0, 3).forEach((g: any) => {
          const p = typeof g.progress === 'number' ? g.progress : 50
          details.push(`  • ${g.title} (${p}%) ${renderProgressBar(p / 100, 6)}`)
        })
      }

      if (habits.length > 0) {
        details.push('')
        details.push(`● Активные привычки:`)
        habits.slice(0, 3).forEach((hb: any) => {
          details.push(`  • ${hb.title} — стрик ${hb.currentStreak || hb.progress || 3} дн.`)
        })
      }

      setActionProgress({ label: 'Сводка сформирована', ratio: 1.0 })
      setTimeout(() => setActionProgress(null), 800)
      setHistory(h => [
        ...h,
        {
          id: makeUniqueId(),
          type: 'assistant',
          text: `❖ Сводка по задачам и планам:`,
          details,
        },
      ])
      return
    }

    // 6. AI Query / Free text assistant
    try {
      const currentModel = config.model || 'openai/gpt-oss-120b'
      setActionProgress({ label: `Генерация ответа через ${currentModel}...`, ratio: 0.45 })
      const progTimer = setTimeout(() => {
        setActionProgress({ label: `Генерация ответа через ${currentModel}...`, ratio: 0.8 })
      }, 500)

      if (currentModel.startsWith('cli:')) {
        const out = await runLocalCliBridge(currentModel, raw)
        clearTimeout(progTimer)
        setActionProgress({ label: 'Ответ CLI получен', ratio: 1.0 })
        setTimeout(() => setActionProgress(null), 800)
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `◈ Ответ ${currentModel.replace('cli:', '')}:`, details: [out] },
        ])
      } else {
        const res = await sendAiQuery(creds, raw, currentModel)
        clearTimeout(progTimer)
        setActionProgress({ label: 'Ответ сформирован', ratio: 1.0 })
        setTimeout(() => setActionProgress(null), 800)
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: res.message, details: res.details },
        ])
      }
    } catch (e: any) {
      setActionProgress(null)
      setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${e.message}` }])
    }
  }

  const userName = data?.user?.name || creds.userName || 'Пользователь Zerf'
  const planTag = (data?.user?.plan || creds.plan || 'corp').toUpperCase()
  const username = data?.user?.username ? `@${data.user.username}` : ''
  const spriteLines = getAllaySpriteLines('idle', wingFrame)
  const todayTasks = (data?.tasks || []).filter((t: any) => !t.dueDate || t.dueDate.startsWith(new Date().toISOString().slice(0, 10)))
  const overdueTasks = (data?.tasks || []).filter((t: any) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done')

  const userStreak = (() => {
    const completedDates = new Set<string>()
    ;(data?.tasks || []).forEach((t: any) => {
      if (t && t.status === 'done') {
        if (t.completedAt) {
          try { completedDates.add(new Date(t.completedAt).toISOString().slice(0, 10)) } catch {}
        }
        if (t.dueDate) completedDates.add(String(t.dueDate).slice(0, 10))
      }
    })
    ;(data?.habits || []).forEach((h: any) => {
      if (h && h.lastCompletedAt) {
        try { completedDates.add(new Date(h.lastCompletedAt).toISOString().slice(0, 10)) } catch {}
      }
    })
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
    let streak = 0
    const hasToday = completedDates.has(todayStr)
    const hasYesterday = completedDates.has(yesterdayStr)
    if (hasToday || hasYesterday) {
      let cur = new Date(hasToday ? now : new Date(now.getTime() - 86400000))
      while (true) {
        const dStr = cur.toISOString().slice(0, 10)
        if (completedDates.has(dStr)) {
          streak++
          cur = new Date(cur.getTime() - 86400000)
        } else {
          break
        }
      }
    }
    const maxHabit = (data?.habits || []).reduce((m: number, h: any) => Math.max(m, Number(h?.streak) || 0), 0)
    const base = Math.max(streak, maxHabit)
    if (base === 0 && (data?.tasks || []).filter((t: any) => t?.status === 'done').length > 0 && hasToday) {
      return 1
    }
    return base
  })()

  return (
    <Box flexDirection="column" paddingX={1} width={90}>
      {/* ── Top Bar ── */}
      <Box justifyContent="space-between" width={86} marginY={0}>
        <Box gap={1}>
          <Text bold color="cyanBright">◈</Text>
          <Text bold color="white">Zerf CLI v2.0.26</Text>
        </Box>
        <Box gap={1}>
          <Text color="gray">{userName}</Text>
          <Text color="gray">·</Text>
          <Text bold color="cyanBright">{planTag}</Text>
          <Text color="gray">·</Text>
          <Text color="white">стрик {userStreak} дн.</Text>
        </Box>
      </Box>

      {/* ── Hero Box ── */}
      <Box borderStyle="round" borderColor="cyan" flexDirection="row" width={86} marginY={0}>
        {/* Left Column: Mascot Render */}
        <Box flexDirection="column" width={40} paddingX={1} borderStyle="single" borderColor="gray" borderTop={false} borderBottom={false} borderLeft={false}>
          <Text bold color="white">С возвращением, {userName}</Text>
          <Box flexDirection="column" alignItems="center" marginY={1}>
            {spriteLines.map((line, idx) => (
              <Text key={`sprite_${idx}`}>{line}</Text>
            ))}
          </Box>
          <Box gap={1}>
            <Text bold color="cyanBright">Groq AI</Text>
            <Text color="gray">·</Text>
            <Text bold color="greenBright">Zerf {planTag}</Text>
            {username && <Text color="gray">· {username}</Text>}
          </Box>
        </Box>

        {/* Right Column: Tips & Stats */}
        <Box flexDirection="column" width={42} paddingX={1}>
          <Text bold color="cyanBright">Советы & Шорткаты</Text>
          <Box flexDirection="column" marginTop={0}>
            <Text color="gray">• <Text color="cyanBright">settings</Text> — настройки · <Text color="cyanBright">today</Text> — задачи</Text>
            <Text color="gray">• <Text color="cyanBright">/search &lt;запрос&gt;</Text> — поиск Entropy AI</Text>
            <Text color="gray">• <Text color="cyanBright">add &lt;текст&gt;</Text> — создать задачу</Text>
            <Text color="gray">• <Text color="cyanBright">done &lt;имя&gt;</Text> — закрыть дело</Text>
          </Box>

          <Box marginY={0}>
            <Text color="gray" dimColor>───────────────────────────────────</Text>
          </Box>

          <Text bold color="cyanBright">Активность сегодня</Text>
          <Box flexDirection="column" marginTop={0}>
            <Text color="white">
              ❖ Задач: {todayTasks.length} {overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''}
            </Text>
            <Text color="white">● Стрик: {userStreak} {userStreak === 1 ? 'день' : userStreak < 5 && userStreak > 0 ? 'дня' : 'дней'}</Text>
          </Box>
        </Box>
      </Box>

      {/* ── Action History Feed ── */}
      {history.slice(-5).map(item => (
        <Box key={`hist_${item.id}`} flexDirection="column" marginY={0} marginTop={1}>
          {item.type === 'user' ? (
            <Box gap={1}>
              <Text bold color="cyanBright">{'>'}</Text>
              <Text bold color="white">{item.text}</Text>
            </Box>
          ) : item.type === 'error' ? (
            <Box gap={1} marginLeft={2}>
              <Text color="red">●</Text>
              <Text color="red">{item.text}</Text>
            </Box>
          ) : (
            <Box flexDirection="column" marginLeft={2}>
              <Box gap={1}>
                <Text color="cyanBright">●</Text>
                <Text color="white">{item.text}</Text>
              </Box>
              {item.details && item.details.map((d, i) => (
                <Box key={`detail_${item.id}_${i}`} marginLeft={2}>
                  <Text color="gray">{d}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ))}

      {/* ── Interactive Friend Picker Modal (/chat) ─────────────────────── */}
      {pickingChatFriend && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyanBright" paddingX={1} marginY={1}>
          <Box justifyContent="space-between" marginBottom={0}>
            <Text bold color="cyanBright">◈ Выберите друга для начала диалога (↑/↓, Enter):</Text>
            <Text color="gray">ESC отмена</Text>
          </Box>
          {(() => {
            const friendsList = data?.friends || []
            const VISIBLE_FRIEND_COUNT = 7
            const startFriendIdx = friendsList.length <= VISIBLE_FRIEND_COUNT
              ? 0
              : Math.max(0, Math.min(selectedFriendIdx - Math.floor(VISIBLE_FRIEND_COUNT / 2), friendsList.length - VISIBLE_FRIEND_COUNT))
            const endFriendIdx = Math.min(friendsList.length, startFriendIdx + VISIBLE_FRIEND_COUNT)
            const visibleFriends = friendsList.slice(startFriendIdx, endFriendIdx)

            return (
              <>
                {visibleFriends.map((f: any, relIdx: number) => {
                  const actualIdx = startFriendIdx + relIdx
                  const isSel = actualIdx === selectedFriendIdx
                  const usernameTag = f.username ? `@${f.username}` : 'без юзернейма'
                  return (
                    <Box key={`friend_opt_${f.id || actualIdx}_${actualIdx}`} gap={1}>
                      <Text bold color={isSel ? 'cyanBright' : 'gray'}>
                        {isSel ? '▶ ' : '  '}{f.name.padEnd(20)}
                      </Text>
                      <Text color={isSel ? 'white' : 'gray'}>
                        — {usernameTag.padEnd(18)} [В сети] Начать диалог
                      </Text>
                    </Box>
                  )
                })}
                {friendsList.length > VISIBLE_FRIEND_COUNT && (
                  <Box justifyContent="space-between" marginTop={0}>
                    <Text color="gray" dimColor>{startFriendIdx > 0 ? `▲ ещё ${startFriendIdx}` : ''}</Text>
                    <Text color="gray" dimColor>
                      {startFriendIdx + 1}–{endFriendIdx} из {friendsList.length} (листайте ↑/↓)
                    </Text>
                    <Text color="gray" dimColor>{endFriendIdx < friendsList.length ? `▼ ещё ${friendsList.length - endFriendIdx}` : ''}</Text>
                  </Box>
                )}
              </>
            )
          })()}
        </Box>
      )}

      {/* ── Interactive Model Picker Modal (/model) ─────────────────────── */}
      {pickingModel && (
        <Box flexDirection="column" borderStyle="double" borderColor="cyanBright" paddingX={1} marginY={1}>
          <Box justifyContent="space-between" marginBottom={0}>
            <Text bold color="cyanBright">◈ Выберите нейросеть или локальный CLI агент (↑/↓, Enter):</Text>
            <Text color="gray">ESC для закрытия</Text>
          </Box>
          {(() => {
            const VISIBLE_MODEL_COUNT = 7
            const startModelIdx = allAvailableModels.length <= VISIBLE_MODEL_COUNT
              ? 0
              : Math.max(0, Math.min(selectedModelIdx - Math.floor(VISIBLE_MODEL_COUNT / 2), allAvailableModels.length - VISIBLE_MODEL_COUNT))
            const endModelIdx = Math.min(allAvailableModels.length, startModelIdx + VISIBLE_MODEL_COUNT)
            const visibleModels = allAvailableModels.slice(startModelIdx, endModelIdx)

            return (
              <>
                {visibleModels.map((m, relIdx) => {
                  const actualIdx = startModelIdx + relIdx
                  const isSel = actualIdx === selectedModelIdx
                  const isCurrent = config.model === m.id
                  const tag = m.type === 'local_cli' ? `[Локальный CLI ${m.status || ''}]` : '[Облако Zerf]'
                  return (
                    <Box key={`model_opt_${m.id}_${actualIdx}`} gap={1}>
                      <Text bold color={isSel ? 'cyanBright' : 'gray'}>
                        {isSel ? '▶ ' : '  '}{m.name.padEnd(30)}
                      </Text>
                      <Text color={isSel ? 'white' : 'gray'}>
                        — {tag} {m.desc} {isCurrent ? '(Текущий)' : ''}
                      </Text>
                    </Box>
                  )
                })}
                {allAvailableModels.length > VISIBLE_MODEL_COUNT && (
                  <Box justifyContent="space-between" marginTop={0}>
                    <Text color="gray" dimColor>{startModelIdx > 0 ? `▲ ещё ${startModelIdx}` : ''}</Text>
                    <Text color="gray" dimColor>
                      {startModelIdx + 1}–{endModelIdx} из {allAvailableModels.length} (листайте ↑/↓)
                    </Text>
                    <Text color="gray" dimColor>{endModelIdx < allAvailableModels.length ? `▼ ещё ${allAvailableModels.length - endModelIdx}` : ''}</Text>
                  </Box>
                )}
              </>
            )
          })()}
        </Box>
      )}

      {/* ── Interactive Command Autocomplete Dropdown with Smooth Scrolling ── */}
      {isSlashOrTyping && filteredCommands.length > 0 && !pickingModel && !pickingChatFriend && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyanBright" paddingX={1} marginY={1}>
          <Box justifyContent="space-between" marginBottom={0}>
            <Text bold color="cyanBright">
              {menuForced ? '❖ Меню возможностей Zerf CLI (навигация ↑/↓, Enter для открытия):' : 'Команды Zerf CLI (навигация ↑/↓, Tab выбор):'}
            </Text>
            <Text color="gray">ESC для закрытия</Text>
          </Box>
          {(() => {
            const VISIBLE_CMD_COUNT = 8
            const startCmdIdx = filteredCommands.length <= VISIBLE_CMD_COUNT
              ? 0
              : Math.max(0, Math.min(selectedIdx - Math.floor(VISIBLE_CMD_COUNT / 2), filteredCommands.length - VISIBLE_CMD_COUNT))
            const endCmdIdx = Math.min(filteredCommands.length, startCmdIdx + VISIBLE_CMD_COUNT)
            const visibleCommands = filteredCommands.slice(startCmdIdx, endCmdIdx)

            return (
              <>
                {visibleCommands.map((item, relIdx) => {
                  const actualIdx = startCmdIdx + relIdx
                  const isSel = actualIdx === selectedIdx
                  const planBadge = item.minPlan ? `[${item.minPlan}] ` : ''
                  return (
                    <Box key={`cmd_opt_${item.cmd}_${actualIdx}`} gap={1}>
                      <Text bold color={isSel ? 'cyanBright' : 'gray'}>
                        {isSel ? '▶ ' : '  '}{item.label.padEnd(18)}
                      </Text>
                      <Text color={isSel ? 'white' : 'gray'}>
                        — {planBadge}{item.desc}
                      </Text>
                    </Box>
                  )
                })}
                {filteredCommands.length > VISIBLE_CMD_COUNT && (
                  <Box justifyContent="space-between" marginTop={0}>
                    <Text color="gray" dimColor>{startCmdIdx > 0 ? `▲ ещё ${startCmdIdx}` : ' '}</Text>
                    <Text color="gray" dimColor>
                      {startCmdIdx + 1}–{endCmdIdx} из {filteredCommands.length} · ↑/↓ прокрутка · Tab выбор
                    </Text>
                    <Text color="gray" dimColor>{endCmdIdx < filteredCommands.length ? `▼ ещё ${filteredCommands.length - endCmdIdx}` : ' '}</Text>
                  </Box>
                )}
              </>
            )
          })()}
        </Box>
      )}

      {/* ── Live Action Progress Bar ── */}
      {actionProgress && (
        <Box gap={1} marginY={0} marginTop={1} marginLeft={1}>
          <Text bold color="cyanBright">{renderProgressBar(actionProgress.ratio, 14)}</Text>
          <Text bold color="white">{Math.round(actionProgress.ratio * 100)}%</Text>
          <Text color="gray">— {actionProgress.label}</Text>
        </Box>
      )}

      {/* ── Pinned Bottom Prompt Frame ── */}
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>
        <Box gap={1} marginY={0}>
          <Text bold color="cyanBright">{'>'}</Text>
          <TextInput
            value={inputVal}
            onChange={(val) => {
              setInputVal(val)
              if (!val) setMenuForced(false)
            }}
            onSubmit={executeCommand}
            placeholder="Напишите задачу, /search, /today, settings, /menu..."
          />
        </Box>
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>

        {/* Footer info & limits bar */}
        <Box justifyContent="space-between" marginTop={0}>
          <Text color="gray" dimColor>settings настройки · today задачи · cal календарь · /menu меню · ? справка</Text>
          <Text color="gray" dimColor>
            [{planTag}: {cliCount}/{data?.limits?.maxCli || '∞'} CLI | {Math.floor((data?.limits?.voiceUsedSeconds || 0) / 60)}/{data?.limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(data?.limits?.maxVoiceSeconds / 60)}м голос]
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
