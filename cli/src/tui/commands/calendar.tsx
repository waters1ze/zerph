import React from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH } from '../theme.js'
import { StatusBar } from '../StatusBar.js'

export function CalendarScreen({ userData }: { userData?: any }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || key.return) {
      setScreen('repl')
    }
  })

  const today = new Date()
  const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
  const tasks = userData?.tasks || []

  // Generate 7 days
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(today.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const label = `${dayNames[d.getDay()]} ${d.getDate()}`
    const count = tasks.filter((t: any) => t.dueDate && t.dueDate.startsWith(dateStr) && t.status !== 'done').length
    days.push({
      dateStr,
      label,
      count,
      isToday: i === 0,
    })
  }

  const upcomingTasks = tasks
    .filter((t: any) => t.dueDate && t.status !== 'done')
    .sort((a: any, b: any) => (a.dueDate > b.dueDate ? 1 : -1))
    .slice(0, 5)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Календарь · неделя</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      {/* ── 7-day columns ── */}
      <Box flexDirection="row" marginY={1} gap={2}>
        {days.map(d => (
          <Box key={d.dateStr} flexDirection="column" alignItems="center">
            <Text bold color={d.isToday ? 'white' : 'gray'}>
              {d.isToday ? `[${d.label}]` : d.label}
            </Text>
            <Text color={d.count > 0 ? 'white' : 'gray'}>
              {d.count > 0 ? `${d.count} ${d.count === 1 ? 'дело' : 'дела'}` : '—'}
            </Text>
          </Box>
        ))}
      </Box>

      {/* ── Расписание ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">РАСПИСАНИЕ</Text>
        {upcomingTasks.length === 0 ? (
          <Text color="gray">Запланированных задач на эту неделю нет.</Text>
        ) : (
          upcomingTasks.map((t: any, idx: number) => {
            const timeStr = t.dueTime ? ` · ${t.dueTime}` : ''
            return (
              <Box key={`sched_${t.id || idx}`} gap={1}>
                <Text color="gray">{GLYPH.arrow} {t.dueDate}{timeStr}</Text>
                <Text color="white">{t.title}</Text>
              </Box>
            )
          })
        )}
      </Box>

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Esc — назад в REPL"
      />
    </Box>
  )
}
