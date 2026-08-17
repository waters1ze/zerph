import { jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { getAllaySpriteLines } from '../mascot.js';
export function MascotSprite({ mood = 'idle', wingFrame = 0 }) {
    const lines = getAllaySpriteLines(mood, wingFrame);
    return (_jsx(Box, { flexDirection: "column", alignItems: "flex-start", marginY: 0, children: lines.map((line, idx) => (_jsx(Text, { children: line }, `sprite_${idx}`))) }));
}
