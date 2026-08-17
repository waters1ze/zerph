import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen, setMascotMood } from '../state.js'
import { GLYPH, progressBar } from '../theme.js'
import { MascotSprite } from '../MascotSprite.js'
import { StatusBar } from '../StatusBar.js'

export function FocusScreen({ minutes = 25, userData, onComplete }: { minutes?: number; userData?: any; onComplete?: () => void }) {
  const totalSeconds = Math.max(10, minutes * 60)
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [isFinished, setIsFinished] = useState(false)
  const [wingFrame, setWingFrame] = useState(0)

  useEffect(() => {
    setMascotMood('focus')
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsFinished(true)
          setMascotMood('celebrate')
          setTimeout(() => {
            setMascotMood('idle')
            if (onComplete) onComplete()
            setScreen('repl')
          }, 3000)
          return 0
        }
        return prev - 1
      })
      setWingFrame(w => (w + 1) % 4)
    }, 1000)

    return () => {
      clearInterval(timer)
      setMascotMood('idle')
    }
  }, [])

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      setMascotMood('idle')
      setScreen('repl')
    }
  })

  const elapsed = totalSeconds - secondsLeft
  const ratio = elapsed / totalSeconds
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Режим фокуса · {timeStr}</Text>
        <Text color="gray">Esc — прервать</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      <Box flexDirection="row" marginY={1} gap={4}>
        <MascotSprite mood={isFinished ? 'celebrate' : 'focus'} wingFrame={wingFrame} />
        <Box flexDirection="column" justifyContent="center">
          <Text bold color="white">
            {isFinished ? 'Отличная работа! Сессия завершена.' : 'Тихоня сосредоточена вместе с вами'}
          </Text>
          <Box gap={1} marginY={1}>
            <Text bold color="white">{progressBar(ratio, 16)}</Text>
            <Text color="gray">{Math.round(ratio * 100)}% · {timeStr} осталось</Text>
          </Box>
          <Text color="gray">Сохраняйте концентрацию и не переключайте контекст.</Text>
        </Box>
      </Box>

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Esc — прервать сессию"
      />
    </Box>
  )
}
