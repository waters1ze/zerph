import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH } from '../theme.js';
import { StatusBar } from '../StatusBar.js';
const COMMANDS_LIST = [
    { cmd: '/menu', desc: 'Интерактивное меню команд со стрелочной навигацией (↑/↓)' },
    { cmd: '/today', desc: 'Задачи, привычки и цели на сегодня (Space — переключить)' },
    { cmd: '/add <текст>', desc: 'Создать задачу с распознаванием даты и времени' },
    { cmd: '/done <текст>', desc: 'Завершить задачу по названию (нечёткий поиск)' },
    { cmd: '/note <текст>', desc: 'Сохранить быструю заметку в базу Zerf Note' },
    { cmd: '/cal', desc: '7-дневная календарная сетка с расписанием' },
    { cmd: '/focus [5/10/15/20/25]', desc: 'Таймер концентрации Pomodoro со сферой фокуса' },
    { cmd: '/model', desc: 'Выбор нейросети (GPT-OSS, Compound, Llama, claude, agy)' },
    { cmd: '/settings', desc: 'Настройки профиля, параметров и подключений' },
    { cmd: '/friends', desc: 'Список друзей и ссылка-приглашение' },
    { cmd: '/chat <текст>', desc: 'Командный диалог / запрос к ИИ-ассистенту' },
    { cmd: '/limits', desc: 'Статус лимитов и квот на текущие сутки' },
    { cmd: '/stats', desc: 'Недельная аналитика эффективности и выполнения' },
    { cmd: '/ext', desc: 'Маркетплейс и управление расширениями Zerf Ext' },
    { cmd: '/clear', desc: 'Очистить историю диалога (Ctrl+L)' },
    { cmd: '/help', desc: 'Данная таблица команд и горячих клавиш' },
    { cmd: '/exit', desc: 'Выйти из Zerf CLI' },
];
export function HelpScreen({ userData }) {
    useInput((input, key) => {
        if (key.escape || input === 'q' || key.return) {
            setScreen('repl');
        }
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C Zerf CLI"] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u041A\u041E\u041C\u0410\u041D\u0414\u042B" }), COMMANDS_LIST.map(item => (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.arrow, " ", item.cmd.padEnd(16)] }), _jsxs(Text, { color: "gray", children: ["\u2014 ", item.desc] })] }, item.cmd)))] }), _jsxs(Box, { flexDirection: "column", marginY: 0, children: [_jsx(Text, { bold: true, color: "white", children: "\u0413\u041E\u0420\u042F\u0427\u0418\u0415 \u041A\u041B\u0410\u0412\u0418\u0428\u0418" }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "white", children: "Enter" }), _jsx(Text, { color: "gray", children: "\u2014 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0432\u0432\u043E\u0434 / \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "white", children: "Space" }), _jsx(Text, { color: "gray", children: "\u2014 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432 /today" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "white", children: "Tab" }), _jsx(Text, { color: "gray", children: "\u2014 \u0430\u0432\u0442\u043E\u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 slash-\u043A\u043E\u043C\u0430\u043D\u0434" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "white", children: "\u2191 / \u2193" }), _jsx(Text, { color: "gray", children: "\u2014 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043A\u043E\u043C\u0430\u043D\u0434 (\u043A\u043E\u043B\u044C\u0446\u043E \u043D\u0430 50) / \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "white", children: "Ctrl+C" }), _jsx(Text, { color: "gray", children: "\u2014 1-\u0439 \u0440\u0430\u0437 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435, 2-\u0439 \u0432\u044B\u0445\u043E\u0434" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "white", children: "Ctrl+L" }), _jsx(Text, { color: "gray", children: "\u2014 \u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u044D\u043A\u0440\u0430\u043D\u0430" })] })] }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Esc \u2014 \u043D\u0430\u0437\u0430\u0434 \u0432 REPL" })] }));
}
