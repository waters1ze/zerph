import fs from 'fs';
import path from 'path';
import os from 'os';
const ZERF_DIR = path.join(os.homedir(), '.zerf');
const EXT_DIR = path.join(ZERF_DIR, 'extensions');
export const OFFICIAL_CATALOG = [
    { name: 'zerf-github', version: '1.0.0', description: 'GitHub Issues и PR синхронизация с задачами Zerf', author: 'Zerf Team' },
    { name: 'zerf-jira', version: '1.2.0', description: 'Jira Sprint & Backlog импорт в задачи и заметки', author: 'Zerf Team' },
    { name: 'zerf-notion', version: '0.9.1', description: 'Экспорт заметок Zerf Note в базы данных Notion', author: 'Community' },
    { name: 'zerf-cal', version: '2.1.0', description: 'Двусторонняя синхронизация Google Calendar', author: 'Zerf Team' },
    { name: 'zerf-ai-coach', version: '1.0.0', description: 'Персональный AI-коуч по привычкам и фокусу', author: 'Zerf Team' },
    { name: 'zerf-slack', version: '1.1.0', description: 'Slack уведомления и превращение тредов в задачи', author: 'Community' },
];
export function getInstalledExtensions() {
    try {
        if (!fs.existsSync(EXT_DIR)) {
            fs.mkdirSync(EXT_DIR, { recursive: true });
            return [];
        }
        const dirs = fs.readdirSync(EXT_DIR);
        const result = [];
        for (const d of dirs) {
            const manifestPath = path.join(EXT_DIR, d, 'zerf.manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                result.push({
                    name: manifest.name || d,
                    version: manifest.version || '1.0.0',
                    description: manifest.description || 'Пользовательское расширение',
                    author: manifest.author || 'local',
                    installed: true,
                });
            }
        }
        return result;
    }
    catch {
        return [];
    }
}
/**
 * Returns full loaded manifests of all local developer extensions coded on disk in ~/.zerf/extensions/
 */
export function getLocalDeveloperExtensions() {
    if (!fs.existsSync(EXT_DIR))
        return [];
    try {
        const dirs = fs.readdirSync(EXT_DIR);
        const result = [];
        for (const d of dirs) {
            const manifestPath = path.join(EXT_DIR, d, 'zerf.manifest.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    result.push({
                        id: manifest.name || d,
                        title: manifest.title || manifest.name || d,
                        name: manifest.name || d,
                        version: manifest.version || '1.0.0',
                        description: manifest.description || 'Локальный модуль',
                        authorName: manifest.author || 'local',
                        authorGithub: manifest.authorGithub,
                        icon: manifest.icon || '🛠️',
                        commands: manifest.commands || [],
                        triggers: manifest.triggers || [],
                        aiInstructions: manifest.aiInstructions,
                        content: manifest,
                        isLocal: true,
                    });
                }
                catch { }
            }
        }
        return result;
    }
    catch {
        return [];
    }
}
export function scaffoldExtension(name, desc) {
    const cleanName = name.startsWith('zerf-') ? name : `zerf-${name}`;
    const targetDir = path.join(EXT_DIR, cleanName);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    const cmdName = cleanName.replace(/^zerf-/, '');
    const manifest = {
        name: cleanName,
        title: name.replace(/^zerf-/, ''),
        version: '1.0.0',
        description: desc || 'Модуль расширения Zerf CLI',
        author: os.userInfo().username || 'developer',
        icon: '🛠️',
        aiInstructions: `Инструкция для Zerf AI: при вызове команды /${cmdName} или связанных триггеров обрабатывай задачи согласно логике плагина ${cleanName}.`,
        triggers: [`/${cmdName}`, `${cmdName}`],
        commands: [{ cmd: `/${cmdName}`, description: desc || 'Команда расширения' }],
        permissions: ['tasks:read', 'tasks:write', 'notes:read'],
        entrypoint: 'index.js',
    };
    const manifestPath = path.join(targetDir, 'zerf.manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    const sampleCode = `// ${cleanName} Extension Entrypoint
export default {
  async onLoad(ctx) {
    ctx.log.info('Расширение ${cleanName} загружено');
  },
  async onCommand(cmd, args, ctx) {
    ctx.log.success('Команда ' + cmd + ' выполнена с аргументами: ' + args.join(' '));
  },
  // Обработчик для ИИ-инструкций в CLI и Telegram
  async onAIAction(intent, context, ctx) {
    ctx.log.info('ИИ активировал действие расширения: ' + intent);
    return { success: true, processedBy: '${cleanName}' };
  }
};
`;
    fs.writeFileSync(path.join(targetDir, 'index.js'), sampleCode, 'utf-8');
    return { dir: targetDir, manifestPath };
}
export async function installExtensionPackage(name) {
    const cleanName = name.startsWith('zerf-') ? name : `zerf-${name}`;
    return new Promise((resolve) => {
        const targetDir = path.join(EXT_DIR, cleanName);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const cmdName = cleanName.replace(/^zerf-/, '');
        const manifest = {
            name: cleanName,
            title: cmdName,
            version: '1.0.0',
            description: `Установленное расширение ${cleanName}`,
            author: 'registry',
            icon: '◈',
            commands: [{ cmd: `/${cmdName}`, description: `Команда ${cleanName}` }],
            triggers: [`/${cmdName}`, `${cmdName}`],
            entrypoint: 'index.js',
        };
        fs.writeFileSync(path.join(targetDir, 'zerf.manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
        fs.writeFileSync(path.join(targetDir, 'index.js'), 'export default {};', 'utf-8');
        resolve();
    });
}
export async function removeExtensionPackage(name) {
    const cleanName = name.startsWith('zerf-') ? name : `zerf-${name}`;
    const targetDir = path.join(EXT_DIR, cleanName);
    if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
    }
}
