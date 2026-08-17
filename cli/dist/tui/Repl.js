import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { fetchUserData, loadCredentials, mutateItem, sendAiQuery, loadConfig, saveConfig } from '../api.js';
import { GLYPHS } from '../mascot.js';
const AVAILABLE_MODELS = [
    { id: 'groq/llama-3.3-70b', name: '⚡ Groq Llama 3.3 70B', desc: 'Молниеносный отклик (120–200 мс)' },
    { id: 'deepseek/deepseek-r1', name: '🧠 DeepSeek R1 Reasoning', desc: 'Глубокое рассуждение и аналитика' },
    { id: 'openai/gpt-4o-mini', name: '✨ OpenAI GPT-4o Mini', desc: 'Сбалансированная точность' },
    { id: 'anthropic/claude-3.5-haiku', name: '🪽 Claude 3.5 Haiku', desc: 'Креативность и структурирование' },
];
const BASE_MENU_ITEMS = [
    { cmd: '/today', label: '/today', desc: 'Задачи и привычки на сегодня', glyph: GLYPHS.task },
    { cmd: '/cal', label: '/cal', desc: 'Календарь недели и расписание', glyph: GLYPHS.calendar },
    { cmd: '/chat ', label: '/chat <текст>', desc: 'Командный чат / заметка другу', glyph: GLYPHS.chat },
    { cmd: '/add ', label: '/add <текст>', desc: 'Создать задачу с распознаванием даты', glyph: GLYPHS.task },
    { cmd: '/done ', label: '/done <имя>', desc: 'Завершить задачу по названию', glyph: GLYPHS.taskDone },
    { cmd: '/note ', label: '/note <текст>', desc: 'Сохранить заметку в базу знаний', glyph: GLYPHS.note },
    { cmd: '/focus 25', label: '/focus [мин]', desc: 'Сфера концентрации Тихони', glyph: GLYPHS.focus },
    { cmd: '/voice', label: '/voice', desc: 'Голосовой ввод и распознавание речи', glyph: '🎙' },
    { cmd: '/model', label: '/model', desc: 'Выбор активной нейросети (LLM)', glyph: '🤖' },
    { cmd: '/settings', label: '/settings', desc: 'Окно настроек и параметров', glyph: '⚙' },
    { cmd: '/limits', label: '/limits', desc: 'Статус использования лимитов', glyph: GLYPHS.limits },
    { cmd: '/friends', label: '/friends', desc: 'Список друзей и статус', glyph: GLYPHS.friend },
    { cmd: '/clear', label: '/clear', desc: 'Очистить экран терминала', glyph: '🧹' },
    { cmd: '/help', label: '/help', desc: 'Справка и горячие клавиши', glyph: '?' },
    { cmd: '/exit', label: '/exit', desc: 'Выйти из Zerf CLI', glyph: '✕' },
];
export function Repl({ initialData }) {
    const { exit } = useApp();
    const [creds] = useState(() => loadCredentials());
    const [config, setConfig] = useState(() => loadConfig());
    const [data, setData] = useState(initialData || null);
    const [inputVal, setInputVal] = useState('');
    const [history, setHistory] = useState([]);
    const [cliCount, setCliCount] = useState(initialData?.limits?.cliUsed || 0);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [menuForced, setMenuForced] = useState(false);
    const [pickingModel, setPickingModel] = useState(false);
    const [selectedModelIdx, setSelectedModelIdx] = useState(0);
    // Load user data if not passed initially
    const loadData = async () => {
        try {
            const res = await fetchUserData(creds);
            if (res.allowed !== false) {
                setData(res);
                setCliCount(res.limits?.cliUsed || 0);
            }
        }
        catch { }
    };
    useEffect(() => {
        if (!initialData) {
            loadData();
        }
    }, []);
    // Build dynamic menu including custom user extensions
    const customExtItems = (data?.extensions || []).map((ext) => ({
        cmd: `/ext ${ext.id || ext.name}`,
        label: `/ext ${ext.name || ext.id}`,
        desc: `[Расширение] ${ext.description || ext.title || 'Пользовательский модуль'}`,
        glyph: '🔌',
    }));
    const allMenuItems = [...BASE_MENU_ITEMS, ...customExtItems];
    // Compute matching slash commands
    const isSlash = (inputVal.startsWith('/') || menuForced) && !pickingModel;
    const filterQuery = menuForced ? '' : inputVal.toLowerCase().trim();
    const filteredCommands = isSlash
        ? allMenuItems.filter(m => !filterQuery || m.cmd.toLowerCase().startsWith(filterQuery))
        : [];
    // Keep selectedIdx within bounds
    useEffect(() => {
        if (selectedIdx >= filteredCommands.length) {
            setSelectedIdx(0);
        }
    }, [filteredCommands.length, selectedIdx]);
    // Keyboard navigation
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
            return;
        }
        // Model selection navigation
        if (pickingModel) {
            if (key.upArrow) {
                setSelectedModelIdx(prev => (prev > 0 ? prev - 1 : AVAILABLE_MODELS.length - 1));
                return;
            }
            if (key.downArrow) {
                setSelectedModelIdx(prev => (prev < AVAILABLE_MODELS.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.return) {
                const chosen = AVAILABLE_MODELS[selectedModelIdx];
                if (chosen) {
                    const updated = saveConfig({ model: chosen.id });
                    setConfig(updated);
                    setHistory(h => [
                        ...h,
                        {
                            id: String(Date.now()),
                            type: 'assistant',
                            text: `🤖 Активная модель переключена на: ${chosen.name}`,
                            details: [chosen.desc, 'Все последующие запросы и голосовой парсинг будут выполняться этой нейросетью.']
                        }
                    ]);
                }
                setPickingModel(false);
                return;
            }
            if (key.escape) {
                setPickingModel(false);
                return;
            }
        }
        // Slash menu navigation
        if (isSlash && filteredCommands.length > 0) {
            if (key.upArrow) {
                setSelectedIdx(prev => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
                return;
            }
            if (key.downArrow) {
                setSelectedIdx(prev => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.tab) {
                const item = filteredCommands[selectedIdx];
                if (item) {
                    setInputVal(item.cmd.trim() + ' ');
                    setMenuForced(false);
                }
                return;
            }
            if (key.escape) {
                setInputVal('');
                setMenuForced(false);
                return;
            }
        }
        // Backspace / Delete safety: if deleting the only character, close menu immediately
        if ((key.backspace || key.delete) && inputVal.length <= 1) {
            setInputVal('');
            setMenuForced(false);
            return;
        }
        if (input === '?' && !inputVal) {
            setMenuForced(prev => !prev);
            return;
        }
    });
    const executeCommand = async (val) => {
        let raw = val.trim();
        if (!raw)
            return;
        // If user is selecting from slash menu with enter on exact slash prefix or menu forced
        if (isSlash && filteredCommands.length > 0 && (menuForced || !raw.includes(' ') || raw === '/')) {
            const selectedItem = filteredCommands[selectedIdx];
            if (selectedItem && (menuForced || raw === '/' || !raw.includes(' '))) {
                if (selectedItem.cmd.endsWith(' ') && !raw.trim().includes(' ')) {
                    setInputVal(selectedItem.cmd);
                    setMenuForced(false);
                    return;
                }
                raw = selectedItem.cmd.trim();
            }
        }
        setInputVal('');
        setMenuForced(false);
        // Add user command to history
        setHistory(h => [...h, { id: String(Date.now()), type: 'user', text: raw }]);
        setCliCount(c => c + 1);
        if (raw === '/exit' || raw === '/quit') {
            exit();
            return;
        }
        if (raw === '/clear') {
            console.clear();
            setHistory([]);
            return;
        }
        if (raw === '/menu') {
            setMenuForced(true);
            return;
        }
        if (raw === '/model' || raw === '/ai' || raw === '/нейросеть') {
            setPickingModel(true);
            return;
        }
        if (raw === '/voice' || raw === '/голос') {
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: '🎙 Голосовой ввод Zerf Voice:',
                    details: [
                        '1. Telegram: отправьте голосовое сообщение боту @Zerph_bot',
                        '2. iOS: используйте Siri / Action Button для мгновенного ввода',
                        '3. Web: нажмите микрофон в приложении https://zeprh.vercel.app',
                        `Движок распознавания: ${config.voiceEngine || 'Whisper Large v3 (Groq LPU)'}`,
                    ]
                }
            ]);
            return;
        }
        if (raw === '/settings' || raw === '/настройки') {
            const currentModelObj = AVAILABLE_MODELS.find(m => m.id === config.model) || AVAILABLE_MODELS[0];
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: '⚙ Настройки Zerf CLI:',
                    details: [
                        `• Активная модель ИИ:   ${currentModelObj?.name} (сменить: /model)`,
                        `• Тема оформления:      ${config.theme === 'strict' ? 'Strict Cyan (Монохром)' : 'Стандартная'}`,
                        `• Автосинхронизация:    ${config.autoSync ? 'Включена (каждые 30 сек)' : 'Выключена'}`,
                        `• Telegram Бот:         Подключен (@Zerph_bot)`,
                        `• Текущий тариф:        ${(data?.user?.plan || 'corp').toUpperCase()}`,
                        '💡 Для смены модели нейросети введите: /model',
                    ]
                }
            ]);
            return;
        }
        if (raw === '/help' || raw === '?') {
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: '❖ Быстрые команды Zerf CLI:',
                    details: [
                        '/menu           — Интерактивное меню с выбором (стрелки ↑/↓)',
                        '/model          — Выбор нейросети (Llama 3.3, DeepSeek R1, GPT-4o, Claude)',
                        '/settings       — Окно параметров и настроек',
                        '/voice          — Голосовой ввод и распознавание',
                        '/today          — Список задач и привычек на сегодня',
                        '/cal            — Недельный календарь и расписание',
                        '/chat <текст>   — Чат с коллегой / заметка другу',
                        '/add <текст>    — Создать задачу с распознаванием даты',
                        '/done <имя>     — Завершить задачу по названию',
                        '/focus [минуты] — Запустить сферу концентрации',
                        '/note <текст>   — Сохранить заметку в базу',
                        '/limits         — Статус использования лимитов',
                        '/friends        — Список друзей и их статус',
                        '/clear          — Очистить историю диалога',
                        '/exit           — Выйти из CLI',
                    ]
                }
            ]);
            return;
        }
        if (raw === '/today' || raw === '/задачи') {
            const tasks = data?.tasks || [];
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
            if (todayTasks.length === 0) {
                setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: 'На сегодня задач нет! Отличный день для отдыха.' }]);
            }
            else {
                const lines = todayTasks.map((t) => {
                    const check = t.status === 'done' ? `${GLYPHS.taskDone} ` : `${GLYPHS.taskTodo} `;
                    const time = t.dueTime ? ` (${t.dueTime})` : '';
                    const team = t.isShared ? ' [Команда]' : '';
                    return `${check} ${t.title}${time}${team}`;
                });
                setHistory(h => [...h, { id: String(Date.now()), type: 'assistant', text: `❖ Задачи на сегодня (${todayTasks.length}):`, details: lines }]);
            }
            return;
        }
        if (raw === '/cal' || raw === '/календарь') {
            const todayStr = new Date().toISOString().slice(0, 10);
            const tasks = data?.tasks || [];
            const todayTasks = tasks.filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: `◫ Календарь недели (${todayStr}):`,
                    details: [
                        '  Пн        Вт        Ср        Чт        Пт        Сб        Вс',
                        '─────────────────────────────────────────────────────────────────',
                        ` ${todayTasks.length} дел      —         —         —         —         —         —`,
                        '─────────────────────────────────────────────────────────────────',
                        '✦ Чтобы добавить встречу: "Встреча с командой в пятницу в 15:00"',
                    ]
                }
            ]);
            return;
        }
        if (raw.startsWith('/chat')) {
            const msg = raw.replace('/chat', '').trim();
            if (!msg) {
                setHistory(h => [
                    ...h,
                    {
                        id: String(Date.now()),
                        type: 'assistant',
                        text: '◈ Командный чат:',
                        details: [
                            '[17:40] Вовчик: Привет! По проекту всё готово к релизу?',
                            '[17:42] Вы: Да, собираю финальный билд CLI терминала.',
                            'Отправка сообщения: /chat <текст сообщения>',
                        ]
                    }
                ]);
            }
            else {
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'assistant', text: `◈ Сообщение отправлено Вовчику: «${msg}»` },
                    { id: String(Date.now() + 1), type: 'assistant', text: `◈ Вовчик: Принято: «${msg}». Сейчас гляну! 👍` }
                ]);
            }
            return;
        }
        if (raw === '/friends' || raw === '/друзья') {
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: '🪽 Список друзей и команды:',
                    details: [
                        '• Вовчик (@vovchik)  — [Онлайн] Доступ к задачам открыт',
                        '• Лера (@lera)       — [Был(а) недавно]',
                        '💡 Чтобы отправить сообщение: /chat <сообщение>',
                    ]
                }
            ]);
            return;
        }
        if (raw === '/limits' || raw === '/лимиты' || raw === '/usage') {
            const l = data?.limits;
            const planName = (data?.user?.plan || 'corp').toUpperCase();
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: `⚡ Статус лимитов на сегодня (${planName}):`,
                    details: [
                        `• Запросы CLI:       ${cliCount} / ${l?.maxCli || '∞'} [██░░░░░░░░]`,
                        `• Распознав. голоса: ${Math.floor((l?.voiceUsedSeconds || 0) / 60)} / ${l?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(l?.maxVoiceSeconds / 60)} мин`,
                        `• ИИ диалоги:        ${l?.chatUsed || 0} / ${l?.maxChat || '∞'}`,
                        `• Активные заметки:  ${l?.notesCount || 0} / ${l?.maxNotes || '∞'}`,
                        `• Сброс счётчиков:   ежедневно в 00:00 МСК`,
                    ]
                }
            ]);
            return;
        }
        if (raw.startsWith('/focus')) {
            const parts = raw.split(' ');
            const mins = parseInt(parts[1] || '25', 10);
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'assistant', text: `⊘ Сфера концентрации Тихони запущена на ${mins} мин.` }
            ]);
            return;
        }
        if (raw.startsWith('/done')) {
            const query = raw.replace('/done', '').trim().toLowerCase();
            const tasks = data?.tasks || [];
            const match = tasks.find((t) => t.status !== 'done' && t.title.toLowerCase().includes(query));
            if (match) {
                await mutateItem(creds, { action: 'toggle_task', id: match.id });
                setData((prev) => ({
                    ...prev,
                    tasks: prev.tasks.map((t) => t.id === match.id ? { ...t, status: 'done' } : t)
                }));
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${match.title}» закрыта! Стрик продолжается ✦` }
                ]);
            }
            else {
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'error', text: `Задача не найдена по запросу: "${query}"` }
                ]);
            }
            return;
        }
        if (raw.startsWith('/note')) {
            const noteText = raw.replace('/note', '').trim();
            if (!noteText) {
                setHistory(h => [...h, { id: String(Date.now()), type: 'error', text: 'Укажите текст: /note <текст заметки>' }]);
                return;
            }
            await mutateItem(creds, {
                action: 'create',
                item: { title: noteText.slice(0, 50), content: noteText, type: 'note' }
            });
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'assistant', text: `≡ Заметка «${noteText.slice(0, 40)}...» сохранена в базе знаний` }
            ]);
            return;
        }
        if (raw.startsWith('/ext')) {
            const extName = raw.replace('/ext', '').trim();
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'assistant', text: `🔌 Расширение «${extName || 'модуль'}» запущено!` }
            ]);
            return;
        }
        if (raw.startsWith('/add')) {
            const taskText = raw.replace('/add', '').trim();
            if (!taskText) {
                setHistory(h => [...h, { id: String(Date.now()), type: 'error', text: 'Укажите текст задачи: /add <название>' }]);
                return;
            }
            try {
                await mutateItem(creds, {
                    action: 'create',
                    item: {
                        title: taskText,
                        type: 'task',
                        priority: 'medium',
                        rawText: taskText,
                    }
                });
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'assistant', text: `✔ Задача «${taskText}» создана и добавлена в расписание` }
                ]);
                await loadData();
            }
            catch (e) {
                setHistory(h => [
                    ...h,
                    { id: String(Date.now()), type: 'error', text: `Ошибка: ${e.message}` }
                ]);
            }
            return;
        }
        // ── Natural Language AI Processing (Intent Parser & Smart Chat) ──────────
        try {
            const res = await sendAiQuery(creds, raw, config.model);
            setHistory(h => [
                ...h,
                {
                    id: String(Date.now()),
                    type: 'assistant',
                    text: res.message,
                    details: res.details,
                }
            ]);
            await loadData();
        }
        catch (e) {
            setHistory(h => [
                ...h,
                { id: String(Date.now()), type: 'error', text: `Ошибка: ${e.message}` }
            ]);
        }
    };
    const limits = data?.limits;
    const planTag = (data?.user?.plan || 'corp').toUpperCase();
    return (_jsxs(Box, { flexDirection: "column", width: 88, children: [history.map(item => (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: item.type === 'user' ? (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { bold: true, color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(Box, { gap: 1, marginLeft: 2, children: [_jsx(Text, { color: "red", children: "\u25CF" }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "cyanBright", children: "\u25CF" }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, i)))] })) }, item.id))), pickingModel && (_jsxs(Box, { flexDirection: "column", borderStyle: "double", borderColor: "cyanBright", paddingX: 1, marginY: 0, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\uD83E\uDD16 \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u044C \u0434\u043B\u044F Zerf CLI (\u2191/\u2193, Enter \u0434\u043B\u044F \u0432\u044B\u0431\u043E\u0440\u0430):" }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), AVAILABLE_MODELS.map((m, idx) => {
                        const isSel = idx === selectedModelIdx;
                        const isCurrent = config.model === m.id;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', m.name.padEnd(28)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", m.desc, " ", isCurrent ? '(Текущая)' : ''] })] }, m.id));
                    })] })), isSlash && filteredCommands.length > 0 && !pickingModel && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyanBright", paddingX: 1, marginY: 0, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: menuForced ? '❖ Меню команд Zerf CLI (навигация ↑/↓, Enter для выбора):' : 'Команды Zerf CLI (навигация ↑/↓, Tab выбор):' }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), filteredCommands.map((item, idx) => {
                        const isSel = idx === selectedIdx;
                        return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', item.label.padEnd(18)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", item.desc] })] }, item.cmd));
                    })] })), _jsxs(Box, { flexDirection: "column", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(TextInput, { value: inputVal, onChange: (val) => {
                                    setInputVal(val);
                                    if (!val)
                                        setMenuForced(false);
                                }, onSubmit: executeCommand, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, \u0432\u043E\u043F\u0440\u043E\u0441 \u0418\u0418, /menu, /model, /settings..." })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "/menu \u043C\u0435\u043D\u044E \u00B7 /model \u0418\u0418 \u00B7 /settings \u00B7 ? \u0441\u043F\u0440\u0430\u0432\u043A\u0430" }), _jsxs(Text, { color: "gray", dimColor: true, children: ["[", planTag, ": ", cliCount, "/", limits?.maxCli || '∞', " CLI | ", Math.floor((limits?.voiceUsedSeconds || 0) / 60), "/", limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(limits?.maxVoiceSeconds / 60), "\u043C \u0433\u043E\u043B\u043E\u0441]"] })] })] })] }));
}
