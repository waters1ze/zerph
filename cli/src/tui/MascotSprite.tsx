import React from 'react'
import { Box, Text } from 'ink'
import { getAllaySpriteLines, type MascotMood } from '../mascot.js'

interface MascotSpriteProps {
  mood?: MascotMood
  wingFrame?: number
}

export function MascotSprite({ mood = 'idle', wingFrame = 0 }: MascotSpriteProps) {
  const lines = getAllaySpriteLines(mood, wingFrame)

  return (
    <Box flexDirection="column" alignItems="flex-start" marginY={0}>
      {lines.map((line, idx) => (
        <Text key={`sprite_${idx}`}>{line}</Text>
      ))}
    </Box>
  )
}
