import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { fetchUserData, loadCredentials, mutateItem } from '../api.js';
import { getAllaySpriteLines } from '../mascot.js';
const MENU_ITEMS = [
    { cmd: '/today', label: '📋 Задачи на сегодня', desc: 'Список дел, статусы и привычки' },
    { cmd: '/cal', label: '📅 Календарь недели', desc: 'Недельное расписание' },
    { cmd: '/chat', label: '💬 Чат с коллегой', desc: 'Командные сообщения и заметки' },
    { cmd: '/focus 25', label: '☕ Таймер фокуса', desc: 'Pomodoro 25 мин со сферой' },
    { cmd: '/note ', label: '📝 Сохранить заметку', desc: 'Добавить в базу знаний' },
    { cmd: '/limits', label: '⚡ Лимиты & Квоты', desc: 'Использование суточных лимитов' },
    { cmd: '/clear', label: '🧹 Очистить экран', desc: 'Сбросить историю диалога' },
    { cmd: '/exit', label: '🚪 Выйти', desc: 'Закрыть терминал' },
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
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedMenuIdx, setSelectedMenuIdx] = useState(0);
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
    // Keyboard navigation
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
            return;
        }
        if (menuOpen) {
            if (key.upArrow) {
                setSelectedMenuIdx(prev => (prev > 0 ? prev - 1 : MENU_ITEMS.length - 1));
                return;
            }
            if (key.downArrow) {
                setSelectedMenuIdx(prev => (prev < MENU_ITEMS.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.return) {
                const item = MENU_ITEMS[selectedMenuIdx];
                setMenuOpen(false);
                if (item) {
                    executeCommand(item.cmd);
                }
                return;
            }
            if (key.escape) {
                setMenuOpen(false);
                return;
            }
        }
        // Toggle menu with /menu or ?
        if (input === '?' && !inputVal) {
            setMenuOpen(prev => !prev);
            return;
        }
    });
    const executeCommand = async (val) => {
        const raw = val.trim();
        if (!raw)
            return;
        setInputVal('');
        setMenuOpen(false);
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
        if (raw === '/menu') {
            setMenuOpen(true);
            return;
        }
        if (raw === '/help' || raw === '?') {
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: '📖 Быстрые команды Zerf CLI:',
                    details: [
                        '/menu           — Интерактивное меню с выбором (стрелки ↑/↓)',
                        '/today          — Список задач и привычек на сегодня',
                        '/cal            — Недельный календарь',
                        '/chat <текст>   — Чат с коллегой / заметка другу',
                        '/done <имя>     — Завершить задачу',
                        '/focus [минуты] — Запустить Pomodoro таймер',
                        '/note <текст>   — Сохранить заметку в базу',
                        '/limits         — Статус использования лимитов',
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
                    const check = t.status === 'done' ? '✔' : '○';
                    const time = t.dueTime ? ` (${t.dueTime})` : '';
                    const team = t.isShared ? ' [Команда]' : '';
                    return `${check} ${t.title}${time}${team}`;
                });
                setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: `Задачи на сегодня (${todayTasks.length}):`, details: lines }]);
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
                    text: `📅 Календарь недели (${todayStr}):`,
                    details: [
                        '  Пн        Вт        Ср        Чт        Пт        Сб        Вс',
                        '─────────────────────────────────────────────────────────────────',
                        ` ${todayTasks.length} дел      —         —         —         —         —         —`,
                        '─────────────────────────────────────────────────────────────────',
                        '💡 Чтобы добавить встречу: "Встреча с командой в пятницу в 15:00"',
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
                        text: '💬 Командный чат:',
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
                    { id: String(Date.now()), type: 'assistant', text: `💬 Сообщение отправлено Вовчику: «${msg}»` },
                    { id: String(Date.now() + 1), type: 'assistant', text: `💬 Вовчик: Принято: «${msg}». Сейчас гляну! 👍` }
                ]);
                setTimeout(() => setMood('idle'), 2500);
            }
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
                        `• Запросы CLI:       ${cliCount} / ${l?.maxCli || '∞'}`,
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
                { id: String(Date.now()), type: 'assistant', text: `☕ Сфера концентрации Тихони запущена на ${mins} мин.` }
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
                    { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${match.title}» закрыта! Стрик продолжается 🔥` }
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
                { id: String(Date.now()), type: 'assistant', text: `✔ Заметка «${noteText.slice(0, 40)}...» сохранена в базе знаний` }
            ]);
            setTimeout(() => setMood('idle'), 2500);
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
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "\uD83D\uDC51 \u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 Plus, Pro \u0438\u043B\u0438 Corp" }), _jsx(Text, { color: "gray", children: error }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C: " }), _jsx(Text, { underline: true, color: "blueBright", children: "https://t.me/Zerph_bot?start=buy" })] })] }));
    }
    const tasks = data?.tasks || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
    const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    const spriteLines = getAllaySpriteLines(mood, 0);
    const limits = data?.limits;
    const planTag = (data?.user?.plan || 'corp').toUpperCase();
    return (_jsxs(Box, { flexDirection: "column", padding: 1, width: 88, children: [_jsxs(Box, { borderStyle: "round", borderColor: "cyan", flexDirection: "row", children: [_jsxs(Box, { flexDirection: "column", width: 42, paddingX: 1, borderStyle: "single", borderColor: "gray", borderTop: false, borderBottom: false, borderLeft: false, children: [_jsx(Box, { justifyContent: "center", marginBottom: 1, children: _jsxs(Text, { bold: true, color: "white", children: ["\u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C, ", data?.user?.name || 'Кирилл', "!"] }) }), _jsx(Box, { flexDirection: "column", alignItems: "center", marginY: 1, children: spriteLines.map((line, idx) => (_jsx(Text, { children: line }, idx))) }), _jsxs(Box, { flexDirection: "column", alignItems: "center", marginTop: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "Groq AI" }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsxs(Text, { bold: true, color: "greenBright", children: ["Zerf ", planTag] }), data?.user?.username && _jsxs(Text, { color: "gray", children: ["\u00B7 @", data.user.username] })] }), _jsxs(Text, { color: "gray", dimColor: true, children: ["~/ZerfNotes/", todayStr] })] })] }), _jsxs(Box, { flexDirection: "column", width: 42, paddingX: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "\u0421\u043E\u0432\u0435\u0442\u044B & \u0428\u043E\u0440\u0442\u043A\u0430\u0442\u044B" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, gap: 0, children: [_jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/menu" }), " \u2014 \u0438\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0435 \u043C\u0435\u043D\u044E (Gemini CLI)"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/today" }), " \u2014 \u0441\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u0434\u0430\u0447 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/cal" }), " \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/chat" }), " \u2014 \u043A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0447\u0430\u0442"] })] }), _jsx(Box, { marginY: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }), _jsx(Text, { bold: true, color: "yellow", children: "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0441\u0435\u0433\u043E\u0434\u043D\u044F" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { color: "white", children: ["\uD83D\uDCCB \u0417\u0430\u0434\u0430\u0447: ", todayTasks.length, " ", overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''] }), _jsx(Text, { color: "yellow", children: "\uD83D\uDD25 \u0421\u0442\u0440\u0438\u043A \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438: 12 \u0434\u043D\u0435\u0439" })] })] })] }), _jsx(Box, { flexDirection: "column", marginY: 1, children: history.map(item => (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: item.type === 'user' ? (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { bold: true, color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(Box, { gap: 1, marginLeft: 2, children: [_jsx(Text, { color: "red", children: "\u25CF" }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "greenBright", children: "\u25CF" }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, i)))] })) }, item.id))) }), menuOpen && (_jsxs(Box, { flexDirection: "column", borderStyle: "double", borderColor: "cyanBright", paddingX: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "\u2756 \u041C\u0435\u043D\u044E \u043A\u043E\u043C\u0430\u043D\u0434 Zerf CLI (\u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0440\u0435\u043B\u043A\u0430\u043C\u0438 \u2191/\u2193 \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 Enter):" }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), MENU_ITEMS.map((item, idx) => {
                        const isSel = idx === selectedMenuIdx;
                        return (_jsxs(Box, { gap: 1, paddingX: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', inverse: isSel, children: [isSel ? '▶ ' : '  ', item.label.padEnd(26)] }), _jsx(Text, { color: isSel ? 'white' : 'gray', children: item.desc })] }, item.cmd));
                    })] })), _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(TextInput, { value: inputVal, onChange: setInputVal, onSubmit: executeCommand, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, /menu, /today, /cal, /chat, ? \u0434\u043B\u044F \u0441\u043F\u0440\u0430\u0432\u043A\u0438..." })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "/menu \u0434\u043B\u044F \u0432\u044B\u0431\u043E\u0440\u0430 \u00B7 ? \u0441\u043F\u0440\u0430\u0432\u043A\u0430" }), _jsxs(Text, { color: "gray", dimColor: true, children: ["[", planTag, ": ", cliCount, "/", limits?.maxCli || '∞', " CLI | ", Math.floor((limits?.voiceUsedSeconds || 0) / 60), "/", limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60), "\u043C \u0433\u043E\u043B\u043E\u0441]"] })] })] })] }));
}
