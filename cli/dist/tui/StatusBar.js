import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { GLYPH } from './theme.js';
export function StatusBar({ userName = 'Пользователь Zerf', plan = 'plus', hint }) {
    const planTag = plan ? plan.toUpperCase() : 'FREE';
    const defaultHint = '/help — справка │ Ctrl+C — выход';
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { justifyContent: "space-between", paddingX: 0, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "white", children: userName }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsx(Text, { bold: true, color: "white", children: planTag })] }), _jsx(Text, { color: "gray", children: hint || defaultHint })] })] }));
}
