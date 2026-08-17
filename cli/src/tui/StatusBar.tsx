import React from 'react'
import { Box, Text } from 'ink'
import { GLYPH, divider } from './theme.js'

interface StatusBarProps {
  userName?: string
  plan?: string
  hint?: string
}

export function StatusBar({ userName = 'Пользователь Zerf', plan = 'plus', hint }: StatusBarProps) {
  const planTag = plan ? plan.toUpperCase() : 'FREE'
  const defaultHint = '/help — справка │ Ctrl+C — выход'

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>
      <Box justifyContent="space-between" paddingX={0}>
        <Box gap={1}>
          <Text bold color="white">{userName}</Text>
          <Text color="gray">·</Text>
          <Text bold color="white">{planTag}</Text>
        </Box>
        <Text color="gray">{hint || defaultHint}</Text>
      </Box>
    </Box>
  )
}
