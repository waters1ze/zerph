import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Log } from './Log.js';
import { StatusBar } from './StatusBar.js';
import { GLYPH, formatDate } from './theme.js';
import { setScreen, updateReplState } from './state.js';
import { makeUniqueId, getInputHistory, pushInputHistory } from './utils.js';
import { handleAddCommand } from './commands/add.js';
import { handleDoneCommand } from './commands/done.js';
import { handleNoteCommand } from './commands/note.js';
import { handleChatCommand } from './commands/chat.js';
import { scaffoldExtension } from '../extensions/registry.js';
import { loadCredentials, loadConfig } from '../api.js';
export function Repl({ userData, onRefresh }) {
    const { exit } = useApp();
    const [inputVal, setInputVal] = useState('');
    const [entries, setEntries] = useState([]);
    const [historyList] = useState(() => getInputHistory());
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [ctrlCCount, setCtrlCCount] = useState(0);
    const userName = userData?.user?.name || 'Пользователь Zerf';
    const plan = userData?.user?.plan || 'plus';
    const tasks = userData?.tasks || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== 'done');
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            if (ctrlCCount >= 1) {
                exit();
            }
            else {
                setCtrlCCount(1);
                setEntries(e => [...e, { id: makeUniqueId(), type: 'system', text: 'Ещё раз Ctrl+C — выход' }]);
                setTimeout(() => setCtrlCCount(0), 2000);
            }
            return;
        }
        if (key.ctrl && (input === 'l' || input === 'L')) {
            setEntries([]);
            return;
        }
        if (key.upArrow && historyList.length > 0) {
            const nextIdx = historyIdx === -1 ? historyList.length - 1 : Math.max(0, historyIdx - 1);
            setHistoryIdx(nextIdx);
            setInputVal(historyList[nextIdx] || '');
            return;
        }
        if (key.downArrow && historyIdx !== -1) {
            const nextIdx = historyIdx + 1;
            if (nextIdx >= historyList.length) {
                setHistoryIdx(-1);
                setInputVal('');
            }
            else {
                setHistoryIdx(nextIdx);
                setInputVal(historyList[nextIdx] || '');
            }
        }
    });
    const executeCommand = async (raw) => {
        const trimmed = raw.trim();
        if (!trimmed)
            return;
        pushInputHistory(trimmed);
        setHistoryIdx(-1);
        setInputVal('');
        setEntries(e => [...e, { id: makeUniqueId(), type: 'user', text: trimmed }]);
        const creds = loadCredentials();
        const cfg = loadConfig();
        // 1. Navigation slash commands
        if (trimmed === '/today')
            return setScreen('today');
        if (trimmed === '/cal' || trimmed === '/calendar')
            return setScreen('cal');
        if (trimmed === '/model' || trimmed === '/ai')
            return setScreen('model');
        if (trimmed === '/settings')
            return setScreen('settings');
        if (trimmed === '/friends')
            return setScreen('friends');
        if (trimmed === '/limits')
            return setScreen('limits');
        if (trimmed === '/stats')
            return setScreen('stats');
        if (trimmed === '/ext' || trimmed === '/extensions')
            return setScreen('extensions');
        if (trimmed === '/help' || trimmed === '?')
            return setScreen('help');
        if (trimmed === '/clear')
            return setEntries([]);
        if (trimmed === '/exit' || trimmed === '/quit') {
            setEntries(e => [...e, { id: makeUniqueId(), type: 'system', text: 'До встречи! ❖' }]);
            setTimeout(() => exit(), 300);
            return;
        }
        // 2. Focus timer command
        if (trimmed.startsWith('/focus')) {
            const parts = trimmed.split(' ');
            const mins = parseInt(parts[1] || '25', 10);
            updateReplState({ focusMinutes: isNaN(mins) ? 25 : mins });
            return setScreen('focus');
        }
        // 3. Extension scaffold command
        if (trimmed.startsWith('/ext create')) {
            const name = trimmed.replace('/ext create', '').trim() || 'my-plugin';
            const { dir } = scaffoldExtension(name, 'Кастомный плагин Zerf');
            setEntries(e => [
                ...e,
                { id: makeUniqueId(), type: 'assistant', text: `${GLYPH.ok} Расширение ${name} создано в ${dir}` },
            ]);
            return;
        }
        // 4. Action mutations
        if (trimmed.startsWith('/add')) {
            const res = await handleAddCommand(trimmed, creds);
            setEntries(e => [...e, { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message }]);
            if (onRefresh)
                onRefresh();
            return;
        }
        if (trimmed.startsWith('/done')) {
            const res = await handleDoneCommand(trimmed, tasks, creds);
            setEntries(e => [
                ...e,
                { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message, details: res.details },
            ]);
            if (onRefresh)
                onRefresh();
            return;
        }
        if (trimmed.startsWith('/note')) {
            const res = await handleNoteCommand(trimmed, creds);
            setEntries(e => [
                ...e,
                { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message, details: res.details },
            ]);
            if (onRefresh)
                onRefresh();
            return;
        }
        // 5. General AI or Friend Chat
        setEntries(e => [...e, { id: makeUniqueId(), type: 'system', text: `${GLYPH.thinking} Думаю…` }]);
        const res = await handleChatCommand(trimmed, creds, cfg.model, userData?.friends || []);
        setEntries(e => {
            const filtered = e.filter(item => !item.text.includes('Думаю…'));
            return [...filtered, { id: makeUniqueId(), type: res.ok ? 'assistant' : 'error', text: res.message, details: res.details }];
        });
        if (onRefresh)
            onRefresh();
    };
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " Zerf \u2014 \u0432\u0442\u043E\u0440\u043E\u0439 \u043C\u043E\u0437\u0433"] }), _jsxs(Text, { color: "gray", children: [userName, " \u00B7 ", plan.toUpperCase(), " \u00B7 ", formatDate()] })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { gap: 1, marginY: 1, children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.mascotIdle, "_", GLYPH.mascotIdle] }), _jsxs(Text, { color: "gray", children: [todayTasks.length, " ", todayTasks.length === 1 ? 'задача' : 'задач', " \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u00B7", ' ', overdueTasks.length > 0 ? `${overdueTasks.length} просрочено · ` : '', "\u0441\u0442\u0440\u0438\u043A 5 \u0434\u043D\u0435\u0439"] })] }), _jsx(Log, { entries: entries }), _jsxs(Box, { gap: 1, marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u203A" }), _jsx(TextInput, { value: inputVal, onChange: setInputVal, onSubmit: executeCommand, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, \u0432\u043E\u043F\u0440\u043E\u0441 \u0418\u0418, /today, /focus, /help..." })] }), _jsx(StatusBar, { userName: userName, plan: plan })] }));
}
