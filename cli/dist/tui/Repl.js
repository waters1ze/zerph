import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { loadCredentials, mutateItem, sendAiQuery, loadConfig, saveConfig } from '../api.js';
import { detectInstalledClis, runLocalCliBridge } from '../local-cli.js';
import { getAllaySpriteLines, GLYPHS } from '../mascot.js';
import { makeUniqueId } from './utils.js';
const CLOUD_MODELS = [
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B', desc: 'Флагман скорости и глубокой логики (120–200 мс)', type: 'cloud' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B', desc: 'Молниеносный отклик для быстрых задач', type: 'cloud' },
    { id: 'groq/compound', name: 'Groq Compound Router', desc: 'Авто-роутинг оптимальной модели под контекст', type: 'cloud' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instant', desc: 'Лёгкая модель для быстрых сводок и заметок', type: 'cloud' },
];
const BASE_MENU_ITEMS = [
    { cmd: '/menu', label: '/menu', desc: 'Интерактивное меню команд (стрелки ↑/↓)', glyph: '❖' },
    { cmd: '/today', label: '/today', desc: 'Список дел и привычек с отсчетом времени', glyph: '❖' },
    { cmd: '/cal', label: '/cal', desc: '7-дневный календарь с расписанием', glyph: '◫' },
    { cmd: '/chat', label: '/chat', desc: 'Диалог с друзьями / поручение задачи', glyph: '◈' },
    { cmd: '/add ', label: '/add <текст>', desc: 'Добавить задачу с распознаванием даты', glyph: '▸' },
    { cmd: '/done ', label: '/done <имя>', desc: 'Завершить задачу по названию', glyph: '✔' },
    { cmd: '/note ', label: '/note <текст>', desc: 'Сохранить быструю заметку в базу', glyph: '≡' },
    { cmd: '/focus 25', label: '/focus [мин]', desc: 'Сфера концентрации Pomodoro', glyph: '⊘' },
    { cmd: '/model', label: '/model', desc: 'Выбор нейросети или локального CLI', glyph: '◈' },
    { cmd: '/settings', label: '/settings', desc: 'Настройки, статус CLI и параметры', glyph: '⚙' },
    { cmd: '/friends', label: '/friends', desc: 'Список друзей и ссылка-приглашение', glyph: '◈' },
    { cmd: '/limits', label: '/limits', desc: 'Статус использования лимитов', glyph: '●' },
    { cmd: '/clear', label: '/clear', desc: 'Очистить историю диалога', glyph: '─' },
    { cmd: '/help', label: '/help', desc: 'Справка по всем командам', glyph: '?' },
    { cmd: '/exit', label: '/exit', desc: 'Выйти из Zerf CLI', glyph: '✕' },
];
function getCountdownText(dueTime, status) {
    if (status === 'done')
        return '✔ Выполнено';
    if (!dueTime)
        return 'без точного времени';
    const [dueHours, dueMinutes] = dueTime.split(':').map(Number);
    if (isNaN(dueHours) || isNaN(dueMinutes))
        return dueTime;
    const now = new Date();
    const target = new Date();
    target.setHours(dueHours, dueMinutes, 0, 0);
    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins > 60) {
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        return `через ${h} ч ${m > 0 ? `${m} мин` : ''}`;
    }
    else if (diffMins > 0) {
        return `через ${diffMins} мин`;
    }
    else if (diffMins === 0) {
        return `прямо сейчас!`;
    }
    else {
        const passed = Math.abs(diffMins);
        const h = Math.floor(passed / 60);
        const m = passed % 60;
        return `просрочено на ${h > 0 ? `${h} ч ` : ''}${m} мин`;
    }
}
function renderProgressBar(ratio, length = 12) {
    const clamped = Math.max(0, Math.min(1, isNaN(ratio) ? 0 : ratio));
    const filled = Math.round(clamped * length);
    const empty = length - filled;
    return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}]`;
}
export function Repl({ initialData }) {
    const { exit } = useApp();
    const [creds] = useState(() => loadCredentials());
    const [config, setConfig] = useState(() => loadConfig());
    const [data, setData] = useState(initialData || null);
    const [inputVal, setInputVal] = useState('');
    const [history, setHistory] = useState([]);
    const [cliCount, setCliCount] = useState(initialData?.limits?.cliUsed || 0);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [menuForced, setMenuForced] = useState(false);
    const [pickingModel, setPickingModel] = useState(false);
    const [selectedModelIdx, setSelectedModelIdx] = useState(0);
    const [pickingChatFriend, setPickingChatFriend] = useState(false);
    const [selectedFriendIdx, setSelectedFriendIdx] = useState(0);
    const [activeChatTarget, setActiveChatTarget] = useState(null);
    const [detectedClis, setDetectedClis] = useState([]);
    const [wingFrame, setWingFrame] = useState(0);
    const [actionProgress, setActionProgress] = useState(null);
    useEffect(() => {
        try {
            const found = detectInstalledClis();
            setDetectedClis(found);
        }
        catch { }
        const timer = setInterval(() => {
            setWingFrame(w => (w + 1) % 4);
        }, 400);
        return () => clearInterval(timer);
    }, []);
    const allAvailableModels = [
        ...CLOUD_MODELS,
        ...detectedClis.map(c => ({
            id: c.id,
            name: c.name,
            desc: c.desc,
            type: 'local_cli',
            status: c.installed ? 'Готов к работе' : 'Не установлен в PATH',
        })),
    ];
    const customExtItems = (data?.extensions || []).map((ext) => ({
        cmd: `/ext ${ext.id || ext.name}`,
        label: `/ext ${ext.name || ext.id}`,
        desc: `[Расширение] ${ext.description || ext.title || 'Пользовательский модуль'}`,
        glyph: '◈',
    }));
    const allMenuItems = [...BASE_MENU_ITEMS, ...customExtItems];
    const isSlash = (inputVal.startsWith('/') || menuForced) && !pickingModel && !pickingChatFriend;
    const filterQuery = menuForced ? '' : inputVal.toLowerCase().trim();
    const filteredCommands = isSlash
        ? allMenuItems.filter(m => !filterQuery || m.cmd.toLowerCase().startsWith(filterQuery))
        : [];
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
            return;
        }
        if (pickingModel) {
            if (key.upArrow) {
                setSelectedModelIdx(prev => (prev > 0 ? prev - 1 : allAvailableModels.length - 1));
                return;
            }
            if (key.downArrow) {
                setSelectedModelIdx(prev => (prev < allAvailableModels.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.return) {
                const chosen = allAvailableModels[selectedModelIdx];
                if (chosen) {
                    setActionProgress({ label: `Применение модели ${chosen.name}...`, ratio: 0.8 });
                    const updated = saveConfig({ model: chosen.id });
                    setConfig(updated);
                    setTimeout(() => {
                        setActionProgress({ label: `Активна модель: ${chosen.name}`, ratio: 1.0 });
                        setTimeout(() => setActionProgress(null), 1200);
                    }, 200);
                    setHistory(h => [
                        ...h,
                        {
                            id: makeUniqueId(),
                            type: 'assistant',
                            text: `◈ Активная нейросеть / CLI агент: ${chosen.name}`,
                            details: [chosen.desc],
                        },
                    ]);
                }
                setPickingModel(false);
                return;
            }
            if (key.escape) {
                setPickingModel(false);
                return;
            }
        }
        if (pickingChatFriend) {
            const friends = data?.friends || [];
            if (key.upArrow) {
                setSelectedFriendIdx(prev => (prev > 0 ? prev - 1 : (friends.length > 0 ? friends.length - 1 : 0)));
                return;
            }
            if (key.downArrow) {
                setSelectedFriendIdx(prev => (prev < friends.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.return) {
                const chosen = friends[selectedFriendIdx];
                if (chosen) {
                    setActiveChatTarget(chosen);
                    const targetName = chosen.username ? `@${chosen.username}` : chosen.name;
                    setInputVal(`/chat ${targetName} `);
                    setHistory(h => [
                        ...h,
                        {
                            id: makeUniqueId(),
                            type: 'assistant',
                            text: `◈ Выбран собеседник: ${chosen.name} (${targetName})`,
                            details: ['Введите сообщение или задачу для отправки.'],
                        },
                    ]);
                }
                setPickingChatFriend(false);
                return;
            }
            if (key.escape) {
                setPickingChatFriend(false);
                return;
            }
        }
        if (isSlash && filteredCommands.length > 0) {
            if (key.upArrow) {
                setSelectedIdx(prev => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
                return;
            }
            if (key.downArrow) {
                setSelectedIdx(prev => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.tab) {
                const item = filteredCommands[selectedIdx];
                if (item) {
                    setInputVal(item.cmd.trim() + ' ');
                    setMenuForced(false);
                }
                return;
            }
            if (key.escape) {
                setInputVal('');
                setMenuForced(false);
                return;
            }
        }
        if ((key.backspace || key.delete) && inputVal.length <= 1) {
            setInputVal('');
            setMenuForced(false);
            return;
        }
        if (input === '?' && !inputVal) {
            setMenuForced(prev => !prev);
            return;
        }
    });
    const executeCommand = async (val) => {
        let raw = val.trim();
        if (!raw)
            return;
        if (isSlash && filteredCommands.length > 0 && (menuForced || !raw.includes(' ') || raw === '/')) {
            const selectedItem = filteredCommands[selectedIdx];
            if (selectedItem && (menuForced || raw === '/' || !raw.includes(' '))) {
                if (selectedItem.cmd.endsWith(' ') && !raw.trim().includes(' ')) {
                    setInputVal(selectedItem.cmd);
                    setMenuForced(false);
                    return;
                }
                raw = selectedItem.cmd.trim();
            }
        }
        setInputVal('');
        setMenuForced(false);
        setHistory(h => [...h, { id: makeUniqueId(), type: 'user', text: raw }]);
        setCliCount(c => c + 1);
        if (raw === '/exit' || raw === '/quit') {
            exit();
            return;
        }
        if (raw === '/clear') {
            console.clear();
            setHistory([]);
            return;
        }
        if (raw === '/menu') {
            setMenuForced(true);
            return;
        }
        if (raw === '/model' || raw === '/ai') {
            setPickingModel(true);
            return;
        }
        if (raw === '/settings') {
            const currentModelObj = allAvailableModels.find(m => m.id === config.model) || allAvailableModels[0];
            const installedCliCount = detectedClis.filter(c => c.installed).length;
            setHistory(h => [
                ...h,
                {
                    id: makeUniqueId(),
                    type: 'assistant',
                    text: '⚙ Настройки Zerf CLI:',
                    details: [
                        `• Активная модель / CLI: ${currentModelObj?.name} (сменить: /model)`,
                        `• Локальные CLI на ПК:  Обнаружено: ${installedCliCount} (agy, claude, opencode, gh, ollama)`,
                        `• Тема оформления:      Strict Cyan (Монохром + Тихоня)`,
                        `• Автосинхронизация:    Включена (каждые 30 сек)`,
                        `• Telegram Бот:         Подключен (@Zerph_bot)`,
                        `• Текущий тариф:        ${(data?.user?.plan || 'corp').toUpperCase()}`,
                    ],
                },
            ]);
            return;
        }
        if (raw === '/help' || raw === '?') {
            setHistory(h => [
                ...h,
                {
                    id: makeUniqueId(),
                    type: 'assistant',
                    text: '❖ Быстрые команды Zerf CLI:',
                    details: [
                        '/menu           — Интерактивное меню с выбором (стрелки ↑/↓)',
                        '/model          — Выбор нейросети (GPT-OSS, Compound, agy, claude)',
                        '/settings       — Окно параметров и настроек',
                        '/today          — Список задач с обратным отсчетом и шкалой',
                        '/cal            — 7-дневный календарь расписания',
                        '/chat <текст>   — Чат с друзьями / поручение задачи',
                        '/friends        — Список друзей и персональная ссылка',
                        '/add <текст>    — Создать задачу с распознаванием даты',
                        '/done <имя>     — Завершить задачу по названию',
                        '/focus [минуты] — Запустить Pomodoro таймер',
                        '/note <текст>   — Сохранить заметку в базу',
                        '/limits         — Статус использования лимитов',
                        '/clear          — Очистить историю диалога',
                        '/exit           — Выйти из CLI',
                    ],
                },
            ]);
            return;
        }
        if (raw === '/today' || raw === '/задачи') {
            const tasks = data?.tasks || [];
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
            const doneCount = todayTasks.filter((t) => t.status === 'done').length;
            const progressRatio = todayTasks.length > 0 ? doneCount / todayTasks.length : 0;
            const progressBar = renderProgressBar(progressRatio, 10);
            if (todayTasks.length === 0) {
                setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: 'На сегодня задач нет! Отличный день для отдыха.' }]);
            }
            else {
                const lines = todayTasks.map((t) => {
                    const isDone = t.status === 'done';
                    const check = isDone ? `${GLYPHS.taskDone} ` : `${GLYPHS.taskTodo} `;
                    const countdown = getCountdownText(t.dueTime, t.status);
                    const timeStr = t.dueTime ? ` [${t.dueTime}]` : '';
                    const prio = t.priority === 'urgent' ? ' [Срочно]' : t.priority === 'high' ? ' [Высокий]' : '';
                    return `${check} ${t.title}${timeStr}${prio}  →  ${countdown}`;
                });
                setHistory(h => [
                    ...h,
                    {
                        id: makeUniqueId(),
                        type: 'assistant',
                        text: `❖ Задачи на сегодня (${doneCount}/${todayTasks.length}) ${progressBar} ${Math.round(progressRatio * 100)}%:`,
                        details: lines,
                    },
                ]);
            }
            return;
        }
        if (raw === '/cal') {
            const today = new Date();
            const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            const tasks = data?.tasks || [];
            const days = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(today.getDate() + i);
                const dateStr = d.toISOString().slice(0, 10);
                const dayLabel = dayNames[d.getDay()];
                const dayTasks = tasks.filter((t) => t.dueDate && t.dueDate.startsWith(dateStr));
                days.push({
                    header: `${dayLabel} ${d.getDate()}`,
                    count: dayTasks.length,
                    isToday: i === 0,
                });
            }
            const gridHeader = days.map(d => (d.isToday ? `[${d.header}]`.padEnd(9) : d.header.padEnd(9))).join('│ ');
            const gridCounts = days.map(d => (d.count > 0 ? ` ${d.count} дел `.padEnd(9) : '   —    '.padEnd(9))).join('│ ');
            setHistory(h => [
                ...h,
                {
                    id: makeUniqueId(),
                    type: 'assistant',
                    text: `◫ Календарь на 7 дней (${today.toISOString().slice(0, 10)}):`,
                    details: [gridHeader, gridCounts],
                },
            ]);
            return;
        }
        if (raw.startsWith('/chat')) {
            const rest = raw.replace(/^\/chat\s*/i, '').trim();
            const friends = data?.friends || [];
            const chatId = data?.user?.chatId || '';
            if (!rest) {
                if (friends.length > 0) {
                    setPickingChatFriend(true);
                    setSelectedFriendIdx(0);
                    return;
                }
                else {
                    setHistory(h => [
                        ...h,
                        {
                            id: makeUniqueId(),
                            type: 'assistant',
                            text: '◈ Командный чат & Друзья (0):',
                            details: [
                                'У вас пока нет добавленных друзей для диалога.',
                                `▸ Ваша ссылка для добавления: https://t.me/Zerph_bot?start=invite_${chatId}`,
                            ],
                        },
                    ]);
                    return;
                }
            }
            let targetFriend = activeChatTarget;
            let messageText = rest;
            if (rest.startsWith('@')) {
                const parts = rest.split(' ');
                const targetUsername = parts[0].replace('@', '').toLowerCase();
                messageText = parts.slice(1).join(' ');
                targetFriend = friends.find((f) => (f.username || '').toLowerCase() === targetUsername || f.name.toLowerCase() === targetUsername) || { name: `@${targetUsername}`, username: targetUsername };
            }
            setActionProgress({ label: `Отправка сообщения ${targetFriend?.name || 'собеседнику'}...`, ratio: 0.6 });
            try {
                await mutateItem(creds, {
                    action: 'create_task',
                    title: messageText,
                    priority: 'medium',
                    isShared: true,
                    assignees: targetFriend?.chatId ? [String(targetFriend.chatId)] : (targetFriend?.username ? [targetFriend.username] : []),
                });
                setActionProgress({ label: 'Сообщение доставлено', ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 1000);
                setHistory(h => [
                    ...h,
                    {
                        id: makeUniqueId(),
                        type: 'assistant',
                        text: `◈ Сообщение / поручение отправлено ${targetFriend?.name || 'другу'}!`,
                        details: [`Текст: «${messageText}»`, 'Синхронизировано в командный чат Zerf Note и Telegram.'],
                    },
                ]);
            }
            catch (err) {
                setActionProgress(null);
                setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${err.message}` }]);
            }
            return;
        }
        if (raw === '/friends') {
            const friends = data?.friends || [];
            const chatId = data?.user?.chatId || '';
            if (friends.length === 0) {
                setHistory(h => [
                    ...h,
                    {
                        id: makeUniqueId(),
                        type: 'assistant',
                        text: '◈ Список друзей (0):',
                        details: [
                            'У вас пока нет добавленных друзей.',
                            `▸ Ссылка-приглашение: https://t.me/Zerph_bot?start=invite_${chatId}`,
                        ],
                    },
                ]);
            }
            else {
                const friendLines = friends.map((f) => `• ${f.name} (@${f.username || 'нет юзернейма'}) — [В сети]`);
                setHistory(h => [
                    ...h,
                    {
                        id: makeUniqueId(),
                        type: 'assistant',
                        text: `◈ Список друзей (${friends.length}):`,
                        details: [...friendLines, `▸ Ссылка: https://t.me/Zerph_bot?start=invite_${chatId}`],
                    },
                ]);
            }
            return;
        }
        if (raw === '/limits') {
            const l = data?.limits;
            const planName = (data?.user?.plan || 'corp').toUpperCase();
            const maxCli = typeof l?.maxCli === 'number' ? l.maxCli : 8000;
            const cliBar = renderProgressBar(cliCount / maxCli, 10);
            setHistory(h => [
                ...h,
                {
                    id: makeUniqueId(),
                    type: 'assistant',
                    text: `● Статус лимитов на сегодня (${planName}):`,
                    details: [
                        `• Запросы CLI:       ${cliCount} / ${l?.maxCli || '∞'} ${cliBar}`,
                        `• Распознав. голоса: ${Math.floor((l?.voiceUsedSeconds || 0) / 60)} / ${l?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(l?.maxVoiceSeconds / 60)} мин`,
                        `• ИИ диалоги:        ${l?.chatUsed || 0} / ${l?.maxChat || '∞'}`,
                        `• Активные заметки:  ${l?.notesCount || 0} / ${l?.maxNotes || '∞'}`,
                    ],
                },
            ]);
            return;
        }
        if (raw.startsWith('/focus')) {
            const mins = parseInt(raw.split(' ')[1] || '25', 10);
            setHistory(h => [
                ...h,
                { id: makeUniqueId(), type: 'assistant', text: `⊘ Сфера концентрации Тихони запущена на ${mins} мин.` },
            ]);
            return;
        }
        if (raw.startsWith('/done')) {
            const query = raw.replace('/done', '').trim().toLowerCase();
            const tasks = data?.tasks || [];
            const match = tasks.find((t) => t.status !== 'done' && t.title.toLowerCase().includes(query));
            if (match) {
                setActionProgress({ label: `Завершение «${match.title}»...`, ratio: 0.6 });
                await mutateItem(creds, { action: 'toggle_task', id: match.id });
                match.status = 'done';
                setActionProgress({ label: `Задача «${match.title}» закрыта`, ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 1000);
                setHistory(h => [
                    ...h,
                    { id: makeUniqueId(), type: 'assistant', text: `✔ Задача «${match.title}» успешно завершена!` },
                ]);
            }
            else {
                setHistory(h => [...h, { id: makeUniqueId(), type: 'assistant', text: `Задача не найдена по запросу «${query}»` }]);
            }
            return;
        }
        if (raw.startsWith('/add')) {
            const text = raw.replace('/add', '').trim();
            setActionProgress({ label: `Сохранение задачи «${text}»...`, ratio: 0.6 });
            await mutateItem(creds, {
                action: 'create_task',
                title: text,
                dueDate: new Date().toISOString().slice(0, 10),
                priority: 'medium',
                rawText: text,
            });
            setActionProgress({ label: `Задача сохранена в расписание`, ratio: 1.0 });
            setTimeout(() => setActionProgress(null), 1000);
            setHistory(h => [
                ...h,
                { id: makeUniqueId(), type: 'assistant', text: `✔ Задача «${text}» добавлена на сегодня!` },
            ]);
            return;
        }
        if (raw.startsWith('/note')) {
            const text = raw.replace('/note', '').trim();
            setActionProgress({ label: `Синхронизация заметки...`, ratio: 0.6 });
            await mutateItem(creds, {
                action: 'create_note',
                title: text.length > 40 ? text.slice(0, 37) + '…' : text,
                body: text,
            });
            setActionProgress({ label: `Заметка сохранена в базу`, ratio: 1.0 });
            setTimeout(() => setActionProgress(null), 1000);
            setHistory(h => [
                ...h,
                { id: makeUniqueId(), type: 'assistant', text: `✔ Заметка «${text}» сохранена в базу.` },
            ]);
            return;
        }
        // AI Query / Free text
        try {
            const currentModel = config.model || 'openai/gpt-oss-120b';
            setActionProgress({ label: `Генерация ответа через ${currentModel}...`, ratio: 0.45 });
            const progTimer = setTimeout(() => {
                setActionProgress({ label: `Генерация ответа через ${currentModel}...`, ratio: 0.8 });
            }, 500);
            if (currentModel.startsWith('cli:')) {
                const out = await runLocalCliBridge(currentModel, raw);
                clearTimeout(progTimer);
                setActionProgress({ label: 'Ответ CLI получен', ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 800);
                setHistory(h => [
                    ...h,
                    { id: makeUniqueId(), type: 'assistant', text: `◈ Ответ ${currentModel.replace('cli:', '')}:`, details: [out] },
                ]);
            }
            else {
                const res = await sendAiQuery(creds, raw, currentModel);
                clearTimeout(progTimer);
                setActionProgress({ label: 'Ответ сформирован', ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 800);
                setHistory(h => [
                    ...h,
                    { id: makeUniqueId(), type: 'assistant', text: res.message, details: res.details },
                ]);
            }
        }
        catch (e) {
            setActionProgress(null);
            setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${e.message}` }]);
        }
    };
    const userName = data?.user?.name || creds.userName || 'Пользователь Zerf';
    const planTag = (data?.user?.plan || creds.plan || 'corp').toUpperCase();
    const username = data?.user?.username ? `@${data.user.username}` : '';
    const spriteLines = getAllaySpriteLines('idle', wingFrame);
    const todayTasks = (data?.tasks || []).filter((t) => !t.dueDate || t.dueDate.startsWith(new Date().toISOString().slice(0, 10)));
    const overdueTasks = (data?.tasks || []).filter((t) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done');
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, width: 90, children: [_jsxs(Box, { justifyContent: "space-between", width: 86, marginY: 0, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u25C8" }), _jsx(Text, { bold: true, color: "white", children: "Zerf CLI v2.0.26" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: userName }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsx(Text, { bold: true, color: "cyanBright", children: planTag }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsx(Text, { color: "white", children: "\u0441\u0442\u0440\u0438\u043A 12 \u0434\u043D." })] })] }), _jsxs(Box, { borderStyle: "round", borderColor: "cyan", flexDirection: "row", width: 86, marginY: 0, children: [_jsxs(Box, { flexDirection: "column", width: 40, paddingX: 1, borderStyle: "single", borderColor: "gray", borderTop: false, borderBottom: false, borderLeft: false, children: [_jsxs(Text, { bold: true, color: "white", children: ["\u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C, ", userName] }), _jsx(Box, { flexDirection: "column", alignItems: "center", marginY: 1, children: spriteLines.map((line, idx) => (_jsx(Text, { children: line }, `sprite_${idx}`))) }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "Groq AI" }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsxs(Text, { bold: true, color: "greenBright", children: ["Zerf ", planTag] }), username && _jsxs(Text, { color: "gray", children: ["\u00B7 ", username] })] })] }), _jsxs(Box, { flexDirection: "column", width: 42, paddingX: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u0421\u043E\u0432\u0435\u0442\u044B & \u0428\u043E\u0440\u0442\u043A\u0430\u0442\u044B" }), _jsxs(Box, { flexDirection: "column", marginTop: 0, children: [_jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/menu" }), " \u2014 \u0438\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0435 \u043C\u0435\u043D\u044E (\u2191/\u2193)"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/today" }), " \u2014 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/cal" }), " \u2014 \u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/chat" }), " \u2014 \u043A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0447\u0430\u0442"] })] }), _jsx(Box, { marginY: 0, children: _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }), _jsx(Text, { bold: true, color: "cyanBright", children: "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0441\u0435\u0433\u043E\u0434\u043D\u044F" }), _jsxs(Box, { flexDirection: "column", marginTop: 0, children: [_jsxs(Text, { color: "white", children: ["\u2756 \u0417\u0430\u0434\u0430\u0447: ", todayTasks.length, " ", overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''] }), _jsx(Text, { color: "white", children: "\u25CF \u0421\u0442\u0440\u0438\u043A: 12 \u0434\u043D\u0435\u0439" })] })] })] }), history.slice(-5).map(item => (_jsx(Box, { flexDirection: "column", marginY: 0, marginTop: 1, children: item.type === 'user' ? (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { bold: true, color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(Box, { gap: 1, marginLeft: 2, children: [_jsx(Text, { color: "red", children: "\u25CF" }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "cyanBright", children: "\u25CF" }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, `detail_${item.id}_${i}`)))] })) }, `hist_${item.id}`))), pickingChatFriend && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyanBright", paddingX: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u25C8 \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0430 \u0434\u043B\u044F \u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u0438\u0430\u043B\u043E\u0433\u0430 (\u2191/\u2193, Enter):" }), _jsx(Text, { color: "gray", children: "ESC \u043E\u0442\u043C\u0435\u043D\u0430" })] }), (data?.friends || []).map((f, idx) => {
                        const isSel = idx === selectedFriendIdx;
                        const usernameTag = f.username ? `@${f.username}` : 'без юзернейма';
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', f.name.padEnd(20)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", usernameTag.padEnd(18), " [\u0412 \u0441\u0435\u0442\u0438] \u041D\u0430\u0447\u0430\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433"] })] }, `friend_opt_${f.id || idx}_${idx}`));
                    })] })), pickingModel && (_jsxs(Box, { flexDirection: "column", borderStyle: "double", borderColor: "cyanBright", paddingX: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u25C8 \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u044C \u0438\u043B\u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 CLI \u0430\u0433\u0435\u043D\u0442 (\u2191/\u2193, Enter):" }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), allAvailableModels.map((m, idx) => {
                        const isSel = idx === selectedModelIdx;
                        const isCurrent = config.model === m.id;
                        const tag = m.type === 'local_cli' ? `[Локальный CLI ${m.status || ''}]` : '[Облако Zerf]';
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', m.name.padEnd(30)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", tag, " ", m.desc, " ", isCurrent ? '(Текущий)' : ''] })] }, `model_opt_${m.id}_${idx}`));
                    })] })), isSlash && filteredCommands.length > 0 && !pickingModel && !pickingChatFriend && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyanBright", paddingX: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: menuForced ? '❖ Меню команд Zerf CLI (навигация ↑/↓, Enter для выбора):' : 'Команды Zerf CLI (навигация ↑/↓, Tab выбор):' }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), filteredCommands.map((item, idx) => {
                        const isSel = idx === selectedIdx;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', item.label.padEnd(18)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", item.desc] })] }, `cmd_opt_${item.cmd}_${idx}`));
                    })] })), actionProgress && (_jsxs(Box, { gap: 1, marginY: 0, marginTop: 1, marginLeft: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: renderProgressBar(actionProgress.ratio, 14) }), _jsxs(Text, { bold: true, color: "white", children: [Math.round(actionProgress.ratio * 100), "%"] }), _jsxs(Text, { color: "gray", children: ["\u2014 ", actionProgress.label] })] })), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(TextInput, { value: inputVal, onChange: (val) => {
                                    setInputVal(val);
                                    if (!val)
                                        setMenuForced(false);
                                }, onSubmit: executeCommand, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, \u0432\u043E\u043F\u0440\u043E\u0441 \u0418\u0418, /menu, /model, /settings..." })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "/menu \u043C\u0435\u043D\u044E \u00B7 /model \u0418\u0418/CLI \u00B7 /settings \u00B7 ? \u0441\u043F\u0440\u0430\u0432\u043A\u0430" }), _jsxs(Text, { color: "gray", dimColor: true, children: ["[", planTag, ": ", cliCount, "/", data?.limits?.maxCli || '∞', " CLI | ", Math.floor((data?.limits?.voiceUsedSeconds || 0) / 60), "/", data?.limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(data?.limits?.maxVoiceSeconds / 60), "\u043C \u0433\u043E\u043B\u043E\u0441]"] })] })] })] }));
}
