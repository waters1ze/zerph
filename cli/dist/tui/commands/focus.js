import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { setScreen, setMascotMood } from '../state.js';
import { GLYPH, progressBar } from '../theme.js';
import { MascotSprite } from '../MascotSprite.js';
import { StatusBar } from '../StatusBar.js';
export function FocusScreen({ minutes = 25, userData, onComplete }) {
    const totalSeconds = Math.max(10, minutes * 60);
    const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
    const [isFinished, setIsFinished] = useState(false);
    const [wingFrame, setWingFrame] = useState(0);
    useEffect(() => {
        setMascotMood('focus');
        const timer = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsFinished(true);
                    setMascotMood('celebrate');
                    setTimeout(() => {
                        setMascotMood('idle');
                        if (onComplete)
                            onComplete();
                        setScreen('repl');
                    }, 3000);
                    return 0;
                }
                return prev - 1;
            });
            setWingFrame(w => (w + 1) % 4);
        }, 1000);
        return () => {
            clearInterval(timer);
            setMascotMood('idle');
        };
    }, []);
    useInput((input, key) => {
        if (key.escape || input === 'q') {
            setMascotMood('idle');
            setScreen('repl');
        }
    });
    const elapsed = totalSeconds - secondsLeft;
    const ratio = elapsed / totalSeconds;
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Text, { bold: true, color: "white", children: [GLYPH.logo, " \u0420\u0435\u0436\u0438\u043C \u0444\u043E\u043A\u0443\u0441\u0430 \u00B7 ", timeStr] }), _jsx(Text, { color: "gray", children: "Esc \u2014 \u043F\u0440\u0435\u0440\u0432\u0430\u0442\u044C" })] }), _jsx(Text, { color: "gray", children: GLYPH.divider.repeat(70) }), _jsxs(Box, { flexDirection: "row", marginY: 1, gap: 4, children: [_jsx(MascotSprite, { mood: isFinished ? 'celebrate' : 'focus', wingFrame: wingFrame }), _jsxs(Box, { flexDirection: "column", justifyContent: "center", children: [_jsx(Text, { bold: true, color: "white", children: isFinished ? 'Отличная работа! Сессия завершена.' : 'Тихоня сосредоточена вместе с вами' }), _jsxs(Box, { gap: 1, marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: progressBar(ratio, 16) }), _jsxs(Text, { color: "gray", children: [Math.round(ratio * 100), "% \u00B7 ", timeStr, " \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C"] })] }), _jsx(Text, { color: "gray", children: "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439\u0442\u0435 \u043A\u043E\u043D\u0446\u0435\u043D\u0442\u0440\u0430\u0446\u0438\u044E \u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0439\u0442\u0435 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442." })] })] }), _jsx(StatusBar, { userName: userData?.user?.name || 'Пользователь Zerf', plan: userData?.user?.plan || 'plus', hint: "Esc \u2014 \u043F\u0440\u0435\u0440\u0432\u0430\u0442\u044C \u0441\u0435\u0441\u0441\u0438\u044E" })] }));
}
