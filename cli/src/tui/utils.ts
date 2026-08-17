import fs from 'fs'
import path from 'path'
import os from 'os'

const ZERF_DIR = path.join(os.homedir(), '.zerf')
const HISTORY_FILE = path.join(ZERF_DIR, 'history.json')

export function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase().trim()
  if (t.includes(q)) return true

  // Subsequence matching
  let qIdx = 0
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) qIdx++
  }
  if (qIdx === q.length) return true

  // Levenshtein distance check for short typos (length diff <= 2)
  if (Math.abs(q.length - t.length) <= 2 && q.length >= 3) {
    let diff = 0
    const minLen = Math.min(q.length, t.length)
    for (let i = 0; i < minLen; i++) {
      if (q[i] !== t[i]) diff++
    }
    if (diff <= 2) return true
  }

  return false
}

export function isNetworkError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || String(err)).toLowerCase()
  const code = (err.code || '').toLowerCase()
  return (
    code === 'econnrefused' ||
    code === 'enotfound' ||
    code === 'etimedout' ||
    code === 'econnreset' ||
    msg.includes('fetch failed') ||
    msg.includes('network error') ||
    msg.includes('socket disconnected')
  )
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  onRetry?: (attempt: number, delaySec: number) => void
): Promise<T> {
  const delays = [1, 2, 4, 8, 16]
  let lastErr: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      // Do not retry 4xx errors
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err
      }
      if (attempt < maxAttempts) {
        const delay = delays[attempt - 1] || 16
        if (onRetry) onRetry(attempt, delay)
        await new Promise(res => setTimeout(res, delay * 1000))
      }
    }
  }

  throw lastErr
}

export function getInputHistory(max = 50): string[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
      if (Array.isArray(data)) return data.slice(-max)
    }
  } catch {}
  return []
}

export function pushInputHistory(cmd: string, max = 50): void {
  const trimmed = cmd.trim()
  if (!trimmed) return
  try {
    if (!fs.existsSync(ZERF_DIR)) {
      fs.mkdirSync(ZERF_DIR, { recursive: true })
    }
    const history = getInputHistory(max)
    const filtered = history.filter(h => h !== trimmed)
    filtered.push(trimmed)
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(filtered.slice(-max)), 'utf-8')
  } catch {}
}

let idCounter = 0
export function makeUniqueId(): string {
  idCounter++
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`
}
