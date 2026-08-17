/**
 * Zerf CLI Mascot: «Зеф» (Zef)
 * Minimalist digital sprite companion for Zerf Second Brain CLI.
 * Strict monochrome theme with clean white/slate/cyan accents.
 */

export type MascotMood = 'idle' | 'thinking' | 'celebrate' | 'focus' | 'alert'

// Strict Monochrome ANSI palette
const WHITE = '\x1b[38;2;255;255;255m'
const SLATE = '\x1b[38;2;148;163;184m'
const MUTED = '\x1b[38;2;100;116;139m'
const CYAN = '\x1b[38;2;56;189;248m'
const EMERALD = '\x1b[38;2;52;211;153m'
const AMBER = '\x1b[38;2;251;191;36m'
const ROSE = '\x1b[38;2;244;63;94m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

export function isUnicodeSupported(): boolean {
  if (process.platform !== 'win32') {
    return process.env.TERM !== 'linux'
  }
  return (
    Boolean(process.env.WT_SESSION) || // Windows Terminal
    Boolean(process.env.TERMINUS_SUBLIME) ||
    process.env.ConEmuTask === '{cmd::Cmder}' ||
    process.env.TERM_PROGRAM === 'vscode' ||
    process.env.TERM === 'xterm-256color' ||
    process.env.TERM === 'alacritty'
  )
}

export function getZefFace(mood: MascotMood = 'idle'): string {
  if (!isUnicodeSupported()) {
    return '❖'
  }
  switch (mood) {
    case 'idle':
      return `${WHITE}${BOLD}✦ _ ✦${RESET}`
    case 'thinking':
      return `${CYAN}${BOLD}⬡ . ⬡${RESET}`
    case 'celebrate':
      return `${EMERALD}${BOLD}✧ ᴗ ✧${RESET}`
    case 'focus':
      return `${WHITE}${BOLD}˘ ᴗ ˘ ${SLATE}☕${RESET}`
    case 'alert':
      return `${ROSE}${BOLD}⊙ _ ⊙ !${RESET}`
  }
}

export function getZefAsciiArt(mood: MascotMood = 'idle'): string[] {
  if (!isUnicodeSupported()) {
    return [
      `  ❖ Zerf Sprite [${mood}]`,
    ]
  }

  const face = getZefFace(mood)
  return [
    `       ${MUTED}.---.${RESET}`,
    `     ${MUTED}.'${WHITE}  _  ${MUTED}'.${RESET}      ${CYAN}🪽${RESET} [ ${face} ] ${CYAN}🪽${RESET}`,
    `    ${MUTED}/   ${CYAN}(o)${MUTED}   \\${RESET}        ${MUTED}/|  ${CYAN}✦${MUTED}  |\\${RESET}`,
    `   ${MUTED}|  ${WHITE}(  _  )${MUTED}  |${RESET}       ${MUTED}/ |     | \\${RESET}`,
    `    ${MUTED}\\  ${MUTED}'---'${MUTED}  /${RESET}        ${MUTED}~  '---'  ~${RESET}`,
    `     ${MUTED}'..___..'${RESET}        ${CYAN}✨   *   ✨${RESET}`,
    `       ${MUTED}/   \\${RESET}`,
    `      ${MUTED}~     ~${RESET}`,
  ]
}

export function renderZefBanner(userName: string, plan: string, streak = 1): string {
  const symbol = isUnicodeSupported() ? '❖' : '*'
  const planColor = plan.toLowerCase() === 'corp' ? AMBER : plan.toLowerCase() === 'pro' ? CYAN : EMERALD
  const fire = isUnicodeSupported() ? '🔥' : '^'

  return [
    ` ${CYAN}${symbol}${RESET} ${BOLD}${WHITE}Zerf — второй мозг${RESET}        ${SLATE}${userName}${RESET} · ${planColor}${plan.toUpperCase()}${RESET} · ${SLATE}стрик ${streak} ${fire}${RESET}`,
    `${MUTED}──────────────────────────────────────────────────────────${RESET}`,
  ].join('\n')
}
