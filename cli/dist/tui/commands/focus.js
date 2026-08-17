import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { setScreen } from '../state.js';
import { GLYPH, progressBar } from '../theme.js';
import { getAllaySpriteLines } from '../../mascot.js';
import { StatusBar } from '../StatusBar.js';
import os from 'os';
import { exec } from 'child_process';
function playCompletionSound() {
    try {
        // 1. Terminal Bell
        process.stdout.write('\x07\x07');
        // 2. Windows native beep chord
        if (os.platform() === 'win32') {
            exec('powershell -NoProfile -Command "[console]::beep(587, 180); [console]::beep(880, 250); [console]::beep(1174, 400)"');
        }
    }
    catch { }
}
export function FocusScreen({ minutes = 25, userData, onComplete, }) {
    const totalSeconds = Math.max(10, minutes * 60);
    const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
    const [isFinished, setIsFinished] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [wingFrame, setWingFrame] = useState(0);
    const [floatOffset, setFloatOffset] = useState(0);
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    useEffect(() => {
        // Set terminal / tray window title
        try {
            process.stdout.write(`\x1b]0;[${timeStr}] ⊘ Zerf Focus: Концентрация Тихони\x07`);
        }
        catch { }
        const timer = setInterval(() => {
            if (isPaused)
                return;
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsFinished(true);
                    playCompletionSound();
                    try {
                        process.stdout.write('\x1b]0;✔ Zerf Focus: Сессия завершена!\x07');
                    }
                    catch { }
                    setTimeout(() => {
                        try {
                            process.stdout.write('\x1b]0;Zerf CLI\x07');
                        }
                        catch { }
                        if (onComplete)
                            onComplete();
                        setScreen('repl');
                    }, 3500);
                    return 0;
                }
                const next = prev - 1;
                const curMins = Math.floor(next / 60);
                const curSecs = next % 60;
                const curTime = `${String(curMins).padStart(2, '0')}:${String(curSecs).padStart(2, '0')}`;
                try {
                    process.stdout.write(`\x1b]0;[${curTime}] ⊘ Zerf: Концентрация\x07`);
                }
                catch { }
                return next;
            });
            setWingFrame(w => (w + 1) % 4);
        }, 1000);
        // Animation float bobbing
        const animTimer = setInterval(() => {
            setFloatOffset(f => (f === 0 ? 1 : 0));
        }, 3000);
        return () => {
            clearInterval(timer);
            clearInterval(animTimer);
            try {
                process.stdout.write('\x1b]0;Zerf CLI\x07');
            }
            catch { }
        };
    }, [isPaused]);
    useInput((input, key) => {
        if (key.escape || input === 'q') {
            try {
                process.stdout.write('\x1b]0;Zerf CLI\x07');
            }
            catch { }
            setScreen('repl');
            return;
        }
        if (input === ' ') {
            setIsPaused(p => !p);
        }
    });
    const elapsed = totalSeconds - secondsLeft;
    const ratio = elapsed / totalSeconds;
    const percent = Math.round(ratio * 100);
    const mood = isFinished ? 'celebrate' : isPaused ? 'idle' : 'focus';
    const spriteLines = getAllaySpriteLines(mood, wingFrame);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, width: 90, children: [_jsxs(Box, { justifyContent: "space-between", width: 86, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u2298" }), _jsx(Text, { bold: true, color: "white", children: "\u0421\u0444\u0435\u0440\u0430 \u041A\u043E\u043D\u0446\u0435\u043D\u0442\u0440\u0430\u0446\u0438\u0438 \u0422\u0438\u0445\u043E\u043D\u0438 (Pomodoro)" })] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043F\u0440\u0435\u0440\u0432\u0430\u0442\u044C \u00B7 Space \u2014 \u043F\u0430\u0443\u0437\u0430" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { borderStyle: "round", borderColor: "cyan", flexDirection: "row", width: 86, marginY: 1, children: [_jsxs(Box, { flexDirection: "column", width: 38, paddingX: 1, alignItems: "center", justifyContent: "center", children: [_jsx(Box, { flexDirection: "column", marginTop: floatOffset, marginBottom: 1 - floatOffset, children: spriteLines.map((line, idx) => (_jsx(Text, { children: line }, `sprite_${idx}`))) }), _jsx(Text, { bold: true, color: isFinished ? 'greenBright' : 'cyanBright', children: isFinished ? '✧ Тихоня ликует! ✧' : isPaused ? '● На паузе (Space)' : '✦ Тихоня в глубоком фокусе ✦' })] }), _jsxs(Box, { flexDirection: "column", width: 44, paddingX: 1, justifyContent: "center", children: [_jsx(Text, { bold: true, color: "white", children: isFinished ? 'Сессия успешно завершена!' : 'Идёт сессия концентрации:' }), _jsxs(Box, { marginY: 1, gap: 1, children: [_jsx(Text, { bold: true, color: isFinished ? 'greenBright' : isPaused ? 'yellow' : 'cyanBright', children: timeStr }), _jsxs(Text, { color: "gray", children: ["/ ", minutes, ":00 \u043C\u0438\u043D"] })] }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: progressBar(ratio, 16) }), _jsxs(Text, { bold: true, color: "white", children: [percent, "%"] })] }), _jsx(Box, { marginY: 1, flexDirection: "column", children: _jsx(Text, { color: "gray", children: isFinished
                                        ? '✔ Звуковое оповещение отправлено. Стрик сохранён!'
                                        : isPaused
                                            ? 'Сессия приостановлена. Нажмите Space для продолжения.'
                                            : 'Таймер выведен в заголовок окна и трей. Работайте без отвлечений.' }) })] })] }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: isPaused ? 'Space — возобновить │ Esc — выход' : 'Space — пауза │ Esc — прервать' })] }));
}
