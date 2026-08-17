import React from 'react'
import { Box, Text } from 'ink'
import { c, GLYPH } from './theme.js'

export interface LogEntry {
  id: string
  type: 'user' | 'assistant' | 'system' | 'error' | 'ext'
  text: string
  details?: string[]
}

export function Log({ entries }: { entries: LogEntry[] }) {
  // Render up to 8 last entries to prevent terminal scroll overflow
  const visible = entries.slice(-8)

  return (
    <Box flexDirection="column" marginY={0}>
      {visible.map(item => (
        <Box key={`log_${item.id}`} flexDirection="column" marginY={0}>
          {item.type === 'user' ? (
            <Box gap={1}>
              <Text bold color="white">› {item.text}</Text>
            </Box>
          ) : item.type === 'error' ? (
            <Box gap={1} marginLeft={1}>
              <Text color="red">{GLYPH.cancel} {item.text}</Text>
            </Box>
          ) : item.type === 'system' ? (
            <Box gap={1} marginLeft={1}>
              <Text color="gray">{item.text}</Text>
            </Box>
          ) : item.type === 'ext' ? (
            <Box gap={1} marginLeft={1}>
              <Text color="gray">[ext] {item.text}</Text>
            </Box>
          ) : (
            <Box flexDirection="column" marginLeft={1}>
              <Box gap={1}>
                <Text color="gray">{GLYPH.bullet}</Text>
                <Text color="white">{item.text}</Text>
              </Box>
              {item.details && item.details.map((d, i) => (
                <Box key={`det_${item.id}_${i}`} marginLeft={2}>
                  <Text color="gray">{d}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
