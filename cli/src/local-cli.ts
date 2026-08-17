import { execSync, spawn } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'

export const ALLOWED_CLIS = ['claude', 'agy', 'opencode', 'gh', 'ollama'] as const
export type AllowedCli = (typeof ALLOWED_CLIS)[number]

export interface DetectedCli {
  id: string
  name: string
  command: AllowedCli
  path?: string
  version?: string
  installed: boolean
  desc: string
  type: 'local_cli' | 'local_llm'
}

const SUPPORTED_LOCAL_CLIS: Array<{ command: AllowedCli; name: string; desc: string; type: 'local_cli' | 'local_llm' }> = [
  { command: 'claude', name: '🪽 Claude Code CLI (claude)', desc: 'Anthropic Claude Code терминальный агент', type: 'local_cli' },
  { command: 'agy', name: '🌌 Antigravity CLI (agy)', desc: 'Antigravity автономный AI агент', type: 'local_cli' },
  { command: 'opencode', name: '⚡ OpenCode CLI (opencode)', desc: 'OpenCode terminal agent', type: 'local_cli' },
  { command: 'gh', name: '🐙 GitHub Copilot CLI (gh)', desc: 'GitHub Copilot терминальный помощник', type: 'local_cli' },
  { command: 'ollama', name: '🦙 Ollama Local (ollama)', desc: 'Локальные LLaMA/Qwen модели на ПК (localhost:11434)', type: 'local_llm' },
]

export function checkCliInstalled(cmd: AllowedCli): { installed: boolean; path?: string; version?: string } {
  const isWin = os.platform() === 'win32'
  try {
    const checkCmd = isWin ? `where.exe ${cmd}` : `which ${cmd}`
    const out = execSync(checkCmd, { stdio: 'pipe', timeout: 1000 }).toString().trim()
    const resolvedPath = out.split('\n')[0]?.trim()
    return { installed: true, path: resolvedPath, version: 'готов к работе' }
  } catch {
    if (isWin) {
      const appData = process.env.APPDATA || ''
      const localAppData = process.env.LOCALAPPDATA || ''
      const candidates = [
        path.join(appData, 'npm', `${cmd}.cmd`),
        path.join(appData, 'npm', `${cmd}.exe`),
        path.join(localAppData, 'Programs', cmd, `${cmd}.exe`),
      ]
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return { installed: true, path: p, version: 'готов к работе' }
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
      id: `cli:${cli.command}`,
      name: cli.name,
      command: cli.command,
      path: status.path,
      installed: status.installed,
      version: status.version,
      desc: cli.desc,
      type: cli.type,
    }
  })
}

export async function runLocalCliBridge(
  cliName: string,
  userPrompt: string,
  onData?: (chunk: string) => void
): Promise<string> {
  const cleanName = cliName.replace(/^cli:/, '') as AllowedCli
  if (!ALLOWED_CLIS.includes(cleanName)) {
    throw new Error(`CLI «${cleanName}» не поддерживается. Разрешены: ${ALLOWED_CLIS.join(', ')}`)
  }

  const detectedList = detectInstalledClis()
  const cliInfo = detectedList.find(c => c.command === cleanName)

  if (!cliInfo || !cliInfo.installed || !cliInfo.path) {
    throw new Error(`CLI «${cleanName}» не установлен или не найден в PATH.`)
  }

  return new Promise((resolve, reject) => {
    const exePath = cliInfo.path!
    const args = [userPrompt]

    let fullOutput = ''
    let isSettled = false

    const proc = spawn(exePath, args, {
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 120_000,
    })

    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true
        proc.kill()
        reject(new Error('Таймаут 120с при вызове локального CLI.'))
      }
    }, 120_000)

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

    proc.on('close', code => {
      clearTimeout(timeoutTimer)
      if (isSettled) return
      isSettled = true
      if (code === 0 || fullOutput.trim()) {
        resolve(fullOutput.trim() || `Команда выполнена через ${cleanName}.`)
      } else {
        reject(new Error(`CLI ${cleanName} завершился с кодом ${code}`))
      }
    })

    proc.on('error', err => {
      clearTimeout(timeoutTimer)
      if (isSettled) return
      isSettled = true
      reject(err)
    })
  })
}
