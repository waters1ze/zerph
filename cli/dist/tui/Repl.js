import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { fetchUserData, loadCredentials, mutateItem } from '../api.js';
import { getAllaySpriteLines, GLYPHS } from '../mascot.js';
const MENU_ITEMS = [
    { cmd: '/today', label: '/today', desc: 'Задачи и привычки на сегодня', glyph: GLYPHS.task },
    { cmd: '/add ', label: '/add <текст>', desc: 'Создать задачу с распознаванием даты', glyph: GLYPHS.task },
    { cmd: '/done ', label: '/done <название>', desc: 'Завершить задачу по имени', glyph: GLYPHS.taskDone },
    { cmd: '/cal', label: '/cal', desc: 'Календарь недели и расписание', glyph: GLYPHS.calendar },
    { cmd: '/chat ', label: '/chat <текст>', desc: 'Командный чат / заметка другу', glyph: GLYPHS.chat },
    { cmd: '/note ', label: '/note <текст>', desc: 'Сохранить заметку в базу знаний', glyph: GLYPHS.note },
    { cmd: '/focus 25', label: '/focus [мин]', desc: 'Сфера концентрации Тихони', glyph: GLYPHS.focus },
    { cmd: '/limits', label: '/limits', desc: 'Статус использования лимитов', glyph: GLYPHS.limits },
    { cmd: '/friends', label: '/friends', desc: 'Список друзей и совместные проекты', glyph: GLYPHS.friend },
    { cmd: '/clear', label: '/clear', desc: 'Очистить экран терминала', glyph: '🧹' },
    { cmd: '/help', label: '/help', desc: 'Справка и горячие клавиши', glyph: '?' },
    { cmd: '/exit', label: '/exit', desc: 'Выйти из Zerf CLI', glyph: '✕' },
];
export function Repl() {
    const { exit } = useApp();
    const [creds] = useState(() => loadCredentials());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [inputVal, setInputVal] = useState('');
    const [mood, setMood] = useState('idle');
    const [history, setHistory] = useState([]);
    const [cliCount, setCliCount] = useState(0);
    const [selectedIdx, setSelectedIdx] = useState(0);
    // Load user data once on mount
    const loadData = async () => {
        try {
            setLoading(true);
            const res = await fetchUserData(creds);
            if (res.allowed === false) {
                setError(res.message || 'Zerf CLI доступен для подписчиков Plus, Pro и Corp.');
            }
            else {
                setData(res);
                setCliCount(res.limits?.cliUsed || 0);
            }
        }
        catch (err) {
            setError(err.message || 'Ошибка загрузки данных');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData();
    }, [creds]);
    // Compute matching slash commands
    const isSlash = inputVal.startsWith('/');
    const filteredCommands = isSlash
        ? MENU_ITEMS.filter(m => m.cmd.toLowerCase().startsWith(inputVal.toLowerCase().trim()))
        : [];
    // Keep selectedIdx within bounds
    useEffect(() => {
        if (selectedIdx >= filteredCommands.length) {
            setSelectedIdx(0);
        }
    }, [filteredCommands.length, selectedIdx]);
    // Keyboard navigation for menu and suggestions
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
            return;
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
                }
                return;
            }
            if (key.escape) {
                setInputVal('');
                return;
            }
        }
    });
    const executeCommand = async (val) => {
        let raw = val.trim();
        if (!raw)
            return;
        // If user is selecting from slash menu with enter on exact slash prefix
        if (isSlash && filteredCommands.length > 0 && (!raw.includes(' ') || raw === '/')) {
            const selectedItem = filteredCommands[selectedIdx];
            if (selectedItem && (raw === '/' || !raw.includes(' '))) {
                if (selectedItem.cmd.endsWith(' ') && !raw.trim().includes(' ')) {
                    setInputVal(selectedItem.cmd);
                    return;
                }
                raw = selectedItem.cmd.trim();
            }
        }
        setInputVal('');
        // Add user command to history
        setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }]);
        setCliCount(c => c + 1);
        if (raw === '/exit' || raw === '/quit') {
            exit();
            return;
        }
        if (raw === '/clear') {
            setHistory([]);
            return;
        }
        if (raw === '/help' || raw === '?') {
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: '❖ Быстрые команды Zerf CLI:',
                    details: [
                        '/today          — Список задач и привычек на сегодня',
                        '/cal            — Недельный календарь и расписание',
                        '/chat <текст>   — Чат с коллегой / заметка другу',
                        '/add <текст>    — Создать задачу с распознаванием даты',
                        '/done <имя>     — Завершить задачу по названию',
                        '/focus [минуты] — Запустить сферу концентрации',
                        '/note <текст>   — Сохранить заметку в базу',
                        '/limits         — Статус использования лимитов',
                        '/friends        — Список друзей и их статус',
                        '/clear          — Очистить историю диалога',
                        '/exit           — Выйти из CLI',
                    ]
                }
            ]);
            return;
        }
        if (raw === '/today' || raw === '/задачи') {
            const tasks = data?.tasks || [];
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
            if (todayTasks.length === 0) {
                setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: 'На сегодня задач нет! Отличный день для отдыха.' }]);
            }
            else {
                const lines = todayTasks.map((t) => {
                    const check = t.status === 'done' ? `${GLYPHS.taskDone} ` : `${GLYPHS.taskTodo} `;
                    const time = t.dueTime ? ` (${t.dueTime})` : '';
                    const team = t.isShared ? ' [Команда]' : '';
                    return `${check} ${t.title}${time}${team}`;
                });
                setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: `❖ Задачи на сегодня (${todayTasks.length}):`, details: lines }]);
            }
            return;
        }
        if (raw === '/cal' || raw === '/календарь') {
            const todayStr = new Date().toISOString().slice(0, 10);
            const tasks = data?.tasks || [];
            const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: `◫ Календарь недели (${todayStr}):`,
                    details: [
                        '  Пн        Вт        Ср        Чт        Пт        Сб        Вс',
                        '─────────────────────────────────────────────────────────────────',
                        ` ${todayTasks.length} дел      —         —         —         —         —         —`,
                        '─────────────────────────────────────────────────────────────────',
                        '✦ Чтобы добавить встречу: "Встреча с командой в пятницу в 15:00"',
                    ]
                }
            ]);
            return;
        }
        if (raw.startsWith('/chat')) {
            const msg = raw.replace('/chat', '').trim();
            if (!msg) {
                setHistory(h => [
                    ...h,
                    {
                        id: String(Date.now()),
                        type: 'assistant',
                        text: '◈ Командный чат:',
                        details: [
                            '[17:40] Вовчик: Привет! По проекту всё готово к релизу?',
                            '[17:42] Вы: Да, собираю финальный билд CLI терминала.',
                            'Отправка сообщения: /chat <текст сообщения>',
                        ]
                    }
                ]);
            }
            else {
                setMood('celebrate');
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'assistant', text: `◈ Сообщение отправлено Вовчику: «${msg}»` },
                    { id: String(Date.now() + 1), type: 'assistant', text: `◈ Вовчик: Принято: «${msg}». Сейчас гляну! 👍` }
                ]);
                setTimeout(() => setMood('idle'), 2500);
            }
            return;
        }
        if (raw === '/friends' || raw === '/друзья') {
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: '🪽 Список друзей и команды:',
                    details: [
                        '• Вовчик (@vovchik)  — [Онлайн] Доступ к задачам открыт',
                        '• Лера (@lera)       — [Был(а) недавно]',
                        '💡 Чтобы отправить сообщение: /chat <сообщение>',
                    ]
                }
            ]);
            return;
        }
        if (raw === '/limits' || raw === '/лимиты' || raw === '/usage') {
            const l = data?.limits;
            const planName = (data?.user?.plan || 'corp').toUpperCase();
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: `⚡ Статус лимитов на сегодня (${planName}):`,
                    details: [
                        `• Запросы CLI:       ${cliCount} / ${l?.maxCli || '∞'} [██░░░░░░░░]`,
                        `• Распознав. голоса: ${Math.floor((l?.voiceUsedSeconds || 0) / 60)} / ${l?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(l?.maxVoiceSeconds / 60)} мин`,
                        `• ИИ диалоги:        ${l?.chatUsed || 0} / ${l?.maxChat || '∞'}`,
                        `• Активные заметки:  ${l?.notesCount || 0} / ${l?.maxNotes || '∞'}`,
                        `• Сброс счётчиков:   ежедневно в 00:00 МСК`,
                    ]
                }
            ]);
            return;
        }
        if (raw.startsWith('/focus')) {
            const parts = raw.split(' ');
            const mins = parseInt(parts[1] || '25', 10);
            setMood('focus');
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'assistant', text: `⊘ Сфера концентрации Тихони запущена на ${mins} мин.` }
            ]);
            return;
        }
        if (raw.startsWith('/done')) {
            const query = raw.replace('/done', '').trim().toLowerCase();
            const tasks = data?.tasks || [];
            const match = tasks.find((t) => t.status !== 'done' && t.title.toLowerCase().includes(query));
            if (match) {
                setMood('celebrate');
                await mutateItem(creds, { action: 'toggle_task', id: match.id });
                setData((prev) => ({
                    ...prev,
                    tasks: prev.tasks.map((t) => t.id === match.id ? { ...t, status: 'done' } : t)
                }));
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${match.title}» закрыта! Стрик продолжается ✦` }
                ]);
                setTimeout(() => setMood('idle'), 2500);
            }
            else {
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'error', text: `Задача не найдена по запросу: "${query}"` }
                ]);
            }
            return;
        }
        if (raw.startsWith('/note')) {
            const noteText = raw.replace('/note', '').trim();
            if (!noteText) {
                setHistory(h => [...h, { id: String(Date.now()), type: 'error', text: 'Укажите текст: /note <текст заметки>' }]);
                return;
            }
            setMood('thinking');
            await mutateItem(creds, {
                action: 'create',
                item: { title: noteText.slice(0, 50), content: noteText, type: 'note' }
            });
            setMood('celebrate');
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'assistant', text: `≡ Заметка «${noteText.slice(0, 40)}...» сохранена в базе знаний` }
            ]);
            setTimeout(() => setMood('idle'), 2500);
            return;
        }
        if (raw.startsWith('/add')) {
            const taskText = raw.replace('/add', '').trim();
            if (!taskText) {
                setHistory(h => [...h, { id: String(Date.now()), type: 'error', text: 'Укажите текст задачи: /add <название>' }]);
                return;
            }
            setMood('thinking');
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
                setMood('celebrate');
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${taskText}» создана и добавлена в расписание` }
                ]);
                await loadData();
                setTimeout(() => setMood('idle'), 2500);
            }
            catch (e) {
                setMood('alert');
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'error', text: `Ошибка: ${e.message}` }
                ]);
                setTimeout(() => setMood('idle'), 2500);
            }
            return;
        }
        // Natural language query / AI dispatch
        setMood('thinking');
        try {
            await mutateItem(creds, {
                action: 'create',
                item: {
                    title: raw,
                    type: 'task',
                    priority: 'medium',
                    rawText: raw,
                }
            });
            setMood('celebrate');
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${raw}» создана и добавлена в расписание` }
            ]);
            await loadData();
            setTimeout(() => setMood('idle'), 2500);
        }
        catch (e) {
            setMood('alert');
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'error', text: `Ошибка: ${e.message}` }
            ]);
            setTimeout(() => setMood('idle'), 2500);
        }
    };
    if (loading) {
        return (_jsx(Box, { flexDirection: "column", padding: 1, children: _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "cyan", children: _jsx(Spinner, { type: "dots" }) }), _jsx(Text, { color: "gray", children: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F Zerf Second Brain..." })] }) }));
    }
    if (error) {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "\u2756 \u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 Plus, Pro \u0438\u043B\u0438 Corp" }), _jsx(Text, { color: "gray", children: error }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C: " }), _jsx(Text, { underline: true, color: "blueBright", children: "https://t.me/Zerph_bot?start=buy" })] })] }));
    }
    const tasks = data?.tasks || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
    const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    const spriteLines = getAllaySpriteLines(mood, 0);
    const limits = data?.limits;
    const planTag = (data?.user?.plan || 'corp').toUpperCase();
    return (_jsxs(Box, { flexDirection: "column", padding: 1, width: 88, children: [_jsxs(Box, { borderStyle: "round", borderColor: "cyan", flexDirection: "row", children: [_jsxs(Box, { flexDirection: "column", width: 42, paddingX: 1, borderStyle: "single", borderColor: "gray", borderTop: false, borderBottom: false, borderLeft: false, children: [_jsx(Box, { justifyContent: "center", marginBottom: 1, children: _jsxs(Text, { bold: true, color: "white", children: ["\u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C, ", data?.user?.name || 'Кирилл', "!"] }) }), _jsx(Box, { flexDirection: "column", alignItems: "center", marginY: 1, children: spriteLines.map((line, idx) => (_jsx(Text, { children: line }, idx))) }), _jsxs(Box, { flexDirection: "column", alignItems: "center", marginTop: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "Groq AI" }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsxs(Text, { bold: true, color: "greenBright", children: ["Zerf ", planTag] }), data?.user?.username && _jsxs(Text, { color: "gray", children: ["\u00B7 @", data.user.username] })] }), _jsxs(Text, { color: "gray", dimColor: true, children: ["~/ZerfNotes/", todayStr] })] })] }), _jsxs(Box, { flexDirection: "column", width: 42, paddingX: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u0421\u043E\u0432\u0435\u0442\u044B & \u0428\u043E\u0440\u0442\u043A\u0430\u0442\u044B" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, gap: 0, children: [_jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/" }), " \u2014 \u0430\u0432\u0442\u043E\u043A\u043E\u043C\u043F\u043B\u0438\u0442 \u0438 \u043C\u0435\u043D\u044E (\u0441\u0442\u0440\u0435\u043B\u043A\u0438 \u2191/\u2193)"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/today" }), " \u2014 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/cal" }), " \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/chat" }), " \u2014 \u043A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0447\u0430\u0442"] })] }), _jsx(Box, { marginY: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }), _jsx(Text, { bold: true, color: "cyanBright", children: "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0441\u0435\u0433\u043E\u0434\u043D\u044F" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { color: "white", children: ["\u2756 \u0417\u0430\u0434\u0430\u0447: ", todayTasks.length, " ", overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''] }), _jsx(Text, { color: "cyanBright", children: "\u2726 \u0421\u0442\u0440\u0438\u043A \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438: 12 \u0434\u043D\u0435\u0439" })] })] })] }), _jsx(Box, { flexDirection: "column", marginY: 1, children: history.map(item => (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: item.type === 'user' ? (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { bold: true, color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(Box, { gap: 1, marginLeft: 2, children: [_jsx(Text, { color: "red", children: "\u25CF" }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "cyanBright", children: "\u25CF" }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, i)))] })) }, item.id))) }), isSlash && filteredCommands.length > 0 && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyanBright", paddingX: 1, marginY: 0, children: [_jsx(Box, { justifyContent: "space-between", marginBottom: 0, children: _jsx(Text, { bold: true, color: "cyanBright", children: "\u041A\u043E\u043C\u0430\u043D\u0434\u044B Zerf CLI (\u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F \u2191/\u2193, Tab \u0432\u044B\u0431\u043E\u0440):" }) }), filteredCommands.map((item, idx) => {
                        const isSel = idx === selectedIdx;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', item.label.padEnd(16)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", item.desc] })] }, item.cmd));
                    })] })), _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(TextInput, { value: inputVal, onChange: setInputVal, onSubmit: executeCommand, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, /today, /cal, /chat, ? \u0434\u043B\u044F \u0441\u043F\u0440\u0430\u0432\u043A\u0438..." })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u0421\u0442\u0440\u0435\u043B\u043A\u0438 \u2191/\u2193 \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F \u043F\u043E / \u00B7 Tab \u0432\u044B\u0431\u043E\u0440 \u00B7 ? \u0441\u043F\u0440\u0430\u0432\u043A\u0430" }), _jsxs(Text, { color: "gray", dimColor: true, children: ["[", planTag, ": ", cliCount, "/", limits?.maxCli || '∞', " CLI | ", Math.floor((limits?.voiceUsedSeconds || 0) / 60), "/", limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60), "\u043C \u0433\u043E\u043B\u043E\u0441]"] })] })] })] }));
}
