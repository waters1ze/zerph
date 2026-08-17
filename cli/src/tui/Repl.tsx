import React, { useState, useEffect } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { Log, type LogEntry } from './Log.js'
import { StatusBar } from './StatusBar.js'
import { GLYPH, formatDate } from './theme.js'
import { setScreen, updateReplState, type ScreenName } from './state.js'
import { makeUniqueId, getInputHistory, pushInputHistory } from './utils.js'
import { handleAddCommand } from './commands/add.js'
import { handleDoneCommand } from './commands/done.js'
import { handleNoteCommand } from './commands/note.js'
import { handleChatCommand } from './commands/chat.js'
import { scaffoldExtension } from '../extensions/registry.js'
import { loadCredentials, loadConfig } from '../api.js'

export function Repl({ userData, onRefresh }: { userData?: any; onRefresh?: () => void }) {
  const { exit } = useApp()
  const [inputVal, setInputVal] = useState('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [historyList] = useState(() => getInputHistory())
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [ctrlCCount, setCtrlCCount] = useState(0)

  const userName = userData?.user?.name || 'Пользователь Zerf'
  const plan = userData?.user?.plan || 'plus'
  const tasks = userData?.tasks || []
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr))
  const overdueTasks = tasks.filter((t: any) => t.dueDate && t.dueDate < todayStr && t.status !== 'done')

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (ctrlCCount >= 1) {
        exit()
      } else {
        setCtrlCCount(1)
        setEntries(e => [...e, { id: makeUniqueId(), type: 'system', text: 'Ещё раз Ctrl+C — выход' }])
        setTimeout(() => setCtrlCCount(0), 2000)
      }
      return
    }

    if (key.ctrl && (input === 'l' || input === 'L')) {
      setEntries([])
      return
    }

    if (key.upArrow && historyList.length > 0) {
      const nextIdx = historyIdx === -1 ? historyList.length - 1 : Math.max(0, historyIdx - 1)
      setHistoryIdx(nextIdx)
      setInputVal(historyList[nextIdx] || '')
      return
    }

    if (key.downArrow && historyIdx !== -1) {
      const nextIdx = historyIdx + 1
      if (nextIdx >= historyList.length) {
        setHistoryIdx(-1)
        setInputVal('')
      } else {
        setHistoryIdx(nextIdx)
        setInputVal(historyList[nextIdx] || '')
      }
    }
  })

  const executeCommand = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return

    pushInputHistory(trimmed)
    setHistoryIdx(-1)
    setInputVal('')
    setEntries(e => [...e, { id: makeUniqueId(), type: 'user', text: trimmed }])

    const creds = loadCredentials()
    const cfg = loadConfig()

    // 1. Navigation slash commands
    if (trimmed === '/today') return setScreen('today')
    if (trimmed === '/cal' || trimmed === '/calendar') return setScreen('cal')
    if (trimmed === '/model' || trimmed === '/ai') return setScreen('model')
    if (trimmed === '/settings') return setScreen('settings')
    if (trimmed === '/friends') return setScreen('friends')
    if (trimmed === '/limits') return setScreen('limits')
    if (trimmed === '/stats') return setScreen('stats')
    if (trimmed === '/ext' || trimmed === '/extensions') return setScreen('extensions')
    if (trimmed === '/help' || trimmed === '?') return setScreen('help')
    if (trimmed === '/clear') return setEntries([])
    if (trimmed === '/exit' || trimmed === '/quit') {
      setEntries(e => [...e, { id: makeUniqueId(), type: 'system', text: 'До встречи! ❖' }])
      setTimeout(() => exit(), 300)
      return
    }

    // 2. Focus timer command
    if (trimmed.startsWith('/focus')) {
      const parts = trimmed.split(' ')
      const mins = parseInt(parts[1] || '25', 10)
      updateReplState({ focusMinutes: isNaN(mins) ? 25 : mins })
      return setScreen('focus')
    }

    // 3. Extension scaffold command
    if (trimmed.startsWith('/ext create')) {
      const name = trimmed.replace('/ext create', '').trim() || 'my-plugin'
      const { dir } = scaffoldExtension(name, 'Кастомный плагин Zerf')
      setEntries(e => [
        ...e,
        { id: makeUniqueId(), type: 'assistant', text: `${GLYPH.ok} Расширение ${name} создано в ${dir}` },
      ])
      return
    }

    // 4. Action mutations
    if (trimmed.startsWith('/add')) {
      const res = await handleAddCommand(trimmed, creds)
      setEntries(e => [...e, { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message }])
      if (onRefresh) onRefresh()
      return
    }

    if (trimmed.startsWith('/done')) {
      const res = await handleDoneCommand(trimmed, tasks, creds)
      setEntries(e => [
        ...e,
        { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message, details: res.details },
      ])
      if (onRefresh) onRefresh()
      return
    }

    if (trimmed.startsWith('/note')) {
      const res = await handleNoteCommand(trimmed, creds)
      setEntries(e => [
        ...e,
        { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message, details: res.details },
      ])
      if (onRefresh) onRefresh()
      return
    }

    // 5. General AI or Friend Chat
    setEntries(e => [...e, { id: makeUniqueId(), type: 'system', text: `${GLYPH.thinking} Думаю…` }])
    const res = await handleChatCommand(trimmed, creds, cfg.model, userData?.friends || [])
    setEntries(e => {
      const filtered = e.filter(item => !item.text.includes('Думаю…'))
      return [...filtered, { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message, details: res.details }]
    })
    if (onRefresh) onRefresh()
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* ── Top Header ── */}
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Zerf — второй мозг</Text>
        <Text color="gray">{userName} · {plan.toUpperCase()} · {formatDate()}</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      {/* ── Mascot & Status line ── */}
      <Box gap={1} marginY={1}>
        <Text bold color="white">{GLYPH.mascotIdle}_{GLYPH.mascotIdle}</Text>
        <Text color="gray">
          {todayTasks.length} {todayTasks.length === 1 ? 'задача' : 'задач'} на сегодня ·{' '}
          {overdueTasks.length > 0 ? `${overdueTasks.length} просрочено · ` : ''}стрик 5 дней
        </Text>
      </Box>

      {/* ── Action History Log ── */}
      <Log entries={entries} />

      {/* ── Input Prompt ── */}
      <Box gap={1} marginY={1}>
        <Text bold color="white">›</Text>
        <TextInput
          value={inputVal}
          onChange={setInputVal}
          onSubmit={executeCommand}
          placeholder="Напишите задачу, вопрос ИИ, /today, /focus, /help..."
        />
      </Box>

      <StatusBar userName={userName} plan={plan} />
    </Box>
  )
}
