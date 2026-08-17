import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH, formatCountdown, progressBar, formatDate } from '../theme.js'
import { StatusBar } from '../StatusBar.js'
import { mutateItem, loadCredentials } from '../../api.js'

export function TodayScreen({ userData, onRefresh }: { userData?: any; onRefresh?: () => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const tasks = userData?.tasks || []
  const habits = userData?.habits || []
  const goals = userData?.goals || []

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter((t: any) => !t.dueDate || t.dueDate.startsWith(todayStr) || (t.dueDate < todayStr && t.status !== 'done'))

  useInput(async (input, key) => {
    if (key.escape || input === 'q') {
      setScreen('repl')
      return
    }

    if (key.upArrow) {
      setSelectedIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, todayTasks.length - 1)))
      return
    }

    if (key.downArrow) {
      setSelectedIdx(prev => (prev < todayTasks.length - 1 ? prev + 1 : 0))
      return
    }

    if (input === ' ' && todayTasks.length > 0) {
      const task = todayTasks[selectedIdx]
      if (task) {
        try {
          const creds = loadCredentials()
          await mutateItem(creds, { action: 'toggle_task', id: task.id })
          task.status = task.status === 'done' ? 'todo' : 'done'
          setStatusMsg(`${GLYPH.ok} Статус задачи «${task.title}» обновлен`)
          setTimeout(() => setStatusMsg(null), 2500)
          if (onRefresh) onRefresh()
        } catch (e: any) {
          setStatusMsg(`${GLYPH.cancel} Ошибка: ${e.message}`)
        }
      }
    }
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Сегодня · {formatDate()}</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      {statusMsg && (
        <Box marginY={0}>
          <Text bold color="green">{statusMsg}</Text>
        </Box>
      )}

      {/* ── Задачи ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ЗАДАЧИ</Text>
        {todayTasks.length === 0 ? (
          <Text color="gray">На сегодня задач нет. /add — добавить первую</Text>
        ) : (
          todayTasks.map((t: any, idx: number) => {
            const isSel = idx === selectedIdx
            const isDone = t.status === 'done'
            const checkbox = isDone ? GLYPH.taskDone : GLYPH.taskTodo
            const countdown = formatCountdown(t.dueDate, t.dueTime, t.status)
            const prio = t.priority === 'urgent' ? ' [Срочно]' : t.priority === 'high' ? ' [Высокий]' : ''

            return (
              <Box key={`task_${t.id || idx}`} gap={1}>
                <Text bold color={isSel ? 'white' : 'gray'}>
                  {isSel ? '▸ ' : '  '}{checkbox} {t.title}{prio}
                </Text>
                <Text color="gray">· {countdown}</Text>
              </Box>
            )
          })
        )}
      </Box>

      {/* ── Привычки ── */}
      {habits.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color="white">ПРИВЫЧКИ</Text>
          {habits.slice(0, 5).map((h: any, idx: number) => {
            const target = h.targetDays || 10
            const current = h.currentStreak || h.progress || 3
            const bar = progressBar(current / target, 8)
            return (
              <Box key={`habit_${h.id || idx}`} gap={1}>
                <Text color="gray">{GLYPH.arrow} {h.title.padEnd(16)}</Text>
                <Text bold color="white">{bar}</Text>
                <Text color="gray">{current}/{target} · стрик {current} дн.</Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* ── Цели ── */}
      {goals.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color="white">ЦЕЛИ</Text>
          {goals.slice(0, 3).map((g: any, idx: number) => {
            const prog = typeof g.progress === 'number' ? g.progress : 50
            const bar = progressBar(prog / 100, 8)
            return (
              <Box key={`goal_${g.id || idx}`} gap={1}>
                <Text color="gray">{GLYPH.arrow} {g.title.padEnd(20)}</Text>
                <Text bold color="white">{bar}</Text>
                <Text color="gray">{prog}%</Text>
              </Box>
            )
          })}
        </Box>
      )}

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Space — переключить │ ↑/↓ — выбор │ Esc — назад"
      />
    </Box>
  )
}
