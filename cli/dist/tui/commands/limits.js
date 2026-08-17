import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH, progressBar } from '../theme.js';
import { StatusBar } from '../StatusBar.js';
export function LimitsScreen({ userData }) {
    useInput((input, key) => {
        if (key.escape || input === 'q' || key.return) {
            setScreen('repl');
        }
    });
    const l = userData?.limits || {};
    const plan = (userData?.user?.plan || 'plus').toUpperCase();
    const cliMax = typeof l.maxCli === 'number' ? l.maxCli : 8000;
    const cliUsed = l.cliUsed || 0;
    const voiceMax = typeof l.maxVoiceSeconds === 'number' ? Math.floor(l.maxVoiceSeconds / 60) : 15;
    const voiceUsed = Math.floor((l.voiceUsedSeconds || 0) / 60);
    const chatMax = typeof l.maxChat === 'number' ? l.maxChat : 150;
    const chatUsed = l.chatUsed || 0;
    const notesMax = typeof l.maxNotes === 'number' ? l.maxNotes : 250;
    const notesUsed = l.notesCount || 0;
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0421\u0442\u0430\u0442\u0443\u0441 \u043B\u0438\u043C\u0438\u0442\u043E\u0432 \u00B7 ", plan] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: [GLYPH.arrow, " \u0417\u0430\u043F\u0440\u043E\u0441\u044B CLI:       "] }), _jsx(Text, { bold: true, color: "white", children: progressBar(cliUsed / cliMax, 8) }), _jsxs(Text, { color: "gray", children: [cliUsed, " / ", cliMax] })] }), _jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: [GLYPH.arrow, " \u0420\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u0435 \u0433\u043E\u043B\u043E\u0441\u0430:"] }), _jsx(Text, { bold: true, color: "white", children: progressBar(voiceUsed / (voiceMax || 1), 8) }), _jsxs(Text, { color: "gray", children: [voiceUsed, " / ", voiceMax, " \u043C\u0438\u043D"] })] }), _jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: [GLYPH.arrow, " \u0418\u0418 \u0434\u0438\u0430\u043B\u043E\u0433\u0438:        "] }), _jsx(Text, { bold: true, color: "white", children: progressBar(chatUsed / (chatMax || 1), 8) }), _jsxs(Text, { color: "gray", children: [chatUsed, " / ", chatMax] })] }), _jsxs(Box, { gap: 1, children: [_jsxs(Text, { color: "gray", children: [GLYPH.arrow, " \u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438:  "] }), _jsx(Text, { bold: true, color: "white", children: progressBar(notesUsed / (notesMax || 1), 8) }), _jsxs(Text, { color: "gray", children: [notesUsed, " / ", notesMax] })] })] }), _jsxs(Box, { marginY: 0, children: [_jsx(Text, { color: "gray", children: "\u0421\u0431\u0440\u043E\u0441 \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u043E\u0432 \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u0438\u0442 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E \u0432 00:00 \u041C\u0421\u041A." }), _jsx(Text, { color: "gray", children: "\u0414\u043B\u044F \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u043A\u0432\u043E\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 Pro \u0438\u043B\u0438 Corp \u0442\u0430\u0440\u0438\u0444 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435." })] }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434 \u0432 REPL" })] }));
}
