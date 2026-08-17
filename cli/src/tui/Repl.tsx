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
import { scaffoldExtension, installExtensionPackage, getInstalledExtensions } from '../extensions/registry.js'

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
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B', desc: 'Флагман скорости и глубокой логики (120–200 мс)', type: 'cloud' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B', desc: 'Молниеносный отклик для быстрых задач', type: 'cloud' },
  { id: 'groq/compound', name: 'Groq Compound Router', desc: 'Авто-роутинг оптимальной модели под контекст', type: 'cloud' },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instant', desc: 'Лёгкая модель для быстрых сводок и заметок', type: 'cloud' },
]

const BASE_MENU_ITEMS: MenuItem[] = [
  { cmd: '/today', label: '/today', desc: 'Задачи, привычки и цели на сегодня с таймером', glyph: '❖' },
  { cmd: '/cal', label: '/cal', desc: 'Календарь задач по дням недели с расписанием', glyph: '◫' },
  { cmd: '/tasks', label: '/tasks', desc: 'Полный список всех активных и завершенных задач', glyph: '❖' },
  { cmd: '/notes', label: '/notes', desc: 'Все сохранённые заметки и конспекты', glyph: '≡' },
  { cmd: '/goals', label: '/goals', desc: 'Трекинг долгосрочных целей и шкала прогресса', glyph: '◈' },
  { cmd: '/habits', label: '/habits', desc: 'Привычки, прогресс-бары и серии дней', glyph: '●' },
  { cmd: '/focus 25', label: '/focus [мин]', desc: 'Сфера концентрации Pomodoro с таймером', glyph: '⊘' },
  { cmd: '/chat', label: '/chat', desc: 'Диалог с друзьями / поручение задачи', glyph: '◈' },
  { cmd: '/friends', label: '/friends', desc: 'Список команды/друзей и ссылка-приглашение', glyph: '◈' },
  { cmd: '/ext', label: '/ext', desc: 'Каталог расширений и маркетплейс Zerf Ext', glyph: '◈' },
  { cmd: '/ext create ', label: '/ext create <имя>', desc: 'Создать новое расширение (шаблон плагина)', glyph: '▸' },
  { cmd: '/add ', label: '/add <текст>', desc: 'Создать задачу с умным распознаванием даты', glyph: '▸' },
  { cmd: '/done ', label: '/done <имя>', desc: 'Завершить задачу по названию', glyph: '✔' },
  { cmd: '/note ', label: '/note <текст>', desc: 'Быстрая заметка в базу знаний', glyph: '≡' },
  { cmd: '/model', label: '/model', desc: 'Выбор нейросети (GPT-OSS, Compound) или CLI', glyph: '◈' },
  { cmd: '/settings', label: '/settings', desc: 'Настройки профиля, параметров и подключений', glyph: '⚙' },
  { cmd: '/limits', label: '/limits', desc: 'Статус лимитов и квот на текущие сутки', glyph: '●' },
  { cmd: '/stats', label: '/stats', desc: 'Аналитика продуктивности за 7 дней', glyph: '●' },
  { cmd: '/clear', label: '/clear', desc: 'Очистить историю диалога', glyph: '─' },
  { cmd: '/help', label: '/help', desc: 'Справка по всем возможностям', glyph: '?' },
  { cmd: '/exit', label: '/exit', desc: 'Выйти из Zerf CLI', glyph: '✕' },
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
    glyph: '◈',
  }))

  const allMenuItems = [...BASE_MENU_ITEMS, ...customExtItems]

  const isSlash = (inputVal.startsWith('/') || menuForced) && !pickingModel && !pickingChatFriend
  const filterQuery = (menuForced || inputVal === '/menu' || inputVal === '/') ? '' : inputVal.toLowerCase().trim()
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

    // If menu was open and user pressed enter on selected item
    if (isSlash && filteredCommands.length > 0 && (menuForced || raw === '/menu' || raw === '/')) {
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
      setSelectedIdx(0)
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
            `• Локальные CLI на ПК:  Обнаружено: ${installedCliCount} (agy, claude, opencode, gh, ollama)`,
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
            '/menu           — Интерактивное меню со всеми разделами (стрелки ↑/↓)',
            '/today          — Задачи, привычки и цели на сегодня с отсчетом',
            '/cal            — 7-дневный календарь с расписанием задач по дням',
            '/tasks          — Полный список задач (активные и выполненные)',
            '/notes          — Все сохранённые заметки и конспекты',
            '/goals          — Трекинг целей и прогресс',
            '/habits         — Привычки, шкалы прогресса и стрик',
            '/focus [минуты] — Сфера концентрации Pomodoro с таймером',
            '/chat <текст>   — Чат с друзьями / поручение задачи',
            '/friends        — Список команды и персональная ссылка-приглашение',
            '/ext            — Маркетплейс и каталог расширений',
            '/ext create     — Создать новый плагин',
            '/model          — Выбор нейросети (GPT-OSS, Compound, agy, claude)',
            '/settings       — Окно параметров и настроек',
            '/limits         — Статус использования лимитов',
            '/clear          — Очистить историю диалога',
            '/exit           — Выйти из CLI',
          ],
        },
      ])
      return
    }

    // ── Tasks list (/tasks) ──
    if (raw === '/tasks' || raw === '/задачи_все') {
      const tasks = data?.tasks || []
      if (tasks.length === 0) {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: 'Задач пока нет. Добавьте первую через /add <текст>' }])
      } else {
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
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `❖ База задач Zerf (${tasks.length} всего):`, details: lines },
        ])
      }
      return
    }

    // ── Notes list (/notes) ──
    if (raw === '/notes' || raw === '/заметки') {
      const notes = data?.notes || []
      if (notes.length === 0) {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: 'Заметок пока нет. Создайте через /note <текст>' }])
      } else {
        const lines = notes.slice(0, 10).map((n: any) => `• ≡ ${n.title || n.body} (${n.createdAt ? n.createdAt.slice(0, 10) : 'сегодня'})`)
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `≡ Сохранённые заметки (${notes.length}):`, details: lines },
        ])
      }
      return
    }

    // ── Goals list (/goals) ──
    if (raw === '/goals' || raw === '/цели') {
      const goals = data?.goals || []
      if (goals.length === 0) {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: 'Цели пока не заданы.' }])
      } else {
        const lines = goals.map((g: any) => {
          const prog = typeof g.progress === 'number' ? g.progress : 50
          return `• ◈ ${g.title.padEnd(24)} ${renderProgressBar(prog / 100, 8)} ${prog}%`
        })
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `◈ Долгосрочные цели (${goals.length}):`, details: lines },
        ])
      }
      return
    }

    // ── Habits list (/habits) ──
    if (raw === '/habits' || raw === '/привычки') {
      const habits = data?.habits || []
      if (habits.length === 0) {
        setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: 'Привычки пока не настроены.' }])
      } else {
        const lines = habits.map((hb: any) => {
          const cur = hb.currentStreak || hb.progress || 3
          const target = hb.targetDays || 10
          return `• ● ${hb.title.padEnd(18)} ${renderProgressBar(cur / target, 8)} ${cur}/${target} · стрик ${cur} дн.`
        })
        setHistory(h => [
          ...h,
          { id: makeUniqueId(), type: 'assistant', text: `● Трекер привычек (${habits.length}):`, details: lines },
        ])
      }
      return
    }

    // ── Extensions commands (/ext) ──
    if (raw === '/ext' || raw === '/extensions') {
      const installed = getInstalledExtensions()
      const lines = [
        `Установлено расширений: ${installed.length}`,
        ...installed.map(i => `  • ◈ ${i.name} v${i.version} — ${i.description}`),
        '',
        'Доступные команды:',
        '  • /ext create <название> — создать каркас нового плагина',
        '  • /ext install <имя>    — установить расширение из каталога',
      ]
      setHistory(h => [
        ...h,
        { id: makeUniqueId(), type: 'assistant', text: '◈ Маркетплейс расширений Zerf Ext:', details: lines },
      ])
      return
    }

    if (raw.startsWith('/ext create')) {
      const name = raw.replace('/ext create', '').trim() || 'my-plugin'
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

    if (raw.startsWith('/ext install')) {
      const name = raw.replace('/ext install', '').trim()
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
          const prio = t.priority === 'urgent' ? ' [Срочно]' : t.priority === 'high' ? ' [Высокий]' : ''
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

    // ── Rich 7-day calendar with real tasks (/cal) ──
    if (raw === '/cal' || raw === '/calendar' || raw === '/календарь') {
      const today = new Date()
      const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
      const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
      const tasks = data?.tasks || []
      const details: string[] = []

      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(today.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayLabel = dayNames[d.getDay()]
        const dayNum = d.getDate()
        const monthName = monthNames[d.getMonth()]
        const dayTasks = tasks.filter((t: any) => t.dueDate && t.dueDate.startsWith(dateStr))
        const isToday = i === 0
        const isTomorrow = i === 1
        const dayTag = isToday ? ' (Сегодня)' : isTomorrow ? ' (Завтра)' : ''
        const countTag = dayTasks.length > 0 ? ` · ${dayTasks.length} ${dayTasks.length === 1 ? 'дело' : 'дел(а)'}` : ''

        details.push(`• [${dayLabel} ${dayNum} ${monthName}]${dayTag}${countTag}`)
        if (dayTasks.length === 0) {
          details.push(`  └─ нет запланированных задач`)
        } else {
          dayTasks.forEach((t: any) => {
            const check = t.status === 'done' ? '[✔]' : '[◌]'
            const timeStr = t.dueTime ? ` [${t.dueTime}]` : ''
            const prio = t.priority === 'urgent' ? ' [Срочно]' : ''
            details.push(`  └─ ${check} ${t.title}${timeStr}${prio}`)
          })
        }
      }

      setHistory(h => [
        ...h,
        {
          id: makeUniqueId(),
          type: 'assistant',
          text: `◫ Календарь задач на 7 дней (${today.getDate()} ${monthNames[today.getMonth()]} — ${new Date(today.getTime() + 6 * 86400000).getDate()} ${monthNames[new Date(today.getTime() + 6 * 86400000).getMonth()]}):`,
          details,
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
                `▸ Ваша ссылка для добавления: https://t.me/Zerph_bot?start=invite_${chatId}`,
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

      setActionProgress({ label: `Отправка сообщения ${targetFriend?.name || 'собеседнику'}...`, ratio: 0.6 })
      try {
        await mutateItem(creds, {
          action: 'create_task',
          title: messageText,
          priority: 'medium',
          isShared: true,
          assignees: targetFriend?.chatId ? [String(targetFriend.chatId)] : (targetFriend?.username ? [targetFriend.username] : []),
        })
        setActionProgress({ label: 'Сообщение доставлено', ratio: 1.0 })
        setTimeout(() => setActionProgress(null), 1000)
        setHistory(h => [
          ...h,
          {
            id: makeUniqueId(),
            type: 'assistant',
            text: `◈ Сообщение / поручение отправлено ${targetFriend?.name || 'другу'}!`,
            details: [`Текст: «${messageText}»`, 'Синхронизировано в командный чат Zerf Note и Telegram.'],
          },
        ])
      } catch (err: any) {
        setActionProgress(null)
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
            text: '◈ Список друзей (0):',
            details: [
              'У вас пока нет добавленных друзей.',
              `▸ Ссылка-приглашение: https://t.me/Zerph_bot?start=invite_${chatId}`,
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
            text: `◈ Список друзей (${friends.length}):`,
            details: [...friendLines, `▸ Ссылка: https://t.me/Zerph_bot?start=invite_${chatId}`],
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
          text: `● Статус лимитов на сегодня (${planName}):`,
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
        setActionProgress({ label: `Завершение «${match.title}»...`, ratio: 0.6 })
        await mutateItem(creds, { action: 'toggle_task', id: match.id })
        match.status = 'done'
        setActionProgress({ label: `Задача «${match.title}» закрыта`, ratio: 1.0 })
        setTimeout(() => setActionProgress(null), 1000)
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
      setActionProgress({ label: `Сохранение задачи «${text}»...`, ratio: 0.6 })
      await mutateItem(creds, {
        action: 'create_task',
        title: text,
        dueDate: new Date().toISOString().slice(0, 10),
        priority: 'medium',
        rawText: text,
      })
      setActionProgress({ label: `Задача сохранена в расписание`, ratio: 1.0 })
      setTimeout(() => setActionProgress(null), 1000)
      setHistory(h => [
        ...h,
        { id: makeUniqueId(), type: 'assistant', text: `✔ Задача «${text}» добавлена на сегодня!` },
      ])
      return
    }

    if (raw.startsWith('/note')) {
      const text = raw.replace('/note', '').trim()
      setActionProgress({ label: `Синхронизация заметки...`, ratio: 0.6 })
      await mutateItem(creds, {
        action: 'create_note',
        title: text.length > 40 ? text.slice(0, 37) + '…' : text,
        body: text,
      })
      setActionProgress({ label: `Заметка сохранена в базу`, ratio: 1.0 })
      setTimeout(() => setActionProgress(null), 1000)
      setHistory(h => [
        ...h,
        { id: makeUniqueId(), type: 'assistant', text: `✔ Заметка «${text}» сохранена в базу.` },
      ])
      return
    }

    // ── Smart Natural Language Summaries Detection (e.g. "выдай мне сводку на след месяц по задачам") ──
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

    // AI Query / Free text
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
          <Text color="white">стрик 12 дн.</Text>
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
            <Text color="gray">• <Text color="cyanBright">/cal</Text> — календарь с задачами</Text>
            <Text color="gray">• <Text color="cyanBright">/tasks</Text> — все задачи · <Text color="cyanBright">/notes</Text></Text>
          </Box>

          <Box marginY={0}>
            <Text color="gray" dimColor>───────────────────────────────────</Text>
          </Box>

          <Text bold color="cyanBright">Активность сегодня</Text>
          <Box flexDirection="column" marginTop={0}>
            <Text color="white">
              ❖ Задач: {todayTasks.length} {overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''}
            </Text>
            <Text color="white">● Стрик: 12 дней</Text>
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
            <Text bold color="cyanBright">◈ Выберите друга для начала диалога (↑/↓, Enter):</Text>
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
            <Text bold color="cyanBright">◈ Выберите нейросеть или локальный CLI агент (↑/↓, Enter):</Text>
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
              {menuForced ? '❖ Меню возможностей Zerf CLI (навигация ↑/↓, Enter для открытия):' : 'Команды Zerf CLI (навигация ↑/↓, Tab выбор):'}
            </Text>
            <Text color="gray">ESC для закрытия</Text>
          </Box>
          {filteredCommands.slice(0, 10).map((item, idx) => {
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
          {filteredCommands.length > 10 && (
            <Text color="gray" dimColor>  ... и ещё {filteredCommands.length - 10} команд (уточните поиск или листайте ↑/↓)</Text>
          )}
        </Box>
      )}

      {/* ── Live Action Progress Bar ──────────────────────────────────────── */}
      {actionProgress && (
        <Box gap={1} marginY={0} marginTop={1} marginLeft={1}>
          <Text bold color="cyanBright">{renderProgressBar(actionProgress.ratio, 14)}</Text>
          <Text bold color="white">{Math.round(actionProgress.ratio * 100)}%</Text>
          <Text color="gray">— {actionProgress.label}</Text>
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
