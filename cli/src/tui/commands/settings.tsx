import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH } from '../theme.js'
import { StatusBar } from '../StatusBar.js'
import { loadConfig } from '../../api.js'
import { detectInstalledClis } from '../../local-cli.js'

export function SettingsScreen({ userData }: { userData?: any }) {
  const [cfg] = useState(() => loadConfig())
  const [clis] = useState(() => detectInstalledClis())

  useInput((input, key) => {
    if (key.escape || input === 'q' || key.return) {
      setScreen('repl')
    }
  })

  const userName = userData?.user?.name || 'Пользователь Zerf'
  const plan = (userData?.user?.plan || 'plus').toUpperCase()
  const username = userData?.user?.username ? `@${userData.user.username}` : 'не привязан'

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Настройки Zerf CLI</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      {/* ── Профиль ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ПРОФИЛЬ</Text>
        <Box gap={1}><Text color="gray">{GLYPH.arrow} Имя:      </Text><Text bold color="white">{userName}</Text></Box>
        <Box gap={1}><Text color="gray">{GLYPH.arrow} Тариф:    </Text><Text bold color="white">{plan}</Text></Box>
        <Box gap={1}><Text color="gray">{GLYPH.arrow} Telegram: </Text><Text color="white">{username}</Text></Box>
      </Box>

      {/* ── Интерфейс & Модель ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ИНТЕРФЕЙС & МОДЕЛЬ</Text>
        <Box gap={1}><Text color="gray">{GLYPH.arrow} Модель ИИ: </Text><Text bold color="white">{cfg.model}</Text><Text color="gray">(сменить: /model)</Text></Box>
        <Box gap={1}><Text color="gray">{GLYPH.arrow} Тема:      </Text><Text color="white">strict (монохром)</Text></Box>
        <Box gap={1}><Text color="gray">{GLYPH.arrow} Автосинк:  </Text><Text color="white">включен</Text></Box>
      </Box>

      {/* ── Local CLI ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">LOCAL CLI BRIDGES</Text>
        {clis.map(c => (
          <Box key={c.id} gap={1}>
            <Text color="gray">{GLYPH.arrow} {c.name.padEnd(12)}</Text>
            <Text color={c.installed ? 'white' : 'gray'}>
              {c.installed ? `${GLYPH.ok} установлен` : `${GLYPH.cancel} не найден`}
            </Text>
          </Box>
        ))}
      </Box>

      {/* ── Аккаунт ── */}
      <Box flexDirection="column" marginY={0}>
        <Text bold color="white">КОМАНДЫ АККАУНТА</Text>
        <Box gap={1}><Text bold color="white">zerf login</Text><Text color="gray">— повторная авторизация в браузере</Text></Box>
        <Box gap={1}><Text bold color="white">zerf logout</Text><Text color="gray">— выход и очистка токена с диска</Text></Box>
      </Box>

      <StatusBar
        userName={userName}
        plan={plan}
        hint="Esc — назад в REPL"
      />
    </Box>
  )
}
