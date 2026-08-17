import fs from 'fs';
import path from 'path';
import os from 'os';
const ZERF_DIR = path.join(os.homedir(), '.zerf');
const EXT_DIR = path.join(ZERF_DIR, 'extensions');
const loadedExtensions = new Map();
export async function loadInstalledExtensions(ctx) {
    if (!fs.existsSync(EXT_DIR))
        return;
    try {
        const dirs = fs.readdirSync(EXT_DIR);
        for (const d of dirs) {
            const manifestPath = path.join(EXT_DIR, d, 'zerf.manifest.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    const ext = { manifest };
                    loadedExtensions.set(manifest.name || d, ext);
                    if (ext.onLoad) {
                        await ext.onLoad(ctx).catch(() => { });
                    }
                }
                catch { }
            }
        }
    }
    catch { }
}
export function findExtensionByCommand(cmd) {
    const cleanCmd = cmd.startsWith('/') ? cmd : `/${cmd}`;
    for (const ext of loadedExtensions.values()) {
        const found = (ext.manifest.commands || []).find(c => c.cmd.toLowerCase() === cleanCmd.toLowerCase());
        if (found) {
            return { ext, commandDef: found };
        }
    }
    return null;
}
