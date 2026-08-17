import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH } from '../theme.js';
import { StatusBar } from '../StatusBar.js';
export function FriendsScreen({ userData, onSelectFriend }) {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const friends = userData?.friends || [];
    const chatId = userData?.user?.chatId || '';
    useInput((input, key) => {
        if (key.escape || input === 'q') {
            setScreen('repl');
            return;
        }
        if (key.upArrow) {
            setSelectedIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, friends.length - 1)));
            return;
        }
        if (key.downArrow) {
            setSelectedIdx(prev => (prev < friends.length - 1 ? prev + 1 : 0));
            return;
        }
        if (key.return && friends.length > 0) {
            const chosen = friends[selectedIdx];
            if (chosen && onSelectFriend) {
                onSelectFriend(chosen);
                setScreen('repl');
            }
        }
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0414\u0440\u0443\u0437\u044C\u044F \u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u0447\u0430\u0442"] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Text, { bold: true, color: "white", children: ["\u041A\u041E\u041C\u0410\u041D\u0414\u0410 (", friends.length, ")"] }), friends.length === 0 ? (_jsx(Text, { color: "gray", children: "\u0423 \u0432\u0430\u0441 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0434\u0440\u0443\u0437\u0435\u0439." })) : (friends.map((f, idx) => {
                        const isSel = idx === selectedIdx;
                        const usernameStr = f.username ? `@${f.username}` : 'без юзернейма';
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'white' : 'gray', children: [isSel ? '▸ ' : '  ', f.name, " (", usernameStr, ")"] }), _jsx(Text, { color: "gray", children: "\u00B7 \u0412 \u0441\u0435\u0442\u0438" })] }, `friend_${f.id || idx}`));
                    }))] }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u0421\u0421\u042B\u041B\u041A\u0410 \u0414\u041B\u042F \u041F\u0420\u0418\u0413\u041B\u0410\u0428\u0415\u041D\u0418\u042F" }), _jsxs(Text, { color: "gray", children: ["https://t.me/Zerph_bot?start=invite_", chatId] }), _jsx(Text, { color: "gray", children: "\u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u044D\u0442\u0443 \u0441\u0441\u044B\u043B\u043A\u0443 \u043A\u043E\u043B\u043B\u0435\u0433\u0435 \u0438\u043B\u0438 \u0434\u0440\u0443\u0433\u0443 \u0432 Telegram \u0434\u043B\u044F \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F." })] }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Enter \u2014 \u043D\u0430\u0447\u0430\u0442\u044C \u0447\u0430\u0442 \u2502 Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }));
}
