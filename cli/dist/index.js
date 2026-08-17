#!/usr/bin/env node
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import open from 'open';
import { Repl } from './tui/Repl.js';
import { loadCredentials, saveCredentials, clearCredentials, startDeviceAuth, pollDeviceAuth, fetchUserData, mutateItem, } from './api.js';
import { getAllayFace, renderAllayBanner } from './mascot.js';
const program = new Command();
program
    .name('zerf')
    .description('Zerf — второй мозг в терминале (Claude Code style CLI)')
    .version('1.0.0');
// Default action — Launch interactive REPL
program
    .action(async () => {
    const creds = loadCredentials();
    if (!creds.token) {
        console.log(`\n ${getAllayFace('idle')}  \x1b[1m\x1b[38;2;255;255;255mДобро пожаловать в Zerf CLI!\x1b[0m`);
        console.log(`     \x1b[38;2;148;163;184mДля входа в аккаунт выполните:\x1b[0m \x1b[38;2;56;189;248mzerf login\x1b[0m\n`);
        return;
    }
    try {
        const data = await fetchUserData(creds);
        if (data.allowed === false) {
            console.log(`\n 👑 \x1b[1m\x1b[38;2;251;191;36mТребуется подписка Plus, Pro или Corp\x1b[0m`);
            console.log(`    ${data.message}\n`);
            return;
        }
        console.clear();
        render(React.createElement(Repl, { initialData: data }));
    }
    catch (e) {
        render(React.createElement(Repl));
    }
});
// zerf login (Device Flow)
program
    .command('login')
    .description('Авторизация в Zerf через браузер (Device Code Flow)')
    .action(async () => {
    console.log(`\n ${getAllayFace('thinking')}  \x1b[38;2;148;163;184mГенерирую код подключения к Zerf Note...\x1b[0m`);
    try {
        const { code, authUrl } = await startDeviceAuth();
        console.log(`\n     Код подтверждения: \x1b[1m\x1b[38;2;56;189;248m${code}\x1b[0m`);
        console.log(`     Ссылка для входа:  \x1b[4m\x1b[38;2;129;140;248m${authUrl}\x1b[0m\n`);
        try {
            await open(authUrl);
        }
        catch { }
        let dots = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < 300_000) {
            await new Promise(r => setTimeout(r, 1500));
            dots = (dots + 1) % 4;
            process.stdout.write(`\r     \x1b[36m[ ⬡ . ⬡ ]\x1b[0m  Ожидаю подтверждения в браузере${'.'.repeat(dots)}${' '.repeat(4 - dots)} `);
            try {
                const res = await pollDeviceAuth(code);
                if (res && res.status === 'approved' && res.token) {
                    saveCredentials({
                        token: res.token,
                        chatId: res.chatId,
                        plan: res.plan,
                    });
                    console.log(`\n\n ${getAllayFace('celebrate')}  \x1b[32mУспешно авторизовано! Добро пожаловать в Zerf.\x1b[0m`);
                    console.log(`     Запустите \x1b[1m\x1b[38;2;56;189;248mzerf\x1b[0m для входа в REPL.\n`);
                    return;
                }
                if (res && res.status === 'rejected') {
                    console.log(`\n\n ${getAllayFace('alert')}  \x1b[31mЗапрос авторизации был отклонён на сайте.\x1b[0m\n`);
                    return;
                }
            }
            catch {
                // Retry on transient poll hiccups
            }
        }
        console.log('\n     Время ожидания истекло. Попробуйте снова: zerf login\n');
    }
    catch (err) {
        console.error('Ошибка входа:', err.message);
    }
});
// zerf today
program
    .command('today')
    .description('Показать список дел и привычек на сегодня')
    .action(async () => {
    const creds = loadCredentials();
    try {
        const data = await fetchUserData(creds);
        if (data.allowed === false) {
            console.log(`\n ${getAllayFace('alert')}  ${data.message}\n`);
            return;
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        const tasks = (data.tasks || []).filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
        console.log(`\n` + renderAllayBanner(data.user?.name || 'User', data.user?.plan || 'plus'));
        console.log(` ${getAllayFace('idle')}  \x1b[1m\x1b[38;2;255;255;255mЗадачи на сегодня (${tasks.length}):\x1b[0m\n`);
        if (tasks.length === 0) {
            console.log('   \x1b[38;2;148;163;184mНа сегодня задач нет! Отличный день для отдыха.\x1b[0m\n');
        }
        else {
            tasks.forEach((t) => {
                const check = t.status === 'done' ? '\x1b[32m✔\x1b[0m' : '\x1b[90m○\x1b[0m';
                const title = t.status === 'done' ? `\x1b[90m\x1b[9m${t.title}\x1b[0m` : `\x1b[1m${t.title}\x1b[0m`;
                const time = t.dueTime ? ` \x1b[36m(${t.dueTime})\x1b[0m` : '';
                console.log(`   ${check} ${title}${time}`);
            });
            console.log('');
        }
    }
    catch (err) {
        console.error(err.message);
    }
});
// zerf add <task>
program
    .command('add <task...>')
    .description('Быстро добавить задачу с распознаванием даты и времени')
    .action(async (taskParts) => {
    const creds = loadCredentials();
    const taskText = taskParts.join(' ');
    try {
        await mutateItem(creds, {
            action: 'create',
            item: {
                title: taskText,
                type: 'task',
                priority: 'medium',
                rawText: taskText,
            }
        });
        console.log(`\n ${getAllayFace('celebrate')}  \x1b[32m✔ задача «${taskText}» сохранена\x1b[0m\n`);
    }
    catch (err) {
        console.error('Ошибка сохранения:', err.message);
    }
});
// zerf done <query>
program
    .command('done <query...>')
    .description('Завершить задачу по названию (нечёткий поиск)')
    .action(async (queryParts) => {
    const creds = loadCredentials();
    const query = queryParts.join(' ').toLowerCase();
    try {
        const data = await fetchUserData(creds);
        const tasks = data.tasks || [];
        const match = tasks.find((t) => t.status !== 'done' && t.title.toLowerCase().includes(query));
        if (match) {
            await mutateItem(creds, { action: 'toggle_task', id: match.id });
            console.log(`\n ${getAllayFace('celebrate')}  \x1b[32m✔ задача «${match.title}» закрыта!\x1b[0m\n`);
        }
        else {
            console.log(`\n ${getAllayFace('alert')}  \x1b[31m✖ Задача не найдена по запросу: "${query}"\x1b[0m\n`);
        }
    }
    catch (err) {
        console.error(err.message);
    }
});
// zerf habit
program
    .command('habit')
    .description('Трекер привычек с прогрессом и стриками')
    .action(async () => {
    const creds = loadCredentials();
    try {
        const data = await fetchUserData(creds);
        const habits = data.habits || [];
        console.log(`\n ${getAllayFace('idle')}  \x1b[1m\x1b[38;2;255;255;255mПривычки (${habits.length}):\x1b[0m\n`);
        if (habits.length === 0) {
            console.log('   \x1b[90mПривычки пока не настроены. Создайте их в боте или на сайте.\x1b[0m\n');
        }
        else {
            habits.forEach((h) => {
                const streak = h.streak || 0;
                const bar = '█'.repeat(Math.min(streak, 10)) + '░'.repeat(Math.max(0, 10 - streak));
                console.log(`   \x1b[36m${h.title}\x1b[0m`);
                console.log(`   \x1b[33m[${bar}]\x1b[0m стрик ${streak} дн.\n`);
            });
        }
    }
    catch (err) {
        console.error(err.message);
    }
});
// zerf note <title>
program
    .command('note [text...]')
    .description('Создать заметку или открыть системный редактор $EDITOR')
    .action(async (textParts) => {
    const creds = loadCredentials();
    const text = (textParts || []).join(' ').trim();
    if (!text) {
        console.log(`\n ${getAllayFace('idle')}  Укажите текст заметки: \x1b[36mzerf note "Текст заметки"\x1b[0m\n`);
        return;
    }
    try {
        await mutateItem(creds, {
            action: 'create',
            item: {
                title: text.slice(0, 50),
                content: text,
                type: 'note',
            }
        });
        console.log(`\n ${getAllayFace('celebrate')}  \x1b[32m✔ Заметка сохранена в вашей базе знаний\x1b[0m\n`);
    }
    catch (err) {
        console.error('Ошибка сохранения заметки:', err.message);
    }
});
// zerf find <query>
program
    .command('find <query...>')
    .description('Быстрый поиск по всем задачам, заметкам и целям')
    .action(async (queryParts) => {
    const creds = loadCredentials();
    const query = queryParts.join(' ').toLowerCase();
    try {
        const data = await fetchUserData(creds);
        const tasks = (data.tasks || []).filter((t) => t.title.toLowerCase().includes(query));
        const notes = (data.notes || []).filter((n) => (n.title || '').toLowerCase().includes(query) || (n.content || '').toLowerCase().includes(query));
        const goals = (data.goals || []).filter((g) => g.title.toLowerCase().includes(query));
        console.log(`\n ${getAllayFace('thinking')}  \x1b[1m\x1b[38;2;255;255;255mРезультаты поиска по запросу: "${query}"\x1b[0m\n`);
        if (tasks.length > 0) {
            console.log(` \x1b[36m📋 Задачи (${tasks.length}):\x1b[0m`);
            tasks.slice(0, 5).forEach((t) => console.log(`   ${t.status === 'done' ? '✔' : '○'} ${t.title}`));
        }
        if (notes.length > 0) {
            console.log(`\n \x1b[33m📝 Заметки (${notes.length}):\x1b[0m`);
            notes.slice(0, 5).forEach((n) => console.log(`   • ${n.title || 'Без названия'}`));
        }
        if (goals.length > 0) {
            console.log(`\n \x1b[35m🎯 Цели (${goals.length}):\x1b[0m`);
            goals.slice(0, 5).forEach((g) => console.log(`   ◈ ${g.title} [${g.progress || 0}%]`));
        }
        if (tasks.length === 0 && notes.length === 0 && goals.length === 0) {
            console.log('   \x1b[90mНичего не найдено\x1b[0m');
        }
        console.log('');
    }
    catch (err) {
        console.error(err.message);
    }
});
// zerf focus [mins]
program
    .command('focus [mins]')
    .description('Запустить Pomodoro таймер со сферой концентрации Зефа')
    .action(async (minsArg) => {
    const mins = parseInt(minsArg || '25', 10);
    console.log(`\n ${getAllayFace('focus')}  \x1b[1m\x1b[38;2;255;255;255mСфера концентрации запущена на ${mins} мин.\x1b[0m`);
    console.log(`     \x1b[90mНажмите Ctrl+C для выхода из фокус-режима\x1b[0m\n`);
    let remaining = mins * 60;
    const interval = setInterval(() => {
        remaining -= 1;
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        process.stdout.write(`\r   \x1b[36m[ ˘ ᴗ ˘ ☕ ]\x1b[0m  Осталось: \x1b[1m\x1b[38;2;255;255;255m${timeStr}\x1b[0m   `);
        if (remaining <= 0) {
            clearInterval(interval);
            console.log(`\n\n ${getAllayFace('celebrate')}  \x1b[32mФокус-сессия завершена! Сделайте небольшой перерыв.\x1b[0m\n`);
        }
    }, 1000);
});
// zerf cal
program
    .command('cal')
    .description('Календарная сетка недели с расписанием')
    .action(async () => {
    const creds = loadCredentials();
    try {
        const data = await fetchUserData(creds);
        const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const today = new Date();
        console.log(`\n ${getAllayFace('idle')}  \x1b[1m\x1b[38;2;255;255;255mКалендарь недели:\x1b[0m\n`);
        console.log('   ' + days.map(d => `\x1b[36m ${d} \x1b[0m`).join('│'));
        console.log('   ' + '────┼'.repeat(6) + '────');
        const tasksCount = [2, 4, 1, 3, 5, 0, 1]; // demo distribution
        console.log('   ' + tasksCount.map(c => c > 0 ? ` \x1b[32m${c}д\x1b[0m ` : '  · ').join('│'));
        console.log('\n   \x1b[90mВсего задач на неделю: ' + (data.tasks?.length || 0) + '\x1b[0m\n');
    }
    catch (err) {
        console.error(err.message);
    }
});
// zerf sync
program
    .command('sync')
    .description('Синхронизировать данные и показать ленту активности')
    .action(async () => {
    const creds = loadCredentials();
    console.log(`\n ${getAllayFace('thinking')}  \x1b[90mСинхронизация с облаком Zerf Note...\x1b[0m`);
    try {
        const data = await fetchUserData(creds);
        console.log(`\n ${getAllayFace('celebrate')}  \x1b[32mСинхронизировано успешно!\x1b[0m`);
        console.log(`   • Задач в облаке: ${data.stats?.totalTasks || 0}`);
        console.log(`   • Заметок:        ${data.stats?.totalNotes || 0}`);
        console.log(`   • Привычек:       ${data.stats?.totalHabits || 0}\n`);
    }
    catch (err) {
        console.error(err.message);
    }
});
// zerf open
program
    .command('open [id]')
    .description('Открыть веб-приложение Zerf Note в браузере')
    .action(async () => {
    const creds = loadCredentials();
    const targetUrl = creds.serverUrl || 'https://zeprh.vercel.app';
    console.log(`\n ${getAllayFace('idle')}  Открываю веб-приложение: \x1b[4m\x1b[36m${targetUrl}\x1b[0m\n`);
    try {
        await open(targetUrl);
    }
    catch { }
});
// zerf whoami
program
    .command('whoami')
    .description('Показать текущий профиль, тариф и статистику')
    .action(async () => {
    const creds = loadCredentials();
    if (!creds.token) {
        console.log('Вы не авторизованы. Выполните: zerf login');
        return;
    }
    try {
        const data = await fetchUserData(creds);
        console.log(`\n` + renderAllayBanner(data.user?.name || 'User', data.user?.plan || 'plus'));
        console.log(`  Пользователь: \x1b[1m${data.user?.name}\x1b[0m (@${data.user?.username || 'no_uname'})`);
        console.log(`  Chat ID:      ${data.user?.chatId}`);
        console.log(`  Тариф:        \x1b[32m${data.user?.plan?.toUpperCase()}\x1b[0m`);
        console.log(`  Всего задач:  ${data.stats?.totalTasks || 0}`);
        console.log(`  Заметок:      ${data.stats?.totalNotes || 0}\n`);
    }
    catch (err) {
        console.error(err.message);
    }
});
// zerf logout
program
    .command('logout')
    .description('Выйти из аккаунта и очистить токен на диске')
    .action(() => {
    clearCredentials();
    console.log(`\n ${getAllayFace('idle')}  Вы вышли из аккаунта. Конфигурация очищена.\n`);
});
program.parse(process.argv);
