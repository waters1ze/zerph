import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH } from '../theme.js'
import { detectInstalledClis, type DetectedCli } from '../../local-cli.js'
import { loadConfig, saveConfig } from '../../api.js'

export const CLOUD_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'openai/gpt-oss-120b', desc: 'Флагман · максимальный интеллект' },
  { id: 'openai/gpt-oss-20b', name: 'openai/gpt-oss-20b', desc: 'Быстрый отклик' },
  { id: 'groq/compound', name: 'groq/compound', desc: 'Авто-роутинг — выбирает оптимальную модель' },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'meta-llama/Llama-3.1-8B', desc: 'Лёгкая, для быстрых задач' },
]

export function ModelScreen({ onSelect }: { onSelect?: (modelId: string, name: string) => void }) {
  const [cfg, setCfg] = useState(() => loadConfig())
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [localClis] = useState<DetectedCli[]>(() => detectInstalledClis())

  const allOptions = [
    ...CLOUD_MODELS.map(m => ({ ...m, type: 'cloud' as const, isInstalled: true })),
    ...localClis.map(c => ({
      id: c.id,
      name: c.name,
      desc: c.desc,
      type: 'local' as const,
      isInstalled: c.installed,
    })),
  ]

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      setScreen('repl')
      return
    }

    if (key.upArrow) {
      setSelectedIdx(prev => (prev > 0 ? prev - 1 : allOptions.length - 1))
      return
    }

    if (key.downArrow) {
      setSelectedIdx(prev => (prev < allOptions.length - 1 ? prev + 1 : 0))
      return
    }

    if (key.return) {
      const chosen = allOptions[selectedIdx]
      if (chosen) {
        saveConfig({ model: chosen.id })
        setCfg(prev => ({ ...prev, model: chosen.id }))
        if (onSelect) onSelect(chosen.id, chosen.name)
        setScreen('repl')
      }
    }
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Выбор нейросети и CLI-агента</Text>
        <Text color="gray">Esc — закрыть</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      {/* ── Облачные модели ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ОБЛАКО (Zerf AI)</Text>
        {CLOUD_MODELS.map((m, idx) => {
          const isSel = idx === selectedIdx
          const isCurrent = cfg.model === m.id
          return (
            <Box key={m.id} gap={1}>
              <Text bold color={isSel ? 'white' : 'gray'}>
                {isSel ? '▸ ' : '  '}{m.name.padEnd(28)}
              </Text>
              <Text color="gray">— {m.desc} {isCurrent ? '(Текущий)' : ''}</Text>
            </Box>
          )
        })}
      </Box>

      {/* ── Локальные CLI ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">ЛОКАЛЬНО (External CLI Bridge)</Text>
        {localClis.map((c, idx) => {
          const actualIdx = CLOUD_MODELS.length + idx
          const isSel = actualIdx === selectedIdx
          const isCurrent = cfg.model === c.id
          const status = c.installed ? `${GLYPH.ok} установлен` : `${GLYPH.cancel} не найден`

          return (
            <Box key={c.id} gap={1}>
              <Text bold color={isSel ? 'white' : 'gray'}>
                {isSel ? '▸ ' : '  '}{c.name.padEnd(14)}
              </Text>
              <Text color={c.installed ? 'gray' : 'gray'}>{status.padEnd(14)}</Text>
              <Text color="gray">— {c.desc} {isCurrent ? '(Текущий)' : ''}</Text>
            </Box>
          )
        })}
      </Box>

      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>
      <Text color="gray">Навигация: ↑/↓ │ Enter — выбрать │ Esc — назад</Text>
    </Box>
  )
}
