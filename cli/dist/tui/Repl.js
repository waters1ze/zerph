import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { loadCredentials, sendAiQuery, loadConfig, saveConfig, } from '../api.js';
import { detectInstalledClis, runLocalCliBridge } from '../local-cli.js';
import { getAllaySpriteLines } from '../mascot.js';
import { makeUniqueId } from './utils.js';
import { scaffoldExtension, installExtensionPackage } from '../extensions/registry.js';
import { setScreen } from './state.js';
import { matchCommand, isPlanAllowed, COMMAND_REGISTRY, } from './commandRegistry.js';
import { GLYPH } from './theme.js';
export const CLOUD_MODELS = [
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B', desc: 'Флагман скорости и глубокой логики (120–200 мс)', type: 'cloud' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B', desc: 'Молниеносный отклик для быстрых задач', type: 'cloud' },
    { id: 'groq/compound', name: 'Groq Compound Router', desc: 'Авто-роутинг оптимальной модели под контекст', type: 'cloud' },
    { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instant', desc: 'Лёгкая модель для быстрых сводок и заметок', type: 'cloud' },
];
function renderProgressBar(ratio, length = 12) {
    const clamped = Math.max(0, Math.min(1, isNaN(ratio) ? 0 : ratio));
    const filled = Math.round(clamped * length);
    const empty = length - filled;
    return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}]`;
}
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
    const [pickingChatFriend, setPickingChatFriend] = useState(false);
    const [selectedFriendIdx, setSelectedFriendIdx] = useState(0);
    const [activeChatTarget, setActiveChatTarget] = useState(null);
    const [detectedClis, setDetectedClis] = useState([]);
    const [wingFrame, setWingFrame] = useState(0);
    const [actionProgress, setActionProgress] = useState(null);
    const userPlan = (data?.user?.plan || creds.plan || 'corp').toLowerCase();
    useEffect(() => {
        try {
            const found = detectInstalledClis();
            setDetectedClis(found);
        }
        catch { }
        const timer = setInterval(() => {
            setWingFrame(w => (w + 1) % 4);
        }, 400);
        return () => clearInterval(timer);
    }, []);
    const allAvailableModels = [
        ...CLOUD_MODELS,
        ...detectedClis.map(c => ({
            id: c.id,
            name: c.name,
            desc: c.desc,
            type: 'local_cli',
            status: c.installed ? 'Готов к работе' : 'Не установлен в PATH',
        })),
    ];
    // Dynamic extension menu items
    const customExtItems = (data?.extensions || []).flatMap((ext) => {
        const extCommands = ext.content?.commands || ext.commands || [];
        if (Array.isArray(extCommands) && extCommands.length > 0) {
            return extCommands.map((c) => ({
                cmd: c.cmd?.startsWith('/') ? c.cmd : `/${c.cmd || ext.name || ext.id}`,
                label: c.cmd?.startsWith('/') ? c.cmd : `/${c.cmd || ext.name || ext.id}`,
                desc: `[${ext.title || ext.name || 'Плагин'}] ${c.description || ext.description}`,
                glyph: '◈',
            }));
        }
        const defaultCmd = ext.id === 'ext_nexus_search' || ext.name === 'zerf-search' ? '/search' : `/ext ${ext.name || ext.id}`;
        return [{
                cmd: defaultCmd,
                label: defaultCmd,
                desc: `[${ext.title || ext.name || 'Плагин'}] ${ext.description || 'Пользовательский модуль'}`,
                glyph: '◈',
            }];
    });
    // Registered commands as menu items
    const baseMenuItems = COMMAND_REGISTRY.map(c => ({
        cmd: c.name,
        label: c.name,
        desc: c.description,
        glyph: c.glyph,
        minPlan: c.minPlan !== 'free' ? c.minPlan.toUpperCase() : undefined,
    }));
    const seenCmds = new Set();
    const allMenuItems = [];
    for (const item of [...customExtItems, ...baseMenuItems]) {
        const key = item.cmd.toLowerCase();
        if (!seenCmds.has(key)) {
            seenCmds.add(key);
            allMenuItems.push(item);
        }
    }
    const isSlashOrTyping = (inputVal.startsWith('/') || menuForced || (inputVal.length >= 2 && !inputVal.includes(' '))) && !pickingModel && !pickingChatFriend;
    const filterQuery = (menuForced || inputVal === '/menu' || inputVal === '/') ? '' : inputVal.toLowerCase().trim().replace(/^\//, '');
    const filteredCommands = isSlashOrTyping
        ? allMenuItems.filter(m => {
            if (!filterQuery)
                return true;
            const cmdClean = m.cmd.toLowerCase().replace(/^\//, '');
            const labelClean = m.label.toLowerCase().replace(/^\//, '');
            return cmdClean.startsWith(filterQuery) || labelClean.startsWith(filterQuery) || m.desc.toLowerCase().includes(filterQuery);
        })
        : [];
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
            return;
        }
        if (key.ctrl && input === 'l') {
            console.clear();
            setHistory([]);
            return;
        }
        if (pickingModel) {
            if (key.upArrow) {
                setSelectedModelIdx(prev => (prev > 0 ? prev - 1 : allAvailableModels.length - 1));
                return;
            }
            if (key.downArrow) {
                setSelectedModelIdx(prev => (prev < allAvailableModels.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.return) {
                const chosen = allAvailableModels[selectedModelIdx];
                if (chosen) {
                    setActionProgress({ label: `Применение модели ${chosen.name}...`, ratio: 0.8 });
                    const updated = saveConfig({ model: chosen.id });
                    setConfig(updated);
                    setTimeout(() => {
                        setActionProgress({ label: `Активна модель: ${chosen.name}`, ratio: 1.0 });
                        setTimeout(() => setActionProgress(null), 1200);
                    }, 200);
                    setHistory(h => [
                        ...h,
                        {
                            id: makeUniqueId(),
                            type: 'assistant',
                            text: `◈ Активная нейросеть / CLI агент: ${chosen.name}`,
                            details: [chosen.desc],
                        },
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
        if (pickingChatFriend) {
            const friends = data?.friends || [];
            if (key.upArrow) {
                setSelectedFriendIdx(prev => (prev > 0 ? prev - 1 : (friends.length > 0 ? friends.length - 1 : 0)));
                return;
            }
            if (key.downArrow) {
                setSelectedFriendIdx(prev => (prev < friends.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.return) {
                const chosen = friends[selectedFriendIdx];
                if (chosen) {
                    setActiveChatTarget(chosen);
                    const targetName = chosen.username ? `@${chosen.username}` : chosen.name;
                    setInputVal(`/chat ${targetName} `);
                    setHistory(h => [
                        ...h,
                        {
                            id: makeUniqueId(),
                            type: 'assistant',
                            text: `◈ Выбран собеседник: ${chosen.name} (${targetName})`,
                            details: ['Введите сообщение или задачу для отправки.'],
                        },
                    ]);
                }
                setPickingChatFriend(false);
                return;
            }
            if (key.escape) {
                setPickingChatFriend(false);
                return;
            }
        }
        if (isSlashOrTyping && filteredCommands.length > 0) {
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
        // If dropdown menu was open and user pressed enter on an autocomplete item
        if (isSlashOrTyping && filteredCommands.length > 0 && (menuForced || raw === '/menu' || raw === '/' || raw === 'menu')) {
            const selectedItem = filteredCommands[selectedIdx];
            if (selectedItem) {
                if (selectedItem.cmd.endsWith(' ')) {
                    setInputVal(selectedItem.cmd);
                    setMenuForced(false);
                    return;
                }
                raw = selectedItem.cmd.trim();
            }
        }
        setInputVal('');
        setMenuForced(false);
        setHistory(h => [...h, { id: makeUniqueId(), type: 'user', text: raw }]);
        setCliCount(c => c + 1);
        // 1. Built-in exit & clear
        if (raw === '/exit' || raw === '/quit' || raw === 'exit' || raw === 'quit') {
            exit();
            return;
        }
        if (raw === '/clear' || raw === 'clear' || raw === 'cls') {
            console.clear();
            setHistory([]);
            return;
        }
        if (raw === '/menu' || raw === 'menu') {
            setMenuForced(true);
            setSelectedIdx(0);
            return;
        }
        // 2. Command Registry Match (handles /settings, settings, /today, today, /cal, cal, /friends, etc.)
        const matched = matchCommand(raw);
        if (matched) {
            const { command, args } = matched;
            // Check subscription plan access
            if (!isPlanAllowed(userPlan, command.minPlan)) {
                setHistory(h => [
                    ...h,
                    {
                        id: makeUniqueId(),
                        type: 'error',
                        text: `${GLYPH.cancel} Команда «${command.name}» доступна на тарифе ${command.minPlan.toUpperCase()}`,
                        details: [
                            `Ваш текущий тариф: ${userPlan.toUpperCase()}`,
                            `Оформить подписку для снятия ограничений: https://t.me/Zerph_bot?start=buy`,
                        ],
                    },
                ]);
                return;
            }
            // If command maps directly to a full-screen TUI view
            if (command.screen) {
                setScreen(command.screen);
                return;
            }
            // If command has an action handler
            if (command.handler) {
                setActionProgress({ label: `Выполнение ${command.name}...`, ratio: 0.5 });
                try {
                    const res = await command.handler(args, {
                        creds,
                        config,
                        userData: data,
                        rawInput: raw,
                        exitApp: exit,
                    });
                    setActionProgress({ label: 'Готово', ratio: 1.0 });
                    setTimeout(() => setActionProgress(null), 600);
                    if (res) {
                        setHistory(h => [
                            ...h,
                            {
                                id: makeUniqueId(),
                                type: res.ok ? 'assistant' : 'error',
                                text: res.message,
                                details: res.details,
                            },
                        ]);
                    }
                }
                catch (err) {
                    setActionProgress(null);
                    setHistory(h => [
                        ...h,
                        { id: makeUniqueId(), type: 'error', text: `Ошибка выполнения: ${err.message}` },
                    ]);
                }
                return;
            }
        }
        // 3. Extension Management commands: /ext create, /ext install
        if (raw.startsWith('/ext create') || raw.startsWith('ext create')) {
            const name = raw.replace(/^(\/ext|ext)\s+create\s*/i, '').trim() || 'my-plugin';
            const { dir } = scaffoldExtension(name, 'Пользовательский модуль расширения Zerf');
            setHistory(h => [
                ...h,
                {
                    id: makeUniqueId(),
                    type: 'assistant',
                    text: `✔ Расширение ${name} успешно создано!`,
                    details: [`Директория: ${dir}`, 'Файлы: zerf.manifest.json, index.js', 'Команда добавлена в локальный реестр.'],
                },
            ]);
            return;
        }
        if (raw.startsWith('/ext install') || raw.startsWith('ext install')) {
            const name = raw.replace(/^(\/ext|ext)\s+install\s*/i, '').trim();
            if (!name) {
                setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: 'Укажите название расширения: /ext install <name>' }]);
                return;
            }
            setActionProgress({ label: `Установка ${name}...`, ratio: 0.5 });
            try {
                await installExtensionPackage(name);
                setActionProgress({ label: `${name} установлено`, ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 1000);
                setHistory(h => [
                    ...h,
                    { id: makeUniqueId(), type: 'assistant', text: `✔ Расширение ${name} установлено и готово к использованию!` },
                ]);
            }
            catch (e) {
                setActionProgress(null);
                setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${e.message}` }]);
            }
            return;
        }
        // 4. Entropy AI Search & Deep Research (Perplexity style)
        if (raw.startsWith('/search') || raw.startsWith('/entropy') || raw.startsWith('/энтропия') || raw.startsWith('/серч') || raw.startsWith('/поиск')) {
            const query = raw.replace(/^(\/search|\/entropy|\/энтропия|\/серч|\/поиск)\s*/i, '').trim();
            if (!query) {
                setHistory(h => [
                    ...h,
                    {
                        id: makeUniqueId(),
                        type: 'assistant',
                        text: '🔮 Расширение: Entropy AI Search & Deep Research (v1.0.0)',
                        details: [
                            '• Использование: /search <запрос> или /entropy <запрос>',
                            '• Пример: /search архитектура MoE vs Dense в LLM 2026',
                            '• Тихоня выполнит глубокий поиск, верификацию первоисточников и синтез цитат [1][2].',
                        ],
                    },
                ]);
                return;
            }
            setActionProgress({ label: `[Entropy AI] Тихоня краулит первоисточники по «${query}»...`, ratio: 0.4 });
            const progTimer = setTimeout(() => {
                setActionProgress({ label: '[Entropy AI] Тихоня синтезирует факты и проверяет цитаты...', ratio: 0.8 });
            }, 500);
            try {
                let details = [];
                let answerText = '';
                try {
                    const apiBase = (creds.serverUrl || 'https://zeprh.vercel.app').replace(/\/$/, '');
                    const headers = { 'Content-Type': 'application/json' };
                    if (creds.token)
                        headers['x-telegram-auth'] = creds.token;
                    if (creds.chatId)
                        headers['x-telegram-chat-id'] = creds.chatId;
                    const res = await fetch(`${apiBase}/api/entropy/search`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ query, mode: 'web' }),
                    });
                    const searchData = await res.json();
                    if (searchData.success && searchData.result) {
                        const r = searchData.result;
                        answerText = `🔮 Entropy AI: «${query}»`;
                        details.push(`◈ Тихоня: «${r.tikhonyaComment || 'Синтезировал первоисточники [ ˘ ᴗ ˘ ]'}»`);
                        if (r.sources && r.sources.length > 0) {
                            details.push('─'.repeat(50));
                            details.push('📚 Верифицированные первоисточники:');
                            r.sources.forEach((s) => {
                                details.push(`  [${s.id}] ${s.title} (${s.domain})`);
                            });
                            details.push('─'.repeat(50));
                        }
                        details.push('');
                        r.answer.split('\n').forEach((line) => details.push(line));
                        if (r.takeaways && r.takeaways.length > 0) {
                            details.push('');
                            details.push('💡 Главные выводы:');
                            r.takeaways.forEach((t) => details.push(`  ◈ ${t}`));
                        }
                    }
                }
                catch { }
                if (details.length === 0) {
                    const searchPrompt = `Ты — ведущий исследовательский поисково-аналитический движок Entropy AI с маскотом Тихоня.
Пользователь ищет: "${query}".

Сформируй глубокий структурированный ответ со следующей структурой:
1. Краткий прямой ответ (Direct Summary).
2. Подробный разбор с цитатами и фактами. Помечай факты сносками [1], [2], [3].
3. Список проверенных источников (Sources & References).
4. Ключевые выводы (Key takeaways).
5. Реплика Тихони [ ˘ ᴗ ˘ ].`;
                    const aiRes = await sendAiQuery(creds, searchPrompt, 'openai/gpt-oss-120b');
                    answerText = `🔮 Entropy AI Search: «${query}»`;
                    details = aiRes.message ? aiRes.message.split('\n') : (aiRes.details || []);
                }
                clearTimeout(progTimer);
                setActionProgress({ label: '[Entropy AI] Тихоня завершил поиск', ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 800);
                setHistory(h => [
                    ...h,
                    {
                        id: makeUniqueId(),
                        type: 'assistant',
                        text: answerText,
                        details,
                    },
                ]);
            }
            catch (err) {
                clearTimeout(progTimer);
                setActionProgress(null);
                setHistory(h => [
                    ...h,
                    { id: makeUniqueId(), type: 'error', text: `Entropy Search ошибка: ${err.message}` },
                ]);
            }
            return;
        }
        // 5. Smart Natural Language Summaries Detection (e.g. "выдай мне сводку на след месяц по задачам")
        const lower = raw.toLowerCase();
        const isSummaryRequest = (lower.includes('сводк') || lower.includes('отчет') || lower.includes('итог') || lower.includes('план')) &&
            (lower.includes('задач') || lower.includes('месяц') || lower.includes('недел') || lower.includes('календар'));
        if (isSummaryRequest) {
            setActionProgress({ label: 'Формирование сводки задач...', ratio: 0.7 });
            const allTasks = data?.tasks || [];
            const goals = data?.goals || [];
            const habits = data?.habits || [];
            const pendingTasks = allTasks.filter((t) => t.status !== 'done');
            const doneTasks = allTasks.filter((t) => t.status === 'done');
            const details = [
                `📊 Аналитика расписания:`,
                `  • Всего задач: ${allTasks.length} (активно: ${pendingTasks.length}, завершено: ${doneTasks.length})`,
                '',
                `📅 Ближайшие запланированные задачи:`,
            ];
            if (pendingTasks.length === 0) {
                details.push('  • Нет невыполненных задач');
            }
            else {
                pendingTasks.slice(0, 8).forEach((t) => {
                    const due = t.dueDate ? ` [${t.dueDate}${t.dueTime ? ` в ${t.dueTime}` : ''}]` : ' [без даты]';
                    details.push(`  • [◌] ${t.title}${due}`);
                });
            }
            if (goals.length > 0) {
                details.push('');
                details.push(`◈ Прогресс ключевых целей:`);
                goals.slice(0, 3).forEach((g) => {
                    const p = typeof g.progress === 'number' ? g.progress : 50;
                    details.push(`  • ${g.title} (${p}%) ${renderProgressBar(p / 100, 6)}`);
                });
            }
            if (habits.length > 0) {
                details.push('');
                details.push(`● Активные привычки:`);
                habits.slice(0, 3).forEach((hb) => {
                    details.push(`  • ${hb.title} — стрик ${hb.currentStreak || hb.progress || 3} дн.`);
                });
            }
            setActionProgress({ label: 'Сводка сформирована', ratio: 1.0 });
            setTimeout(() => setActionProgress(null), 800);
            setHistory(h => [
                ...h,
                {
                    id: makeUniqueId(),
                    type: 'assistant',
                    text: `❖ Сводка по задачам и планам:`,
                    details,
                },
            ]);
            return;
        }
        // 6. AI Query / Free text assistant
        try {
            const currentModel = config.model || 'openai/gpt-oss-120b';
            setActionProgress({ label: `Генерация ответа через ${currentModel}...`, ratio: 0.45 });
            const progTimer = setTimeout(() => {
                setActionProgress({ label: `Генерация ответа через ${currentModel}...`, ratio: 0.8 });
            }, 500);
            if (currentModel.startsWith('cli:')) {
                const out = await runLocalCliBridge(currentModel, raw);
                clearTimeout(progTimer);
                setActionProgress({ label: 'Ответ CLI получен', ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 800);
                setHistory(h => [
                    ...h,
                    { id: makeUniqueId(), type: 'assistant', text: `◈ Ответ ${currentModel.replace('cli:', '')}:`, details: [out] },
                ]);
            }
            else {
                const res = await sendAiQuery(creds, raw, currentModel);
                clearTimeout(progTimer);
                setActionProgress({ label: 'Ответ сформирован', ratio: 1.0 });
                setTimeout(() => setActionProgress(null), 800);
                setHistory(h => [
                    ...h,
                    { id: makeUniqueId(), type: 'assistant', text: res.message, details: res.details },
                ]);
            }
        }
        catch (e) {
            setActionProgress(null);
            setHistory(h => [...h, { id: makeUniqueId(), type: 'error', text: `Ошибка: ${e.message}` }]);
        }
    };
    const userName = data?.user?.name || creds.userName || 'Пользователь Zerf';
    const planTag = (data?.user?.plan || creds.plan || 'corp').toUpperCase();
    const username = data?.user?.username ? `@${data.user.username}` : '';
    const spriteLines = getAllaySpriteLines('idle', wingFrame);
    const todayTasks = (data?.tasks || []).filter((t) => !t.dueDate || t.dueDate.startsWith(new Date().toISOString().slice(0, 10)));
    const overdueTasks = (data?.tasks || []).filter((t) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done');
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, width: 90, children: [_jsxs(Box, { justifyContent: "space-between", width: 86, marginY: 0, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u25C8" }), _jsx(Text, { bold: true, color: "white", children: "Zerf CLI v2.0.26" })] }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "gray", children: userName }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsx(Text, { bold: true, color: "cyanBright", children: planTag }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsx(Text, { color: "white", children: "\u0441\u0442\u0440\u0438\u043A 12 \u0434\u043D." })] })] }), _jsxs(Box, { borderStyle: "round", borderColor: "cyan", flexDirection: "row", width: 86, marginY: 0, children: [_jsxs(Box, { flexDirection: "column", width: 40, paddingX: 1, borderStyle: "single", borderColor: "gray", borderTop: false, borderBottom: false, borderLeft: false, children: [_jsxs(Text, { bold: true, color: "white", children: ["\u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C, ", userName] }), _jsx(Box, { flexDirection: "column", alignItems: "center", marginY: 1, children: spriteLines.map((line, idx) => (_jsx(Text, { children: line }, `sprite_${idx}`))) }), _jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "Groq AI" }), _jsx(Text, { color: "gray", children: "\u00B7" }), _jsxs(Text, { bold: true, color: "greenBright", children: ["Zerf ", planTag] }), username && _jsxs(Text, { color: "gray", children: ["\u00B7 ", username] })] })] }), _jsxs(Box, { flexDirection: "column", width: 42, paddingX: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u0421\u043E\u0432\u0435\u0442\u044B & \u0428\u043E\u0440\u0442\u043A\u0430\u0442\u044B" }), _jsxs(Box, { flexDirection: "column", marginTop: 0, children: [_jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "settings" }), " \u2014 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u00B7 ", _jsx(Text, { color: "cyanBright", children: "today" }), " \u2014 \u0437\u0430\u0434\u0430\u0447\u0438"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "/search <\u0437\u0430\u043F\u0440\u043E\u0441>" }), " \u2014 \u043F\u043E\u0438\u0441\u043A Entropy AI"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "add <\u0442\u0435\u043A\u0441\u0442>" }), " \u2014 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443"] }), _jsxs(Text, { color: "gray", children: ["\u2022 ", _jsx(Text, { color: "cyanBright", children: "done <\u0438\u043C\u044F>" }), " \u2014 \u0437\u0430\u043A\u0440\u044B\u0442\u044C \u0434\u0435\u043B\u043E"] })] }), _jsx(Box, { marginY: 0, children: _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }) }), _jsx(Text, { bold: true, color: "cyanBright", children: "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0441\u0435\u0433\u043E\u0434\u043D\u044F" }), _jsxs(Box, { flexDirection: "column", marginTop: 0, children: [_jsxs(Text, { color: "white", children: ["\u2756 \u0417\u0430\u0434\u0430\u0447: ", todayTasks.length, " ", overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : ''] }), _jsx(Text, { color: "white", children: "\u25CF \u0421\u0442\u0440\u0438\u043A: 12 \u0434\u043D\u0435\u0439" })] })] })] }), history.slice(-5).map(item => (_jsx(Box, { flexDirection: "column", marginY: 0, marginTop: 1, children: item.type === 'user' ? (_jsxs(Box, { gap: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(Text, { bold: true, color: "white", children: item.text })] })) : item.type === 'error' ? (_jsxs(Box, { gap: 1, marginLeft: 2, children: [_jsx(Text, { color: "red", children: "\u25CF" }), _jsx(Text, { color: "red", children: item.text })] })) : (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: "cyanBright", children: "\u25CF" }), _jsx(Text, { color: "white", children: item.text })] }), item.details && item.details.map((d, i) => (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { color: "gray", children: d }) }, `detail_${item.id}_${i}`)))] })) }, `hist_${item.id}`))), pickingChatFriend && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyanBright", paddingX: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u25C8 \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0430 \u0434\u043B\u044F \u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u0438\u0430\u043B\u043E\u0433\u0430 (\u2191/\u2193, Enter):" }), _jsx(Text, { color: "gray", children: "ESC \u043E\u0442\u043C\u0435\u043D\u0430" })] }), (() => {
                        const friendsList = data?.friends || [];
                        const VISIBLE_FRIEND_COUNT = 7;
                        const startFriendIdx = friendsList.length <= VISIBLE_FRIEND_COUNT
                            ? 0
                            : Math.max(0, Math.min(selectedFriendIdx - Math.floor(VISIBLE_FRIEND_COUNT / 2), friendsList.length - VISIBLE_FRIEND_COUNT));
                        const endFriendIdx = Math.min(friendsList.length, startFriendIdx + VISIBLE_FRIEND_COUNT);
                        const visibleFriends = friendsList.slice(startFriendIdx, endFriendIdx);
                        return (_jsxs(_Fragment, { children: [visibleFriends.map((f, relIdx) => {
                                    const actualIdx = startFriendIdx + relIdx;
                                    const isSel = actualIdx === selectedFriendIdx;
                                    const usernameTag = f.username ? `@${f.username}` : 'без юзернейма';
                                    return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', f.name.padEnd(20)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", usernameTag.padEnd(18), " [\u0412 \u0441\u0435\u0442\u0438] \u041D\u0430\u0447\u0430\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433"] })] }, `friend_opt_${f.id || actualIdx}_${actualIdx}`));
                                }), friendsList.length > VISIBLE_FRIEND_COUNT && (_jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: startFriendIdx > 0 ? `▲ ещё ${startFriendIdx}` : '' }), _jsxs(Text, { color: "gray", dimColor: true, children: [startFriendIdx + 1, "\u2013", endFriendIdx, " \u0438\u0437 ", friendsList.length, " (\u043B\u0438\u0441\u0442\u0430\u0439\u0442\u0435 \u2191/\u2193)"] }), _jsx(Text, { color: "gray", dimColor: true, children: endFriendIdx < friendsList.length ? `▼ ещё ${friendsList.length - endFriendIdx}` : '' })] }))] }));
                    })()] })), pickingModel && (_jsxs(Box, { flexDirection: "column", borderStyle: "double", borderColor: "cyanBright", paddingX: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: "\u25C8 \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0435\u0439\u0440\u043E\u0441\u0435\u0442\u044C \u0438\u043B\u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 CLI \u0430\u0433\u0435\u043D\u0442 (\u2191/\u2193, Enter):" }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), (() => {
                        const VISIBLE_MODEL_COUNT = 7;
                        const startModelIdx = allAvailableModels.length <= VISIBLE_MODEL_COUNT
                            ? 0
                            : Math.max(0, Math.min(selectedModelIdx - Math.floor(VISIBLE_MODEL_COUNT / 2), allAvailableModels.length - VISIBLE_MODEL_COUNT));
                        const endModelIdx = Math.min(allAvailableModels.length, startModelIdx + VISIBLE_MODEL_COUNT);
                        const visibleModels = allAvailableModels.slice(startModelIdx, endModelIdx);
                        return (_jsxs(_Fragment, { children: [visibleModels.map((m, relIdx) => {
                                    const actualIdx = startModelIdx + relIdx;
                                    const isSel = actualIdx === selectedModelIdx;
                                    const isCurrent = config.model === m.id;
                                    const tag = m.type === 'local_cli' ? `[Локальный CLI ${m.status || ''}]` : '[Облако Zerf]';
                                    return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', m.name.padEnd(30)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", tag, " ", m.desc, " ", isCurrent ? '(Текущий)' : ''] })] }, `model_opt_${m.id}_${actualIdx}`));
                                }), allAvailableModels.length > VISIBLE_MODEL_COUNT && (_jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: startModelIdx > 0 ? `▲ ещё ${startModelIdx}` : '' }), _jsxs(Text, { color: "gray", dimColor: true, children: [startModelIdx + 1, "\u2013", endModelIdx, " \u0438\u0437 ", allAvailableModels.length, " (\u043B\u0438\u0441\u0442\u0430\u0439\u0442\u0435 \u2191/\u2193)"] }), _jsx(Text, { color: "gray", dimColor: true, children: endModelIdx < allAvailableModels.length ? `▼ ещё ${allAvailableModels.length - endModelIdx}` : '' })] }))] }));
                    })()] })), isSlashOrTyping && filteredCommands.length > 0 && !pickingModel && !pickingChatFriend && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyanBright", paddingX: 1, marginY: 1, children: [_jsxs(Box, { justifyContent: "space-between", marginBottom: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: menuForced ? '❖ Меню возможностей Zerf CLI (навигация ↑/↓, Enter для открытия):' : 'Команды Zerf CLI (навигация ↑/↓, Tab выбор):' }), _jsx(Text, { color: "gray", children: "ESC \u0434\u043B\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F" })] }), (() => {
                        const VISIBLE_CMD_COUNT = 8;
                        const startCmdIdx = filteredCommands.length <= VISIBLE_CMD_COUNT
                            ? 0
                            : Math.max(0, Math.min(selectedIdx - Math.floor(VISIBLE_CMD_COUNT / 2), filteredCommands.length - VISIBLE_CMD_COUNT));
                        const endCmdIdx = Math.min(filteredCommands.length, startCmdIdx + VISIBLE_CMD_COUNT);
                        const visibleCommands = filteredCommands.slice(startCmdIdx, endCmdIdx);
                        return (_jsxs(_Fragment, { children: [visibleCommands.map((item, relIdx) => {
                                    const actualIdx = startCmdIdx + relIdx;
                                    const isSel = actualIdx === selectedIdx;
                                    const planBadge = item.minPlan ? `[${item.minPlan}] ` : '';
                                    return (_jsxs(Box, { gap: 1, children: [_jsxs(Text, { bold: true, color: isSel ? 'cyanBright' : 'gray', children: [isSel ? '▶ ' : '  ', item.label.padEnd(18)] }), _jsxs(Text, { color: isSel ? 'white' : 'gray', children: ["\u2014 ", planBadge, item.desc] })] }, `cmd_opt_${item.cmd}_${actualIdx}`));
                                }), filteredCommands.length > VISIBLE_CMD_COUNT && (_jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: startCmdIdx > 0 ? `▲ ещё ${startCmdIdx}` : ' ' }), _jsxs(Text, { color: "gray", dimColor: true, children: [startCmdIdx + 1, "\u2013", endCmdIdx, " \u0438\u0437 ", filteredCommands.length, " \u00B7 \u2191/\u2193 \u043F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u0430 \u00B7 Tab \u0432\u044B\u0431\u043E\u0440"] }), _jsx(Text, { color: "gray", dimColor: true, children: endCmdIdx < filteredCommands.length ? `▼ ещё ${filteredCommands.length - endCmdIdx}` : ' ' })] }))] }));
                    })()] })), actionProgress && (_jsxs(Box, { gap: 1, marginY: 0, marginTop: 1, marginLeft: 1, children: [_jsx(Text, { bold: true, color: "cyanBright", children: renderProgressBar(actionProgress.ratio, 14) }), _jsxs(Text, { bold: true, color: "white", children: [Math.round(actionProgress.ratio * 100), "%"] }), _jsxs(Text, { color: "gray", children: ["\u2014 ", actionProgress.label] })] })), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { gap: 1, marginY: 0, children: [_jsx(Text, { bold: true, color: "cyanBright", children: '>' }), _jsx(TextInput, { value: inputVal, onChange: (val) => {
                                    setInputVal(val);
                                    if (!val)
                                        setMenuForced(false);
                                }, onSubmit: executeCommand, placeholder: "\u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443, /search, /today, settings, /menu..." })] }), _jsx(Text, { color: "gray", dimColor: true, children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), _jsxs(Box, { justifyContent: "space-between", marginTop: 0, children: [_jsx(Text, { color: "gray", dimColor: true, children: "settings \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u00B7 today \u0437\u0430\u0434\u0430\u0447\u0438 \u00B7 cal \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C \u00B7 /menu \u043C\u0435\u043D\u044E \u00B7 ? \u0441\u043F\u0440\u0430\u0432\u043A\u0430" }), _jsxs(Text, { color: "gray", dimColor: true, children: ["[", planTag, ": ", cliCount, "/", data?.limits?.maxCli || '∞', " CLI | ", Math.floor((data?.limits?.voiceUsedSeconds || 0) / 60), "/", data?.limits?.maxVoiceSeconds === '∞' ? '∞' : Math.floor(data?.limits?.maxVoiceSeconds / 60), "\u043C \u0433\u043E\u043B\u043E\u0441]"] })] })] })] }));
}
