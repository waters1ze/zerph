import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { fetchUserData, loadCredentials, mutateItem } from '../api.js';
import { getZefFace } from '../mascot.js';
export function Repl() {
    const { exit } = useApp();
    const [creds] = useState(() => loadCredentials());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [inputVal, setInputVal] = useState('');
    const [mood, setMood] = useState('idle');
    const [history, setHistory] = useState([]);
    const [focusRemaining, setFocusRemaining] = useState(null);
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
                        { id: String(Date.now()), type: 'system', text: 'Фокус-сессия завершена! Отличная работа.', icon: '🔔' }
                    ]);
                    setTimeout(() => setMood('idle'), 3000);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [focusRemaining]);
    // Keyboard shortcut for exit
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            if (focusRemaining !== null) {
                setFocusRemaining(null);
                setMood('idle');
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'system', text: 'Фокус-таймер остановлен', icon: '⏸' }
                ]);
                return;
            }
            exit();
        }
    });
    const handleCommand = async (val) => {
        const raw = val.trim();
        if (!raw)
            return;
        setInputVal('');
        // Add user command to history
        setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }]);
        // 1. Slash commands
        if (raw === '/exit' || raw === '/quit') {
            exit();
            return;
        }
        if (raw === '/clear') {
            setHistory([]);
            return;
        }
        if (raw === '/help') {
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'system', text: 'Доступные команды:', icon: '💡' },
                { id: String(Date.now() + 1), type: 'result', text: '/today — Задачи на сегодня' },
                { id: String(Date.now() + 2), type: 'result', text: '/done <название> — Завершить задачу' },
                { id: String(Date.now() + 3), type: 'result', text: '/focus [минуты] — Запустить Pomodoro таймер' },
                { id: String(Date.now() + 4), type: 'result', text: '/habit — Трекер полезных привычек' },
                { id: String(Date.now() + 5), type: 'result', text: '/clear — Очистить экран' },
                { id: String(Date.now() + 6), type: 'result', text: '/exit — Выйти из REPL' },
            ]);
            return;
        }
        if (raw === '/today') {
            const tasks = data?.tasks || [];
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
            if (todayTasks.length === 0) {
                setHistory(h => [...h, { id: String(Date.now()), type: 'system', text: 'На сегодня задач нет!', icon: '✨' }]);
            }
            else {
                todayTasks.forEach((t) => {
                    const check = t.status === 'done' ? '✔' : '○';
                    const time = t.dueTime ? ` в ${t.dueTime}` : '';
                    setHistory(h => [...h, { id: String(Date.now() + Math.random()), type: 'result', text: `${check} ${t.title}${time}` }]);
                });
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
                { id: String(Date.now()), type: 'system', text: `Сфера концентрации активна на ${mins} мин.`, icon: '☕' }
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
                    { id: String(Date.now()), type: 'result', text: `задача «${match.title}» закрыта!`, icon: '✔' }
                ]);
                setTimeout(() => setMood('idle'), 2500);
            }
            else {
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'error', text: `Задача не найдена по запросу: "${query}"`, icon: '✖' }
                ]);
            }
            return;
        }
        // 2. Natural language query / AI dispatch
        setMood('thinking');
        try {
            const res = await mutateItem(creds, {
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
                { id: String(Date.now()), type: 'result', text: `задача «${raw}» сохранена`, icon: '✔' }
            ]);
            setTimeout(() => setMood('idle'), 2500);
        }
        catch (e) {
            setMood('alert');
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'error', text: `Ошибка: ${e.message}`, icon: '✖' }
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
    const formatTimer = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    return (_jsxs(Box, { flexDirection: "column", padding: 1, width: 85, children: [_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "cyan", children: "\u2756" }), _jsx(Text, { bold: true, color: "white", children: "Zerf \u2014 \u0432\u0442\u043E\u0440\u043E\u0439 \u043C\u043E\u0437\u0433" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: data?.user?.name || 'Пользователь' }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsx(Text, { bold: true, color: "greenBright", children: data?.user?.plan?.toUpperCase() || 'PLUS' }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsx(Text, { color: "yellow", children: "\u0441\u0442\u0440\u0438\u043A 12 \uD83D\uDD25" })] })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" })] }), _jsxs(Box, { gap: 1, marginBottom: 1, children: [_jsx(Text, { children: getZefFace(mood) }), focusRemaining !== null ? (_jsxs(Text, { color: "cyanBright", children: [formatTimer(focusRemaining), " \u2026 \u0441\u0444\u0435\u0440\u0430 \u043A\u043E\u043D\u0446\u0435\u043D\u0442\u0440\u0430\u0446\u0438\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u0430 (Ctrl+C \u0434\u043B\u044F \u043F\u0430\u0443\u0437\u044B)"] })) : (_jsxs(Text, { color: "gray", children: [todayTasks.length, " \u0437\u0430\u0434\u0430\u0447 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F", overdueTasks.length > 0 ? `, ${overdueTasks.length} просрочено` : ''] }))] }), history.map(item => (_jsx(Box, { gap: 1, marginLeft: item.type === 'user' ? 0 : 2, marginBottom: 0, children: item.type === 'user' ? (_jsxs(_Fragment, { children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: "red", children: item.icon || '✖' }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(_Fragment, { children: [_jsx(Text, { color: "green", children: item.icon || '✔' }), _jsx(Text, { color: "gray", children: item.text })] })) }, item.id))), _jsxs(Box, { marginTop: history.length > 0 ? 1 : 0, children: [_jsxs(Text, { bold: true, color: "cyanBright", children: ['>', " "] }), _jsx(TextInput, { value: inputVal, onChange: setInputVal, onSubmit: handleCommand, placeholder: "\u043A\u0443\u043F\u0438 \u0445\u043B\u0435\u0431, /today, /focus 25, /help..." })] })] }));
}
