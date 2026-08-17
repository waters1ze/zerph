import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH } from '../theme.js'
import { StatusBar } from '../StatusBar.js'

export function FriendsScreen({ userData, onSelectFriend }: { userData?: any; onSelectFriend?: (f: any) => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const friends = userData?.friends || []
  const chatId = userData?.user?.chatId || ''

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      setScreen('repl')
      return
    }

    if (key.upArrow) {
      setSelectedIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, friends.length - 1)))
      return
    }

    if (key.downArrow) {
      setSelectedIdx(prev => (prev < friends.length - 1 ? prev + 1 : 0))
      return
    }

    if (key.return && friends.length > 0) {
      const chosen = friends[selectedIdx]
      if (chosen && onSelectFriend) {
        onSelectFriend(chosen)
        setScreen('repl')
      }
    }
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Друзья и командный чат</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">КОМАНДА ({friends.length})</Text>
        {friends.length === 0 ? (
          <Text color="gray">У вас пока нет добавленных друзей.</Text>
        ) : (
          friends.map((f: any, idx: number) => {
            const isSel = idx === selectedIdx
            const usernameStr = f.username ? `@${f.username}` : 'без юзернейма'
            return (
              <Box key={`friend_${f.id || idx}`} gap={1}>
                <Text bold color={isSel ? 'white' : 'gray'}>
                  {isSel ? '▸ ' : '  '}{f.name} ({usernameStr})
                </Text>
                <Text color="gray">· В сети</Text>
              </Box>
            )
          })
        )}
      </Box>

      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ССЫЛКА ДЛЯ ПРИГЛАШЕНИЯ</Text>
        <Text color="gray">https://t.me/Zerph_bot?start=invite_{chatId}</Text>
        <Text color="gray">Отправьте эту ссылку коллеге или другу в Telegram для добавления.</Text>
      </Box>

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Enter — начать чат │ Esc — назад"
      />
    </Box>
  )
}
