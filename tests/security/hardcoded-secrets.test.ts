import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Security regression gate: previously leaked secrets must never reappear
 * in source. Audit findings C-3 (Google client secret), C-4 (GitHub client
 * secret), C-5 (VAPID private key).
 *
 * These are exact literals from git history — if any test fails, a secret
 * has been re-hardcoded and the corresponding credential must be rotated.
 */

const ROOT = path.resolve(__dirname, '../..')
const visited = new Set<string>()

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'scratch', 'tests',
  '.vercel', 'coverage',
])

function walk(dir: string, acc: string[] = []): string[] {
  let real: string
  try {
    real = fs.realpathSync(dir)
  } catch {
    return acc
  }
  // Junctions/symlinks can point back up the tree (e.g. this workspace has a
  // self-referencing junction) — never traverse the same realpath twice.
  if (visited.has(real)) return acc
  visited.add(real)

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, acc)
    } else if (/\.(ts|tsx|js|mjs|json|prisma)$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

const sources = walk(ROOT).filter((f) => !f.includes('package-lock'))

describe('no hardcoded secrets in source tree', () => {
  it('scanned a meaningful number of source files (sanity)', () => {
    expect(sources.length).toBeGreaterThan(50)
  })

  it('does not contain the leaked Google OAuth client secret (GOCSPX-…)', () => {
    const offenders = sources.filter((f) => /GOCSPX-[A-Za-z0-9_-]{8,}/.test(fs.readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('does not contain the leaked GitHub OAuth client secret fallback', () => {
    const leaked = 'acb04b9e1b10d79b208603feebce151f203d0e8e'
    const offenders = sources.filter((f) => fs.readFileSync(f, 'utf8').includes(leaked))
    expect(offenders).toEqual([])
  })

  it('does not contain the leaked VAPID private key literal', () => {
    // base64url private key assigned as a default constant anywhere
    const offenders = sources.filter((f) =>
      /DEFAULT_VAPID_PRIVATE_KEY\s*=\s*['"][A-Za-z0-9_-]{30,}['"]/.test(fs.readFileSync(f, 'utf8'))
    )
    expect(offenders).toEqual([])
  })

  it('OAuth secrets come from env only: no `process.env.X || <literal>` pattern for *_SECRET', () => {
    const offenderLines: string[] = []
    for (const f of sources) {
      const lines = fs.readFileSync(f, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (/CLIENT_SECRET\s*\|\|\s*['"][^'"]{8,}['"]/.test(line)) {
          offenderLines.push(`${path.relative(ROOT, f)}:${i + 1}`)
        }
      })
    }
    expect(offenderLines).toEqual([])
  })
})
