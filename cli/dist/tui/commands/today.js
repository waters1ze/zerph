import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH, formatCountdown, progressBar, formatDate } from '../theme.js';
import { StatusBar } from '../StatusBar.js';
import { mutateItem, loadCredentials } from '../../api.js';
export function TodayScreen({ userData, onRefresh }) {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [statusMsg, setStatusMsg] = useState(null);
    const tasks = userData?.tasks || [];
    const habits = userData?.habits || [];
    const goals = userData?.goals || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr) || (t.dueDate < todayStr && t.status !== 'done'));
    useInput(async (input, key) => {
        if (key.escape || input === 'q') {
            setScreen('repl');
            return;
        }
        if (key.upArrow) {
            setSelectedIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, todayTasks.length - 1)));
            return;
        }
        if (key.downArrow) {
            setSelectedIdx(prev => (prev < todayTasks.length - 1 ? prev + 1 : 0));
            return;
        }
        if (input === ' ' && todayTasks.length > 0) {
            const task = todayTasks[selectedIdx];
            if (task) {
                try {
                    const creds = loadCredentials();
                    await mutateItem(creds, { action: 'toggle_task', id: task.id });
                    task.status = task.status === 'done' ? 'todo' : 'done';
                    setStatusMsg(`${GLYPH.ok} Статус задачи «${task.title}» обновлен`);
                    setTimeout(() => setStatusMsg(null), 2500);
                    if (onRefresh)
                        onRefresh();
                }
                catch (e) {
                    setStatusMsg(`${GLYPH.cancel} Ошибка: ${e.message}`);
                }
            }
        }
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0421\u0435\u0433\u043E\u0434\u043D\u044F \u00B7 ", formatDate()] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), statusMsg && (_jsx(Box, { marginY: 0, children: _jsx(Text, { bold: true, color: "green", children: statusMsg }) })), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u0417\u0410\u0414\u0410\u0427\u0418" }), todayTasks.length === 0 ? (_jsx(Text, { color: "gray", children: "\u041D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0437\u0430\u0434\u0430\u0447 \u043D\u0435\u0442. /add \u2014 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0435\u0440\u0432\u0443\u044E" })) : (todayTasks.map((t, idx) => {
                        const isSel = idx === selectedIdx;
                        const isDone = t.status === 'done';
                        const checkbox = isDone ? GLYPH.taskDone : GLYPH.taskTodo;
                        const countdown = formatCountdown(t.dueDate, t.dueTime, t.status);
                        const prio = t.priority === 'urgent' ? ' [Срочно]' : t.priority === 'high' ? ' [Высокий]' : '';
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'white' : 'gray', children: [isSel ? '▸ ' : '  ', checkbox, " ", t.title, prio] }), _jsxs(Text, { color: "gray", children: ["\u00B7 ", countdown] })] }, `task_${t.id || idx}`));
                    }))] }), habits.length > 0 && (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u041F\u0420\u0418\u0412\u042B\u0427\u041A\u0418" }), habits.slice(0, 5).map((h, idx) => {
                        const target = h.targetDays || 10;
                        const current = h.currentStreak || h.progress || 3;
                        const bar = progressBar(current / target, 8);
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: [GLYPH.arrow, " ", h.title.padEnd(16)] }), _jsx(Text, { bold: true, color: "white", children: bar }), _jsxs(Text, { color: "gray", children: [current, "/", target, " \u00B7 \u0441\u0442\u0440\u0438\u043A ", current, " \u0434\u043D."] })] }, `habit_${h.id || idx}`));
                    })] })), goals.length > 0 && (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u0426\u0415\u041B\u0418" }), goals.slice(0, 3).map((g, idx) => {
                        const prog = typeof g.progress === 'number' ? g.progress : 50;
                        const bar = progressBar(prog / 100, 8);
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: [GLYPH.arrow, " ", g.title.padEnd(20)] }), _jsx(Text, { bold: true, color: "white", children: bar }), _jsxs(Text, { color: "gray", children: [prog, "%"] })] }, `goal_${g.id || idx}`));
                    })] })), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Space \u2014 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u2502 \u2191/\u2193 \u2014 \u0432\u044B\u0431\u043E\u0440 \u2502 Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }));
}
