import { execSync, spawn } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'

export interface DetectedCli {
  id: string
  name: string
  command: string
  version?: string
  installed: boolean
  desc: string
  type: 'cloud_ai' | 'local_cli' | 'local_llm'
}

const SUPPORTED_LOCAL_CLIS = [
  { id: 'cli:agy', name: '🌌 Antigravity CLI (agy)', command: 'agy', desc: 'Автономный агент Google Antigravity (код, файлы, bash)', type: 'local_cli' as const },
  { id: 'cli:claude', name: '🪽 Claude Code CLI (claude)', command: 'claude', desc: 'Терминальный агент Anthropic Claude с редактированием файлов', type: 'local_cli' as const },
  { id: 'cli:gemini', name: '✨ Gemini CLI (gemini)', command: 'gemini', desc: 'Google Gemini CLI терминальный агент', type: 'local_cli' as const },
  { id: 'cli:ollama', name: '🦙 Ollama Local (ollama)', command: 'ollama', desc: 'Локальные модели на ПК (localhost:11434)', type: 'local_llm' as const },
  { id: 'cli:gh', name: '🐙 GitHub Copilot CLI (gh)', command: 'gh', desc: 'GitHub Copilot терминальный помощник', type: 'local_cli' as const },
]

export function checkCliInstalled(cmd: string): { installed: boolean; version?: string } {
  const isWin = os.platform() === 'win32'
  try {
    const checkCmd = isWin ? `where.exe ${cmd}` : `which ${cmd}`
    execSync(checkCmd, { stdio: 'pipe', timeout: 1000 })
    return { installed: true, version: 'готов к работе' }
  } catch {
    // Check common global npm paths on Windows
    if (isWin) {
      const appData = process.env.APPDATA || ''
      const localAppData = process.env.LOCALAPPDATA || ''
      const candidates = [
        path.join(appData, 'npm', `${cmd}.cmd`),
        path.join(appData, 'npm', `${cmd}.ps1`),
        path.join(localAppData, 'Programs', cmd, `${cmd}.exe`),
      ]
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return { installed: true, version: 'готов к работе' }
        }
      }
    }
    return { installed: false }
  }
}

export function detectInstalledClis(): DetectedCli[] {
  return SUPPORTED_LOCAL_CLIS.map(cli => {
    const status = checkCliInstalled(cli.command)
    return {
      ...cli,
      installed: status.installed,
      version: status.version,
    }
  })
}

export async function runLocalCliBridge(
  cliCommand: string,
  prompt: string,
  onData?: (chunk: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isWin = os.platform() === 'win32'
    const cleanCmd = cliCommand.replace('cli:', '')
    const shell = isWin ? 'powershell.exe' : '/bin/sh'
    const args = isWin
      ? ['-NoProfile', '-Command', `${cleanCmd} "${prompt.replace(/"/g, '`"')}"`]
      : ['-c', `${cleanCmd} "${prompt.replace(/"/g, '\\"')}"`]

    let fullOutput = ''
    try {
      const proc = spawn(shell, args, { stdio: ['inherit', 'pipe', 'pipe'] })

      proc.stdout?.on('data', data => {
        const text = data.toString()
        fullOutput += text
        if (onData) onData(text)
      })

      proc.stderr?.on('data', data => {
        const text = data.toString()
        fullOutput += text
        if (onData) onData(text)
      })

      proc.on('close', () => {
        resolve(fullOutput.trim() || 'Команда выполнена локальным CLI агентом.')
      })

      proc.on('error', err => {
        reject(err)
      })
    } catch (e: any) {
      reject(e)
    }
  })
}
