import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { fetchUserData, loadCredentials, mutateItem } from '../api.js';
import { getAllaySpriteLines } from '../mascot.js';
export function Repl() {
    const { exit } = useApp();
    const [creds] = useState(() => loadCredentials());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [inputVal, setInputVal] = useState('');
    const [mood, setMood] = useState('idle');
    const [wingFrame, setWingFrame] = useState(0);
    const [history, setHistory] = useState([]);
    const [focusRemaining, setFocusRemaining] = useState(null);
    const [thinkingMode, setThinkingMode] = useState(true);
    const [cliCount, setCliCount] = useState(0);
    // Wing flapping animation
    useEffect(() => {
        const timer = setInterval(() => {
            setWingFrame(f => f + 1);
        }, 450);
        return () => clearInterval(timer);
    }, []);
    // Load user data
    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const res = await fetchUserData(creds);
                if (res.allowed === false) {
                    setError(res.message || 'Zerf CLI доступен для подписчиков тарифов Plus, Pro и Corp.');
                }
                else {
                    setData(res);
                    setCliCount(res.limits?.cliUsed || 0);
                    setMood('idle');
                }
            }
            catch (err) {
                setError(err.message || 'Ошибка загрузки данных');
            }
            finally {
                setLoading(false);
            }
        }
        load();
    }, [creds]);
    // Focus Timer Tick
    useEffect(() => {
        if (focusRemaining === null || focusRemaining <= 0)
            return;
        const timer = setInterval(() => {
            setFocusRemaining(prev => {
                if (prev === null || prev <= 1) {
                    setMood('celebrate');
                    setHistory(h => [
                        ...h,
                        { id: String(Date.now()), type: 'assistant', text: '🔔 Фокус-сессия завершена! Отличная работа.' }
                    ]);
                    setTimeout(() => setMood('idle'), 3500);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [focusRemaining]);
    // Keyboard shortcut handlers
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            if (focusRemaining !== null) {
                setFocusRemaining(null);
                setMood('idle');
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'system', text: '⏸ Фокус-таймер остановлен' }
                ]);
                return;
            }
            exit();
            return;
        }
        if (key.tab) {
            setThinkingMode(prev => !prev);
        }
    });
    const handleCommand = async (val) => {
        const raw = val.trim();
        if (!raw)
            return;
        setInputVal('');
        // Add user command to history
        setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }]);
        setCliCount(c => c + 1);
        // 1. Slash commands
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
                    text: 'Доступные команды Zerf CLI:',
                    details: [
                        '/today          — Список задач и привычек на сегодня',
                        '/add <текст>    — Создать задачу с датой и временем',
                        '/done <поиск>   — Завершить задачу по названию',
                        '/note <текст>   — Сохранить заметку в базу знаний',
                        '/habit          — Трекер привычек и стрики',
                        '/limits         — Показать использование дневных лимитов',
                        '/focus [минуты] — Запустить Pomodoro таймер со сферой Тихони',
                        '/find <текст>   — Поиск по всем задачам, заметкам и целям',
                        '/sync           — Синхронизация с сервером',
                        '/clear          — Очистить историю диалога',
                        '/exit           — Выйти из CLI',
                    ]
                }
            ]);
            return;
        }
        if (raw === '/limits' || raw === '/usage') {
            const l = data?.limits;
            const planName = (data?.user?.plan || 'pro').toUpperCase();
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: `📊 Статус лимитов на сегодня (${planName}):`,
                    details: [
                        `• Запросы CLI:       ${cliCount} / ${l?.maxCli || '∞'}`,
                        `• Голос (распознав): ${Math.floor((l?.voiceUsedSeconds || 0) / 60)} / ${l?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(l?.maxVoiceSeconds / 60)} мин`,
                        `• ИИ диалоги:        ${l?.chatUsed || 0} / ${l?.maxChat || '∞'}`,
                        `• Активные заметки:  ${l?.notesCount || 0} / ${l?.maxNotes || '∞'}`,
                        `• Сброс счетчиков:   ежедневно в 00:00 МСК`,
                    ]
                }
            ]);
            return;
        }
        if (raw === '/today') {
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
                    return `${check} ${t.title}${time}`;
                });
                setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: `Задачи на сегодня (${todayTasks.length}):`, details: lines }]);
            }
            return;
        }
        if (raw.startsWith('/focus')) {
            const parts = raw.split(' ');
            const mins = parseInt(parts[1] || '25', 10);
            setFocusRemaining(mins * 60);
            setMood('focus');
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'assistant', text: `☕ Сфера концентрации Тихони запущена на ${mins} мин. (нажмите Ctrl+C для паузы)` }
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
                { id: String(Date.now()), type: 'assistant', text: `✔ Заметка «${noteText.slice(0, 40)}...» сохранена в базе` }
            ]);
            setTimeout(() => setMood('idle'), 2500);
            return;
        }
        // 2. Natural language query / AI dispatch
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
    const spriteLines = getAllaySpriteLines(mood, wingFrame);
    const limits = data?.limits;
    const planTag = (data?.user?.plan || 'pro').toUpperCase();
    const formatTimer = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    return (_jsxs(Box, { flexDirection: "column", padding: 1, width: 88, children: [_jsxs(Box, { borderStyle: "round", borderColor: "cyanBright", flexDirection: "row", children: [_jsxs(Box, { flexDirection: "column", width: 44, paddingX: 1, borderStyle: "single", borderColor: "cyan", borderTop: false, borderBottom: false, borderLeft: false, children: [_jsx(Box, { justifyContent: "center", marginBottom: 1, children: _jsxs(Text, { bold: true, color: "white", children: ["\u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C, ", data?.user?.name || 'Кирилл', "!"] }) }), _jsx(Box, { flexDirection: "column", alignItems: "center", marginY: 1, children: spriteLines.map((line, idx) => (_jsx(Text, { children: line }, idx))) }), _jsxs(Box, { flexDirection: "column", alignItems: "center", marginTop: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "Groq AI" }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsxs(Text, { bold: true, color: "greenBright", children: ["Zerf ", planTag] }), data?.user?.username && _jsxs(Text, { color: "gray", children: ["\u00B7 @", data.user.username] })] }), _jsxs(Text, { color: "gray", dimColor: true, children: ["~/ZerfNotes/", todayStr] })] })] }), _jsxs(Box, { flexDirection: "column", width: 42, paddingX: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "\u0421\u043E\u0432\u0435\u0442\u044B \u043F\u043E \u043D\u0430\u0447\u0430\u043B\u0443 \u0440\u0430\u0431\u043E\u0442\u044B" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, gap: 0, children: [_jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/today" }), " \u2014 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/focus 25" }), " \u2014 \u0442\u0430\u0439\u043C\u0435\u0440 \u0444\u043E\u043A\u0443\u0441\u0430"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/done [\u0438\u043C\u044F]" }), " \u2014 \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/limits" }), " \u2014 \u0441\u0447\u0435\u0442\u0447\u0438\u043A \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432"] })] }), _jsx(Box, { marginY: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }), _jsx(Box, { justifyContent: "space-between", children: _jsxs(Text, { bold: true, color: "yellow", children: ["\u041B\u0438\u043C\u0438\u0442\u044B & \u0421\u0447\u0451\u0442\u0447\u0438\u043A (", planTag, ")"] }) }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { color: "white", children: ["\u26A1 CLI \u0437\u0430\u043F\u0440\u043E\u0441\u044B: ", _jsx(Text, { bold: true, color: "cyanBright", children: cliCount }), " / ", limits?.maxCli || '∞'] }), _jsxs(Text, { color: "slate", dimColor: true, children: ["\uD83C\uDF99 \u0413\u043E\u043B\u043E\u0441: ", Math.floor((limits?.voiceUsedSeconds || 0) / 60), " / ", limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60), " \u043C\u0438\u043D"] }), _jsxs(Text, { color: "slate", dimColor: true, children: ["\uD83D\uDCCB \u0417\u0430\u0434\u0430\u0447 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F: ", todayTasks.length, " ", overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''] }), _jsx(Text, { color: "yellow", children: "\uD83D\uDD25 \u0421\u0442\u0440\u0438\u043A \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438: 12 \u0434\u043D\u0435\u0439" }), focusRemaining !== null && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { bold: true, color: "cyanBright", children: ["\u2615 \u0424\u043E\u043A\u0443\u0441: ", formatTimer(focusRemaining)] }) }))] })] })] }), _jsx(Box, { flexDirection: "column", marginY: 1, children: history.map(item => (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: item.type === 'user' ? (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { bold: true, color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(Box, { gap: 1, marginLeft: 2, children: [_jsx(Text, { color: "red", children: "\u25CF" }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "greenBright", children: "\u25CF" }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, i)))] })) }, item.id))) }), _jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(TextInput, { value: inputVal, onChange: setInputVal, onSubmit: handleCommand, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, /today, /focus 25, /limits, /help..." })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "? for shortcuts \u00B7 /today \u00B7 /focus \u00B7 /limits \u00B7 /done" }), _jsxs(Text, { color: "gray", dimColor: true, children: ["Thinking ", thinkingMode ? 'on' : 'off', " (tab to toggle)"] })] })] })] }));
}
