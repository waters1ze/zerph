import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { GLYPH } from './theme.js';
export function Log({ entries }) {
    // Render up to 8 last entries to prevent terminal scroll overflow
    const visible = entries.slice(-8);
    return (_jsx(Box, { flexDirection: "column", marginY: 0, children: visible.map(item => (_jsx(Box, { flexDirection: "column", marginY: 0, children: item.type === 'user' ? (_jsx(Box, { gap: 1, children: _jsxs(Text, { bold: true, color: "white", children: ["\u203A ", item.text] }) })) : item.type === 'error' ? (_jsx(Box, { gap: 1, marginLeft: 1, children: _jsxs(Text, { color: "red", children: [GLYPH.cancel, " ", item.text] }) })) : item.type === 'system' ? (_jsx(Box, { gap: 1, marginLeft: 1, children: _jsx(Text, { color: "gray", children: item.text }) })) : item.type === 'ext' ? (_jsx(Box, { gap: 1, marginLeft: 1, children: _jsxs(Text, { color: "gray", children: ["[ext] ", item.text] }) })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: GLYPH.bullet }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, `det_${item.id}_${i}`)))] })) }, `log_${item.id}`))) }));
}
