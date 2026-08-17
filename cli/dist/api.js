import fs from 'fs';
import path from 'path';
import os from 'os';
const ZERF_DIR = path.join(os.homedir(), '.zerf');
const CREDENTIALS_FILE = path.join(ZERF_DIR, 'credentials.json');
const CONFIG_FILE = path.join(ZERF_DIR, 'config.json');
export const DEFAULT_SERVER_URL = process.env.ZERF_API_URL || 'https://zeprh.vercel.app';
export function loadCredentials() {
    try {
        if (fs.existsSync(CREDENTIALS_FILE)) {
            return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
        }
    }
    catch { }
    return { serverUrl: DEFAULT_SERVER_URL };
}
export function saveCredentials(creds) {
    try {
        if (!fs.existsSync(ZERF_DIR)) {
            fs.mkdirSync(ZERF_DIR, { recursive: true });
        }
        const current = loadCredentials();
        const merged = { ...current, ...creds };
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
        return merged;
    }
    catch (e) {
        console.error('Failed to save Zerf credentials:', e);
        return { serverUrl: DEFAULT_SERVER_URL, ...creds };
    }
}
export function clearCredentials() {
    try {
        if (fs.existsSync(CREDENTIALS_FILE)) {
            fs.unlinkSync(CREDENTIALS_FILE);
        }
    }
    catch { }
}
export function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    }
    catch { }
    return { theme: 'strict', sound: true, autoSync: true };
}
export function saveConfig(cfg) {
    try {
        if (!fs.existsSync(ZERF_DIR)) {
            fs.mkdirSync(ZERF_DIR, { recursive: true });
        }
        const current = loadConfig();
        const merged = { ...current, ...cfg };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
        return merged;
    }
    catch {
        return { theme: 'strict', sound: true, autoSync: true, ...cfg };
    }
}
// Device Flow Start
export async function startDeviceAuth(serverUrl = DEFAULT_SERVER_URL) {
    const res = await fetch(`${serverUrl}/api/cli/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: `Zerf CLI on ${os.hostname()} (${os.platform()})` }),
    });
    if (!res.ok) {
        throw new Error(`Device auth start error (HTTP ${res.status}): ${await res.text()}`);
    }
    return res.json();
}
// Device Flow Poll
export async function pollDeviceAuth(code, serverUrl = DEFAULT_SERVER_URL) {
    const res = await fetch(`${serverUrl}/api/cli/auth?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
        throw new Error(`Device auth poll error (HTTP ${res.status})`);
    }
    return res.json();
}
// Fetch Full Snapshot
export async function fetchUserData(creds) {
    if (!creds.token) {
        throw new Error('Not logged in. Please run `zerf login` to authenticate.');
    }
    const res = await fetch(`${creds.serverUrl || DEFAULT_SERVER_URL}/api/cli/data`, {
        headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json',
        },
    });
    if (res.status === 401) {
        throw new Error('Session expired. Please run `zerf login` again.');
    }
    if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        return {
            allowed: false,
            plan: errData.plan || 'free',
            message: errData.message || 'Zerf CLI доступен для подписчиков тарифов Plus, Pro и Corp.',
            upgradeUrl: errData.upgradeUrl || 'https://t.me/Zerph_bot?start=buy',
        };
    }
    if (!res.ok) {
        throw new Error(`API Error (HTTP ${res.status}): ${await res.text()}`);
    }
    return res.json();
}
// Mutate items (task done, delete, add)
export async function mutateItem(creds, payload) {
    if (!creds.token)
        throw new Error('Not logged in');
    const res = await fetch(`${creds.serverUrl || DEFAULT_SERVER_URL}/api/cli/data`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${creds.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(`Mutate error (HTTP ${res.status}): ${await res.text()}`);
    }
    return res.json();
}
