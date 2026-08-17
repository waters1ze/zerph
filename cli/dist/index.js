#!/usr/bin/env node
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import chalk from 'chalk';
import { App } from './tui/App.js';
import { loadCredentials, saveCredentials, clearCredentials, fetchUserData, startDeviceAuth, pollDeviceAuth, } from './api.js';
import { GLYPH } from './tui/theme.js';
function renderStartupBar(ratio, width = 18) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const filled = Math.round(clamped * width);
    const empty = width - filled;
    return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}]`;
}
const program = new Command();
program
    .name('zerf')
    .description('Zerf — второй мозг в терминале (Claude Code style CLI)')
    .version('2.0.0');
// Default action — Launch interactive REPL TUI with animated progress
program.action(async () => {
    const creds = loadCredentials();
    if (!creds.token) {
        console.log(`\n ${GLYPH.logo} ${chalk.bold.white('Zerf — второй мозг в терминале')}`);
        console.log(`   ${chalk.gray('Вы не авторизованы. Для входа выполните:')} ${chalk.white('zerf login')}\n`);
        return;
    }
    try {
        // ── Animated Startup Progress Bar ──
        const showProgress = (ratio, label) => {
            const pct = Math.round(ratio * 100);
            const bar = chalk.cyanBright(renderStartupBar(ratio, 16));
            process.stdout.write(`\r \x1b[36m◈\x1b[0m \x1b[1mZerf CLI\x1b[0m  ${bar} \x1b[1m${pct}%\x1b[0m  \x1b[90m${label.padEnd(45)}\x1b[0m`);
        };
        showProgress(0.2, 'Чтение локальной конфигурации и сессии...');
        await new Promise(r => setTimeout(r, 60));
        showProgress(0.5, 'Синхронизация профиля с сервером Zerf...');
        const data = await fetchUserData(creds);
        showProgress(0.85, 'Инициализация контекста и внешних CLI...');
        await new Promise(r => setTimeout(r, 60));
        if (data.allowed === false) {
            process.stdout.write('\n');
            console.log(`\n ${GLYPH.cancel} ${chalk.bold.yellow('Требуется подписка Plus, Pro или Corp')}`);
            console.log(`   ${data.message}\n`);
            return;
        }
        showProgress(1.0, 'Готово! Запуск интерфейса...');
        await new Promise(r => setTimeout(r, 80));
        // Enter alternate screen buffer for 100% clean single-frame rendering
        process.stdout.write('\x1b[?1049h\x1b[H');
        const cleanup = () => {
            try {
                process.stdout.write('\x1b[?1049l');
            }
            catch { }
        };
        process.on('exit', cleanup);
        process.on('SIGINT', () => {
            cleanup();
            process.exit(0);
        });
        const appInstance = render(React.createElement(App, { initialData: data }), {
            exitOnCtrlC: true,
        });
        await appInstance.waitUntilExit();
        cleanup();
    }
    catch (err) {
        process.stdout.write('\n');
        console.error(`\n ${GLYPH.cancel} Ошибка загрузки: ${err.message}`);
    }
});
// zerf login (Device Code Flow)
program
    .command('login')
    .description('Авторизация в Zerf через браузер (Device Code Flow)')
    .action(async () => {
    console.log(`\n ${GLYPH.mascotIdle} ${chalk.gray('Генерирую код подключения к Zerf Note...')}`);
    try {
        const { code, authUrl } = await startDeviceAuth();
        console.log(`\n     Код подтверждения: ${chalk.bold.white(code)}`);
        console.log(`     Ссылка для входа:  ${chalk.white(authUrl)}`);
        console.log(`\n   ${GLYPH.bullet} ${chalk.gray('Ожидаю подтверждения входа в браузере...')}`);
        const pollInterval = setInterval(async () => {
            try {
                const res = await pollDeviceAuth(code);
                if (res.status === 'approved' && res.token) {
                    clearInterval(pollInterval);
                    saveCredentials({ token: res.token, chatId: res.chatId, plan: res.plan });
                    console.log(`\n ${GLYPH.ok} ${chalk.bold.white('Авторизация успешна! Запустите: zerf')}\n`);
                    process.exit(0);
                }
            }
            catch { }
        }, 2000);
    }
    catch (e) {
        console.error(`\n ${GLYPH.cancel} Ошибка входа: ${e.message}\n`);
    }
});
// zerf logout
program
    .command('logout')
    .description('Выйти из аккаунта и удалить токен на диске')
    .action(() => {
    clearCredentials();
    console.log(`\n ${GLYPH.ok} Сессия завершена. Токен удален.\n`);
});
program.parse(process.argv);
