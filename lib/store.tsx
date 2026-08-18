'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from 'react'
import type {
  Task, Goal, Project, Note, Friend, ChatMessage,
  UserSettings, View, Priority, TaskStatus, GoalStatus, Habit, ScheduleGroup
} from './types'
import {
  applyVisualsToDocument, normalizeTheme, accentPaletteFor,
  type TextScaleStep, type DensityMode, type RadiusMode,
} from './theme-presets'

// ─── Seed Data ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)

const SEED_TASKS: Task[] = []
const SEED_GOALS: Goal[] = []
const SEED_PROJECTS: Project[] = []
const SEED_NOTES: Note[] = []
const SEED_FRIENDS: Friend[] = []
const SEED_HABITS: Habit[] = []

const SEED_CHAT: ChatMessage[] = [
  {
    id: 'c1', role: 'assistant',
    content: 'Привет! Я твой ассистент Zerf Note. Помогу расставить задачи, записать заметки, спланировать день и ответить на любые вопросы. Чем займёмся сегодня?',
    createdAt: today + 'T08:00:00Z',
  },
]

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'strict',
  name: '',
  email: '',
  avatar: '',
  accentColor: 'default',
  textScale: 0,
  density: 'default',
  borderRadius: 'default',
  roundShapes: true,
  notifications: { desktop: true, web: true, telegram: true, vk: true, email: false, dueReminders: true, teamUpdates: true, reminderIntervalMinutes: 5, reminderRepeatCount: 3 },
  integrations: { telegram: false, aiApiKey: '', aiModel: 'openai/gpt-oss-120b', groqApiKey: '', telegramBotToken: '' },
  weekStartsOn: 1,
  focusModeEnabled: false,
  userPlan: 'free',
  focusSettings: { defaultDurationMinutes: 25, breakDurationMinutes: 5 },
  eveningReview: { enabled: true, time: '21:00' },
  voiceSettings: { ttsResponseEnabled: false },
}

// ─── State & Actions ──────────────────────────────────────────────────────────
interface AppState {
  tasks: Task[]
  goals: Goal[]
  projects: Project[]
  notes: Note[]
  friends: Friend[]
  habits: Habit[]
  scheduleGroups: ScheduleGroup[]
  chat: ChatMessage[]
  settings: UserSettings
  currentView: View
  selectedTaskId: string | null
  selectedNoteId: string | null
  selectedGoalId: string | null
  isChatOpen: boolean
  isDetailOpen: boolean
  searchQuery: string
  isLoading: boolean
}

type Action =
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SELECT_TASK'; id: string | null }
  | { type: 'SELECT_NOTE'; id: string | null }
  | { type: 'SELECT_GOAL'; id: string | null }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'TOGGLE_DETAIL'; open?: boolean }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; id: string; updates: Partial<Task> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'ADD_NOTE'; note: Note }
  | { type: 'UPDATE_NOTE'; id: string; updates: Partial<Note> }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'ADD_GOAL'; goal: Goal }
  | { type: 'UPDATE_GOAL'; id: string; updates: Partial<Goal> }
  | { type: 'DELETE_GOAL'; id: string }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'UPDATE_PROJECT'; id: string; updates: Partial<Project> }
  | { type: 'ADD_HABIT'; habit: Habit }
  | { type: 'UPDATE_HABIT'; id: string; updates: Partial<Habit> }
  | { type: 'REPLACE_TASK'; tempId: string; task: Task }
  | { type: 'REPLACE_NOTE'; tempId: string; note: Note }
  | { type: 'REPLACE_GOAL'; tempId: string; goal: Goal }
  | { type: 'REPLACE_HABIT'; tempId: string; habit: Habit }
  | { type: 'DELETE_HABIT'; id: string }
  | { type: 'ADD_SCHEDULE_GROUP'; group: ScheduleGroup }
  | { type: 'UPDATE_SCHEDULE_GROUP'; id: string; updates: Partial<ScheduleGroup> }
  | { type: 'DELETE_SCHEDULE_GROUP'; id: string }
  | { type: 'SET_SCHEDULE_GROUPS'; groups: ScheduleGroup[] }
  | { type: 'ADD_CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'UPDATE_SETTINGS'; updates: Partial<UserSettings> }
  | { type: 'ADD_FRIEND'; friend: Friend }
  | { type: 'REMOVE_FRIEND'; id: string }
  | { type: 'LOAD_STATE'; state: Partial<AppState> }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('zerf_current_view', action.view) } catch {}
      }
      return { ...state, currentView: action.view, selectedTaskId: null, isDetailOpen: false }
    case 'SELECT_TASK':
      return { ...state, selectedTaskId: action.id, isDetailOpen: action.id !== null }
    case 'SELECT_NOTE':
      return { ...state, selectedNoteId: action.id }
    case 'SELECT_GOAL':
      return { ...state, selectedGoalId: action.id }
    case 'TOGGLE_CHAT':
      return { ...state, isChatOpen: !state.isChatOpen }
    case 'TOGGLE_DETAIL':
      return { ...state, isDetailOpen: action.open ?? !state.isDetailOpen }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query }
    case 'TOGGLE_TASK': {
      const now = new Date().toISOString()
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.id
            ? {
                ...t,
                status: t.status === 'done' ? 'todo' : 'done',
                completedAt: t.status !== 'done' ? now : undefined,
                updatedAt: now,
              }
            : t
        ),
      }
    }
    case 'ADD_TASK':
      return { ...state, tasks: [action.task, ...state.tasks] }
    case 'REPLACE_TASK':
      // Replace temp optimistic task with real DB record (different id)
      return { ...state, tasks: state.tasks.map(t => t.id === action.tempId ? action.task : t) }
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.id ? { ...t, ...action.updates, updatedAt: new Date().toISOString() } : t
        ),
      }
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.id), selectedTaskId: null, isDetailOpen: false }
    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes] }
    case 'REPLACE_NOTE':
      return { ...state, notes: state.notes.map(n => n.id === action.tempId ? action.note : n) }
    case 'UPDATE_NOTE':
      return { ...state, notes: state.notes.map(n => n.id === action.id ? { ...n, ...action.updates, updatedAt: new Date().toISOString() } : n) }
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.id), selectedNoteId: null }
    case 'ADD_GOAL':
      return { ...state, goals: [action.goal, ...state.goals] }
    case 'REPLACE_GOAL':
      return { ...state, goals: state.goals.map(g => g.id === action.tempId ? action.goal : g) }
    case 'UPDATE_GOAL':
      return { ...state, goals: state.goals.map(g => g.id === action.id ? { ...g, ...action.updates, updatedAt: new Date().toISOString() } : g) }
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter(g => g.id !== action.id), selectedGoalId: null }
    case 'ADD_PROJECT':
      return { ...state, projects: [action.project, ...state.projects] }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.id ? { ...p, ...action.updates, updatedAt: new Date().toISOString() } : p) }
    case 'ADD_HABIT':
      return { ...state, habits: [action.habit, ...state.habits] }
    case 'UPDATE_HABIT':
      return { ...state, habits: state.habits.map(h => h.id === action.id ? { ...h, ...action.updates, updatedAt: new Date().toISOString() } : h) }
    case 'REPLACE_HABIT':
      // Replace temp optimistic habit with real DB record (different id)
      return { ...state, habits: state.habits.map(h => h.id === action.tempId ? action.habit : h) }
    case 'DELETE_HABIT':
      return { ...state, habits: state.habits.filter(h => h.id !== action.id) }
    case 'ADD_SCHEDULE_GROUP': {
      const nextGroups = [action.group, ...state.scheduleGroups]
      try { localStorage.setItem('zerf_schedule_groups', JSON.stringify(nextGroups)) } catch {}
      return { ...state, scheduleGroups: nextGroups }
    }
    case 'UPDATE_SCHEDULE_GROUP': {
      const nextGroups = state.scheduleGroups.map(g =>
        g.id === action.id ? { ...g, ...action.updates, updatedAt: new Date().toISOString() } : g
      )
      try { localStorage.setItem('zerf_schedule_groups', JSON.stringify(nextGroups)) } catch {}
      return { ...state, scheduleGroups: nextGroups }
    }
    case 'DELETE_SCHEDULE_GROUP': {
      const nextGroups = state.scheduleGroups.filter(g => g.id !== action.id)
      try { localStorage.setItem('zerf_schedule_groups', JSON.stringify(nextGroups)) } catch {}
      return { ...state, scheduleGroups: nextGroups }
    }
    case 'SET_SCHEDULE_GROUPS': {
      try { localStorage.setItem('zerf_schedule_groups', JSON.stringify(action.groups)) } catch {}
      return { ...state, scheduleGroups: action.groups }
    }
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chat: [...state.chat, action.message] }
    case 'UPDATE_SETTINGS': {
      const newSettings = { ...state.settings, ...action.updates }
      return { ...state, settings: newSettings }
    }
    case 'ADD_FRIEND':
      return { ...state, friends: [...state.friends, action.friend] }
    case 'REMOVE_FRIEND':
      return { ...state, friends: state.friends.filter(f => f.id !== action.id) }
    case 'LOAD_STATE':
      return { ...state, ...action.state }
    default:
      return state
  }
}

const INITIAL_STATE: AppState = {
  tasks: SEED_TASKS,
  goals: SEED_GOALS,
  projects: SEED_PROJECTS,
  notes: SEED_NOTES,
  friends: SEED_FRIENDS,
  habits: SEED_HABITS,
  scheduleGroups: [],
  chat: SEED_CHAT,
  settings: DEFAULT_SETTINGS,
  currentView: 'today',
  selectedTaskId: null,
  selectedNoteId: null,
  selectedGoalId: null,
  isChatOpen: false,
  isDetailOpen: false,
  searchQuery: '',
  isLoading: false,
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<Action>
  syncData: () => Promise<void>
  isSyncing: boolean
} | null>(null)

function setPermanentCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  const date = new Date()
  date.setTime(date.getTime() + 10 * 365 * 24 * 60 * 60 * 1000) // 10 years
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const cookies = document.cookie.split(';')
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim()
    if (c.indexOf(prefix) === 0) {
      return decodeURIComponent(c.substring(prefix.length))
    }
  }
  return null
}


/**
 * Drop stale credentials after a 401 (e.g. the session DB was switched or the
 * session was revoked) so the login screen appears instead of a dead UI.
 * Guarded to run once per browser session to prevent reload loops.
 */
function forceLogoutOnDeadSession() {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem('zerf_force_logout_done')) return
    sessionStorage.setItem('zerf_force_logout_done', '1')
    localStorage.removeItem('zerf_auth_token')
    localStorage.removeItem('zerf_chat_id')
    localStorage.removeItem('zerf_vk_launch')
    localStorage.removeItem('zerf_cached_state')
    document.cookie = 'zerf_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'zerf_chat_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    window.location.replace('/')
  } catch {}
}

export function getTgChatId(): string | null {
  if (typeof window !== 'undefined') {
    // 1. HIGHEST PRIORITY: Telegram WebApp context (cryptographically signed by Telegram servers)
    const u = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } })?.Telegram?.WebApp?.initDataUnsafe?.user
    if (u?.id) {
      const tgId = String(u.id)
      try {
        localStorage.setItem('zerf_chat_id', tgId)
        setPermanentCookie('zerf_chat_id', tgId)
      } catch {}
      return tgId
    }

    const urlParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

    // 2. Direct Auth Params from /login or notification link (?chat_id=... or ?chatId=...)
    const paramChatId = urlParams.get('chat_id') || urlParams.get('chatId')
    const paramAuthToken = urlParams.get('auth_token') || urlParams.get('token')
    if (paramChatId && /^\d+$/.test(paramChatId.trim())) {
      const cleanId = paramChatId.trim()
      try {
        localStorage.setItem('zerf_chat_id', cleanId)
        setPermanentCookie('zerf_chat_id', cleanId)
        if (paramAuthToken) {
          localStorage.setItem('zerf_auth_token', paramAuthToken)
          setPermanentCookie('zerf_auth_token', paramAuthToken)
        }
      } catch {}
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
      return cleanId
    }

    // 3. VK Mini App launch context — only together with VK's cryptographic
    //    sign, which the server verifies via VK_APP_SECRET.
    const vkUserId = urlParams.get('vk_user_id') || hashParams.get('vk_user_id')
    if (vkUserId && /^\d+$/.test(vkUserId)) {
      const hasSign = Boolean(urlParams.get('sign') || hashParams.get('sign'))
      if (hasSign) {
        const vkId = String(vkUserId)
        const vkLaunch = [
          ...Array.from(urlParams.entries()),
          ...Array.from(hashParams.entries()),
        ]
          .filter(([k]) => k.startsWith('vk_'))
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
        try {
          localStorage.setItem('zerf_chat_id', vkId)
          localStorage.setItem('zerf_vk_launch', vkLaunch)
          setPermanentCookie('zerf_chat_id', vkId)
        } catch {}
        return vkId
      }
      return null
    }

    // 5. One-time login token from bot (/login command) — verified server-side and consumed
    const loginToken = urlParams.get('login_token')
    if (loginToken) {
      // Immediately clean URL so token can't be copied/forwarded
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
      // Verify + consume one-time token server-side
      fetch(`/api/auth/login-token?token=${loginToken}`)
        .then(r => r.json())
        .then(data => {
          if (data.valid && data.chatId) {
            const chatId = String(data.chatId)
            try {
              localStorage.setItem('zerf_chat_id', chatId)
              localStorage.removeItem('zerf_cached_state')
              setPermanentCookie('zerf_chat_id', chatId)
              if (data.sessionToken) {
                localStorage.setItem('zerf_auth_token', data.sessionToken)
                setPermanentCookie('zerf_auth_token', data.sessionToken)
              }
            } catch {}
            window.location.replace('/')
          }
        })
        .catch(() => {})
    }

    // Always strip any query params from address bar immediately to prevent accidental link forwarding
    if (window.location.search && window.history && window.history.replaceState) {
      try {
        const cleanUrl = window.location.pathname + (window.location.hash || '')
        window.history.replaceState({}, document.title, cleanUrl)
      } catch {}
    }

    // 6. Saved authenticated session on this device (check both localStorage and permanent cookie for PWA)
    let savedChatId = localStorage.getItem('zerf_chat_id') || getCookie('zerf_chat_id')
    let savedToken = localStorage.getItem('zerf_auth_token') || getCookie('zerf_auth_token')

    if (savedChatId) {
      return savedChatId
    }

    return null
  }
  return null
}

export function getAuthHeaders(): Record<string, string> {
  const chatId = getTgChatId()
  const token = typeof window !== 'undefined' ? (localStorage.getItem('zerf_auth_token') || getCookie('zerf_auth_token')) : null
  const initData = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : null
  const vkLaunch = typeof window !== 'undefined' ? localStorage.getItem('zerf_vk_launch') : null

  const headers: Record<string, string> = {}
  if (chatId) headers['x-chat-id'] = chatId
  if (token) headers['x-auth-token'] = token
  if (initData) headers['x-tg-init-data'] = initData
  if (vkLaunch) headers['x-vk-launch'] = vkLaunch
  return headers
}

function initAppState(initialState: AppState): AppState {
  if (typeof window === 'undefined') return initialState
  const currentChatId = getTgChatId()
  let savedSettings = {}
  let savedView: View | null = null
  let cachedData: any = {}

  try {
    const cachedStateStr = localStorage.getItem('zerf_cached_state')
    if (cachedStateStr) {
      const parsed = JSON.parse(cachedStateStr)
      // Strictly verify that the cached tasks belong to the active user profile!
      if (parsed.chatId && parsed.chatId === currentChatId) {
        cachedData = parsed
      } else {
        localStorage.removeItem('zerf_cached_state')
      }
    }
  } catch {}

  try {
    const saved = localStorage.getItem('zerf-settings')
    if (saved) savedSettings = JSON.parse(saved)
  } catch {}

  try {
    const viewStr = localStorage.getItem('zerf_current_view') as View | null
    if (viewStr) savedView = viewStr
  } catch {}

  let savedScheduleGroups: ScheduleGroup[] = []
  try {
    const rawGroups = localStorage.getItem('zerf_schedule_groups')
    if (rawGroups) {
      savedScheduleGroups = JSON.parse(rawGroups)
    }
  } catch {}

  // Normalize legacy visual settings (light/dark/system themes, old hex accents)
  const mergedSettings: UserSettings = { ...initialState.settings, ...savedSettings }
  const theme = normalizeTheme(mergedSettings.theme)
  const accentKnown =
    mergedSettings.accentColor === 'default' ||
    accentPaletteFor(theme).some(a => a.id === mergedSettings.accentColor)
  mergedSettings.theme = theme
  if (!accentKnown) mergedSettings.accentColor = 'default'
  mergedSettings.textScale = ([-1, 0, 1, 2, 3] as const).includes(mergedSettings.textScale as any)
    ? (mergedSettings.textScale as TextScaleStep)
    : 0
  if (!['compact', 'default', 'comfortable'].includes(String(mergedSettings.density))) {
    mergedSettings.density = 'default'
  }
  if (!['sharp', 'default', 'rounded'].includes(String(mergedSettings.borderRadius))) {
    mergedSettings.borderRadius = 'default'
  }
  if (typeof mergedSettings.roundShapes !== 'boolean') mergedSettings.roundShapes = true

  return {
    ...initialState,
    tasks: Array.isArray(cachedData.tasks) ? cachedData.tasks : [],
    goals: Array.isArray(cachedData.goals) ? cachedData.goals : [],
    notes: Array.isArray(cachedData.notes) ? cachedData.notes : [],
    projects: Array.isArray(cachedData.projects) ? cachedData.projects : [],
    friends: Array.isArray(cachedData.friends) ? cachedData.friends : [],
    habits: Array.isArray(cachedData.habits) ? cachedData.habits : [],
    scheduleGroups: savedScheduleGroups.length > 0 ? savedScheduleGroups : [],
    settings: mergedSettings,
    ...(savedView ? { currentView: savedView } : {})
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, initAppState)
  const [isSyncing, setIsSyncing] = useState(false)
  // Track recently deleted item IDs to prevent race-condition resurrection during background sync
  const recentlyDeletedIdsRef = useRef<Map<string, number>>(new Map())
  // Track freshly created optimistic IDs so a racing background sync doesn't wipe them
  // before the server POST completes (same 60s window as deletions)
  const recentlyAddedIdsRef = useRef<Map<string, number>>(new Map())
  // Consecutive 401 strikes from the sync endpoint — logout only fires on the
  // second strike so a single transient/racing 401 can't log the user out
  const deadSessionStrikesRef = useRef(0)
  // Prevents overlapping sync requests from piling up on a slow backend
  const syncInFlightRef = useRef(false)
  const lastSyncTimeRef = useRef<number>(0)
  const lastUserFetchTimeRef = useRef<number>(0)

  // Latest-state ref for background sync (avoids stale closures / callback churn)
  const stateRef = useRef(state)
  stateRef.current = state

  const broadcastSync = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const bc = new BroadcastChannel('zerf_sync_channel')
      bc.postMessage('sync')
      bc.close()
    } catch {}
  }, [])

  const enhancedDispatch: React.Dispatch<Action> = useCallback((action: Action) => {
    // Perform state change locally immediately
    dispatch(action)
    broadcastSync()

    // Sync deletion / updates to cloud DB via API
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }

    if (action.type === 'DELETE_TASK') {
      recentlyDeletedIdsRef.current.set(action.id, Date.now())
      fetch(`/api/tasks?id=${action.id}&type=task`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'DELETE_NOTE') {
      recentlyDeletedIdsRef.current.set(action.id, Date.now())
      fetch(`/api/tasks?id=${action.id}&type=note`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'DELETE_GOAL') {
      recentlyDeletedIdsRef.current.set(action.id, Date.now())
      fetch(`/api/tasks?id=${action.id}&type=goal`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'DELETE_HABIT') {
      recentlyDeletedIdsRef.current.set(action.id, Date.now())
      fetch(`/api/tasks?id=${action.id}&type=habit`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'REMOVE_FRIEND') {
      recentlyDeletedIdsRef.current.set(action.id, Date.now())
    } else if (action.type === 'TOGGLE_TASK') {
      const target = state.tasks.find(t => t.id === action.id)
      const nextStatus = target ? (target.status === 'done' ? 'todo' : 'done') : 'done'
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, status: nextStatus }),
      }).catch(() => {})
    } else if (action.type === 'UPDATE_TASK') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, ...action.updates }),
      }).catch(() => {})
    } else if (action.type === 'UPDATE_NOTE') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, itemType: 'note', ...action.updates }),
      }).catch(() => {})
    } else if (action.type === 'UPDATE_GOAL') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, itemType: 'goal', ...action.updates }),
      }).catch(() => {})
    } else if (action.type === 'ADD_TASK') {
      recentlyAddedIdsRef.current.set(action.task.id, Date.now())
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(action.task),
      })
        .then(async r => {
          const data = await r.json().catch(() => null)
          if (r.ok && data?.task?.id) {
            dispatch({ type: 'REPLACE_TASK', tempId: action.task.id, task: data.task })
          } else if (!r.ok) {
            dispatch({ type: 'DELETE_TASK', id: action.task.id })
          }
        })
        .catch(() => {})
    } else if (action.type === 'ADD_NOTE') {
      recentlyAddedIdsRef.current.set(action.note.id, Date.now())
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...action.note, itemType: 'note' }),
      })
        .then(async r => {
          const data = await r.json().catch(() => null)
          if (r.ok && data?.note?.id) {
            dispatch({ type: 'REPLACE_NOTE', tempId: action.note.id, note: data.note })
          } else if (!r.ok) {
            dispatch({ type: 'DELETE_NOTE', id: action.note.id })
          }
        })
        .catch(() => {})
    } else if (action.type === 'ADD_GOAL') {
      recentlyAddedIdsRef.current.set(action.goal.id, Date.now())
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...action.goal, itemType: 'goal' }),
      })
        .then(async r => {
          const data = await r.json().catch(() => null)
          if (r.ok && data?.goal?.id) {
            dispatch({ type: 'REPLACE_GOAL', tempId: action.goal.id, goal: data.goal })
          } else if (!r.ok) {
            dispatch({ type: 'DELETE_GOAL', id: action.goal.id })
          }
        })
        .catch(() => {})
    } else if (action.type === 'ADD_HABIT') {
      recentlyAddedIdsRef.current.set(action.habit.id, Date.now())
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...action.habit, itemType: 'habit' }),
      })
        .then(async r => {
          const data = await r.json().catch(() => null)
          if (r.ok && data?.habit?.id) {
            dispatch({ type: 'REPLACE_HABIT', tempId: action.habit.id, habit: data.habit })
          } else if (!r.ok) {
            dispatch({ type: 'DELETE_HABIT', id: action.habit.id })
          }
        })
        .catch(() => {})
    } else if (action.type === 'UPDATE_HABIT') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, itemType: 'habit', ...action.updates }),
      }).catch(() => {})
    }
  }, [state.tasks, broadcastSync])

  // Apply visual preset: theme class, accent override, density, radius, text scale
  useEffect(() => {
    applyVisualsToDocument({
      theme: normalizeTheme(state.settings.theme),
      accentId: state.settings.accentColor || 'default',
      textScale: (state.settings.textScale ?? 0) as TextScaleStep,
      density: (state.settings.density ?? 'default') as DensityMode,
      radius: (state.settings.borderRadius ?? 'default') as RadiusMode,
      roundShapes: state.settings.roundShapes !== false,
    })
  }, [state.settings.theme, state.settings.accentColor, state.settings.textScale, state.settings.density, state.settings.borderRadius, state.settings.roundShapes])

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zerf-settings', JSON.stringify(state.settings))
    } catch {}
  }, [state.settings])

  // Persist all workspace state scoped to active user profile
  useEffect(() => {
    try {
      const currentChatId = getTgChatId()
      const filteredTasks = state.tasks.filter(t => !recentlyDeletedIdsRef.current.has(t.id))
      const filteredGoals = state.goals.filter(g => !recentlyDeletedIdsRef.current.has(g.id))
      const filteredNotes = state.notes.filter(n => !recentlyDeletedIdsRef.current.has(n.id))
      const filteredProjects = state.projects.filter(p => !recentlyDeletedIdsRef.current.has(p.id))
      const filteredFriends = state.friends.filter(f => !recentlyDeletedIdsRef.current.has(f.id))
      const filteredHabits = state.habits.filter(h => !recentlyDeletedIdsRef.current.has(h.id))

      localStorage.setItem('zerf_cached_state', JSON.stringify({
        chatId: currentChatId,
        tasks: filteredTasks,
        goals: filteredGoals,
        notes: filteredNotes,
        projects: filteredProjects,
        friends: filteredFriends,
        habits: filteredHabits,
      }))
    } catch {}
  }, [state.tasks, state.goals, state.notes, state.projects, state.friends, state.habits])

  // Core Sync Function with strict throttling to prevent function invocation burnout
  const syncBackendData = useCallback(async (showIndicator = false) => {
    if (syncInFlightRef.current) return
    const now = Date.now()
    // Throttle automatic background sync to at most once per 25 seconds unless explicitly requested by user action
    if (!showIndicator && (now - lastSyncTimeRef.current < 25_000)) {
      return
    }
    lastSyncTimeRef.current = now
    syncInFlightRef.current = true
    if (showIndicator) setIsSyncing(true)
    try {
      const headers = getAuthHeaders()
      const chatId = headers['x-chat-id']

      // Purge deleted/added IDs older than 60 seconds
      for (const [id, timestamp] of recentlyDeletedIdsRef.current.entries()) {
        if (now - timestamp > 60000) {
          recentlyDeletedIdsRef.current.delete(id)
        }
      }
      for (const [id, timestamp] of recentlyAddedIdsRef.current.entries()) {
        if (now - timestamp > 60000) {
          recentlyAddedIdsRef.current.delete(id)
        }
      }

      const res = await fetch('/api/tasks', {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }).catch(() => null)

      if (res) {
        if (res.status === 401 && (headers['x-auth-token'] || headers['x-tg-init-data'] || headers['x-vk-launch'])) {
          deadSessionStrikesRef.current += 1
          if (deadSessionStrikesRef.current >= 2) {
            forceLogoutOnDeadSession()
          }
          return
        }
        if (res.ok) {
          deadSessionStrikesRef.current = 0
        }
        if (!res.ok) return
        const data = await res.json()

        if (data && data.tasks !== undefined) {
          if (data._dbOffline && (!data.tasks || data.tasks.length === 0)) {
            return
          }

          const keepFresh = <T extends { id: string }>(serverList: T[], localList: T[]): T[] => {
            const fresh = localList.filter(
              l => recentlyAddedIdsRef.current.has(l.id) && !serverList.some(srv => srv.id === l.id)
            )
            return [...serverList, ...fresh]
          }
          const filteredTasks = keepFresh(data.tasks || [], stateRef.current.tasks).filter((t: Task) => !recentlyDeletedIdsRef.current.has(t.id))
          const filteredGoals = keepFresh(data.goals || [], stateRef.current.goals).filter((g: Goal) => !recentlyDeletedIdsRef.current.has(g.id))
          const filteredNotes = keepFresh(data.notes || [], stateRef.current.notes).filter((n: Note) => !recentlyDeletedIdsRef.current.has(n.id))
          const filteredFriends = (data.friends || []).filter((f: Friend) => !recentlyDeletedIdsRef.current.has(f.id))
          const filteredHabits = keepFresh(data.habits || [], stateRef.current.habits).filter((h: Habit) => !recentlyDeletedIdsRef.current.has(h.id))

          dispatch({
            type: 'LOAD_STATE',
            state: {
              tasks: filteredTasks,
              goals: filteredGoals,
              notes: filteredNotes,
              friends: filteredFriends,
              habits: filteredHabits,
            },
          })
        }

        // Throttle profile and birthdays fetch to at most once per 2 minutes
        if (showIndicator || (now - lastUserFetchTimeRef.current > 120_000)) {
          lastUserFetchTimeRef.current = now
          const userUrl = chatId ? `/api/telegram/user?chatId=${chatId}` : '/api/telegram/user'
          fetch(userUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
            .then(r => r.json())
            .then(user => {
              if (user.connected) {
                const curSettings = stateRef.current.settings
                const updates: Partial<UserSettings> = {}
                if (user.plan && user.plan !== curSettings.userPlan) {
                  updates.userPlan = user.plan
                }
                if (user.name && user.name !== 'Kirill Perekatnov' && user.name !== 'Пользователь Zerf' && (!curSettings.name || curSettings.name === 'Kirill Perekatnov')) {
                  updates.name = user.name
                }
                if (user.reminderIntervalMinutes !== undefined || user.reminderRepeatCount !== undefined) {
                  updates.notifications = {
                    ...curSettings.notifications,
                    reminderIntervalMinutes: user.reminderIntervalMinutes ?? curSettings.notifications.reminderIntervalMinutes ?? 5,
                    reminderRepeatCount: user.reminderRepeatCount ?? curSettings.notifications.reminderRepeatCount ?? 3,
                  }
                }
                if (user.ttsEnabled !== undefined) {
                  updates.voiceSettings = {
                    ...curSettings.voiceSettings,
                    ttsResponseEnabled: Boolean(user.ttsEnabled)
                  }
                }
                if (Object.keys(updates).length > 0) {
                  dispatch({ type: 'UPDATE_SETTINGS', updates })
                }
              }
            })
            .catch(() => {})

          if (chatId) {
            fetch(`/api/birthdays?chatId=${chatId}`, { headers, signal: AbortSignal.timeout(15000) }).catch(() => {})
          }
        }
      }
    } catch {} finally {
      syncInFlightRef.current = false
      if (showIndicator) {
        setTimeout(() => setIsSyncing(false), 400)
      }
    }
  }, [])

  // Sync from backend DB on mount, focus, visibility change, pageshow, and throttled live interval
  useEffect(() => {
    // Initial sync
    syncBackendData(false)

    // Window and mobile lifecycle events (e.g. returning to app from home screen or other apps)
    const handleSyncNow = () => syncBackendData(false)
    const handleSyncWithSpinner = () => syncBackendData(true)

    window.addEventListener('focus', handleSyncNow)
    window.addEventListener('pageshow', handleSyncNow)
    window.addEventListener('online', handleSyncNow)
    window.addEventListener('zerf:sync', handleSyncWithSpinner)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncBackendData(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Cross-instance broadcast channel
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel('zerf_sync_channel')
      channel.onmessage = (e) => {
        if (e.data === 'sync') syncBackendData(false)
      }
    } catch {}

    // Background fallback sync (every 15 minutes). Primary sync is event-driven (focus, visibility, actions)
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncBackendData(false)
      }
    }, 15 * 60 * 1000)

    // Hydrate currentView safely on client mount
    try {
      const savedView = localStorage.getItem('zerf_current_view') as View | null
      if (savedView && savedView !== state.currentView) {
        dispatch({ type: 'SET_VIEW', view: savedView })
      }
    } catch {}

    return () => {
      window.removeEventListener('focus', handleSyncNow)
      window.removeEventListener('pageshow', handleSyncNow)
      window.removeEventListener('online', handleSyncNow)
      window.removeEventListener('zerf:sync', handleSyncWithSpinner)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(syncInterval)
      try { channel?.close() } catch {}
    }
  }, [syncBackendData, state.currentView])

  return (
    <AppContext.Provider value={{ state, dispatch: enhancedDispatch, syncData: () => syncBackendData(true), isSyncing }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

export function useSettings() {
  const { state, dispatch } = useApp()
  const update = useCallback((updates: Partial<UserSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', updates })
  }, [dispatch])
  return { settings: state.settings, update }
}
