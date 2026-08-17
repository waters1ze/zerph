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

export function Repl() {
  const { exit } = useApp()
  const [creds] = useState<ZerfCredentials>(() => loadCredentials())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [mood, setMood] = useState<MascotMood>('idle')
  const [wingFrame, setWingFrame] = useState(0)
  const [history, setHistory] = useState<LogEntry[]>([])
  const [focusRemaining, setFocusRemaining] = useState<number | null>(null)
  const [thinkingMode, setThinkingMode] = useState(true)

  // Wing flapping animation
  useEffect(() => {
    const timer = setInterval(() => {
      setWingFrame(f => f + 1)
    }, 450)
    return () => clearInterval(timer)
  }, [])

  // Load user data
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetchUserData(creds)
        if (res.allowed === false) {
          setError(res.message || 'Zerf CLI доступен для подписчиков тарифов Plus, Pro и Corp.')
        } else {
          setData(res)
          setMood('idle')
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки данных')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [creds])

  // Focus Timer Tick
  useEffect(() => {
    if (focusRemaining === null || focusRemaining <= 0) return
    const timer = setInterval(() => {
      setFocusRemaining(prev => {
        if (prev === null || prev <= 1) {
          setMood('celebrate')
          setHistory(h => [
            ...h,
            { id: String(Date.now()), type: 'assistant', text: '🔔 Фокус-сессия завершена! Отличная работа.' }
          ])
          setTimeout(() => setMood('idle'), 3500)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [focusRemaining])

  // Keyboard shortcut handlers
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (focusRemaining !== null) {
        setFocusRemaining(null)
        setMood('idle')
        setHistory(h => [
          ...h,
          { id: String(Date.now()), type: 'system', text: '⏸ Фокус-таймер остановлен' }
        ])
        return
      }
      exit()
      return
    }

    if (key.tab) {
      setThinkingMode(prev => !prev)
    }
  })

  const handleCommand = async (val: string) => {
    const raw = val.trim()
    if (!raw) return
    setInputVal('')

    // Add user command to history
    setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }])

    // 1. Slash commands
    if (raw === '/exit' || raw === '/quit') {
      exit()
      return
    }

    if (raw === '/clear') {
      setHistory([])
      return
    }

    if (raw === '/help' || raw === '?') {
      setHistory(h => [
        ...h,
        {
          id: String(Date.now()),
          type: 'assistant',
          text: 'Доступные команды Zerf CLI:',
          details: [
            '/today          — Список задач и привычек на сегодня',
            '/add <текст>    — Создать задачу с датой и временем',
            '/done <поиск>   — Завершить задачу по названию',
            '/note <текст>   — Сохранить заметку в базу знаний',
            '/habit          — Трекер привычек и стрики',
            '/focus [минуты] — Запустить Pomodoro таймер со сферой Тихони',
            '/find <текст>   — Поиск по всем задачам, заметкам и целям',
            '/sync           — Синхронизация с сервером',
            '/clear          — Очистить историю диалога',
            '/exit           — Выйти из CLI',
          ]
        }
      ])
      return
    }

    if (raw === '/today') {
      const tasks = data?.tasks || []
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
      if (todayTasks.length === 0) {
        setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: 'На сегодня задач нет! Отличный день для отдыха.' }])
      } else {
        const lines = todayTasks.map((t: any) => {
          const check = t.status === 'done' ? '✔' : '○'
          const time = t.dueTime ? ` (${t.dueTime})` : ''
          return `${check} ${t.title}${time}`
        })
        setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: `Задачи на сегодня (${todayTasks.length}):`, details: lines }])
      }
      return
    }

    if (raw.startsWith('/focus')) {
      const parts = raw.split(' ')
      const mins = parseInt(parts[1] || '25', 10)
      setFocusRemaining(mins * 60)
      setMood('focus')
      setHistory(h => [
        ...h,
        { id: String(Date.now()), type: 'assistant', text: `☕ Сфера концентрации Тихони запущена на ${mins} мин. (нажмите Ctrl+C для паузы)` }
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
        { id: String(Date.now()), type: 'assistant', text: `✔ Заметка «${noteText.slice(0, 40)}...» сохранена в базе` }
      ])
      setTimeout(() => setMood('idle'), 2500)
      return
    }

    // 2. Natural language query / AI dispatch
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
  const spriteLines = getAllaySpriteLines(mood, wingFrame)

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <Box flexDirection="column" padding={1} width={88}>
      {/* ── Boxed Hero Header (Claude Code v2.1.19 style) ─────────────────── */}
      <Box borderStyle="round" borderColor="cyanBright" flexDirection="row">
        {/* Left Column: Mascot Pixel Art + Profile */}
        <Box flexDirection="column" width={44} paddingX={1} borderStyle="single" borderColor="cyan" borderTop={false} borderBottom={false} borderLeft={false}>
          <Box justifyContent="center" marginBottom={1}>
            <Text bold color="white">С возвращением, {data?.user?.name || 'Кирилл'}!</Text>
          </Box>

          {/* Minecraft Allay (Тихоня) Pixel Art Render */}
          <Box flexDirection="column" alignItems="center" marginY={1}>
            {spriteLines.map((line, idx) => (
              <Text key={idx}>{line}</Text>
            ))}
          </Box>

          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Box gap={1}>
              <Text bold color="cyanBright">Groq AI</Text>
              <Text color="gray">·</Text>
              <Text bold color="greenBright">Zerf {data?.user?.plan?.toUpperCase() || 'CORP'}</Text>
              {data?.user?.username && <Text color="gray">· @{data.user.username}</Text>}
            </Box>
            <Text color="gray" dimColor>~/ZerfNotes/{todayStr}</Text>
          </Box>
        </Box>

        {/* Right Column: Tips & Recent Activity */}
        <Box flexDirection="column" width={42} paddingX={1}>
          <Text bold color="yellow">Советы по началу работы</Text>
          <Box flexDirection="column" marginTop={1} gap={0}>
            <Text color="gray">• <Text color="cyanBright">/today</Text> — задачи на сегодня</Text>
            <Text color="gray">• <Text color="cyanBright">/focus 25</Text> — таймер фокуса</Text>
            <Text color="gray">• <Text color="cyanBright">/done [имя]</Text> — закрыть задачу</Text>
            <Text color="gray">• <Text color="cyanBright">/help</Text> — все команды</Text>
          </Box>

          <Box marginY={1}>
            <Text color="gray" dimColor>───────────────────────────────────</Text>
          </Box>

          <Text bold color="yellow">Активность сегодня</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color="white">
              📋 {todayTasks.length} задач на сегодня {overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''}
            </Text>
            <Text color="yellow">🔥 Стрик продуктивности: 12 дней</Text>
            {focusRemaining !== null && (
              <Box marginTop={1}>
                <Text bold color="cyanBright">☕ Фокус: {formatTimer(focusRemaining)}</Text>
              </Box>
            )}
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

      {/* ── Pinned Bottom Prompt Frame (Claude Code style) ────────────────── */}
      <Box flexDirection="column">
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>
        <Box gap={1} marginY={0}>
          <Text bold color="cyanBright">{'>'}</Text>
          <TextInput
            value={inputVal}
            onChange={setInputVal}
            onSubmit={handleCommand}
            placeholder="Напишите задачу, /today, /focus 25, /help..."
          />
        </Box>
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>

        {/* Footer info bar */}
        <Box justifyContent="space-between" marginTop={0}>
          <Text color="gray" dimColor>? for shortcuts · /today · /focus · /done</Text>
          <Text color="gray" dimColor>
            Thinking {thinkingMode ? 'on' : 'off'} (tab to toggle)
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
