import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH } from '../theme.js';
import { detectInstalledClis } from '../../local-cli.js';
import { loadConfig, saveConfig } from '../../api.js';
export const CLOUD_MODELS = [
    { id: 'openai/gpt-oss-120b', name: 'openai/gpt-oss-120b', desc: 'Флагман · максимальный интеллект' },
    { id: 'openai/gpt-oss-20b', name: 'openai/gpt-oss-20b', desc: 'Быстрый отклик' },
    { id: 'groq/compound', name: 'groq/compound', desc: 'Авто-роутинг — выбирает оптимальную модель' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'meta-llama/Llama-3.1-8B', desc: 'Лёгкая, для быстрых задач' },
];
export function ModelScreen({ onSelect }) {
    const [cfg, setCfg] = useState(() => loadConfig());
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [localClis] = useState(() => detectInstalledClis());
    const allOptions = [
        ...CLOUD_MODELS.map(m => ({ ...m, type: 'cloud', isInstalled: true })),
        ...localClis.map(c => ({
            id: c.id,
            name: c.name,
            desc: c.desc,
            type: 'local',
            isInstalled: c.installed,
        })),
    ];
    useInput((input, key) => {
        if (key.escape || input === 'q') {
            setScreen('repl');
            return;
        }
        if (key.upArrow) {
            setSelectedIdx(prev => (prev > 0 ? prev - 1 : allOptions.length - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIdx(prev => (prev < allOptions.length - 1 ? prev + 1 : 0));
            return;
        }
        if (key.return) {
            const chosen = allOptions[selectedIdx];
            if (chosen) {
                saveConfig({ model: chosen.id });
                setCfg(prev => ({ ...prev, model: chosen.id }));
                if (onSelect)
                    onSelect(chosen.id, chosen.name);
                setScreen('repl');
            }
        }
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0412\u044B\u0431\u043E\u0440 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u0438 \u0438 CLI-\u0430\u0433\u0435\u043D\u0442\u0430"] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u0437\u0430\u043A\u0440\u044B\u0442\u044C" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u041E\u0411\u041B\u0410\u041A\u041E (Zerf AI)" }), CLOUD_MODELS.map((m, idx) => {
                        const isSel = idx === selectedIdx;
                        const isCurrent = cfg.model === m.id;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'white' : 'gray', children: [isSel ? '▸ ' : '  ', m.name.padEnd(28)] }), _jsxs(Text, { color: "gray", children: ["\u2014 ", m.desc, " ", isCurrent ? '(Текущий)' : ''] })] }, m.id));
                    })] }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u041B\u041E\u041A\u0410\u041B\u042C\u041D\u041E (External CLI Bridge)" }), localClis.map((c, idx) => {
                        const actualIdx = CLOUD_MODELS.length + idx;
                        const isSel = actualIdx === selectedIdx;
                        const isCurrent = cfg.model === c.id;
                        const status = c.installed ? `${GLYPH.ok} установлен` : `${GLYPH.cancel} не найден`;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'white' : 'gray', children: [isSel ? '▸ ' : '  ', c.name.padEnd(14)] }), _jsx(Text, { color: c.installed ? 'gray' : 'gray', children: status.padEnd(14) }), _jsxs(Text, { color: "gray", children: ["\u2014 ", c.desc, " ", isCurrent ? '(Текущий)' : ''] })] }, c.id));
                    })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsx(Text, { color: "gray", children: "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F: \u2191/\u2193 \u2502 Enter \u2014 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u2502 Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }));
}
