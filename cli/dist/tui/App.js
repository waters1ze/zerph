import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { fetchUserData, loadConfig, mutateItem } from '../api.js';
import { getAllayAscii } from '../mascot.js';
export function App({ initialTab = 0 }) {
    const { exit } = useApp();
    const [config] = useState(() => loadConfig());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [promptInput, setPromptInput] = useState('');
    const [aiMessage, setAiMessage] = useState(null);
    const [mascotMood, setMascotMood] = useState('idle');
    const [wingFrame, setWingFrame] = useState(0);
    const TABS = [
        { key: 'today', label: '1. Сегодня', icon: '📋' },
        { key: 'tasks', label: '2. Все задачи', icon: '✔' },
        { key: 'notes', label: '3. Заметки', icon: '📝' },
        { key: 'goals', label: '4. Цели', icon: '🎯' },
        { key: 'habits', label: '5. Привычки', icon: '🔄' },
        { key: 'focus', label: '6. Фокус', icon: '⏱' },
        { key: 'extensions', label: '7. Расширения', icon: '🧩' },
    ];
    // Flapping wings animation effect
    useEffect(() => {
        const timer = setInterval(() => {
            setWingFrame(f => f + 1);
        }, 450);
        return () => clearInterval(timer);
    }, []);
    // Load initial data
    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const res = await fetchUserData(config);
                if (res.allowed === false) {
                    setError(res.message || 'Zerf CLI доступен только для тарифов Pro и Corp.');
                }
                else {
                    setData(res);
                    setMascotMood('idle');
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
    }, [config]);
    // Keyboard navigation
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
            return;
        }
        if (input === '1')
            setActiveTab(0);
        if (input === '2')
            setActiveTab(1);
        if (input === '3')
            setActiveTab(2);
        if (input === '4')
            setActiveTab(3);
        if (input === '5')
            setActiveTab(4);
        if (input === '6')
            setActiveTab(5);
        if (input === '7')
            setActiveTab(6);
    });
    // Handle task toggling
    const handleToggleTask = async (taskId) => {
        if (!data)
            return;
        try {
            setMascotMood('celebrate');
            await mutateItem(config, { action: 'toggle_task', id: taskId });
            // Update local state optimistically
            setData((prev) => ({
                ...prev,
                tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t)
            }));
            setTimeout(() => setMascotMood('idle'), 2500);
        }
        catch { }
    };
    // Handle natural language query
    const handlePromptSubmit = async (value) => {
        if (!value.trim())
            return;
        setMascotMood('thinking');
        setAiMessage(`Думаю над: "${value}"...`);
        setPromptInput('');
        try {
            const res = await fetch(`${config.apiUrl || 'https://zeprh.vercel.app'}/api/chat`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: value }),
            });
            const respData = await res.json();
            setAiMessage(respData.reply || 'Задача обработана!');
            setMascotMood('celebrate');
            setTimeout(() => setMascotMood('idle'), 3000);
        }
        catch (e) {
            setAiMessage(`Ошибка: ${e.message}`);
            setMascotMood('alert');
        }
    };
    if (loading) {
        return (_jsx(Box, { flexDirection: "column", padding: 1, children: _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "cyan", children: _jsx(Spinner, { type: "dots" }) }), _jsx(Text, { color: "cyanBright", children: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F Zerf CLI \u0441 \u043E\u0431\u043B\u0430\u043A\u043E\u043C..." })] }) }));
    }
    if (error) {
        return (_jsxs(Box, { flexDirection: "column", padding: 2, borderStyle: "round", borderColor: "yellow", children: [_jsx(Text, { bold: true, color: "yellow", children: "\uD83D\uDC51 \u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 Pro \u0438\u043B\u0438 Corp" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: error }) }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: "\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0443: " }), _jsx(Text, { underline: true, color: "blueBright", children: "https://t.me/Zerph_bot?start=buy" })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 Ctrl+C \u0434\u043B\u044F \u0432\u044B\u0445\u043E\u0434\u0430" }) })] }));
    }
    const tasks = data?.tasks || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
    const notes = data?.notes || [];
    const habits = data?.habits || [];
    const goals = data?.goals || [];
    return (_jsxs(Box, { flexDirection: "column", padding: 1, width: 90, children: [_jsxs(Box, { justifyContent: "space-between", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u2726 ZERF NOTE CLI" }), _jsx(Text, { color: "gray", children: "|" }), _jsx(Text, { color: "white", children: data?.user?.name || 'User' }), _jsxs(Text, { color: "greenBright", children: ["[", data?.user?.plan?.toUpperCase() || 'PRO', "]"] }), _jsx(Text, { color: "yellow", children: "\uD83D\uDD25 1" })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u041A\u043B\u0430\u0432\u0438\u0448\u0438 1-7: \u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432 | Ctrl+C: \u0412\u044B\u0445\u043E\u0434" })] }), _jsx(Box, { gap: 1, alignItems: "center", children: _jsx(Text, { color: "cyan", children: getAllayAscii(mascotMood, wingFrame)[1] }) })] }), _jsx(Box, { marginY: 1, gap: 1, children: TABS.map((tab, idx) => (_jsx(Box, { paddingX: 1, borderStyle: activeTab === idx ? 'bold' : 'single', borderColor: activeTab === idx ? 'cyanBright' : 'gray', children: _jsx(Text, { bold: activeTab === idx, color: activeTab === idx ? 'cyanBright' : 'gray', children: tab.label }) }, tab.key))) }), _jsxs(Box, { flexDirection: "column", minHeight: 12, borderStyle: "round", borderColor: "gray", padding: 1, children: [activeTab === 0 && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, color: "cyanBright", children: ["\uD83D\uDCCB \u0417\u0430\u0434\u0430\u0447\u0438 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F (", todayTasks.length, "):"] }), todayTasks.length === 0 ? (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", italic: true, children: "\u041D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0437\u0430\u0434\u0430\u0447 \u043D\u0435\u0442! \u041E\u0442\u043B\u0438\u0447\u043D\u044B\u0439 \u0434\u0435\u043D\u044C \u0434\u043B\u044F \u043E\u0442\u0434\u044B\u0445\u0430 \u0438\u043B\u0438 \u043D\u043E\u0432\u044B\u0445 \u0446\u0435\u043B\u0435\u0439." }) })) : (todayTasks.slice(0, 10).map((t) => (_jsxs(Box, { gap: 1, marginTop: 1, children: [_jsx(Text, { color: t.status === 'done' ? 'green' : 'gray', children: t.status === 'done' ? '[✔]' : '[ ]' }), _jsx(Text, { strikethrough: t.status === 'done', color: t.status === 'done' ? 'gray' : 'white', children: t.title }), t.dueTime && _jsxs(Text, { color: "cyan", children: ["(", t.dueTime, ")"] }), t.priority === 'urgent' && _jsx(Text, { color: "red", children: "[\u0421\u0440\u043E\u0447\u043D\u043E]" })] }, t.id))))] })), activeTab === 1 && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, color: "cyanBright", children: ["\u2714 \u0412\u0441\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 (", tasks.length, "):"] }), tasks.slice(0, 12).map((t) => (_jsxs(Box, { gap: 1, marginTop: 1, children: [_jsx(Text, { color: t.status === 'done' ? 'green' : 'gray', children: t.status === 'done' ? '[✔]' : '[ ]' }), _jsx(Text, { strikethrough: t.status === 'done', color: t.status === 'done' ? 'gray' : 'white', children: t.title }), t.dueDate && _jsxs(Text, { color: "gray", children: ["(", t.dueDate.slice(0, 10), ")"] })] }, t.id)))] })), activeTab === 2 && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, color: "cyanBright", children: ["\uD83D\uDCDD \u0412\u0430\u0448\u0438 \u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u0438 \u0411\u0430\u0437\u0430 \u0437\u043D\u0430\u043D\u0438\u0439 (", notes.length, "):"] }), notes.slice(0, 8).map((n) => (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 1, borderStyle: "single", borderColor: "gray", children: [_jsx(Text, { bold: true, color: "white", children: n.title || 'Без названия' }), _jsx(Text, { color: "gray", dimColor: true, children: (n.content || '').slice(0, 90) })] }, n.id)))] })), activeTab === 3 && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, color: "cyanBright", children: ["\uD83C\uDFAF \u0413\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u044B\u0435 \u0446\u0435\u043B\u0438 \u0438 \u0441\u043F\u0440\u0438\u043D\u0442\u044B (", goals.length, "):"] }), goals.slice(0, 6).map((g) => (_jsxs(Box, { gap: 1, marginTop: 1, children: [_jsx(Text, { color: "yellow", children: "\u25C8" }), _jsx(Text, { bold: true, color: "white", children: g.title }), _jsxs(Text, { color: "green", children: ["[", g.progress || 0, "%]"] })] }, g.id)))] })), activeTab === 4 && (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, color: "cyanBright", children: ["\uD83D\uDD04 \u0422\u0440\u0435\u043A\u0435\u0440 \u043F\u043E\u043B\u0435\u0437\u043D\u044B\u0445 \u043F\u0440\u0438\u0432\u044B\u0447\u0435\u043A (", habits.length, "):"] }), habits.slice(0, 6).map((h) => (_jsxs(Box, { gap: 1, marginTop: 1, children: [_jsx(Text, { color: "cyan", children: "\u2726" }), _jsx(Text, { color: "white", children: h.title }), _jsxs(Text, { color: "yellow", children: ["\uD83D\uDD25 \u0421\u0442\u0440\u0438\u043A: ", h.streak || 0, " \u0434\u043D."] })] }, h.id)))] })), activeTab === 5 && (_jsxs(Box, { flexDirection: "column", alignItems: "center", justifyContent: "center", children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u23F1 \u0420\u0435\u0436\u0438\u043C \u0424\u043E\u043A\u0443\u0441\u0430 (Pomodoro Zen)" }), _jsx(Box, { marginY: 1, borderStyle: "double", borderColor: "cyan", paddingX: 4, paddingY: 1, children: _jsx(Text, { bold: true, color: "white", children: "25:00" }) }), _jsx(Text, { color: "gray", children: "\u041C\u0430\u0441\u043A\u043E\u0442 \u042D\u043B\u043B\u0435\u0439 \u0445\u0440\u0430\u043D\u0438\u0442 \u0432\u0430\u0448 \u0444\u043E\u043A\u0443\u0441. \u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0437\u0432\u0443\u0447\u0438\u0442 \u043F\u043E \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0438." })] })), activeTab === 6 && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\uD83E\uDDE9 \u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0439 Zerf AI:" }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432 \u0441\u0442\u0440\u043E\u043A\u0443 \u0432\u043D\u0438\u0437\u0443: ", _jsx(Text, { color: "cyan", children: "\u0441\u043E\u0437\u0434\u0430\u0439 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 [\u0432\u0430\u0448\u0430 \u0438\u0434\u0435\u044F]" })] }) }), _jsx(Text, { color: "gray", dimColor: true, children: "\u041D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043D\u0430\u043F\u0438\u0448\u0435\u0442 \u043A\u043E\u0434, \u0441\u0442\u0438\u043B\u0438 \u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442 \u0432\u0438\u0434\u0436\u0435\u0442 \u043A \u0432\u0430\u0448\u0435\u043C\u0443 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0443!" })] }))] }), aiMessage && (_jsxs(Box, { borderStyle: "round", borderColor: "cyanBright", marginY: 1, paddingX: 1, children: [_jsx(Text, { color: "cyan", children: "\uD83E\uDD16 \u0417\u0451\u0440\u0444-\u042D\u043B\u043B\u0435\u0439: " }), _jsx(Text, { color: "white", children: aiMessage })] })), _jsxs(Box, { borderStyle: "single", borderColor: "cyan", paddingX: 1, marginTop: 1, children: [_jsx(Text, { color: "cyanBright", children: "\u2726 \u0417\u0430\u043F\u0440\u043E\u0441 \u043A Zerf AI: " }), _jsx(TextInput, { value: promptInput, onChange: setPromptInput, onSubmit: handlePromptSubmit, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, \u0432\u043E\u043F\u0440\u043E\u0441 \u0438\u043B\u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u0443..." })] })] }));
}
