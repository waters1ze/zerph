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

type TabType = 'repl' | 'today' | 'cal' | 'chat' | 'limits'

interface LogEntry {
  id: string
  type: 'user' | 'assistant' | 'error' | 'system'
  text: string
  details?: string[]
}

interface ChatMessage {
  id: string
  from: string
  text: string
  time: string
  isMe: boolean
}

const SLASH_COMMANDS = [
  { cmd: '/today', desc: 'Задачи и привычки на сегодня', cat: 'Планирование' },
  { cmd: '/add', desc: 'Создать задачу (<текст> [дата/время])', cat: 'Планирование' },
  { cmd: '/done', desc: 'Завершить задачу по названию', cat: 'Планирование' },
  { cmd: '/cal', desc: 'Календарь недели и расписание', cat: 'Просмотр' },
  { cmd: '/chat', desc: 'Чат с другом в терминале', cat: 'Команда' },
  { cmd: '/friends', desc: 'Список друзей и совместные дела', cat: 'Команда' },
  { cmd: '/note', desc: 'Сохранить заметку в базу знаний', cat: 'База знаний' },
  { cmd: '/focus', desc: 'Pomodoro таймер со сферой Тихони', cat: 'Продуктивность' },
  { cmd: '/limits', desc: 'Статус использования лимитов', cat: 'Система' },
  { cmd: '/clear', desc: 'Очистить экран терминала', cat: 'Система' },
  { cmd: '/help', desc: 'Справка и горячие клавиши', cat: 'Система' },
  { cmd: '/exit', desc: 'Выйти из Zerf CLI', cat: 'Система' },
]

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
  const [activeTab, setActiveTab] = useState<TabType>('repl')
  const [cliCount, setCliCount] = useState<number>(0)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', from: 'Вовчик', text: 'Привет! По проекту всё готово к релизу?', time: '17:40', isMe: false },
    { id: '2', from: 'Вы', text: 'Да, собираю финальный билд CLI терминала.', time: '17:42', isMe: true },
  ])

  // Wing flapping animation
  useEffect(() => {
    const timer = setInterval(() => {
      setWingFrame(f => f + 1)
    }, 450)
    return () => clearInterval(timer)
  }, [])

  // Load user data
  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetchUserData(creds)
      if (res.allowed === false) {
        setError(res.message || 'Zerf CLI доступен для подписчиков Plus, Pro и Corp.')
      } else {
        setData(res)
        setCliCount(res.limits?.cliUsed || 0)
        setMood('idle')
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

    // Tab key switches windows
    if (key.tab) {
      const tabs: TabType[] = ['repl', 'today', 'cal', 'chat', 'limits']
      const nextIdx = (tabs.indexOf(activeTab) + 1) % tabs.length
      setActiveTab(tabs[nextIdx])
      return
    }

    if (input === '?' && !inputVal) {
      setShowHelpModal(prev => !prev)
      return
    }

    if (key.escape && showHelpModal) {
      setShowHelpModal(false)
      return
    }
  })

  const handleCommand = async (val: string) => {
    const raw = val.trim()
    if (!raw) return
    setInputVal('')
    setShowHelpModal(false)

    // Add user command to history
    setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }])
    setCliCount(c => c + 1)

    // 1. Slash commands & window navigation
    if (raw === '/exit' || raw === '/quit') {
      exit()
      return
    }

    if (raw === '/clear') {
      setHistory([])
      return
    }

    if (raw === '/help' || raw === '?') {
      setShowHelpModal(true)
      return
    }

    if (raw === '/today' || raw === '/задачи') {
      setActiveTab('today')
      return
    }

    if (raw === '/cal' || raw === '/календарь') {
      setActiveTab('cal')
      return
    }

    if (raw === '/chat' || raw === '/чат' || raw === '/friends' || raw === '/друзья') {
      setActiveTab('chat')
      return
    }

    if (raw === '/limits' || raw === '/лимиты' || raw === '/usage') {
      setActiveTab('limits')
      return
    }

    if (raw === '/repl' || raw === '/ai') {
      setActiveTab('repl')
      return
    }

    // Direct chat message to friend: /chat [текст]
    if (raw.startsWith('/chat ') || activeTab === 'chat') {
      const msgText = raw.startsWith('/chat ') ? raw.replace('/chat ', '').trim() : raw
      if (msgText) {
        const newMsg: ChatMessage = {
          id: String(Date.now()),
          from: data?.user?.name || 'Вы',
          text: msgText,
          time: new Date().toTimeString().slice(0, 5),
          isMe: true,
        }
        setChatMessages(prev => [...prev, newMsg])
        setMood('celebrate')
        setTimeout(() => {
          setChatMessages(prev => [
            ...prev,
            {
              id: String(Date.now() + 1),
              from: 'Вовчик',
              text: `Принято: «${msgText}». Сейчас гляну! 👍`,
              time: new Date().toTimeString().slice(0, 5),
              isMe: false,
            }
          ])
          setMood('idle')
        }, 1200)
        return
      }
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
        { id: String(Date.now()), type: 'assistant', text: `✔ Заметка «${noteText.slice(0, 40)}...» сохранена в базе знаний` }
      ])
      setTimeout(() => setMood('idle'), 2500)
      return
    }

    // 2. Natural language query / AI task creation
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
      // Refresh local tasks list
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
  const activeTodayTasks = todayTasks.filter((t: any) => t.status !== 'done')
  const doneTodayTasks = todayTasks.filter((t: any) => t.status === 'done')
  const overdueTasks = tasks.filter((t: any) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr)
  const spriteLines = getAllaySpriteLines(mood, wingFrame)
  const limits = data?.limits
  const planTag = (data?.user?.plan || 'corp').toUpperCase()
  const habits = data?.habits || []
  const friends = data?.friends || []

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Filter slash command suggestions
  const isSlashInput = inputVal.startsWith('/')
  const suggestions = isSlashInput
    ? SLASH_COMMANDS.filter(s => s.cmd.startsWith(inputVal.toLowerCase()))
    : []

  return (
    <Box flexDirection="column" padding={1} width={92}>
      {/* ── Top Tabs Navigation Bar (Gemini / Claude CLI style) ──────────── */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between" marginBottom={0}>
        <Box gap={2}>
          <Text bold color={activeTab === 'repl' ? 'cyanBright' : 'gray'}>
            {activeTab === 'repl' ? '● [1] ❖ REPL' : '○ [1] ❖ REPL'}
          </Text>
          <Text bold color={activeTab === 'today' ? 'cyanBright' : 'gray'}>
            {activeTab === 'today' ? '● [2] 📋 Сегодня' : '○ [2] 📋 Сегодня'}
          </Text>
          <Text bold color={activeTab === 'cal' ? 'cyanBright' : 'gray'}>
            {activeTab === 'cal' ? '● [3] 📅 Календарь' : '○ [3] 📅 Календарь'}
          </Text>
          <Text bold color={activeTab === 'chat' ? 'cyanBright' : 'gray'}>
            {activeTab === 'chat' ? '● [4] 💬 Чат & Друзья' : '○ [4] 💬 Чат & Друзья'}
          </Text>
          <Text bold color={activeTab === 'limits' ? 'cyanBright' : 'gray'}>
            {activeTab === 'limits' ? '● [5] ⚡ Лимиты' : '○ [5] ⚡ Лимиты'}
          </Text>
        </Box>
        <Text color="gray" dimColor>Tab: сменить окно</Text>
      </Box>

      {/* ── Active Window Content ────────────────────────────────────────── */}

      {/* 1. REPL Window (Claude Code style) */}
      {activeTab === 'repl' && (
        <Box flexDirection="column">
          {/* Boxed Hero Header */}
          <Box borderStyle="round" borderColor="cyan" flexDirection="row">
            {/* Left Column: Minecraft Allay Pixel Sprite */}
            <Box flexDirection="column" width={44} paddingX={1} borderStyle="single" borderColor="gray" borderTop={false} borderBottom={false} borderLeft={false}>
              <Box justifyContent="center" marginBottom={1}>
                <Text bold color="white">С возвращением, {data?.user?.name || 'Кирилл'}!</Text>
              </Box>

              {/* Cute Boxy Minecraft Allay Sprite */}
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

            {/* Right Column: Quick Tips & Live Activity */}
            <Box flexDirection="column" width={44} paddingX={1}>
              <Text bold color="yellow">Советы & Шорткаты</Text>
              <Box flexDirection="column" marginTop={1} gap={0}>
                <Text color="gray">• <Text color="cyanBright">/today</Text> — открыть окно задач</Text>
                <Text color="gray">• <Text color="cyanBright">/cal</Text> — открыть календарь</Text>
                <Text color="gray">• <Text color="cyanBright">/chat</Text> — чат с коллегой</Text>
                <Text color="gray">• <Text color="cyanBright">/focus 25</Text> — помодоро-таймер</Text>
              </Box>

              <Box marginY={1}>
                <Text color="gray" dimColor>───────────────────────────────────</Text>
              </Box>

              <Text bold color="yellow">Сводка на сегодня</Text>
              <Box flexDirection="column" marginTop={1}>
                <Text color="white">
                  📋 Задач: {todayTasks.length} {overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''}
                </Text>
                <Text color="yellow">🔥 Стрик: 12 дней</Text>
                {focusRemaining !== null && (
                  <Box marginTop={1}>
                    <Text bold color="cyanBright">☕ Фокус: {formatTimer(focusRemaining)}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Action History Feed */}
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
        </Box>
      )}

      {/* 2. Today Window (Tasks & Habits) */}
      {activeTab === 'today' && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color="white">📋 Задачи и привычки на сегодня ({todayStr})</Text>
            <Text color="gray">Всего дел: {todayTasks.length}</Text>
          </Box>

          {/* Active Tasks */}
          <Text bold color="cyanBright">В процессе ({activeTodayTasks.length}):</Text>
          {activeTodayTasks.length === 0 ? (
            <Text color="gray" dimColor>   Все задачи на сегодня выполнены!</Text>
          ) : (
            activeTodayTasks.map((t: any) => (
              <Box key={t.id} marginLeft={1}>
                <Text color="gray">[ ] </Text>
                <Text color="white">{t.title}</Text>
                {t.dueTime && <Text color="cyanBright"> ({t.dueTime})</Text>}
                {t.isShared && <Text color="yellow"> [Команда]</Text>}
              </Box>
            ))
          )}

          {/* Completed Tasks */}
          {doneTodayTasks.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="greenBright">Завершено ({doneTodayTasks.length}):</Text>
              {doneTodayTasks.map((t: any) => (
                <Box key={t.id} marginLeft={1}>
                  <Text color="greenBright">[✔] </Text>
                  <Text color="gray" strikethrough>{t.title}</Text>
                  {t.dueTime && <Text color="gray"> ({t.dueTime})</Text>}
                </Box>
              ))}
            </Box>
          )}

          {/* Habits */}
          <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
            <Text bold color="yellow">Привычки и трекер:</Text>
            {habits.length === 0 ? (
              <Text color="gray" dimColor>Привычки не настроены. Создайте их в боте или веб-версии.</Text>
            ) : (
              habits.map((h: any) => (
                <Box key={h.id} justifyContent="space-between">
                  <Text color="white">• {h.title}</Text>
                  <Text color="cyanBright">[████████░░] 80% (стрик 12)</Text>
                </Box>
              ))
            )}
          </Box>
        </Box>
      )}

      {/* 3. Calendar Window */}
      {activeTab === 'cal' && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color="white">📅 Календарь на неделю</Text>
            <Text color="yellow">Сегодня: {todayStr}</Text>
          </Box>

          <Box flexDirection="row" justifyContent="space-between" borderStyle="single" borderColor="gray" padding={1}>
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, idx) => (
              <Box key={day} flexDirection="column" alignItems="center" width={10}>
                <Text bold color={idx === 0 ? 'cyanBright' : 'white'}>{day}</Text>
                <Text color="gray" dimColor>────────</Text>
                <Text color={idx === 0 ? 'greenBright' : 'gray'}>
                  {idx === 0 ? `${todayTasks.length} задач` : '—'}
                </Text>
              </Box>
            ))}
          </Box>

          <Box marginTop={1}>
            <Text color="gray">💡 Для добавления встречи напишите: <Text color="cyanBright">встреча с командой в пятницу в 15:00</Text></Text>
          </Box>
        </Box>
      )}

      {/* 4. Chat & Friends Window */}
      {activeTab === 'chat' && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color="white">💬 Командный чат & Заметки друзьям</Text>
            <Text color="greenBright">● Онлайн: Вовчик, Лера</Text>
          </Box>

          {/* Chat Messages Feed */}
          <Box flexDirection="column" height={8} borderStyle="single" borderColor="gray" paddingX={1} marginY={0}>
            {chatMessages.map(msg => (
              <Box key={msg.id} gap={1}>
                <Text color="gray">[{msg.time}]</Text>
                <Text bold color={msg.isMe ? 'cyanBright' : 'yellow'}>{msg.from}:</Text>
                <Text color="white">{msg.text}</Text>
              </Box>
            ))}
          </Box>

          <Box marginTop={1}>
            <Text color="gray">
              Отправка сообщения: просто напишите текст внизу и нажмите <Text bold color="white">Enter</Text>
            </Text>
          </Box>
        </Box>
      )}

      {/* 5. Limits & Account Quotas Window */}
      {activeTab === 'limits' && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color="white">⚡ Статус лимитов и квот ({planTag})</Text>
            <Text color="greenBright">Активен</Text>
          </Box>

          <Box flexDirection="column" gap={1}>
            <Box justifyContent="space-between">
              <Text color="white">• Запросы в CLI терминале:</Text>
              <Text bold color="cyanBright">{cliCount} / {limits?.maxCli || '∞'} [██░░░░░░░░]</Text>
            </Box>
            <Box justifyContent="space-between">
              <Text color="white">• Распознавание голоса:</Text>
              <Text bold color="cyanBright">{Math.floor((limits?.voiceUsedSeconds || 0) / 60)} / {limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60)} мин</Text>
            </Box>
            <Box justifyContent="space-between">
              <Text color="white">• ИИ сообщения & парсинг:</Text>
              <Text bold color="cyanBright">{limits?.chatUsed || 0} / {limits?.maxChat || '∞'}</Text>
            </Box>
            <Box justifyContent="space-between">
              <Text color="white">• Заметки в базе знаний:</Text>
              <Text bold color="cyanBright">{limits?.notesCount || 0} / {limits?.maxNotes || '∞'}</Text>
            </Box>
            <Box justifyContent="space-between">
              <Text color="white">• Запросы через Siri:</Text>
              <Text bold color="cyanBright">0 / 25 000</Text>
            </Box>
          </Box>

          <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
            <Text color="gray" dimColor>
              Для тарифа {planTag} лимиты рассчитаны с огромным запасом на команду до 4 человек.
              Сброс суточных счётчиков происходит ежедневно в 00:00 МСК.
            </Text>
          </Box>
        </Box>
      )}

      {/* ── Floating Autocomplete Popup for '/' ───────────────────────────── */}
      {isSlashInput && suggestions.length > 0 && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginY={0}>
          <Text bold color="yellow">Команды Zerf CLI:</Text>
          {suggestions.map((s, idx) => (
            <Box key={s.cmd} gap={1}>
              <Text bold color="cyanBright">{s.cmd.padEnd(10)}</Text>
              <Text color="gray">— {s.desc}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Quick Help Modal for '?' ─────────────────────────────────────── */}
      {showHelpModal && (
        <Box flexDirection="column" borderStyle="double" borderColor="cyanBright" padding={1} marginY={1}>
          <Box justifyContent="space-between">
            <Text bold color="cyanBright">📖 Справка и горячие клавиши Zerf CLI</Text>
            <Text color="gray">ESC для закрытия</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} gap={0}>
            <Text color="white">• <Text bold color="cyanBright">Tab</Text> — переключение между окнами (REPL / Сегодня / Календарь / Чат / Лимиты)</Text>
            <Text color="white">• <Text bold color="cyanBright">/today</Text> — перейти в список задач на сегодня</Text>
            <Text color="white">• <Text bold color="cyanBright">/cal</Text> — открыть недельный календарь</Text>
            <Text color="white">• <Text bold color="cyanBright">/chat</Text> — открыть командный чат с коллегой</Text>
            <Text color="white">• <Text bold color="cyanBright">/focus 25</Text> — запустить Pomodoro таймер концентрации</Text>
            <Text color="white">• <Text bold color="cyanBright">/done [текст]</Text> — закрыть задачу</Text>
            <Text color="white">• <Text bold color="cyanBright">/note [текст]</Text> — сохранить заметку</Text>
            <Text color="white">• <Text bold color="cyanBright">Ctrl + C</Text> — остановить фокус-таймер или выйти</Text>
          </Box>
        </Box>
      )}

      {/* ── Pinned Bottom Prompt Frame (Claude Code style) ────────────────── */}
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>
        <Box gap={1} marginY={0}>
          <Text bold color="cyanBright">{'>'}</Text>
          <TextInput
            value={inputVal}
            onChange={setInputVal}
            onSubmit={handleCommand}
            placeholder={
              activeTab === 'chat'
                ? 'Напишите сообщение в чат другу...'
                : 'Напишите задачу, /today, /cal, /chat, /focus 25, ? для помощи...'
            }
          />
        </Box>
        <Text color="gray" dimColor>────────────────────────────────────────────────────────────────────────────</Text>

        {/* Footer info & limits bar */}
        <Box justifyContent="space-between" marginTop={0}>
          <Text color="gray" dimColor>? for help · Tab: переключить окно</Text>
          <Text color="gray" dimColor>
            [{planTag}: {cliCount}/{limits?.maxCli || '∞'} CLI | {Math.floor((limits?.voiceUsedSeconds || 0) / 60)}/{limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60)}м голос]
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
