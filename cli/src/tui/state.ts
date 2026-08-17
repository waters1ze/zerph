import type { MascotMood } from '../mascot.js'

export type ScreenName =
  | 'login'
  | 'repl'
  | 'today'
  | 'cal'
  | 'focus'
  | 'model'
  | 'settings'
  | 'friends'
  | 'limits'
  | 'stats'
  | 'help'
  | 'extensions'

export interface ReplState {
  screen: ScreenName
  userData: any | null
  mascotMood: MascotMood
  wingFrame: number
  ctrlCCount: number
  offlineMode: boolean
  focusMinutes: number
}

let state: ReplState = {
  screen: 'repl',
  userData: null,
  mascotMood: 'idle',
  wingFrame: 0,
  ctrlCCount: 0,
  offlineMode: false,
  focusMinutes: 25,
}

const listeners = new Set<(s: ReplState) => void>()

export function getReplState(): ReplState {
  return state
}

export function updateReplState(patch: Partial<ReplState>): ReplState {
  state = { ...state, ...patch }
  listeners.forEach(fn => fn(state))
  return state
}

export function setScreen(screen: ScreenName): void {
  updateReplState({ screen })
}

export function setMascotMood(mascotMood: MascotMood): void {
  updateReplState({ mascotMood })
}

export function subscribeReplState(listener: (s: ReplState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
