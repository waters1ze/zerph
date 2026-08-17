import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import Spinner from 'ink-spinner'
import TextInput from 'ink-text-input'
import { fetchUserData, loadConfig, mutateItem, ZerfConfig } from '../api.js'
import { getAllayAscii, MascotMood } from '../mascot.js'

interface AppProps {
  initialTab?: number
}

export function App({ initialTab = 0 }: AppProps) {
  const { exit } = useApp()
  const [config] = useState<ZerfConfig>(() => loadConfig())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [promptInput, setPromptInput] = useState('')
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle')
  const [wingFrame, setWingFrame] = useState(0)

  const TABS = [
    { key: 'today', label: '1. Сегодня', icon: '📋' },
    { key: 'tasks', label: '2. Все задачи', icon: '✔' },
    { key: 'notes', label: '3. Заметки', icon: '📝' },
    { key: 'goals', label: '4. Цели', icon: '🎯' },
    { key: 'habits', label: '5. Привычки', icon: '🔄' },
    { key: 'focus', label: '6. Фокус', icon: '⏱' },
    { key: 'extensions', label: '7. Расширения', icon: '🧩' },
  ]

  // Flapping wings animation effect
  useEffect(() => {
    const timer = setInterval(() => {
      setWingFrame(f => f + 1)
    }, 450)
    return () => clearInterval(timer)
  }, [])

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetchUserData(config)
        if (res.allowed === false) {
          setError(res.message || 'Zerf CLI доступен только для тарифов Pro и Corp.')
        } else {
          setData(res)
          setMascotMood('idle')
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки данных')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [config])

  // Keyboard navigation
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit()
      return
    }

    if (input === '1') setActiveTab(0)
    if (input === '2') setActiveTab(1)
    if (input === '3') setActiveTab(2)
    if (input === '4') setActiveTab(3)
    if (input === '5') setActiveTab(4)
    if (input === '6') setActiveTab(5)
    if (input === '7') setActiveTab(6)
  })

  // Handle task toggling
  const handleToggleTask = async (taskId: string) => {
    if (!data) return
    try {
      setMascotMood('celebrate')
      await mutateItem(config, { action: 'toggle_task', id: taskId })
      // Update local state optimistically
      setData((prev: any) => ({
        ...prev,
        tasks: prev.tasks.map((t: any) => t.id === taskId ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t)
      }))
      setTimeout(() => setMascotMood('idle'), 2500)
    } catch {}
  }

  // Handle natural language query
  const handlePromptSubmit = async (value: string) => {
    if (!value.trim()) return
    setMascotMood('thinking')
    setAiMessage(`Думаю над: "${value}"...`)
    setPromptInput('')

    try {
      const res = await fetch(`${config.apiUrl || 'https://zeprh.vercel.app'}/api/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: value }),
      })
      const respData = await res.json()
      setAiMessage(respData.reply || 'Задача обработана!')
      setMascotMood('celebrate')
      setTimeout(() => setMascotMood('idle'), 3000)
    } catch (e: any) {
      setAiMessage(`Ошибка: ${e.message}`)
      setMascotMood('alert')
    }
  }

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box gap={1}>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text color="cyanBright">Синхронизация Zerf CLI с облаком...</Text>
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={2} borderStyle="round" borderColor="yellow">
        <Text bold color="yellow">👑 Требуется подписка Pro или Corp</Text>
        <Box marginTop={1}>
          <Text color="gray">{error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="cyan">Оформить подписку: </Text>
          <Text underline color="blueBright">https://t.me/Zerph_bot?start=buy</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Нажмите Ctrl+C для выхода</Text>
        </Box>
      </Box>
    )
  }

  const tasks = data?.tasks || []
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
  const notes = data?.notes || []
  const habits = data?.habits || []
  const goals = data?.goals || []

  return (
    <Box flexDirection="column" padding={1} width={90}>
      {/* Top Bar with Mascot & User Stats */}
      <Box justifyContent="space-between" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box flexDirection="column">
          <Box gap={1}>
            <Text bold color="cyanBright">✦ ZERF NOTE CLI</Text>
            <Text color="gray">|</Text>
            <Text color="white">{data?.user?.name || 'User'}</Text>
            <Text color="greenBright">[{data?.user?.plan?.toUpperCase() || 'PRO'}]</Text>
            <Text color="yellow">🔥 1</Text>
          </Box>
          <Text color="gray" dimColor>Клавиши 1-7: Переключение разделов | Ctrl+C: Выход</Text>
        </Box>

        <Box gap={1} alignItems="center">
          <Text color="cyan">{getAllayAscii(mascotMood, wingFrame)[1]}</Text>
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Box marginY={1} gap={1}>
        {TABS.map((tab, idx) => (
          <Box key={tab.key} paddingX={1} borderStyle={activeTab === idx ? 'bold' : 'single'} borderColor={activeTab === idx ? 'cyanBright' : 'gray'}>
            <Text bold={activeTab === idx} color={activeTab === idx ? 'cyanBright' : 'gray'}>
              {tab.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Main Content Area */}
      <Box flexDirection="column" minHeight={12} borderStyle="round" borderColor="gray" padding={1}>
        {activeTab === 0 && (
          <Box flexDirection="column">
            <Text bold color="cyanBright">📋 Задачи на сегодня ({todayTasks.length}):</Text>
            {todayTasks.length === 0 ? (
              <Box marginTop={1}>
                <Text color="gray" italic>На сегодня задач нет! Отличный день для отдыха или новых целей.</Text>
              </Box>
            ) : (
              todayTasks.slice(0, 10).map((t: any) => (
                <Box key={t.id} gap={1} marginTop={1}>
                  <Text color={t.status === 'done' ? 'green' : 'gray'}>
                    {t.status === 'done' ? '[✔]' : '[ ]'}
                  </Text>
                  <Text strikethrough={t.status === 'done'} color={t.status === 'done' ? 'gray' : 'white'}>
                    {t.title}
                  </Text>
                  {t.dueTime && <Text color="cyan">({t.dueTime})</Text>}
                  {t.priority === 'urgent' && <Text color="red">[Срочно]</Text>}
                </Box>
              ))
            )}
          </Box>
        )}

        {activeTab === 1 && (
          <Box flexDirection="column">
            <Text bold color="cyanBright">✔ Все задачи ({tasks.length}):</Text>
            {tasks.slice(0, 12).map((t: any) => (
              <Box key={t.id} gap={1} marginTop={1}>
                <Text color={t.status === 'done' ? 'green' : 'gray'}>
                  {t.status === 'done' ? '[✔]' : '[ ]'}
                </Text>
                <Text strikethrough={t.status === 'done'} color={t.status === 'done' ? 'gray' : 'white'}>
                  {t.title}
                </Text>
                {t.dueDate && <Text color="gray">({t.dueDate.slice(0, 10)})</Text>}
              </Box>
            ))}
          </Box>
        )}

        {activeTab === 2 && (
          <Box flexDirection="column">
            <Text bold color="cyanBright">📝 Ваши заметки и База знаний ({notes.length}):</Text>
            {notes.slice(0, 8).map((n: any) => (
              <Box key={n.id} flexDirection="column" marginTop={1} paddingLeft={1} borderStyle="single" borderColor="gray">
                <Text bold color="white">{n.title || 'Без названия'}</Text>
                <Text color="gray" dimColor>{(n.content || '').slice(0, 90)}</Text>
              </Box>
            ))}
          </Box>
        )}

        {activeTab === 3 && (
          <Box flexDirection="column">
            <Text bold color="cyanBright">🎯 Глобальные цели и спринты ({goals.length}):</Text>
            {goals.slice(0, 6).map((g: any) => (
              <Box key={g.id} gap={1} marginTop={1}>
                <Text color="yellow">◈</Text>
                <Text bold color="white">{g.title}</Text>
                <Text color="green">[{g.progress || 0}%]</Text>
              </Box>
            ))}
          </Box>
        )}

        {activeTab === 4 && (
          <Box flexDirection="column">
            <Text bold color="cyanBright">🔄 Трекер полезных привычек ({habits.length}):</Text>
            {habits.slice(0, 6).map((h: any) => (
              <Box key={h.id} gap={1} marginTop={1}>
                <Text color="cyan">✦</Text>
                <Text color="white">{h.title}</Text>
                <Text color="yellow">🔥 Стрик: {h.streak || 0} дн.</Text>
              </Box>
            ))}
          </Box>
        )}

        {activeTab === 5 && (
          <Box flexDirection="column" alignItems="center" justifyContent="center">
            <Text bold color="cyanBright">⏱ Режим Фокуса (Pomodoro Zen)</Text>
            <Box marginY={1} borderStyle="double" borderColor="cyan" paddingX={4} paddingY={1}>
              <Text bold color="white">25:00</Text>
            </Box>
            <Text color="gray">Маскот Эллей хранит ваш фокус. Уведомление прозвучит по окончании.</Text>
          </Box>
        )}

        {activeTab === 6 && (
          <Box flexDirection="column">
            <Text bold color="cyanBright">🧩 Генератор расширений Zerf AI:</Text>
            <Box marginTop={1}>
              <Text color="gray">
                Введите в строку внизу: <Text color="cyan">создай расширение [ваша идея]</Text>
              </Text>
            </Box>
            <Text color="gray" dimColor>
              Нейросеть автоматически напишет код, стили и подключит виджет к вашему интерфейсу!
            </Text>
          </Box>
        )}
      </Box>

      {/* AI Assistant Bubble if active */}
      {aiMessage && (
        <Box borderStyle="round" borderColor="cyanBright" marginY={1} paddingX={1}>
          <Text color="cyan">🤖 Зёрф-Эллей: </Text>
          <Text color="white">{aiMessage}</Text>
        </Box>
      )}

      {/* Interactive Command / Natural Language Bar */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
        <Text color="cyanBright">✦ Запрос к Zerf AI: </Text>
        <TextInput
          value={promptInput}
          onChange={setPromptInput}
          onSubmit={handlePromptSubmit}
          placeholder="Напишите задачу, вопрос или команду..."
        />
      </Box>
    </Box>
  )
}
