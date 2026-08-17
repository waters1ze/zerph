/**
 * Zerf Allay Mascot — The Blue Spirit Companion for Zerf CLI
 * Inspired by the friendly Minecraft Allay spirit that gathers items and dances.
 */
// ANSI 256 / RGB Colors
const CYAN = '\x1b[38;2;56;189;248m';
const AZURE = '\x1b[38;2;129;140;248m';
const INDIGO = '\x1b[38;2;99;102;241m';
const AMBER = '\x1b[38;2;251;191;36m';
const EMERALD = '\x1b[38;2;52;211;153m';
const ROSE = '\x1b[38;2;244;63;94m';
const WHITE = '\x1b[38;2;248;250;252m';
const MUTED = '\x1b[38;2;148;163;184m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
export function getAllayAscii(mood = 'idle', wingFrame = 0) {
    const isWingUp = wingFrame % 2 === 0;
    let eyes = '[ ✦ _ ✦ ]';
    let halo = `${CYAN}   ✦   ${RESET}`;
    let accessory = `${AZURE}/|  ✦  |\\${RESET}`;
    switch (mood) {
        case 'thinking':
            eyes = `[ ${AMBER}⬡ . ⬡${WHITE} ]`;
            halo = `${AMBER}   ⬡   ${RESET}`;
            accessory = `${AMBER}/|  ⬡  |\\${RESET}`;
            break;
        case 'celebrate':
            eyes = `[ ${EMERALD}✧ ᴗ ✧${WHITE} ]`;
            halo = `${EMERALD}  ✨*✨  ${RESET}`;
            accessory = `${EMERALD}/|  🎉  |\\${RESET}`;
            break;
        case 'focus':
            eyes = `[ ${AZURE}˘ ᴗ ˘${WHITE} ]`;
            halo = `${AZURE}   ☕   ${RESET}`;
            accessory = `${AZURE}/|  ☕  |\\${RESET}`;
            break;
        case 'alert':
            eyes = `[ ${ROSE}⊙ _ ⊙${WHITE} ]`;
            halo = `${ROSE}   !   ${RESET}`;
            accessory = `${ROSE}/|  ⚡  |\\${RESET}`;
            break;
        case 'dance':
            eyes = `[ ${CYAN}♪ ᴗ ♪${WHITE} ]`;
            halo = `${CYAN}  ♫ ♫  ${RESET}`;
            accessory = `${CYAN}/|  🎵  |\\${RESET}`;
            break;
    }
    const wingLeft = isWingUp ? `${CYAN}🪽 ` : `${INDIGO} ~`;
    const wingRight = isWingUp ? `${CYAN} 🪽` : `${INDIGO}~ `;
    return [
        `     ${halo}`,
        `   ${wingLeft}${WHITE}${BOLD}${eyes}${RESET}${wingRight}`,
        `      ${accessory}`,
        `      ${CYAN}/ |     | \\${RESET}`,
        `      ${INDIGO}~  '---'  ~${RESET}`,
        `        ${CYAN}✨   ✨${RESET}`,
    ];
}
export function renderMascotWithBubble(text, mood = 'idle', wingFrame = 0) {
    const ascii = getAllayAscii(mood, wingFrame);
    const bubbleLine1 = ` ┌─ ${CYAN}Zerf Allay${RESET} ─────────────────────────────────┐`;
    const bubbleLine2 = ` │ ${WHITE}${text.padEnd(45).slice(0, 45)}${RESET} │`;
    const bubbleLine3 = ` └──────────────────────────────────────────────┘`;
    const lines = [
        `${ascii[0]}   ${bubbleLine1}`,
        `${ascii[1]}   ${bubbleLine2}`,
        `${ascii[2]}   ${bubbleLine3}`,
        `${ascii[3]}`,
        `${ascii[4]}`,
        `${ascii[5]}`,
    ];
    return lines.join('\n');
}
