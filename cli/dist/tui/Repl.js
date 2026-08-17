import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { fetchUserData, loadCredentials, mutateItem } from '../api.js';
import { getAllaySpriteLines } from '../mascot.js';
const SLASH_COMMANDS = [
    { cmd: '/today', desc: 'Задачи и привычки на сегодня', cat: 'Планирование' },
    { cmd: '/add', desc: 'Создать задачу (<текст> [дата/время])', cat: 'Планирование' },
    { cmd: '/done', desc: 'Завершить задачу по названию', cat: 'Планирование' },
    { cmd: '/cal', desc: 'Календарь недели и расписание', cat: 'Просмотр' },
    { cmd: '/chat', desc: 'Чат с другом в терминале', cat: 'Команда' },
    { cmd: '/friends', desc: 'Список друзей и совместные дела', cat: 'Команда' },
    { cmd: '/note', desc: 'Сохранить заметку в базу знаний', cat: 'База знаний' },
    { cmd: '/focus', desc: 'Pomodoro таймер со сферой Тихони', cat: 'Продуктивность' },
    { cmd: '/limits', desc: 'Статус использования лимитов', cat: 'Система' },
    { cmd: '/clear', desc: 'Очистить экран терминала', cat: 'Система' },
    { cmd: '/help', desc: 'Справка и горячие клавиши', cat: 'Система' },
    { cmd: '/exit', desc: 'Выйти из Zerf CLI', cat: 'Система' },
];
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
    const [activeTab, setActiveTab] = useState('repl');
    const [cliCount, setCliCount] = useState(0);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        { id: '1', from: 'Вовчик', text: 'Привет! По проекту всё готово к релизу?', time: '17:40', isMe: false },
        { id: '2', from: 'Вы', text: 'Да, собираю финальный билд CLI терминала.', time: '17:42', isMe: true },
    ]);
    // Wing flapping animation
    useEffect(() => {
        const timer = setInterval(() => {
            setWingFrame(f => f + 1);
        }, 450);
        return () => clearInterval(timer);
    }, []);
    // Load user data
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
                setMood('idle');
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
        // Tab key switches windows
        if (key.tab) {
            const tabs = ['repl', 'today', 'cal', 'chat', 'limits'];
            const nextIdx = (tabs.indexOf(activeTab) + 1) % tabs.length;
            setActiveTab(tabs[nextIdx]);
            return;
        }
        if (input === '?' && !inputVal) {
            setShowHelpModal(prev => !prev);
            return;
        }
        if (key.escape && showHelpModal) {
            setShowHelpModal(false);
            return;
        }
    });
    const handleCommand = async (val) => {
        const raw = val.trim();
        if (!raw)
            return;
        setInputVal('');
        setShowHelpModal(false);
        // Add user command to history
        setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }]);
        setCliCount(c => c + 1);
        // 1. Slash commands & window navigation
        if (raw === '/exit' || raw === '/quit') {
            exit();
            return;
        }
        if (raw === '/clear') {
            setHistory([]);
            return;
        }
        if (raw === '/help' || raw === '?') {
            setShowHelpModal(true);
            return;
        }
        if (raw === '/today' || raw === '/задачи') {
            setActiveTab('today');
            return;
        }
        if (raw === '/cal' || raw === '/календарь') {
            setActiveTab('cal');
            return;
        }
        if (raw === '/chat' || raw === '/чат' || raw === '/friends' || raw === '/друзья') {
            setActiveTab('chat');
            return;
        }
        if (raw === '/limits' || raw === '/лимиты' || raw === '/usage') {
            setActiveTab('limits');
            return;
        }
        if (raw === '/repl' || raw === '/ai') {
            setActiveTab('repl');
            return;
        }
        // Direct chat message to friend: /chat [текст]
        if (raw.startsWith('/chat ') || activeTab === 'chat') {
            const msgText = raw.startsWith('/chat ') ? raw.replace('/chat ', '').trim() : raw;
            if (msgText) {
                const newMsg = {
                    id: String(Date.now()),
                    from: data?.user?.name || 'Вы',
                    text: msgText,
                    time: new Date().toTimeString().slice(0, 5),
                    isMe: true,
                };
                setChatMessages(prev => [...prev, newMsg]);
                setMood('celebrate');
                setTimeout(() => {
                    setChatMessages(prev => [
                        ...prev,
                        {
                            id: String(Date.now() + 1),
                            from: 'Вовчик',
                            text: `Принято: «${msgText}». Сейчас гляну! 👍`,
                            time: new Date().toTimeString().slice(0, 5),
                            isMe: false,
                        }
                    ]);
                    setMood('idle');
                }, 1200);
                return;
            }
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
                { id: String(Date.now()), type: 'assistant', text: `✔ Заметка «${noteText.slice(0, 40)}...» сохранена в базе знаний` }
            ]);
            setTimeout(() => setMood('idle'), 2500);
            return;
        }
        // 2. Natural language query / AI task creation
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
            // Refresh local tasks list
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
    const activeTodayTasks = todayTasks.filter((t) => t.status !== 'done');
    const doneTodayTasks = todayTasks.filter((t) => t.status === 'done');
    const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    const spriteLines = getAllaySpriteLines(mood, wingFrame);
    const limits = data?.limits;
    const planTag = (data?.user?.plan || 'corp').toUpperCase();
    const habits = data?.habits || [];
    const friends = data?.friends || [];
    const formatTimer = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    // Filter slash command suggestions
    const isSlashInput = inputVal.startsWith('/');
    const suggestions = isSlashInput
        ? SLASH_COMMANDS.filter(s => s.cmd.startsWith(inputVal.toLowerCase()))
        : [];
    return (_jsxs(Box, { flexDirection: "column", padding: 1, width: 92, children: [_jsxs(Box, { borderStyle: "single", borderColor: "gray", paddingX: 1, justifyContent: "space-between", marginBottom: 0, children: [_jsxs(Box, { gap: 2, children: [_jsx(Text, { bold: true, color: activeTab === 'repl' ? 'cyanBright' : 'gray', children: activeTab === 'repl' ? '● [1] ❖ REPL' : '○ [1] ❖ REPL' }), _jsx(Text, { bold: true, color: activeTab === 'today' ? 'cyanBright' : 'gray', children: activeTab === 'today' ? '● [2] 📋 Сегодня' : '○ [2] 📋 Сегодня' }), _jsx(Text, { bold: true, color: activeTab === 'cal' ? 'cyanBright' : 'gray', children: activeTab === 'cal' ? '● [3] 📅 Календарь' : '○ [3] 📅 Календарь' }), _jsx(Text, { bold: true, color: activeTab === 'chat' ? 'cyanBright' : 'gray', children: activeTab === 'chat' ? '● [4] 💬 Чат & Друзья' : '○ [4] 💬 Чат & Друзья' }), _jsx(Text, { bold: true, color: activeTab === 'limits' ? 'cyanBright' : 'gray', children: activeTab === 'limits' ? '● [5] ⚡ Лимиты' : '○ [5] ⚡ Лимиты' })] }), _jsx(Text, { color: "gray", dimColor: true, children: "Tab: \u0441\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u043A\u043D\u043E" })] }), activeTab === 'repl' && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { borderStyle: "round", borderColor: "cyan", flexDirection: "row", children: [_jsxs(Box, { flexDirection: "column", width: 44, paddingX: 1, borderStyle: "single", borderColor: "gray", borderTop: false, borderBottom: false, borderLeft: false, children: [_jsx(Box, { justifyContent: "center", marginBottom: 1, children: _jsxs(Text, { bold: true, color: "white", children: ["\u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C, ", data?.user?.name || 'Кирилл', "!"] }) }), _jsx(Box, { flexDirection: "column", alignItems: "center", marginY: 1, children: spriteLines.map((line, idx) => (_jsx(Text, { children: line }, idx))) }), _jsxs(Box, { flexDirection: "column", alignItems: "center", marginTop: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "Groq AI" }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsxs(Text, { bold: true, color: "greenBright", children: ["Zerf ", planTag] }), data?.user?.username && _jsxs(Text, { color: "gray", children: ["\u00B7 @", data.user.username] })] }), _jsxs(Text, { color: "gray", dimColor: true, children: ["~/ZerfNotes/", todayStr] })] })] }), _jsxs(Box, { flexDirection: "column", width: 44, paddingX: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "\u0421\u043E\u0432\u0435\u0442\u044B & \u0428\u043E\u0440\u0442\u043A\u0430\u0442\u044B" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, gap: 0, children: [_jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/today" }), " \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u043A\u043D\u043E \u0437\u0430\u0434\u0430\u0447"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/cal" }), " \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/chat" }), " \u2014 \u0447\u0430\u0442 \u0441 \u043A\u043E\u043B\u043B\u0435\u0433\u043E\u0439"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/focus 25" }), " \u2014 \u043F\u043E\u043C\u043E\u0434\u043E\u0440\u043E-\u0442\u0430\u0439\u043C\u0435\u0440"] })] }), _jsx(Box, { marginY: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }), _jsx(Text, { bold: true, color: "yellow", children: "\u0421\u0432\u043E\u0434\u043A\u0430 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F" }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { color: "white", children: ["\uD83D\uDCCB \u0417\u0430\u0434\u0430\u0447: ", todayTasks.length, " ", overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''] }), _jsx(Text, { color: "yellow", children: "\uD83D\uDD25 \u0421\u0442\u0440\u0438\u043A: 12 \u0434\u043D\u0435\u0439" }), focusRemaining !== null && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { bold: true, color: "cyanBright", children: ["\u2615 \u0424\u043E\u043A\u0443\u0441: ", formatTimer(focusRemaining)] }) }))] })] })] }), _jsx(Box, { flexDirection: "column", marginY: 1, children: history.map(item => (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: item.type === 'user' ? (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { bold: true, color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(Box, { gap: 1, marginLeft: 2, children: [_jsx(Text, { color: "red", children: "\u25CF" }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "greenBright", children: "\u25CF" }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, i)))] })) }, item.id))) })] })), activeTab === 'today' && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", padding: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 1, children: [_jsxs(Text, { bold: true, color: "white", children: ["\uD83D\uDCCB \u0417\u0430\u0434\u0430\u0447\u0438 \u0438 \u043F\u0440\u0438\u0432\u044B\u0447\u043A\u0438 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F (", todayStr, ")"] }), _jsxs(Text, { color: "gray", children: ["\u0412\u0441\u0435\u0433\u043E \u0434\u0435\u043B: ", todayTasks.length] })] }), _jsxs(Text, { bold: true, color: "cyanBright", children: ["\u0412 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435 (", activeTodayTasks.length, "):"] }), activeTodayTasks.length === 0 ? (_jsx(Text, { color: "gray", dimColor: true, children: "   \u0412\u0441\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B!" })) : (activeTodayTasks.map((t) => (_jsxs(Box, { marginLeft: 1, children: [_jsx(Text, { color: "gray", children: "[ ] " }), _jsx(Text, { color: "white", children: t.title }), t.dueTime && _jsxs(Text, { color: "cyanBright", children: [" (", t.dueTime, ")"] }), t.isShared && _jsx(Text, { color: "yellow", children: " [\u041A\u043E\u043C\u0430\u043D\u0434\u0430]" })] }, t.id)))), doneTodayTasks.length > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { bold: true, color: "greenBright", children: ["\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E (", doneTodayTasks.length, "):"] }), doneTodayTasks.map((t) => (_jsxs(Box, { marginLeft: 1, children: [_jsx(Text, { color: "greenBright", children: "[\u2714] " }), _jsx(Text, { color: "gray", strikethrough: true, children: t.title }), t.dueTime && _jsxs(Text, { color: "gray", children: [" (", t.dueTime, ")"] })] }, t.id)))] })), _jsxs(Box, { flexDirection: "column", marginTop: 1, borderStyle: "single", borderColor: "gray", paddingX: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "\u041F\u0440\u0438\u0432\u044B\u0447\u043A\u0438 \u0438 \u0442\u0440\u0435\u043A\u0435\u0440:" }), habits.length === 0 ? (_jsx(Text, { color: "gray", dimColor: true, children: "\u041F\u0440\u0438\u0432\u044B\u0447\u043A\u0438 \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0438\u0445 \u0432 \u0431\u043E\u0442\u0435 \u0438\u043B\u0438 \u0432\u0435\u0431-\u0432\u0435\u0440\u0441\u0438\u0438." })) : (habits.map((h) => (_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { color: "white", children: ["\u2022 ", h.title] }), _jsx(Text, { color: "cyanBright", children: "[\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591] 80% (\u0441\u0442\u0440\u0438\u043A 12)" })] }, h.id))))] })] })), activeTab === 'cal' && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", padding: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\uD83D\uDCC5 \u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C \u043D\u0430 \u043D\u0435\u0434\u0435\u043B\u044E" }), _jsxs(Text, { color: "yellow", children: ["\u0421\u0435\u0433\u043E\u0434\u043D\u044F: ", todayStr] })] }), _jsx(Box, { flexDirection: "row", justifyContent: "space-between", borderStyle: "single", borderColor: "gray", padding: 1, children: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, idx) => (_jsxs(Box, { flexDirection: "column", alignItems: "center", width: 10, children: [_jsx(Text, { bold: true, color: idx === 0 ? 'cyanBright' : 'white', children: day }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsx(Text, { color: idx === 0 ? 'greenBright' : 'gray', children: idx === 0 ? `${todayTasks.length} задач` : '—' })] }, day))) }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["\uD83D\uDCA1 \u0414\u043B\u044F \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432\u0441\u0442\u0440\u0435\u0447\u0438 \u043D\u0430\u043F\u0438\u0448\u0438\u0442\u0435: ", _jsx(Text, { color: "cyanBright", children: "\u0432\u0441\u0442\u0440\u0435\u0447\u0430 \u0441 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439 \u0432 \u043F\u044F\u0442\u043D\u0438\u0446\u0443 \u0432 15:00" })] }) })] })), activeTab === 'chat' && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", padding: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\uD83D\uDCAC \u041A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0447\u0430\u0442 & \u0417\u0430\u043C\u0435\u0442\u043A\u0438 \u0434\u0440\u0443\u0437\u044C\u044F\u043C" }), _jsx(Text, { color: "greenBright", children: "\u25CF \u041E\u043D\u043B\u0430\u0439\u043D: \u0412\u043E\u0432\u0447\u0438\u043A, \u041B\u0435\u0440\u0430" })] }), _jsx(Box, { flexDirection: "column", height: 8, borderStyle: "single", borderColor: "gray", paddingX: 1, marginY: 0, children: chatMessages.map(msg => (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: ["[", msg.time, "]"] }), _jsxs(Text, { bold: true, color: msg.isMe ? 'cyanBright' : 'yellow', children: [msg.from, ":"] }), _jsx(Text, { color: "white", children: msg.text })] }, msg.id))) }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F: \u043F\u0440\u043E\u0441\u0442\u043E \u043D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u0432\u043D\u0438\u0437\u0443 \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 ", _jsx(Text, { bold: true, color: "white", children: "Enter" })] }) })] })), activeTab === 'limits' && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", padding: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 1, children: [_jsxs(Text, { bold: true, color: "white", children: ["\u26A1 \u0421\u0442\u0430\u0442\u0443\u0441 \u043B\u0438\u043C\u0438\u0442\u043E\u0432 \u0438 \u043A\u0432\u043E\u0442 (", planTag, ")"] }), _jsx(Text, { color: "greenBright", children: "\u0410\u043A\u0442\u0438\u0432\u0435\u043D" })] }), _jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { color: "white", children: "\u2022 \u0417\u0430\u043F\u0440\u043E\u0441\u044B \u0432 CLI \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0435:" }), _jsxs(Text, { bold: true, color: "cyanBright", children: [cliCount, " / ", limits?.maxCli || '∞', " [\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591]"] })] }), _jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { color: "white", children: "\u2022 \u0420\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u0435 \u0433\u043E\u043B\u043E\u0441\u0430:" }), _jsxs(Text, { bold: true, color: "cyanBright", children: [Math.floor((limits?.voiceUsedSeconds || 0) / 60), " / ", limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60), " \u043C\u0438\u043D"] })] }), _jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { color: "white", children: "\u2022 \u0418\u0418 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F & \u043F\u0430\u0440\u0441\u0438\u043D\u0433:" }), _jsxs(Text, { bold: true, color: "cyanBright", children: [limits?.chatUsed || 0, " / ", limits?.maxChat || '∞'] })] }), _jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { color: "white", children: "\u2022 \u0417\u0430\u043C\u0435\u0442\u043A\u0438 \u0432 \u0431\u0430\u0437\u0435 \u0437\u043D\u0430\u043D\u0438\u0439:" }), _jsxs(Text, { bold: true, color: "cyanBright", children: [limits?.notesCount || 0, " / ", limits?.maxNotes || '∞'] })] }), _jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { color: "white", children: "\u2022 \u0417\u0430\u043F\u0440\u043E\u0441\u044B \u0447\u0435\u0440\u0435\u0437 Siri:" }), _jsx(Text, { bold: true, color: "cyanBright", children: "0 / 25 000" })] })] }), _jsx(Box, { marginTop: 1, borderStyle: "single", borderColor: "gray", paddingX: 1, children: _jsxs(Text, { color: "gray", dimColor: true, children: ["\u0414\u043B\u044F \u0442\u0430\u0440\u0438\u0444\u0430 ", planTag, " \u043B\u0438\u043C\u0438\u0442\u044B \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u044B \u0441 \u043E\u0433\u0440\u043E\u043C\u043D\u044B\u043C \u0437\u0430\u043F\u0430\u0441\u043E\u043C \u043D\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u0443 \u0434\u043E 4 \u0447\u0435\u043B\u043E\u0432\u0435\u043A. \u0421\u0431\u0440\u043E\u0441 \u0441\u0443\u0442\u043E\u0447\u043D\u044B\u0445 \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u043E\u0432 \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u0438\u0442 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E \u0432 00:00 \u041C\u0421\u041A."] }) })] })), isSlashInput && suggestions.length > 0 && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "yellow", paddingX: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "yellow", children: "\u041A\u043E\u043C\u0430\u043D\u0434\u044B Zerf CLI:" }), suggestions.map((s, idx) => (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: s.cmd.padEnd(10) }), _jsxs(Text, { color: "gray", children: ["\u2014 ", s.desc] })] }, s.cmd)))] })), showHelpModal && (_jsxs(Box, { flexDirection: "column", borderStyle: "double", borderColor: "cyanBright", padding: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\uD83D\uDCD6 \u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u0438 \u0433\u043E\u0440\u044F\u0447\u0438\u0435 \u043A\u043B\u0430\u0432\u0438\u0448\u0438 Zerf CLI" }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), _jsxs(Box, { flexDirection: "column", marginTop: 1, gap: 0, children: [_jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "Tab" }), " \u2014 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043C\u0435\u0436\u0434\u0443 \u043E\u043A\u043D\u0430\u043C\u0438 (REPL / \u0421\u0435\u0433\u043E\u0434\u043D\u044F / \u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C / \u0427\u0430\u0442 / \u041B\u0438\u043C\u0438\u0442\u044B)"] }), _jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "/today" }), " \u2014 \u043F\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u0441\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u0434\u0430\u0447 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F"] }), _jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "/cal" }), " \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C"] }), _jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "/chat" }), " \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0447\u0430\u0442 \u0441 \u043A\u043E\u043B\u043B\u0435\u0433\u043E\u0439"] }), _jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "/focus 25" }), " \u2014 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C Pomodoro \u0442\u0430\u0439\u043C\u0435\u0440 \u043A\u043E\u043D\u0446\u0435\u043D\u0442\u0440\u0430\u0446\u0438\u0438"] }), _jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "/done [\u0442\u0435\u043A\u0441\u0442]" }), " \u2014 \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443"] }), _jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "/note [\u0442\u0435\u043A\u0441\u0442]" }), " \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0437\u0430\u043C\u0435\u0442\u043A\u0443"] }), _jsxs(Text, { color: "white", children: ["\u2022 ", _jsx(Text, { bold: true, color: "cyanBright", children: "Ctrl + C" }), " \u2014 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0444\u043E\u043A\u0443\u0441-\u0442\u0430\u0439\u043C\u0435\u0440 \u0438\u043B\u0438 \u0432\u044B\u0439\u0442\u0438"] })] })] })), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(TextInput, { value: inputVal, onChange: setInputVal, onSubmit: handleCommand, placeholder: activeTab === 'chat'
                                    ? 'Напишите сообщение в чат другу...'
                                    : 'Напишите задачу, /today, /cal, /chat, /focus 25, ? для помощи...' })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "? for help \u00B7 Tab: \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043E\u043A\u043D\u043E" }), _jsxs(Text, { color: "gray", dimColor: true, children: ["[", planTag, ": ", cliCount, "/", limits?.maxCli || '∞', " CLI | ", Math.floor((limits?.voiceUsedSeconds || 0) / 60), "/", limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60), "\u043C \u0433\u043E\u043B\u043E\u0441]"] })] })] })] }));
}
