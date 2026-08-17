import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH } from '../theme.js';
import { StatusBar } from '../StatusBar.js';
import { getInstalledExtensions, OFFICIAL_CATALOG, installExtensionPackage, removeExtensionPackage } from '../../extensions/registry.js';
export function ExtensionsScreen({ userData, onMessage }) {
    const [installed, setInstalled] = useState(() => getInstalledExtensions());
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [statusMsg, setStatusMsg] = useState(null);
    const uninstalledCatalog = OFFICIAL_CATALOG.filter(c => !installed.some(i => i.name === c.name));
    const allRows = [
        ...installed.map(i => ({ ...i, isInstalled: true })),
        ...uninstalledCatalog.map(c => ({ ...c, isInstalled: false })),
    ];
    useInput(async (input, key) => {
        if (key.escape || input === 'q') {
            setScreen('repl');
            return;
        }
        if (key.upArrow) {
            setSelectedIdx(prev => (prev > 0 ? prev - 1 : Math.max(0, allRows.length - 1)));
            return;
        }
        if (key.downArrow) {
            setSelectedIdx(prev => (prev < allRows.length - 1 ? prev + 1 : 0));
            return;
        }
        if (key.return && allRows.length > 0) {
            const item = allRows[selectedIdx];
            if (item) {
                if (!item.isInstalled) {
                    setStatusMsg(`${GLYPH.bullet} Установка ${item.name}…`);
                    try {
                        await installExtensionPackage(item.name);
                        setInstalled(getInstalledExtensions());
                        setStatusMsg(`${GLYPH.ok} Расширение ${item.name} установлено!`);
                        if (onMessage)
                            onMessage(`${GLYPH.ok} Расширение ${item.name} успешно установлено.`);
                    }
                    catch (e) {
                        setStatusMsg(`${GLYPH.cancel} Ошибка установки: ${e.message}`);
                    }
                }
                else {
                    setStatusMsg(`${GLYPH.bullet} Удаление ${item.name}…`);
                    try {
                        await removeExtensionPackage(item.name);
                        setInstalled(getInstalledExtensions());
                        setStatusMsg(`${GLYPH.ok} Расширение ${item.name} удалено.`);
                    }
                    catch (e) {
                        setStatusMsg(`${GLYPH.cancel} Ошибка удаления: ${e.message}`);
                    }
                }
            }
        }
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F Zerf Ext"] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), statusMsg && (_jsx(Box, { marginY: 0, children: _jsx(Text, { bold: true, color: "green", children: statusMsg }) })), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Text, { bold: true, color: "white", children: ["\u0423\u0421\u0422\u0410\u041D\u041E\u0412\u041B\u0415\u041D\u042B (", installed.length, ")"] }), installed.length === 0 ? (_jsx(Text, { color: "gray", children: "\u041D\u0435\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0439. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u043E\u0434\u0443\u043B\u044C \u043D\u0438\u0436\u0435." })) : (installed.map((item, idx) => {
                        const isSel = idx === selectedIdx;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'white' : 'gray', children: [isSel ? '▸ ' : '  ', item.name.padEnd(16), " v", item.version] }), _jsxs(Text, { color: "gray", children: ["\u2014 ", item.description, " (Enter: \u0443\u0434\u0430\u043B\u0438\u0442\u044C)"] })] }, `inst_${item.name}`));
                    }))] }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u041A\u0410\u0422\u0410\u041B\u041E\u0413 (\u041E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u0439)" }), uninstalledCatalog.map((item, idx) => {
                        const actualIdx = installed.length + idx;
                        const isSel = actualIdx === selectedIdx;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'white' : 'gray', children: [isSel ? '▸ ' : '  ', item.name.padEnd(16), " v", item.version] }), _jsxs(Text, { color: "gray", children: ["\u2014 ", item.description, " [Enter: \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C]"] })] }, `cat_${item.name}`));
                    })] }), _jsxs(Box, { flexDirection: "column", marginY: 0, children: [_jsx(Text, { color: "gray", children: "/ext create \u2014 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0432\u043E\u0451 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u0432 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u043F\u0430\u043F\u043A\u0435" }), _jsx(Text, { color: "gray", children: "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F: \u2191/\u2193 \u2502 Enter \u2014 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C/\u0443\u0434\u0430\u043B\u0438\u0442\u044C \u2502 Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Enter \u2014 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u2502 Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }));
}
