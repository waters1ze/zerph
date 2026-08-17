import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH } from '../theme.js';
import { StatusBar } from '../StatusBar.js';
export function CalendarScreen({ userData }) {
    useInput((input, key) => {
        if (key.escape || input === 'q' || key.return) {
            setScreen('repl');
        }
    });
    const today = new Date();
    const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const tasks = userData?.tasks || [];
    // Generate 7 days
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const label = `${dayNames[d.getDay()]} ${d.getDate()}`;
        const count = tasks.filter((t) => t.dueDate && t.dueDate.startsWith(dateStr) && t.status !== 'done').length;
        days.push({
            dateStr,
            label,
            count,
            isToday: i === 0,
        });
    }
    const upcomingTasks = tasks
        .filter((t) => t.dueDate && t.status !== 'done')
        .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1))
        .slice(0, 5);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C \u00B7 \u043D\u0435\u0434\u0435\u043B\u044F"] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsx(Box, { flexDirection: "row", marginY: 1, gap: 2, children: days.map(d => (_jsxs(Box, { flexDirection: "column", alignItems: "center", children: [_jsx(Text, { bold: true, color: d.isToday ? 'white' : 'gray', children: d.isToday ? `[${d.label}]` : d.label }), _jsx(Text, { color: d.count > 0 ? 'white' : 'gray', children: d.count > 0 ? `${d.count} ${d.count === 1 ? 'дело' : 'дела'}` : '—' })] }, d.dateStr))) }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u0420\u0410\u0421\u041F\u0418\u0421\u0410\u041D\u0418\u0415" }), upcomingTasks.length === 0 ? (_jsx(Text, { color: "gray", children: "\u0417\u0430\u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0437\u0430\u0434\u0430\u0447 \u043D\u0430 \u044D\u0442\u0443 \u043D\u0435\u0434\u0435\u043B\u044E \u043D\u0435\u0442." })) : (upcomingTasks.map((t, idx) => {
                        const timeStr = t.dueTime ? ` · ${t.dueTime}` : '';
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: [GLYPH.arrow, " ", t.dueDate, timeStr] }), _jsx(Text, { color: "white", children: t.title })] }, `sched_${t.id || idx}`));
                    }))] }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434 \u0432 REPL" })] }));
}
