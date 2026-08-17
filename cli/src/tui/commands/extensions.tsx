import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { setScreen } from '../state.js'
import { GLYPH } from '../theme.js'
import { StatusBar } from '../StatusBar.js'
import { getInstalledExtensions, OFFICIAL_CATALOG, installExtensionPackage, removeExtensionPackage } from '../../extensions/registry.js'

export function ExtensionsScreen({ userData, onMessage }: { userData?: any; onMessage?: (msg: string) => void }) {
  const [installed, setInstalled] = useState(() => getInstalledExtensions())
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const uninstalledCatalog = OFFICIAL_CATALOG.filter(c => !installed.some(i => i.name === c.name))
  const allRows = [
    ...installed.map(i => ({ ...i, isInstalled: true })),
    ...uninstalledCatalog.map(c => ({ ...c, isInstalled: false })),
  ]

  useInput(async (input, key) => {
    if (key.escape || input === 'q') {
      setScreen('repl')
      return
    }

    if (key.upArrow) {
      setSelectedIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, allRows.length - 1)))
      return
    }

    if (key.downArrow) {
      setSelectedIdx(prev => (prev < allRows.length - 1 ? prev + 1 : 0))
      return
    }

    if (key.return && allRows.length > 0) {
      const item = allRows[selectedIdx]
      if (item) {
        if (!item.isInstalled) {
          setStatusMsg(`${GLYPH.bullet} Установка ${item.name}…`)
          try {
            await installExtensionPackage(item.name)
            setInstalled(getInstalledExtensions())
            setStatusMsg(`${GLYPH.ok} Расширение ${item.name} установлено!`)
            if (onMessage) onMessage(`${GLYPH.ok} Расширение ${item.name} успешно установлено.`)
          } catch (e: any) {
            setStatusMsg(`${GLYPH.cancel} Ошибка установки: ${e.message}`)
          }
        } else {
          setStatusMsg(`${GLYPH.bullet} Удаление ${item.name}…`)
          try {
            await removeExtensionPackage(item.name)
            setInstalled(getInstalledExtensions())
            setStatusMsg(`${GLYPH.ok} Расширение ${item.name} удалено.`)
          } catch (e: any) {
            setStatusMsg(`${GLYPH.cancel} Ошибка удаления: ${e.message}`)
          }
        }
      }
    }
  })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="white">{GLYPH.logo} Расширения Zerf Ext</Text>
        <Text color="gray">Esc — назад</Text>
      </Box>
      <Text color="gray">{GLYPH.divider.repeat(70)}</Text>

      {statusMsg && (
        <Box marginY={0}>
          <Text bold color="green">{statusMsg}</Text>
        </Box>
      )}

      {/* ── Установленные расширения ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">УСТАНОВЛЕНЫ ({installed.length})</Text>
        {installed.length === 0 ? (
          <Text color="gray">Нет установленных расширений. Выберите модуль ниже.</Text>
        ) : (
          installed.map((item, idx) => {
            const isSel = idx === selectedIdx
            return (
              <Box key={`inst_${item.name}`} gap={1}>
                <Text bold color={isSel ? 'white' : 'gray'}>
                  {isSel ? '▸ ' : '  '}{item.name.padEnd(16)} v{item.version}
                </Text>
                <Text color="gray">— {item.description} (Enter: удалить)</Text>
              </Box>
            )
          })
        )}
      </Box>

      {/* ── Каталог расширений ── */}
      <Box flexDirection="column" marginY={1}>
        <Text bold color="white">КАТАЛОГ (Официальный репозиторий)</Text>
        {uninstalledCatalog.map((item, idx) => {
          const actualIdx = installed.length + idx
          const isSel = actualIdx === selectedIdx
          return (
            <Box key={`cat_${item.name}`} gap={1}>
              <Text bold color={isSel ? 'white' : 'gray'}>
                {isSel ? '▸ ' : '  '}{item.name.padEnd(16)} v{item.version}
              </Text>
              <Text color="gray">— {item.description} [Enter: установить]</Text>
            </Box>
          )
        })}
      </Box>

      <Box flexDirection="column" marginY={0}>
        <Text color="gray">/ext create — создать своё расширение в локальной папке</Text>
        <Text color="gray">Навигация: ↑/↓ │ Enter — установить/удалить │ Esc — назад</Text>
      </Box>

      <StatusBar
        userName={userData?.user?.name || 'Пользователь Zerf'}
        plan={userData?.user?.plan || 'plus'}
        hint="Enter — действие │ Esc — назад"
      />
    </Box>
  )
}
