import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ZerfExtension, ZerfExtensionContext } from './types.js'

const ZERF_DIR = path.join(os.homedir(), '.zerf')
const EXT_DIR = path.join(ZERF_DIR, 'extensions')

const loadedExtensions: Map<string, ZerfExtension> = new Map()

export async function loadInstalledExtensions(ctx: ZerfExtensionContext): Promise<void> {
  if (!fs.existsSync(EXT_DIR)) return

  try {
    const dirs = fs.readdirSync(EXT_DIR)
    for (const d of dirs) {
      const dirPath = path.join(EXT_DIR, d)
      const manifestPath = path.join(dirPath, 'zerf.manifest.json')
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
          let pluginModule: any = {}
          const entrypoint = manifest.entrypoint || 'index.js'
          const entryPath = path.join(dirPath, entrypoint)
          if (fs.existsSync(entryPath)) {
            try {
              const fileUrl = `file://${entryPath.replace(/\\/g, '/')}`
              const mod = await import(fileUrl)
              pluginModule = mod.default || mod
            } catch (loadErr) {
              ctx.log.error(`Не удалось импортировать модуль ${d}: ${String(loadErr)}`)
            }
          }

          const ext: ZerfExtension = {
            manifest,
            onLoad: pluginModule.onLoad,
            onCommand: pluginModule.onCommand,
            onHook: pluginModule.onHook,
          }

          loadedExtensions.set(manifest.name || d, ext)
          if (ext.onLoad) {
            await ext.onLoad(ctx).catch(err => {
              ctx.log.error(`Ошибка в onLoad ${manifest.name}: ${String(err)}`)
            })
          }
        } catch {}
      }
    }
  } catch {}
}

export function getLoadedExtensions(): Map<string, ZerfExtension> {
  return loadedExtensions
}

export function findExtensionByCommand(cmd: string): { ext: ZerfExtension; commandDef: any } | null {
  const cleanCmd = cmd.startsWith('/') ? cmd : `/${cmd}`
  for (const ext of loadedExtensions.values()) {
    const found = (ext.manifest.commands || []).find(c => c.cmd.toLowerCase() === cleanCmd.toLowerCase())
    if (found) {
      return { ext, commandDef: found }
    }
  }
  return null
}

export async function dispatchCommand(
  cmd: string,
  args: string[],
  ctx: ZerfExtensionContext
): Promise<boolean> {
  const match = findExtensionByCommand(cmd)
  if (!match || !match.ext.onCommand) return false

  try {
    await match.ext.onCommand(cmd, args, ctx)
    return true
  } catch (err) {
    ctx.log.error(`Ошибка при выполнении команды ${cmd}: ${String(err)}`)
    return false
  }
}

export async function fireHook(
  event: string,
  data: any,
  ctx: ZerfExtensionContext
): Promise<void> {
  for (const ext of loadedExtensions.values()) {
    if (ext.onHook && ext.manifest.hooks?.includes(event)) {
      try {
        await ext.onHook(event, data, ctx)
      } catch (err) {
        ctx.log.error(`Ошибка хука ${event} в ${ext.manifest.name}: ${String(err)}`)
      }
    }
  }
}
