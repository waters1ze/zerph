import React from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH, progressBar } from '../theme.js'
import { StatusBar } from '../StatusBar.js'

export function StatsScreen({ userData }: { userData?: any }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || key.return) {
      setScreen('repl')
    }
  })

  const tasks = userData?.tasks || []
  const doneCount = tasks.filter((t: any) => t.status === 'done').length
  const totalCount = tasks.length || 1
  const efficiency = Math.round((doneCount / totalCount) * 100)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Статистика · за 7 дней</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ЗАДАЧИ</Text>
        <Box gap={2}>
          <Text color="gray">Создано: <Text bold color="white">{tasks.length}</Text></Text>
          <Text color="gray">Закрыто: <Text bold color="white">{doneCount}</Text></Text>
          <Text color="gray">Эффективность: <Text bold color="white">{efficiency}%</Text></Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ЗАКРЫТИЯ ПО ДНЯМ</Text>
        <Box gap={1}><Text color="gray">сб </Text><Text bold color="white">{progressBar(0.8, 6)}</Text><Text color="gray"> 5</Text></Box>
        <Box gap={1}><Text color="gray">вс </Text><Text bold color="white">{progressBar(0.3, 6)}</Text><Text color="gray"> 2</Text></Box>
        <Box gap={1}><Text color="gray">пн </Text><Text bold color="white">{progressBar(0.5, 6)}</Text><Text color="gray"> 3</Text></Box>
        <Box gap={1}><Text color="gray">вт </Text><Text bold color="white">{progressBar(0.7, 6)}</Text><Text color="gray"> 4</Text></Box>
      </Box>

      <Box marginY={0}>
        <Text color="gray">Лучшая серия закрытий: вт 20 авг · 4 задачи</Text>
      </Box>

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Esc — назад в REPL"
      />
    </Box>
  )
}
