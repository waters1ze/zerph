import fs from 'fs'
import path from 'path'
import os from 'os'
import open from 'open'

export interface ZerfConfig {
  apiUrl: string
  token?: string
  chatId?: string
  plan?: string
  userName?: string
  lastSync?: string
  siriMode?: 'fast' | 'full'
}

const CONFIG_DIR = path.join(os.homedir(), '.zerf')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export const DEFAULT_API_URL = process.env.ZERF_API_URL || 'https://zeprh.vercel.app'

export function loadConfig(): ZerfConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(raw)
    }
  } catch {}
  return { apiUrl: DEFAULT_API_URL }
}

export function saveConfig(config: Partial<ZerfConfig>): ZerfConfig {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    const current = loadConfig()
    const merged = { ...current, ...config }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8')
    return merged
  } catch (e) {
    console.error('Failed to save Zerf config:', e)
    return { apiUrl: DEFAULT_API_URL, ...config }
  }
}

export function clearConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE)
    }
  } catch {}
}

export async function requestAuthCode(apiUrl = DEFAULT_API_URL): Promise<{ code: string; authUrl: string }> {
  const res = await fetch(`${apiUrl}/api/cli/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceName: `Zerf CLI on ${os.hostname()} (${os.platform()})` }),
  })
  if (!res.ok) {
    throw new Error(`Failed to request auth code (HTTP ${res.status}): ${await res.text()}`)
  }
  return res.json()
}

export async function pollAuthStatus(code: string, apiUrl = DEFAULT_API_URL): Promise<{ status: string; token?: string; chatId?: string; plan?: string }> {
  const res = await fetch(`${apiUrl}/api/cli/auth?code=${encodeURIComponent(code)}`)
  if (!res.ok) {
    throw new Error(`Poll error (HTTP ${res.status})`)
  }
  return res.json()
}

export async function fetchUserData(config: ZerfConfig): Promise<any> {
  if (!config.token) {
    throw new Error('Not logged in. Please run `zerf login` to authenticate.')
  }

  const res = await fetch(`${config.apiUrl || DEFAULT_API_URL}/api/cli/data`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 401) {
    throw new Error('Session expired. Please run `zerf login` again.')
  }

  if (res.status === 403) {
    const errData = await res.json().catch(() => ({}))
    return {
      allowed: false,
      plan: errData.plan || 'free',
      message: errData.message || 'Zerf CLI доступен только для тарифов Pro и Corp.',
      upgradeUrl: errData.upgradeUrl || 'https://t.me/Zerph_bot?start=buy',
    }
  }

  if (!res.ok) {
    throw new Error(`API Error (HTTP ${res.status}): ${await res.text()}`)
  }

  return res.json()
}

export async function mutateItem(config: ZerfConfig, payload: any): Promise<any> {
  if (!config.token) throw new Error('Not logged in')

  const res = await fetch(`${config.apiUrl || DEFAULT_API_URL}/api/cli/data`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Mutate error (HTTP ${res.status}): ${await res.text()}`)
  }
  return res.json()
}

export async function generateExtensionViaAi(config: ZerfConfig, prompt: string, name?: string): Promise<any> {
  if (!config.token) throw new Error('Not logged in')

  const res = await fetch(`${config.apiUrl || DEFAULT_API_URL}/api/cli/extension`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, name }),
  })

  if (!res.ok) {
    throw new Error(`Extension generator error (HTTP ${res.status}): ${await res.text()}`)
  }
  return res.json()
}
