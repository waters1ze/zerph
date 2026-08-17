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
export function renderAllayBanner(userName, plan, streak = 1) {
    return [
        ` ${C_MAIN}✦${RESET} ${BOLD}Zerf Code v2.0.26${RESET}        ${C_SLATE}${userName}${RESET} · ${C_CYAN}${plan.toUpperCase()}${RESET} · ${C_SLATE}стрик ${streak} ✦${RESET}`,
        `${C_MUTED}────────────────────────────────────────────────────────────────────────────${RESET}`,
    ].join('\n');
}
