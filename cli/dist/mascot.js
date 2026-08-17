/**
 * Zerf Mascot: «Тихоня» (Minecraft Allay Spirit)
 * Strict monochrome + ethereal cyan palette matching the Zerf brand guidelines.
 */
// Strict Brand Palette (Platinum White, Ethereal Sky, Slate Gray)
const C_LIGHT = '\x1b[38;2;186;230;253m'; // #bae6fd Light wings & highlights
const C_CYAN = '\x1b[38;2;125;211;252m'; // #7dd3fc Sky 300
const C_MAIN = '\x1b[38;2;56;189;248m'; // #38bdf8 Sky 400
const C_DARK = '\x1b[38;2;14;165;233m'; // #0ea5e9 Sky 500
const C_INDIGO = '\x1b[38;2;99;102;241m'; // #6366f1 Indigo 500
const C_WHITE = '\x1b[38;2;248;250;252m'; // #f8fafc Platinum White
const C_SLATE = '\x1b[38;2;148;163;184m'; // #94a3b8 Slate 400
const C_MUTED = '\x1b[38;2;100;116;139m'; // #64748b Slate 500
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
/**
 * Custom Monochrome & Cyber Glyphs (Replacing generic OS emojis)
 */
export const GLYPHS = {
    task: '❖',
    taskDone: '✔',
    taskTodo: '○',
    calendar: '◫',
    chat: '◈',
    note: '≡',
    focus: '⊘',
    limits: '⚡',
    streak: '✦',
    friend: '🪽',
    bullet: '●',
    pointer: '▶',
};
/**
 * Cute, Boxy Minecraft Allay (Тихоня) Voxel Pixel Art (5 lines)
 */
export function getAllaySpriteLines(mood = 'idle', wingFrame = 0) {
    const isWingUp = wingFrame % 2 === 0;
    const wTopL = isWingUp ? `${C_LIGHT}▄▀` : `${C_LIGHT}  `;
    const wTopR = isWingUp ? `${C_LIGHT}▀▄` : `${C_LIGHT}  `;
    const wMidL = isWingUp ? `${C_LIGHT}█ ` : `${C_LIGHT}▄▀`;
    const wMidR = isWingUp ? `${C_LIGHT} █` : `${C_LIGHT}▀▄`;
    const wBotL = isWingUp ? `${C_LIGHT}▀▄` : `${C_LIGHT}  `;
    const wBotR = isWingUp ? `${C_LIGHT}▄▀` : `${C_LIGHT}  `;
    let eyes = `${C_WHITE}■${C_MAIN}██${C_WHITE}■`;
    if (mood === 'thinking') {
        eyes = `${C_CYAN}◫${C_MAIN}██${C_CYAN}◫`;
    }
    else if (mood === 'celebrate') {
        eyes = `${C_WHITE}✦${C_MAIN}██${C_WHITE}✦`;
    }
    else if (mood === 'focus') {
        eyes = `${C_INDIGO}▄${C_MAIN}██${C_INDIGO}▄`;
    }
    else if (mood === 'alert') {
        eyes = `${C_WHITE}■${C_MAIN}██${C_WHITE}■`;
    }
    return [
        ` ${wTopL} ${C_CYAN}▄████▄${RESET} ${wTopR}`,
        `${wMidL}${C_MAIN}█${eyes}${C_MAIN}█${RESET}${wMidR}`,
        ` ${wBotL} ${C_DARK}▀████▀${RESET} ${wBotR}`,
        `    ${C_INDIGO}▄██▄${RESET}   `,
        `     ${C_CYAN}▀▀${RESET}    `,
    ];
}
export function getAllayFace(mood = 'idle') {
    switch (mood) {
        case 'idle':
            return `${C_CYAN}[ ■ ◡ ■ ]${RESET}`;
        case 'thinking':
            return `${C_CYAN}[ ◫ ⚬ ◫ ]${RESET}`;
        case 'celebrate':
            return `${C_WHITE}[ ✦ ᗜ ✦ ]${RESET}`;
        case 'focus':
            return `${C_INDIGO}[ ─ ‿ ─ ☕ ]${RESET}`;
        case 'alert':
            return `${C_WHITE}[ ⯀ ᗣ ⯀ ! ]${RESET}`;
    }
}
export function printHeroBanner(data) {
    const userName = data?.user?.name || 'Кирилл';
    const plan = (data?.user?.plan || 'corp').toUpperCase();
    const username = data?.user?.username ? `@${data.user.username}` : '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = (data?.tasks || []).filter((t) => !t.dueDate || t.dueDate.startsWith(todayStr));
    const overdueTasks = (data?.tasks || []).filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    const sprite = getAllaySpriteLines('idle', 0);
    console.log(`\n ${C_MAIN}✦${RESET} ${BOLD}Zerf Code v2.0.26${RESET}        ${C_SLATE}${userName}${RESET} · ${C_CYAN}${plan}${RESET} · ${C_SLATE}стрик 12 ✦${RESET}`);
    console.log(`${C_MUTED}┌────────────────────────────────────────┬────────────────────────────────────────┐${RESET}`);
    console.log(`${C_MUTED}│${RESET} ${BOLD}С возвращением, ${userName.slice(0, 20).padEnd(20)}${RESET}   ${C_MUTED}│${RESET} ${C_CYAN}Советы & Шорткаты${RESET}                      ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}│${RESET}                                        ${C_MUTED}│${RESET} ${C_SLATE}•${RESET} ${C_CYAN}/menu${RESET}  ${C_SLATE}— интерактивное меню (↑/↓)${RESET}     ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}│${RESET}   ${sprite[0]}       ${C_MUTED}│${RESET} ${C_SLATE}•${RESET} ${C_CYAN}/today${RESET} ${C_SLATE}— задачи на сегодня${RESET}             ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}│${RESET}   ${sprite[1]}       ${C_MUTED}│${RESET} ${C_SLATE}•${RESET} ${C_CYAN}/cal${RESET}   ${C_SLATE}— недельный календарь${RESET}           ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}│${RESET}   ${sprite[2]}       ${C_MUTED}│${RESET} ${C_SLATE}•${RESET} ${C_CYAN}/chat${RESET}  ${C_SLATE}— командный чат${RESET}                 ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}│${RESET}   ${sprite[3]}       ${C_MUTED}├────────────────────────────────────────┤${RESET}`);
    console.log(`${C_MUTED}│${RESET}   ${sprite[4]}       ${C_MUTED}│${RESET} ${C_CYAN}Активность сегодня${RESET}                     ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}│${RESET}                                        ${C_MUTED}│${RESET} ${C_SLATE}❖${RESET} Задач: ${BOLD}${String(todayTasks.length).padEnd(2)}${RESET} ${overdueTasks.length > 0 ? `(${overdueTasks.length} просрочено)` : '             '}    ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}│${RESET} ${C_CYAN}Groq AI${RESET} · ${C_LIGHT}Zerf ${plan}${RESET} ${username ? `· ${username}` : ''}          ${C_MUTED}│${RESET} ${C_CYAN}✦${RESET} Стрик: ${BOLD}12 дней${RESET}                         ${C_MUTED}│${RESET}`);
    console.log(`${C_MUTED}└────────────────────────────────────────┴────────────────────────────────────────┘${RESET}\n`);
}
export function renderAllayBanner(userName, plan, streak = 1) {
    return [
        ` ${C_MAIN}✦${RESET} ${BOLD}Zerf Code v2.0.26${RESET}        ${C_SLATE}${userName}${RESET} · ${C_CYAN}${plan.toUpperCase()}${RESET} · ${C_SLATE}стрик ${streak} ✦${RESET}`,
        `${C_MUTED}────────────────────────────────────────────────────────────────────────────${RESET}`,
    ].join('\n');
}
