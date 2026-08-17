/**
 * Zerf Mascot: «Тихоня» (Minecraft Allay Spirit)
 * Cute voxel/block sprite in ANSI colors, matching authentic Minecraft aesthetics.
 */
// Palette matching Minecraft Allay
const C_LIGHT = '\x1b[38;2;186;230;253m'; // #bae6fd Light wings & highlights
const C_CYAN = '\x1b[38;2;125;211;252m'; // #7dd3fc Sky 300
const C_MAIN = '\x1b[38;2;56;189;248m'; // #38bdf8 Sky 400
const C_DARK = '\x1b[38;2;14;165;233m'; // #0ea5e9 Sky 500
const C_PURP = '\x1b[38;2;99;102;241m'; // #6366f1 Indigo 500
const C_WHITE = '\x1b[38;2;255;255;255m'; // White
const C_PUPIL = '\x1b[38;2;30;41;59m'; // Dark pupil
const C_AMBER = '\x1b[38;2;251;191;36m';
const C_GREEN = '\x1b[38;2;52;211;153m';
const C_ROSE = '\x1b[38;2;244;63;94m';
const C_SLATE = '\x1b[38;2;148;163;184m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
/**
 * Cute, Boxy Minecraft Allay (Тихоня) Pixel Sprite (5 lines)
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
        eyes = `${C_AMBER}◫${C_MAIN}██${C_AMBER}◫`;
    }
    else if (mood === 'celebrate') {
        eyes = `${C_GREEN}✦${C_MAIN}██${C_GREEN}✦`;
    }
    else if (mood === 'focus') {
        eyes = `${C_PURP}▄${C_MAIN}██${C_PURP}▄`;
    }
    else if (mood === 'alert') {
        eyes = `${C_ROSE}■${C_MAIN}██${C_ROSE}■`;
    }
    return [
        ` ${wTopL} ${C_CYAN}▄████▄${RESET} ${wTopR}`,
        `${wMidL}${C_MAIN}█${eyes}${C_MAIN}█${RESET}${wMidR}`,
        ` ${wBotL} ${C_DARK}▀████▀${RESET} ${wBotR}`,
        `    ${C_PURP}▄██▄${RESET}   `,
        `     ${C_CYAN}▀▀${RESET}    `,
    ];
}
export function getAllayFace(mood = 'idle') {
    switch (mood) {
        case 'idle':
            return `${C_CYAN}[ ■ ◡ ■ ]${RESET}`;
        case 'thinking':
            return `${C_AMBER}[ ◫ ⚬ ◫ ]${RESET}`;
        case 'celebrate':
            return `${C_GREEN}[ ✦ ᗜ ✦ ]${RESET}`;
        case 'focus':
            return `${C_PURP}[ ─ ‿ ─ ☕ ]${RESET}`;
        case 'alert':
            return `${C_ROSE}[ ⯀ ᗣ ⯀ ! ]${RESET}`;
    }
}
export function renderAllayBanner(userName, plan, streak = 1) {
    const planColor = plan.toLowerCase() === 'corp' ? C_AMBER : plan.toLowerCase() === 'pro' ? C_CYAN : C_GREEN;
    return [
        ` ${C_MAIN}✦${RESET} ${BOLD}Zerf Code v2.0.26${RESET}        ${C_SLATE}${userName}${RESET} · ${planColor}${plan.toUpperCase()}${RESET} · ${C_SLATE}стрик ${streak} 🔥${RESET}`,
        `${C_SLATE}────────────────────────────────────────────────────────────────────────────${RESET}`,
    ].join('\n');
}
