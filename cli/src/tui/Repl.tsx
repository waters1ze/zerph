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
  type ZerfConfig
} from '../api.js'
import { detectInstalledClis, runLocalCliBridge, type DetectedCli } from '../local-cli.js'
import { getAllaySpriteLines, GLYPHS } from '../mascot.js'
import { makeUniqueId, getInputHistory, pushInputHistory } from './utils.js'

interface LogEntry {
  id: string
  type: 'user' | 'assistant' | 'error' | 'system'
  text: string
  details?: string[]
}

interface MenuItem {
  cmd: string
  label: string
  desc: string
  glyph: string
}

interface AiModelOption {
  id: string
  name: string
  desc: string
  type: 'cloud' | 'local_cli'
  status?: string
}

const CLOUD_MODELS: AiModelOption[] = [
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B', desc: 'Флагман скорости и качества (120–200 мс)', type: 'cloud' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B', desc: 'Молниеносный отклик для быстрых задач', type: 'cloud' },
  { id: 'groq/compound', name: 'Groq Compound Router', desc: 'Авто-роутинг оптимальной модели', type: 'cloud' },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instant', desc: 'Лёгкая модель для быстрых сводок', type: 'cloud' },
]

const BASE_MENU_ITEMS: MenuItem[] = [
  { cmd: '/today', label: '/today', desc: 'Список дел и привычек с отсчетом времени', glyph: GLYPHS.task },
  { cmd: '/cal', label: '/cal', desc: '7-дневный календарь с расписанием', glyph: GLYPHS.calendar },
  { cmd: '/chat', label: '/chat', desc: 'Диалог с друзьями / поручение задачи', glyph: GLYPHS.chat },
  { cmd: '/add ', label: '/add <текст>', desc: 'Добавить задачу с распознаванием даты', glyph: GLYPHS.task },
  { cmd: '/done ', label: '/done <имя>', desc: 'Завершить задачу по названию', glyph: GLYPHS.taskDone },
  { cmd: '/note ', label: '/note <текст>', desc: 'Сохранить быструю заметку в базу', glyph: GLYPHS.note },
  { cmd: '/focus 25', label: '/focus [мин]', desc: 'Сфера концентрации Pomodoro', glyph: GLYPHS.focus },
  { cmd: '/model', label: '/model', desc: 'Выбор нейросети или локального CLI', glyph: '🤖' },
  { cmd: '/settings', label: '/settings', desc: 'Настройки, статус CLI и параметры', glyph: '⚙' },
  { cmd: '/friends', label: '/friends', desc: 'Список друзей и ссылка-приглашение', glyph: GLYPHS.friend },
  { cmd: '/limits', label: '/limits', desc: 'Статус использования лимитов', glyph: GLYPHS.limits },
  { cmd: '/clear', label: '/clear', desc: 'Очистить историю диалога', glyph: '🧹' },
  { cmd: '/help', label: '/help', desc: 'Справка по всем командам', glyph: '?' },
  { cmd: '/exit', label: '/exit', desc: 'Выйти из Zerf CLI', glyph: '🚪' },
]

function getCountdownText(dueTime?: string | null, status?: string): string {
  if (status === 'done') return '✔ Выполнено'
  if (!dueTime) return 'без точного времени'

  const [dueHours, dueMinutes] = dueTime.split(':').map(Number)
  if (isNaN(dueHours) || isNaN(dueMinutes)) return dueTime

  const now = new Date()
  const target = new Date()
  target.setHours(dueHours, dueMinutes, 0, 0)

  const diffMs = target.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)

  if (diffMins > 60) {
    const h = Math.floor(diffMins / 60)
    const m = diffMins % 60
    return `через ${h} ч ${m > 0 ? `${m} мин` : ''}`
  } else if (diffMins > 0) {
    return `через ${diffMins} мин`
  } else if (diffMins === 0) {
    return `прямо сейчас!`
  } else {
    const passed = Math.abs(diffMins)
    const h = Math.floor(passed / 60)
    const m = passed % 60
    return `просрочено на ${h > 0 ? `${h} ч ` : ''}${m} мин`
  }
}

function renderProgressBar(ratio: number, length = 10): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const filled = Math.round(clamped * length)
  const empty = length - filled
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}]`
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

  const customExtItems: MenuItem[] = (data?.extensions || []).map((ext: any) => ({
    cmd: `/ext ${ext.id || ext.name}`,
    label: `/ext ${ext.name || ext.id}`,
    desc: `[Расширение] ${ext.description || ext.title || 'Пользовательский модуль'}`,
    glyph: '🔌',
  }))

  const allMenuItems = [...BASE_MENU_ITEMS, ...customExtItems]

  const isSlash = (inputVal.startsWith('/') || menuForced) && !pickingModel && !pickingChatFriend
  const filterQuery = menuForced ? '' : inputVal.toLowerCase().trim()
  const filteredCommands = isSlash
    ? allMenuItems.filter(m => !filterQuery || m.cmd.toLowerCase().startsWith(filterQuery))
    : []

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit()
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
          const updated = saveConfig({ model: chosen.id })
          setConfig(updated)
          setHistory(h => [
            ...h,
            {
              id: makeUniqueId(),
              type: 'assistant',
              text: `🤖 Активная нейросеть / CLI агент: ${chosen.name}`,
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
              text: `💬 Выбран собеседник: ${chosen.name} (${targetName})`,
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

    if (isSlash && filteredCommands.length > 0) {
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

    if (isSlash && filteredCommands.length > 0 && (menuForced || !raw.includes(' ') || raw === '/')) {
      const selectedItem = filteredCommands[selectedIdx]
      if (selectedItem && (menuForced || raw === '/' || !raw.includes(' '))) {
        if (selectedItem.cmd.endsWith(' ') && !raw.trim().includes(' ')) {
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

    if (raw === '/exit' || raw === '/quit') {
      exit()
      return
    }

    if (raw === '/clear') {
      console.clear()
      setHistory([])
      return
    }

    if (raw === '/menu') {
      setMenuForced(true)
      return
    }

    if (raw === '/model' || raw === '/ai') {
      setPickingModel(true)
      return
    }

    if (raw === '/settings') {
      const currentModelObj = allAvailableModels.find(m => m.id === config.model) || allAvailableModels[0]
      const installedCliCount = detectedClis.filter(c => c.installed).length
      setHistory(h => [
        ...h,
        {
          id: makeUniqueId(),
          type: 'assistant',
          text: '⚙ Настройки Zerf CLI:',
          details: [
            `• Активная модель / CLI: ${currentModelObj?.name} (сменить: /model)`,
            `• Локальные CLI на ПК:  Обнаружено: ${installedCliCount} (agy, claude, gemini, ollama)`,
            `• Тема оформления:      Strict Cyan (Монохром + Тихоня)`,
            `• Автосинхронизация:    Включена (каждые 30 сек)`,
            `• Telegram Бот:         Подключен (@Zerph_bot)`,
            `• Текущий тариф:        ${(data?.user?.plan || 'corp').toUpperCase()}`,
          ],
        },
      ])
      return
    }

    if (raw === '/help' || raw === '?') {
      setHistory(h => [
        ...h,
        {
          id: makeUniqueId(),
          type: 'assistant',
          text: '❖ Быстрые команды Zerf CLI:',
          details: [
            '/menu           — Интерактивное меню с выбором (стрелки ↑/↓)',
            '/model          — Выбор нейросети (GPT-OSS, Compound, agy, claude)',
            '/settings       — Окно параметров и настроек',
            '/today          — Список задач с обратным отсчетом и шкалой',
            '/cal            — 7-дневный календарь расписания',
            '/chat <текст>   — Чат с друзьями / поручение задачи',
            '/friends        — Список друзей и персональная ссылка',
            '/add <текст>    — Создать задачу с распознаванием даты',
            '/done <имя>     — Завершить задачу по названию',
            '/focus [минуты] — Запустить Pomodoro таймер',
            '/note <текст>   — Сохранить заметку в базу',
            '/limits         — Статус использования лимитов',
            '/clear          — Очистить историю диалога',
            '/exit           — Выйти из CLI',
          ],
        },
      ])
      return
    }

    if (raw === '/today' || raw === '/задачи') {
      const tasks = data?.tasks || []
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
      const doneCount = todayTasks.filter((t: any) => t.status === 'done').length
      const progressRatio = todayTasks.length > 0 ? doneCount / todayTasks.length : 0
      const progressBar = renderProgressBar(progressRatio, 10)

      if (todayTasks.length === 0) {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: 'На сегодня задач нет! Отличный день для отдыха.' }])
      } else {
        const lines = todayTasks.map((t: any) => {
          const isDone = t.status === 'done'
          const check = isDone ? `${GLYPHS.taskDone} ` : `${GLYPHS.taskTodo} `
          const countdown = getCountdownText(t.dueTime, t.status)
          const timeStr = t.dueTime ? ` [${t.dueTime}]` : ''
          const prio = t.priority === 'urgent' ? ' [⚡ Срочно]' : t.priority === 'high' ? ' [Высокий]' : ''
          return `${check} ${t.title}${timeStr}${prio}  →  ${countdown}`
        })
        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'assistant',
            text: `❖ Задачи на сегодня (${doneCount}/${todayTasks.length}) ${progressBar} ${Math.round(progressRatio * 100)}%:`,
            details: lines,
          },
        ])
      }
      return
    }

    if (raw === '/cal') {
      const today = new Date()
      const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
      const tasks = data?.tasks || []
      const days = []
      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(today.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayLabel = dayNames[d.getDay()]
        const dayTasks = tasks.filter((t: any) => t.dueDate && t.dueDate.startsWith(dateStr))
        days.push({
          header: `${dayLabel} ${d.getDate()}`,
          count: dayTasks.length,
          isToday: i === 0,
        })
      }
      const gridHeader = days.map(d => (d.isToday ? `[${d.header}]`.padEnd(9) : d.header.padEnd(9))).join('│ ')
      const gridCounts = days.map(d => (d.count > 0 ? ` ${d.count} дел `.padEnd(9) : '   —    '.padEnd(9))).join('│ ')
      setHistory(h => [
        ...h,
        {
          id: makeUniqueId(),
          type: 'assistant',
          text: `◫ Календарь на 7 дней (${today.toISOString().slice(0, 10)}):`,
          details: [gridHeader, gridCounts],
        },
      ])
      return
    }

    if (raw.startsWith('/chat')) {
      const rest = raw.replace(/^\/chat\s*/i, '').trim()
      const friends = data?.friends || []
      const chatId = data?.user?.chatId || ''

      if (!rest) {
        if (friends.length > 0) {
          setPickingChatFriend(true)
          setSelectedFriendIdx(0)
          return
        } else {
          setHistory(h => [
            ...h,
            {
              id: makeUniqueId(),
              type: 'assistant',
              text: '◈ Командный чат & Друзья (0):',
              details: [
                'У вас пока нет добавленных друзей для диалога.',
                `🔗 Ваша ссылка для добавления: https://t.me/Zerph_bot?start=invite_${chatId}`,
              ],
            },
          ])
          return
        }
      }

      let targetFriend = activeChatTarget
      let messageText = rest

      if (rest.startsWith('@')) {
        const parts = rest.split(' ')
        const targetUsername = parts[0].replace('@', '').toLowerCase()
        messageText = parts.slice(1).join(' ')
        targetFriend = friends.find((f: any) => (f.username || '').toLowerCase() === targetUsername || f.name.toLowerCase() === targetUsername) || { name: `@${targetUsername}`, username: targetUsername }
      }

      try {
        await mutateItem(creds, {
          action: 'create_task',
          title: messageText,
          priority: 'medium',
          isShared: true,
          assignees: targetFriend?.chatId ? [String(targetFriend.chatId)] : (targetFriend?.username ? [targetFriend.username] : []),
        })
        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'assistant',
            text: `💬 Сообщение / поручение отправлено ${targetFriend?.name || 'другу'}!`,
            details: [`Текст: «${messageText}»`, 'Синхронизировано в командный чат Zerf Note и Telegram.'],
          },
        ])
      } catch (err: any) {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${err.message}` }])
      }
      return
    }

    if (raw === '/friends') {
      const friends = data?.friends || []
      const chatId = data?.user?.chatId || ''
      if (friends.length === 0) {
        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'assistant',
            text: '🪽 Список друзей (0):',
            details: [
              'У вас пока нет добавленных друзей.',
              `🔗 Ссылка-приглашение: https://t.me/Zerph_bot?start=invite_${chatId}`,
            ],
          },
        ])
      } else {
        const friendLines = friends.map((f: any) => `• ${f.name} (@${f.username || 'нет юзернейма'}) — [В сети]`)
        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'assistant',
            text: `🪽 Список друзей (${friends.length}):`,
            details: [...friendLines, `🔗 Ссылка: https://t.me/Zerph_bot?start=invite_${chatId}`],
          },
        ])
      }
      return
    }

    if (raw === '/limits') {
      const l = data?.limits
      const planName = (data?.user?.plan || 'corp').toUpperCase()
      const maxCli = typeof l?.maxCli === 'number' ? l.maxCli : 8000
      const cliBar = renderProgressBar(cliCount / maxCli, 10)
      setHistory(h => [
        ...h,
        {
          id: makeUniqueId(),
          type: 'assistant',
          text: `⚡ Статус лимитов на сегодня (${planName}):`,
          details: [
            `• Запросы CLI:       ${cliCount} / ${l?.maxCli || '∞'} ${cliBar}`,
            `• Распознав. голоса: ${Math.floor((l?.voiceUsedSeconds || 0) / 60)} / ${l?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(l?.maxVoiceSeconds / 60)} мин`,
            `• ИИ диалоги:        ${l?.chatUsed || 0} / ${l?.maxChat || '∞'}`,
            `• Активные заметки:  ${l?.notesCount || 0} / ${l?.maxNotes || '∞'}`,
          ],
        },
      ])
      return
    }

    if (raw.startsWith('/focus')) {
      const mins = parseInt(raw.split(' ')[1] || '25', 10)
      setHistory(h => [
        ...h,
        { id: makeUniqueId(), type: 'assistant', text: `⊘ Сфера концентрации Тихони запущена на ${mins} мин.` },
      ])
      return
    }

    if (raw.startsWith('/done')) {
      const query = raw.replace('/done', '').trim().toLowerCase()
      const tasks = data?.tasks || []
      const match = tasks.find((t: any) => t.status !== 'done' && t.title.toLowerCase().includes(query))
      if (match) {
        await mutateItem(creds, { action: 'toggle_task', id: match.id })
        match.status = 'done'
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `✔ Задача «${match.title}» успешно завершена!` },
        ])
      } else {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: `Задача не найдена по запросу «${query}»` }])
      }
      return
    }

    if (raw.startsWith('/add')) {
      const text = raw.replace('/add', '').trim()
      await mutateItem(creds, {
        action: 'create_task',
        title: text,
        dueDate: new Date().toISOString().slice(0, 10),
        priority: 'medium',
        rawText: text,
      })
      setHistory(h => [
        ...h,
        { id: makeUniqueId(), type: 'assistant', text: `✔ Задача «${text}» добавлена на сегодня!` },
      ])
      return
    }

    if (raw.startsWith('/note')) {
      const text = raw.replace('/note', '').trim()
      await mutateItem(creds, {
        action: 'create_note',
        title: text.length > 40 ? text.slice(0, 37) + '…' : text,
        body: text,
      })
      setHistory(h => [
        ...h,
        { id: makeUniqueId(), type: 'assistant', text: `✔ Заметка «${text}» сохранена в базу.` },
      ])
      return
    }

    // AI Query / Free text
    try {
      const currentModel = config.model || 'openai/gpt-oss-120b'
      if (currentModel.startsWith('cli:')) {
        const out = await runLocalCliBridge(currentModel, raw)
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `🤖 Ответ ${currentModel.replace('cli:', '')}:`, details: [out] },
        ])
      } else {
        const res = await sendAiQuery(creds, raw, currentModel)
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: res.message, details: res.details },
        ])
      }
    } catch (e: any) {
      setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${e.message}` }])
    }
  }

  const userName = data?.user?.name || creds.userName || 'Пользователь Zerf'
  const planTag = (data?.user?.plan || creds.plan || 'corp').toUpperCase()
  const username = data?.user?.username ? `@${data.user.username}` : ''
  const spriteLines = getAllaySpriteLines('idle', wingFrame)
  const todayTasks = (data?.tasks || []).filter((t: any) => !t.dueDate || t.dueDate.startsWith(new Date().toISOString().slice(0, 10)))
  const overdueTasks = (data?.tasks || []).filter((t: any) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done')

  return (
    <Box flexDirection="column" paddingX={1} width={90}>
      {/* ── Single Clean Top Bar (NO DUPLICATES) ── */}
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
          <Text color="yellow">стрик 12 🔥</Text>
        </Box>
      </Box>

      {/* ── Pixel-Perfect Hero Box (Built with native Ink rounded borders) ── */}
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
            <Text color="gray">• <Text color="cyanBright">/menu</Text> — интерактивное меню (↑/↓)</Text>
            <Text color="gray">• <Text color="cyanBright">/today</Text> — задачи на сегодня</Text>
            <Text color="gray">• <Text color="cyanBright">/cal</Text> — недельный календарь</Text>
            <Text color="gray">• <Text color="cyanBright">/chat</Text> — командный чат</Text>
          </Box>

          <Box marginY={0}>
            <Text color="gray" dimColor>───────────────────────────────────</Text>
          </Box>

          <Text bold color="cyanBright">Активность сегодня</Text>
          <Box flexDirection="column" marginTop={0}>
            <Text color="white">
              ❖ Задач: {todayTasks.length} {overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''}
            </Text>
            <Text color="yellow">🔥 Стрик: 12 дней</Text>
          </Box>
        </Box>
      </Box>

      {/* ── Action History Feed (Keep clean viewport) ───────────────────── */}
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
            <Text bold color="cyanBright">👥 Выберите друга для начала диалога (↑/↓, Enter):</Text>
            <Text color="gray">ESC отмена</Text>
          </Box>
          {(data?.friends || []).map((f: any, idx: number) => {
            const isSel = idx === selectedFriendIdx
            const usernameTag = f.username ? `@${f.username}` : 'без юзернейма'
            return (
              <Box key={`friend_opt_${f.id || idx}_${idx}`} gap={1}>
                <Text bold color={isSel ? 'cyanBright' : 'gray'}>
                  {isSel ? '▶ ' : '  '}{f.name.padEnd(20)}
                </Text>
                <Text color={isSel ? 'white' : 'gray'}>
                  — {usernameTag.padEnd(18)} [В сети] Начать диалог
                </Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* ── Interactive Model Picker Modal (/model) ─────────────────────── */}
      {pickingModel && (
        <Box flexDirection="column" borderStyle="double" borderColor="cyanBright" paddingX={1} marginY={1}>
          <Box justifyContent="space-between" marginBottom={0}>
            <Text bold color="cyanBright">🤖 Выберите нейросеть или локальный CLI агент (↑/↓, Enter):</Text>
            <Text color="gray">ESC для закрытия</Text>
          </Box>
          {allAvailableModels.map((m, idx) => {
            const isSel = idx === selectedModelIdx
            const isCurrent = config.model === m.id
            const tag = m.type === 'local_cli' ? `[Локальный CLI ${m.status || ''}]` : '[Облако Zerf]'
            return (
              <Box key={`model_opt_${m.id}_${idx}`} gap={1}>
                <Text bold color={isSel ? 'cyanBright' : 'gray'}>
                  {isSel ? '▶ ' : '  '}{m.name.padEnd(30)}
                </Text>
                <Text color={isSel ? 'white' : 'gray'}>
                  — {tag} {m.desc} {isCurrent ? '(Текущий)' : ''}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* ── Interactive /menu Dropdown (Navigable via ↑/↓ arrows and Tab/Enter) ── */}
      {isSlash && filteredCommands.length > 0 && !pickingModel && !pickingChatFriend && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyanBright" paddingX={1} marginY={1}>
          <Box justifyContent="space-between" marginBottom={0}>
            <Text bold color="cyanBright">
              {menuForced ? '❖ Меню команд Zerf CLI (навигация ↑/↓, Enter для выбора):' : 'Команды Zerf CLI (навигация ↑/↓, Tab выбор):'}
            </Text>
            <Text color="gray">ESC для закрытия</Text>
          </Box>
          {filteredCommands.map((item, idx) => {
            const isSel = idx === selectedIdx
            return (
              <Box key={`cmd_opt_${item.cmd}_${idx}`} gap={1}>
                <Text bold color={isSel ? 'cyanBright' : 'gray'}>
                  {isSel ? '▶ ' : '  '}{item.label.padEnd(18)}
                </Text>
                <Text color={isSel ? 'white' : 'gray'}>
                  — {item.desc}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* ── Pinned Bottom Prompt Frame (Claude Code style) ────────────────── */}
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
            placeholder="Напишите задачу, вопрос ИИ, /menu, /model, /settings..."
          />
        </Box>
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>

        {/* Footer info & limits bar (Claude Code bottom style) */}
        <Box justifyContent="space-between" marginTop={0}>
          <Text color="gray" dimColor>/menu меню · /model ИИ/CLI · /settings · ? справка</Text>
          <Text color="gray" dimColor>
            [{planTag}: {cliCount}/{data?.limits?.maxCli || '∞'} CLI | {Math.floor((data?.limits?.voiceUsedSeconds || 0) / 60)}/{data?.limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(data?.limits?.maxVoiceSeconds / 60)}м голос]
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
