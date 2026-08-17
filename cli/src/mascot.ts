import chalk from 'chalk'
import { GLYPH } from './tui/theme.js'

export type MascotMood = 'idle' | 'thinking' | 'celebrate' | 'focus' | 'alert'

export const MASCOT_GLYPHS = {
  logo: GLYPH.logo,
  bullet: GLYPH.bullet,
  ok: GLYPH.ok,
  cancel: GLYPH.cancel,
  arrow: GLYPH.arrow,
  todo: GLYPH.todo,
  taskTodo: GLYPH.taskTodo,
  taskDone: GLYPH.taskDone,
  thinking: GLYPH.thinking,
  mascotIdle: GLYPH.mascotIdle,
  mascotFocus: GLYPH.mascotFocus,
  mascotAlert: GLYPH.mascotAlert,
  mascotJoy: GLYPH.mascotJoy,
  barFilled: GLYPH.barFilled,
  barEmpty: GLYPH.barEmpty,
  divider: GLYPH.divider,
} as const

// Legacy alias for compatibility
export const GLYPHS = {
  spirit: GLYPH.logo,
  wings: GLYPH.arrow,
  task: GLYPH.logo,
  taskDone: GLYPH.ok,
  taskTodo: GLYPH.todo,
  calendar: '◫',
  chat: GLYPH.logo,
  note: '≡',
  focus: GLYPH.bullet,
  limits: GLYPH.bullet,
  streak: GLYPH.arrow,
  friend: GLYPH.arrow,
  bullet: GLYPH.bullet,
  pointer: GLYPH.arrow,
} as const

export function getAllaySpriteLines(mood: MascotMood = 'idle', wingFrame = 0): string[] {
  const isWingUp = wingFrame % 2 === 0
  const wTopL = isWingUp ? chalk.gray('▄▀') : chalk.gray('  ')
  const wTopR = isWingUp ? chalk.gray('▀▄') : chalk.gray('  ')
  const wMidL = isWingUp ? chalk.gray('█ ') : chalk.gray('▄▀')
  const wMidR = isWingUp ? chalk.gray(' █') : chalk.gray('▀▄')
  const wBotL = isWingUp ? chalk.gray('▀▄') : chalk.gray('  ')
  const wBotR = isWingUp ? chalk.gray('▄▀') : chalk.gray('  ')

  let eyes = chalk.white('■') + chalk.gray('██') + chalk.white('■')
  if (mood === 'thinking') {
    eyes = chalk.gray('⬡') + chalk.white('██') + chalk.gray('⬡')
  } else if (mood === 'celebrate') {
    eyes = chalk.bold.white('✧') + chalk.gray('██') + chalk.bold.white('✧')
  } else if (mood === 'focus') {
    eyes = chalk.gray('˘') + chalk.white('ᴗ') + chalk.gray('˘') + chalk.gray(' ')
  } else if (mood === 'alert') {
    eyes = chalk.yellow('⊙') + chalk.gray('██') + chalk.yellow('⊙')
  }

  return [
    ` ${wTopL} ${chalk.gray('▄████▄')} ${wTopR}`,
    `${wMidL}${chalk.gray('█')}${eyes}${chalk.gray('█')}${wMidR}`,
    ` ${wBotL} ${chalk.gray('▀████▀')} ${wBotR}`,
    `    ${chalk.gray('▄██▄')}   `,
    `     ${chalk.gray('▀▀')}    `,
  ]
}

export function getAllayFace(mood: MascotMood = 'idle'): string {
  switch (mood) {
    case 'idle':
      return chalk.gray('[ ') + chalk.white(GLYPH.mascotIdle + ' _ ' + GLYPH.mascotIdle) + chalk.gray(' ]')
    case 'thinking':
      return chalk.gray('[ ') + chalk.white(GLYPH.thinking + ' _ ' + GLYPH.thinking) + chalk.gray(' ]')
    case 'celebrate':
      return chalk.bold.white('[ ') + chalk.bold.white(GLYPH.mascotJoy) + chalk.bold.white(' ]')
    case 'focus':
      return chalk.gray('[ ') + chalk.white(GLYPH.mascotFocus) + chalk.gray(' ]')
    case 'alert':
      return chalk.yellow('[ ') + chalk.yellow(GLYPH.mascotAlert) + chalk.yellow(' ]')
  }
}
