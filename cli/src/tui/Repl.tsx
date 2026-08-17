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
import { getZefFace, MascotMood } from '../mascot.js'

interface LogEntry {
  id: string
  type: 'user' | 'result' | 'error' | 'system'
  text: string
  icon?: string
}

export function Repl() {
  const { exit } = useApp()
  const [creds] = useState<ZerfCredentials>(() => loadCredentials())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [mood, setMood] = useState<MascotMood>('idle')
  const [history, setHistory] = useState<LogEntry[]>([])
  const [focusRemaining, setFocusRemaining] = useState<number | null>(null)

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
            { id: String(Date.now()), type: 'system', text: 'Фокус-сессия завершена! Отличная работа.', icon: '🔔' }
          ])
          setTimeout(() => setMood('idle'), 3000)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [focusRemaining])

  // Keyboard shortcut for exit
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (focusRemaining !== null) {
        setFocusRemaining(null)
        setMood('idle')
        setHistory(h => [
          ...h,
          { id: String(Date.now()), type: 'system', text: 'Фокус-таймер остановлен', icon: '⏸' }
        ])
        return
      }
      exit()
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

    if (raw === '/help') {
      setHistory(h => [
        ...h,
        { id: String(Date.now()), type: 'system', text: 'Доступные команды:', icon: '💡' },
        { id: String(Date.now() + 1), type: 'result', text: '/today — Задачи на сегодня' },
        { id: String(Date.now() + 2), type: 'result', text: '/done <название> — Завершить задачу' },
        { id: String(Date.now() + 3), type: 'result', text: '/focus [минуты] — Запустить Pomodoro таймер' },
        { id: String(Date.now() + 4), type: 'result', text: '/habit — Трекер полезных привычек' },
        { id: String(Date.now() + 5), type: 'result', text: '/clear — Очистить экран' },
        { id: String(Date.now() + 6), type: 'result', text: '/exit — Выйти из REPL' },
      ])
      return
    }

    if (raw === '/today') {
      const tasks = data?.tasks || []
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
      if (todayTasks.length === 0) {
        setHistory(h => [...h, { id: String(Date.now()), type: 'system', text: 'На сегодня задач нет!', icon: '✨' }])
      } else {
        todayTasks.forEach((t: any) => {
          const check = t.status === 'done' ? '✔' : '○'
          const time = t.dueTime ? ` в ${t.dueTime}` : ''
          setHistory(h => [...h, { id: String(Date.now() + Math.random()), type: 'result', text: `${check} ${t.title}${time}` }])
        })
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
        { id: String(Date.now()), type: 'system', text: `Сфера концентрации активна на ${mins} мин.`, icon: '☕' }
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
          { id: String(Date.now()), type: 'result', text: `задача «${match.title}» закрыта!`, icon: '✔' }
        ])
        setTimeout(() => setMood('idle'), 2500)
      } else {
        setHistory(h => [
          ...h,
          { id: String(Date.now()), type: 'error', text: `Задача не найдена по запросу: "${query}"`, icon: '✖' }
        ])
      }
      return
    }

    // 2. Natural language query / AI dispatch
    setMood('thinking')
    try {
      const res = await mutateItem(creds, {
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
        { id: String(Date.now()), type: 'result', text: `задача «${raw}» сохранена`, icon: '✔' }
      ])
      setTimeout(() => setMood('idle'), 2500)
    } catch (e: any) {
      setMood('alert')
      setHistory(h => [
        ...h,
        { id: String(Date.now()), type: 'error', text: `Ошибка: ${e.message}`, icon: '✖' }
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

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <Box flexDirection="column" padding={1} width={85}>
      {/* Top Banner (Strict style) */}
      <Box flexDirection="column" marginBottom={1}>
        <Box justifyContent="space-between">
          <Box gap={1}>
            <Text color="cyan">❖</Text>
            <Text bold color="white">Zerf — второй мозг</Text>
          </Box>
          <Box gap={1}>
            <Text color="gray">{data?.user?.name || 'Пользователь'}</Text>
            <Text color="gray">·</Text>
            <Text bold color="greenBright">{data?.user?.plan?.toUpperCase() || 'PLUS'}</Text>
            <Text color="gray">·</Text>
            <Text color="yellow">стрик 12 🔥</Text>
          </Box>
        </Box>
        <Text color="gray" dimColor>──────────────────────────────────────────────────────────</Text>
      </Box>

      {/* Mascot Status Line */}
      <Box gap={1} marginBottom={1}>
        <Text>{getZefFace(mood)}</Text>
        {focusRemaining !== null ? (
          <Text color="cyanBright">
            {formatTimer(focusRemaining)} … сфера концентрации активна (Ctrl+C для паузы)
          </Text>
        ) : (
          <Text color="gray">
            {todayTasks.length} задач на сегодня{overdueTasks.length > 0 ? `, ${overdueTasks.length} просрочено` : ''}
          </Text>
        )}
      </Box>

      {/* REPL History Feed */}
      {history.map(item => (
        <Box key={item.id} gap={1} marginLeft={item.type === 'user' ? 0 : 2} marginBottom={0}>
          {item.type === 'user' ? (
            <>
              <Text bold color="cyanBright">{'>'}</Text>
              <Text color="white">{item.text}</Text>
            </>
          ) : item.type === 'error' ? (
            <>
              <Text color="red">{item.icon || '✖'}</Text>
              <Text color="red">{item.text}</Text>
            </>
          ) : (
            <>
              <Text color="green">{item.icon || '✔'}</Text>
              <Text color="gray">{item.text}</Text>
            </>
          )}
        </Box>
      ))}

      {/* REPL Prompt Line */}
      <Box marginTop={history.length > 0 ? 1 : 0}>
        <Text bold color="cyanBright">{'>'} </Text>
        <TextInput
          value={inputVal}
          onChange={setInputVal}
          onSubmit={handleCommand}
          placeholder="купи хлеб, /today, /focus 25, /help..."
        />
      </Box>
    </Box>
  )
}
