import React from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH } from '../theme.js'
import { StatusBar } from '../StatusBar.js'

const COMMANDS_LIST = [
  { cmd: '/today', desc: 'Задачи, привычки и цели на сегодня (Space — переключить)' },
  { cmd: '/add <текст>', desc: 'Создать задачу с распознаванием даты и времени' },
  { cmd: '/done <текст>', desc: 'Завершить задачу по названию (нечёткий поиск)' },
  { cmd: '/note <текст>', desc: 'Сохранить быструю заметку в базу Zerf Note' },
  { cmd: '/cal', desc: '7-дневная календарная сетка с расписанием' },
  { cmd: '/focus [мин]', desc: 'Таймер концентрации Pomodoro со сферой фокуса' },
  { cmd: '/model', desc: 'Выбор нейросети (GPT-OSS, Compound, Llama, claude, agy)' },
  { cmd: '/settings', desc: 'Настройки профиля, параметров и подключений' },
  { cmd: '/friends', desc: 'Список друзей и ссылка-приглашение' },
  { cmd: '/chat <текст>', desc: 'Командный диалог / запрос к ИИ-ассистенту' },
  { cmd: '/limits', desc: 'Статус лимитов и квот на текущие сутки' },
  { cmd: '/stats', desc: 'Недельная аналитика эффективности и выполнения' },
  { cmd: '/ext', desc: 'Маркетплейс и управление расширениями Zerf Ext' },
  { cmd: '/clear', desc: 'Очистить историю диалога (Ctrl+L)' },
  { cmd: '/help', desc: 'Данная таблица команд и горячих клавиш' },
  { cmd: '/exit', desc: 'Выйти из Zerf CLI' },
]

export function HelpScreen({ userData }: { userData?: any }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || key.return) {
      setScreen('repl')
    }
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Справка по командам Zerf CLI</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">КОМАНДЫ</Text>
        {COMMANDS_LIST.map(item => (
          <Box key={item.cmd} gap={1}>
            <Text bold color="white">{GLYPH.arrow} {item.cmd.padEnd(16)}</Text>
            <Text color="gray">— {item.desc}</Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginY={0}>
        <Text bold color="white">ГОРЯЧИЕ КЛАВИШИ</Text>
        <Box gap={1}><Text bold color="white">Enter</Text><Text color="gray">— отправить ввод / подтвердить</Text></Box>
        <Box gap={1}><Text bold color="white">Space</Text><Text color="gray">— переключить статус задачи в /today</Text></Box>
        <Box gap={1}><Text bold color="white">Tab</Text><Text color="gray">— автодополнение slash-команд</Text></Box>
        <Box gap={1}><Text bold color="white">↑ / ↓</Text><Text color="gray">— история команд (кольцо на 50) / навигация</Text></Box>
        <Box gap={1}><Text bold color="white">Ctrl+C</Text><Text color="gray">— 1-й раз предупреждение, 2-й выход</Text></Box>
        <Box gap={1}><Text bold color="white">Ctrl+L</Text><Text color="gray">— очистка экрана</Text></Box>
      </Box>

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Esc — назад в REPL"
      />
    </Box>
  )
}
