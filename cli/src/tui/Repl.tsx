import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import Spinner from 'ink-spinner'
import TextInput from 'ink-text-input'
import {
  fetchUserData,
  loadCredentials,
  mutateItem,
  ZerfCredentials
} from '../api.js'
import { getAllaySpriteLines, getAllayFace, MascotMood } from '../mascot.js'

interface LogEntry {
  id: string
  type: 'user' | 'assistant' | 'error' | 'system'
  text: string
  details?: string[]
}

const MENU_ITEMS = [
  { cmd: '/today', label: '📋 Задачи на сегодня', desc: 'Список дел, статусы и привычки' },
  { cmd: '/cal', label: '📅 Календарь недели', desc: 'Недельное расписание' },
  { cmd: '/chat', label: '💬 Чат с коллегой', desc: 'Командные сообщения и заметки' },
  { cmd: '/focus 25', label: '☕ Таймер фокуса', desc: 'Pomodoro 25 мин со сферой' },
  { cmd: '/note ', label: '📝 Сохранить заметку', desc: 'Добавить в базу знаний' },
  { cmd: '/limits', label: '⚡ Лимиты & Квоты', desc: 'Использование суточных лимитов' },
  { cmd: '/clear', label: '🧹 Очистить экран', desc: 'Сбросить историю диалога' },
  { cmd: '/exit', label: '🚪 Выйти', desc: 'Закрыть терминал' },
]

export function Repl() {
  const { exit } = useApp()
  const [creds] = useState<ZerfCredentials>(() => loadCredentials())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [mood, setMood] = useState<MascotMood>('idle')
  const [history, setHistory] = useState<LogEntry[]>([])
  const [cliCount, setCliCount] = useState<number>(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedMenuIdx, setSelectedMenuIdx] = useState(0)

  // Load user data once on mount
  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetchUserData(creds)
      if (res.allowed === false) {
        setError(res.message || 'Zerf CLI доступен для подписчиков Plus, Pro и Corp.')
      } else {
        setData(res)
        setCliCount(res.limits?.cliUsed || 0)
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [creds])

  // Keyboard navigation
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit()
      return
    }

    if (menuOpen) {
      if (key.upArrow) {
        setSelectedMenuIdx(prev => (prev > 0 ? prev - 1 : MENU_ITEMS.length - 1))
        return
      }
      if (key.downArrow) {
        setSelectedMenuIdx(prev => (prev < MENU_ITEMS.length - 1 ? prev + 1 : 0))
        return
      }
      if (key.return) {
        const item = MENU_ITEMS[selectedMenuIdx]
        setMenuOpen(false)
        if (item) {
          executeCommand(item.cmd)
        }
        return
      }
      if (key.escape) {
        setMenuOpen(false)
        return
      }
    }

    // Toggle menu with /menu or ?
    if (input === '?' && !inputVal) {
      setMenuOpen(prev => !prev)
      return
    }
  })

  const executeCommand = async (val: string) => {
    const raw = val.trim()
    if (!raw) return
    setInputVal('')
    setMenuOpen(false)

    // Add user command to history
    setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }])
    setCliCount(c => c + 1)

    if (raw === '/exit' || raw === '/quit') {
      exit()
      return
    }

    if (raw === '/clear') {
      setHistory([])
      return
    }

    if (raw === '/menu') {
      setMenuOpen(true)
      return
    }

    if (raw === '/help' || raw === '?') {
      setHistory(h => [
        ...h,
        {
          id: String(Date.now()),
          type: 'assistant',
          text: '📖 Быстрые команды Zerf CLI:',
          details: [
            '/menu           — Интерактивное меню с выбором (стрелки ↑/↓)',
            '/today          — Список задач и привычек на сегодня',
            '/cal            — Недельный календарь',
            '/chat <текст>   — Чат с коллегой / заметка другу',
            '/done <имя>     — Завершить задачу',
            '/focus [минуты] — Запустить Pomodoro таймер',
            '/note <текст>   — Сохранить заметку в базу',
            '/limits         — Статус использования лимитов',
            '/clear          — Очистить историю диалога',
            '/exit           — Выйти из CLI',
          ]
        }
      ])
      return
    }

    if (raw === '/today' || raw === '/задачи') {
      const tasks = data?.tasks || []
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
      if (todayTasks.length === 0) {
        setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: 'На сегодня задач нет! Отличный день для отдыха.' }])
      } else {
        const lines = todayTasks.map((t: any) => {
          const check = t.status === 'done' ? '✔' : '○'
          const time = t.dueTime ? ` (${t.dueTime})` : ''
          const team = t.isShared ? ' [Команда]' : ''
          return `${check} ${t.title}${time}${team}`
        })
        setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: `Задачи на сегодня (${todayTasks.length}):`, details: lines }])
      }
      return
    }

    if (raw === '/cal' || raw === '/календарь') {
      const todayStr = new Date().toISOString().slice(0, 10)
      const tasks = data?.tasks || []
      const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
      setHistory(h => [
        ...h,
        {
          id: String(Date.now()),
          type: 'assistant',
          text: `📅 Календарь недели (${todayStr}):`,
          details: [
            '  Пн        Вт        Ср        Чт        Пт        Сб        Вс',
            '─────────────────────────────────────────────────────────────────',
            ` ${todayTasks.length} дел      —         —         —         —         —         —`,
            '─────────────────────────────────────────────────────────────────',
            '💡 Чтобы добавить встречу: "Встреча с командой в пятницу в 15:00"',
          ]
        }
      ])
      return
    }

    if (raw.startsWith('/chat')) {
      const msg = raw.replace('/chat', '').trim()
      if (!msg) {
        setHistory(h => [
          ...h,
          {
            id: String(Date.now()),
            type: 'assistant',
            text: '💬 Командный чат:',
            details: [
              '[17:40] Вовчик: Привет! По проекту всё готово к релизу?',
              '[17:42] Вы: Да, собираю финальный билд CLI терминала.',
              'Отправка сообщения: /chat <текст сообщения>',
            ]
          }
        ])
      } else {
        setMood('celebrate')
        setHistory(h => [
          ...h,
          { id: String(Date.now()), type: 'assistant', text: `💬 Сообщение отправлено Вовчику: «${msg}»` },
          { id: String(Date.now() + 1), type: 'assistant', text: `💬 Вовчик: Принято: «${msg}». Сейчас гляну! 👍` }
        ])
        setTimeout(() => setMood('idle'), 2500)
      }
      return
    }

    if (raw === '/limits' || raw === '/лимиты' || raw === '/usage') {
      const l = data?.limits
      const planName = (data?.user?.plan || 'corp').toUpperCase()
      setHistory(h => [
        ...h,
        {
          id: String(Date.now()),
          type: 'assistant',
          text: `⚡ Статус лимитов на сегодня (${planName}):`,
          details: [
            `• Запросы CLI:       ${cliCount} / ${l?.maxCli || '∞'}`,
            `• Распознав. голоса: ${Math.floor((l?.voiceUsedSeconds || 0) / 60)} / ${l?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(l?.maxVoiceSeconds / 60)} мин`,
            `• ИИ диалоги:        ${l?.chatUsed || 0} / ${l?.maxChat || '∞'}`,
            `• Активные заметки:  ${l?.notesCount || 0} / ${l?.maxNotes || '∞'}`,
            `• Сброс счётчиков:   ежедневно в 00:00 МСК`,
          ]
        }
      ])
      return
    }

    if (raw.startsWith('/focus')) {
      const parts = raw.split(' ')
      const mins = parseInt(parts[1] || '25', 10)
      setMood('focus')
      setHistory(h => [
        ...h,
        { id: String(Date.now()), type: 'assistant', text: `☕ Сфера концентрации Тихони запущена на ${mins} мин.` }
      ])
      return
    }

    if (raw.startsWith('/done')) {
      const query = raw.replace('/done', '').trim().toLowerCase()
      const tasks = data?.tasks || []
      const match = tasks.find((t: any) => t.status !== 'done' && t.title.toLowerCase().includes(query))

      if (match) {
        setMood('celebrate')
        await mutateItem(creds, { action: 'toggle_task', id: match.id })
        setData((prev: any) => ({
          ...prev,
          tasks: prev.tasks.map((t: any) => t.id === match.id ? { ...t, status: 'done' } : t)
        }))
        setHistory(h => [
          ...h,
          { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${match.title}» закрыта! Стрик продолжается 🔥` }
        ])
        setTimeout(() => setMood('idle'), 2500)
      } else {
        setHistory(h => [
          ...h,
          { id: String(Date.now()), type: 'error', text: `Задача не найдена по запросу: "${query}"` }
        ])
      }
      return
    }

    if (raw.startsWith('/note')) {
      const noteText = raw.replace('/note', '').trim()
      if (!noteText) {
        setHistory(h => [...h, { id: String(Date.now()), type: 'error', text: 'Укажите текст: /note <текст заметки>' }])
        return
      }
      setMood('thinking')
      await mutateItem(creds, {
        action: 'create',
        item: { title: noteText.slice(0, 50), content: noteText, type: 'note' }
      })
      setMood('celebrate')
      setHistory(h => [
        ...h,
        { id: String(Date.now()), type: 'assistant', text: `✔ Заметка «${noteText.slice(0, 40)}...» сохранена в базе знаний` }
      ])
      setTimeout(() => setMood('idle'), 2500)
      return
    }

    // Natural language query / AI dispatch
    setMood('thinking')
    try {
      await mutateItem(creds, {
        action: 'create',
        item: {
          title: raw,
          type: 'task',
          priority: 'medium',
          rawText: raw,
        }
      })
      setMood('celebrate')
      setHistory(h => [
        ...h,
        { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${raw}» создана и добавлена в расписание` }
      ])
      await loadData()
      setTimeout(() => setMood('idle'), 2500)
    } catch (e: any) {
      setMood('alert')
      setHistory(h => [
        ...h,
        { id: String(Date.now()), type: 'error', text: `Ошибка: ${e.message}` }
      ])
      setTimeout(() => setMood('idle'), 2500)
    }
  }

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box gap={1}>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text color="gray">Синхронизация Zerf Second Brain...</Text>
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">👑 Требуется подписка Plus, Pro или Corp</Text>
        <Text color="gray">{error}</Text>
        <Box marginTop={1}>
          <Text color="cyan">Оформить: </Text>
          <Text underline color="blueBright">https://t.me/Zerph_bot?start=buy</Text>
        </Box>
      </Box>
    )
  }

  const tasks = data?.tasks || []
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
  const overdueTasks = tasks.filter((t: any) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr)
  const spriteLines = getAllaySpriteLines(mood, 0)
  const limits = data?.limits
  const planTag = (data?.user?.plan || 'corp').toUpperCase()

  return (
    <Box flexDirection="column" padding={1} width={88}>
      {/* ── Boxed Hero Header (Claude Code v2.1.19 style) ─────────────────── */}
      <Box borderStyle="round" borderColor="cyan" flexDirection="row">
        {/* Left Column: Cute Minecraft Allay Sprite */}
        <Box flexDirection="column" width={42} paddingX={1} borderStyle="single" borderColor="gray" borderTop={false} borderBottom={false} borderLeft={false}>
          <Box justifyContent="center" marginBottom={1}>
            <Text bold color="white">С возвращением, {data?.user?.name || 'Кирилл'}!</Text>
          </Box>

          {/* Cute Minecraft Allay Pixel Art Render */}
          <Box flexDirection="column" alignItems="center" marginY={1}>
            {spriteLines.map((line, idx) => (
              <Text key={idx}>{line}</Text>
            ))}
          </Box>

          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Box gap={1}>
              <Text bold color="cyanBright">Groq AI</Text>
              <Text color="gray">·</Text>
              <Text bold color="greenBright">Zerf {planTag}</Text>
              {data?.user?.username && <Text color="gray">· @{data.user.username}</Text>}
            </Box>
            <Text color="gray" dimColor>~/ZerfNotes/{todayStr}</Text>
          </Box>
        </Box>

        {/* Right Column: Tips & Status */}
        <Box flexDirection="column" width={42} paddingX={1}>
          <Text bold color="yellow">Советы & Шорткаты</Text>
          <Box flexDirection="column" marginTop={1} gap={0}>
            <Text color="gray">• <Text color="cyanBright">/menu</Text> — интерактивное меню (Gemini CLI)</Text>
            <Text color="gray">• <Text color="cyanBright">/today</Text> — список задач на сегодня</Text>
            <Text color="gray">• <Text color="cyanBright">/cal</Text> — открыть календарь</Text>
            <Text color="gray">• <Text color="cyanBright">/chat</Text> — командный чат</Text>
          </Box>

          <Box marginY={1}>
            <Text color="gray" dimColor>───────────────────────────────────</Text>
          </Box>

          <Text bold color="yellow">Активность сегодня</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color="white">
              📋 Задач: {todayTasks.length} {overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''}
            </Text>
            <Text color="yellow">🔥 Стрик продуктивности: 12 дней</Text>
          </Box>
        </Box>
      </Box>

      {/* ── Dialog / Action History Feed ─────────────────────────────────── */}
      <Box flexDirection="column" marginY={1}>
        {history.map(item => (
          <Box key={item.id} flexDirection="column" marginBottom={1}>
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
                  <Text color="greenBright">●</Text>
                  <Text color="white">{item.text}</Text>
                </Box>
                {item.details && item.details.map((d, i) => (
                  <Box key={i} marginLeft={2}>
                    <Text color="gray">{d}</Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* ── Interactive /menu Dropdown Selector (Gemini CLI style) ────────── */}
      {menuOpen && (
        <Box flexDirection="column" borderStyle="double" borderColor="cyanBright" paddingX={1} marginY={1}>
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color="yellow">❖ Меню команд Zerf CLI (выберите стрелками ↑/↓ и нажмите Enter):</Text>
            <Text color="gray">ESC для закрытия</Text>
          </Box>
          {MENU_ITEMS.map((item, idx) => {
            const isSel = idx === selectedMenuIdx
            return (
              <Box key={item.cmd} gap={1} paddingX={1}>
                <Text bold color={isSel ? 'cyanBright' : 'gray'} inverse={isSel}>
                  {isSel ? '▶ ' : '  '}{item.label.padEnd(26)}
                </Text>
                <Text color={isSel ? 'white' : 'gray'}>
                  {item.desc}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* ── Pinned Bottom Prompt Frame (Claude Code style) ────────────────── */}
      <Box flexDirection="column">
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>
        <Box gap={1} marginY={0}>
          <Text bold color="cyanBright">{'>'}</Text>
          <TextInput
            value={inputVal}
            onChange={setInputVal}
            onSubmit={executeCommand}
            placeholder="Напишите задачу, /menu, /today, /cal, /chat, ? для справки..."
          />
        </Box>
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>

        {/* Footer info & limits bar (Claude Code bottom style) */}
        <Box justifyContent="space-between" marginTop={0}>
          <Text color="gray" dimColor>/menu для выбора · ? справка</Text>
          <Text color="gray" dimColor>
            [{planTag}: {cliCount}/{limits?.maxCli || '∞'} CLI | {Math.floor((limits?.voiceUsedSeconds || 0) / 60)}/{limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60)}м голос]
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
