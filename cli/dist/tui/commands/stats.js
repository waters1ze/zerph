import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH, progressBar } from '../theme.js';
import { StatusBar } from '../StatusBar.js';
export function StatsScreen({ userData }) {
    useInput((input, key) => {
        if (key.escape || input === 'q' || key.return) {
            setScreen('repl');
        }
    });
    const tasks = userData?.tasks || [];
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    const totalCount = tasks.length || 1;
    const efficiency = Math.round((doneCount / totalCount) * 100);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u00B7 \u0437\u0430 7 \u0434\u043D\u0435\u0439"] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u0417\u0410\u0414\u0410\u0427\u0418" }), _jsxs(Box, { gap: 2, children: [_jsxs(Text, { color: "gray", children: ["\u0421\u043E\u0437\u0434\u0430\u043D\u043E: ", _jsx(Text, { bold: true, color: "white", children: tasks.length })] }), _jsxs(Text, { color: "gray", children: ["\u0417\u0430\u043A\u0440\u044B\u0442\u043E: ", _jsx(Text, { bold: true, color: "white", children: doneCount })] }), _jsxs(Text, { color: "gray", children: ["\u042D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C: ", _jsxs(Text, { bold: true, color: "white", children: [efficiency, "%"] })] })] })] }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u0417\u0410\u041A\u0420\u042B\u0422\u0418\u042F \u041F\u041E \u0414\u041D\u042F\u041C" }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: "\u0441\u0431 " }), _jsx(Text, { bold: true, color: "white", children: progressBar(0.8, 6) }), _jsx(Text, { color: "gray", children: " 5" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: "\u0432\u0441 " }), _jsx(Text, { bold: true, color: "white", children: progressBar(0.3, 6) }), _jsx(Text, { color: "gray", children: " 2" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: "\u043F\u043D " }), _jsx(Text, { bold: true, color: "white", children: progressBar(0.5, 6) }), _jsx(Text, { color: "gray", children: " 3" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: "\u0432\u0442 " }), _jsx(Text, { bold: true, color: "white", children: progressBar(0.7, 6) }), _jsx(Text, { color: "gray", children: " 4" })] })] }), _jsx(Box, { marginY: 0, children: _jsx(Text, { color: "gray", children: "\u041B\u0443\u0447\u0448\u0430\u044F \u0441\u0435\u0440\u0438\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u0439: \u0432\u0442 20 \u0430\u0432\u0433 \u00B7 4 \u0437\u0430\u0434\u0430\u0447\u0438" }) }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434 \u0432 REPL" })] }));
}
