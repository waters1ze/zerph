import React from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH, progressBar } from '../theme.js'
import { StatusBar } from '../StatusBar.js'

export function LimitsScreen({ userData }: { userData?: any }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || key.return) {
      setScreen('repl')
    }
  })

  const l = userData?.limits || {}
  const plan = (userData?.user?.plan || 'plus').toUpperCase()

  const cliMax = typeof l.maxCli === 'number' ? l.maxCli : 8000
  const cliUsed = l.cliUsed || 0
  const voiceMax = typeof l.maxVoiceSeconds === 'number' ? Math.floor(l.maxVoiceSeconds / 60) : 15
  const voiceUsed = Math.floor((l.voiceUsedSeconds || 0) / 60)
  const chatMax = typeof l.maxChat === 'number' ? l.maxChat : 150
  const chatUsed = l.chatUsed || 0
  const notesMax = typeof l.maxNotes === 'number' ? l.maxNotes : 250
  const notesUsed = l.notesCount || 0

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Статус лимитов · {plan}</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      <Box flexDirection="column" marginY={1}>
        <Box gap={1}>
          <Text color="gray">{GLYPH.arrow} Запросы CLI:       </Text>
          <Text bold color="white">{progressBar(cliUsed / cliMax, 8)}</Text>
          <Text color="gray">{cliUsed} / {cliMax}</Text>
        </Box>
        <Box gap={1}>
          <Text color="gray">{GLYPH.arrow} Распознавание голоса:</Text>
          <Text bold color="white">{progressBar(voiceUsed / (voiceMax || 1), 8)}</Text>
          <Text color="gray">{voiceUsed} / {voiceMax} мин</Text>
        </Box>
        <Box gap={1}>
          <Text color="gray">{GLYPH.arrow} ИИ диалоги:        </Text>
          <Text bold color="white">{progressBar(chatUsed / (chatMax || 1), 8)}</Text>
          <Text color="gray">{chatUsed} / {chatMax}</Text>
        </Box>
        <Box gap={1}>
          <Text color="gray">{GLYPH.arrow} Активные заметки:  </Text>
          <Text bold color="white">{progressBar(notesUsed / (notesMax || 1), 8)}</Text>
          <Text color="gray">{notesUsed} / {notesMax}</Text>
        </Box>
      </Box>

      <Box marginY={0}>
        <Text color="gray">Сброс счётчиков происходит ежедневно в 00:00 МСК.</Text>
        <Text color="gray">Для расширения квот используйте Pro или Corp тариф на сайте.</Text>
      </Box>

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Esc — назад в REPL"
      />
    </Box>
  )
}
