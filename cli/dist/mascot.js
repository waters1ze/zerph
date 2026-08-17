/**
 * Zerf Mascot: «Тихоня» (Minecraft Allay Spirit)
 * Pixel-art block sprite rendered in ANSI colors, matching Claude Code's pixel mascot aesthetic.
 */
// Palette matching Minecraft Allay
const C_LIGHT = '\x1b[38;2;125;211;252m'; // #7dd3fc Sky 300
const C_MAIN = '\x1b[38;2;56;189;248m'; // #38bdf8 Sky 400
const C_DARK = '\x1b[38;2;14;165;233m'; // #0ea5e9 Sky 500
const C_WING = '\x1b[38;2;186;230;253m'; // #bae6fd Light wings
const C_PURP = '\x1b[38;2;129;140;248m'; // #818cf8 Indigo 400
const C_EYE = '\x1b[38;2;255;255;255m'; // White
const C_PUPIL = '\x1b[38;2;30;41;59m'; // Dark pupil
const C_AMBER = '\x1b[38;2;251;191;36m';
const C_GREEN = '\x1b[38;2;52;211;153m';
const C_ROSE = '\x1b[38;2;244;63;94m';
const C_SLATE = '\x1b[38;2;148;163;184m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
/**
 * 6-line Pixel Art of the Minecraft Allay (Тихоня)
 */
export function getAllaySpriteLines(mood = 'idle', wingFrame = 0) {
    const isWingUp = wingFrame % 2 === 0;
    const wL = isWingUp ? `${C_WING}▄▀` : `${C_WING}  `;
    const wR = isWingUp ? `${C_WING}▀▄` : `${C_WING}  `;
    const wML = isWingUp ? `${C_WING}█ ` : `${C_WING}▄▀`;
    const wMR = isWingUp ? `${C_WING} █` : `${C_WING}▀▄`;
    let eyesLine = `${C_EYE}█${C_PUPIL}▀${C_MAIN}██${C_EYE}█${C_PUPIL}▀`;
    if (mood === 'thinking') {
        eyesLine = `${C_AMBER}⬡${C_MAIN}████${C_AMBER}⬡`;
    }
    else if (mood === 'celebrate') {
        eyesLine = `${C_GREEN}▀${C_EYE}█${C_MAIN}██${C_EYE}█${C_GREEN}▀`;
    }
    else if (mood === 'focus') {
        eyesLine = `${C_PURP}▄${C_MAIN}████${C_PURP}▄`;
    }
    else if (mood === 'alert') {
        eyesLine = `${C_ROSE}█${C_EYE}▀${C_MAIN}██${C_ROSE}█${C_EYE}▀`;
    }
    return [
        ` ${wL} ${C_LIGHT}▄████▄${RESET} ${wR}`,
        `${wML}${C_MAIN}██${eyesLine}${C_MAIN}██${RESET}${wMR}`,
        ` ${wL} ${C_DARK}▀████▀${RESET} ${wR}`,
        `    ${C_PURP}▄██▄${RESET}   `,
        `    ${C_MAIN}▀██▀${RESET}   `,
        `     ${C_LIGHT}▀▀${RESET}    `,
    ];
}
export function getAllayFace(mood = 'idle') {
    switch (mood) {
        case 'idle':
            return `${C_LIGHT}[ ✦ _ ✦ ]${RESET}`;
        case 'thinking':
            return `${C_AMBER}[ ⬡ . ⬡ ]${RESET}`;
        case 'celebrate':
            return `${C_GREEN}[ ✧ ᴗ ✧ ]${RESET}`;
        case 'focus':
            return `${C_PURP}[ ˘ ᴗ ˘ ☕ ]${RESET}`;
        case 'alert':
            return `${C_ROSE}[ ⊙ _ ⊙ ! ]${RESET}`;
    }
}
export function renderAllayBanner(userName, plan, streak = 1) {
    const planColor = plan.toLowerCase() === 'corp' ? C_AMBER : plan.toLowerCase() === 'pro' ? C_MAIN : C_GREEN;
    return [
        ` ${C_MAIN}✦${RESET} ${BOLD}Zerf Code v2.0.26${RESET}        ${C_SLATE}${userName}${RESET} · ${planColor}${plan.toUpperCase()}${RESET} · ${C_SLATE}стрик ${streak} 🔥${RESET}`,
        `${C_SLATE}────────────────────────────────────────────────────────────────────────────${RESET}`,
    ].join('\n');
}
