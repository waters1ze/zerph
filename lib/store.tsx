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
import { showWebNotification, playAlarmChime, ensurePushSubscribedOnBoot } from './notifications'

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
  autoDeleteMonths: 6,
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
  | { type: 'ADD_TASK'; task: Task; skipSync?: boolean }
  | { type: 'UPDATE_TASK'; id: string; updates: Partial<Task> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'ADD_NOTE'; note: Note; skipSync?: boolean }
  | { type: 'UPDATE_NOTE'; id: string; updates: Partial<Note> }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'ADD_GOAL'; goal: Goal; skipSync?: boolean }
  | { type: 'UPDATE_GOAL'; id: string; updates: Partial<Goal> }
  | { type: 'DELETE_GOAL'; id: string }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'UPDATE_PROJECT'; id: string; updates: Partial<Project> }
  | { type: 'ADD_HABIT'; habit: Habit; skipSync?: boolean }
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
    case 'ADD_TASK': {
      if (state.tasks.some(t => t.id === action.task.id)) {
        return {
          ...state,
          tasks: state.tasks.map(t => t.id === action.task.id ? action.task : t),
        }
      }
      return { ...state, tasks: [action.task, ...state.tasks] }
    }
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
    case 'ADD_NOTE': {
      if (state.notes.some(n => n.id === action.note.id)) {
        return {
          ...state,
          notes: state.notes.map(n => n.id === action.note.id ? action.note : n),
        }
      }
      return { ...state, notes: [action.note, ...state.notes] }
    }
    case 'REPLACE_NOTE':
      return { ...state, notes: state.notes.map(n => n.id === action.tempId ? action.note : n) }
    case 'UPDATE_NOTE':
      return { ...state, notes: state.notes.map(n => n.id === action.id ? { ...n, ...action.updates, updatedAt: new Date().toISOString() } : n) }
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.id), selectedNoteId: null }
    case 'ADD_GOAL': {
      if (state.goals.some(g => g.id === action.goal.id)) {
        return {
          ...state,
          goals: state.goals.map(g => g.id === action.goal.id ? action.goal : g),
        }
      }
      return { ...state, goals: [action.goal, ...state.goals] }
    }
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
    case 'ADD_SCHEDULE_GROUP':
      return { ...state, scheduleGroups: [action.group, ...state.scheduleGroups] }
    case 'UPDATE_SCHEDULE_GROUP':
      return {
        ...state,
        scheduleGroups: state.scheduleGroups.map(g =>
          g.id === action.id ? { ...g, ...action.updates, updatedAt: new Date().toISOString() } : g
        ),
      }
    case 'DELETE_SCHEDULE_GROUP':
      return { ...state, scheduleGroups: state.scheduleGroups.filter(g => g.id !== action.id) }
    case 'SET_SCHEDULE_GROUPS':
      return { ...state, scheduleGroups: action.groups }
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
 * Guarded session handler — does NOT wipe credentials on transient 401 blips
 * to prevent reload loops and flickering on mobile devices.
 */
function forceLogoutOnDeadSession() {
  // Silent no-op for transient errors — preserve user credentials
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
    const savedChatId = localStorage.getItem('zerf_chat_id') || getCookie('zerf_chat_id')
    const savedToken = localStorage.getItem('zerf_auth_token') || getCookie('zerf_auth_token')

    if (savedChatId && !savedChatId.startsWith('guest_')) {
      try {
        if (!localStorage.getItem('zerf_chat_id')) {
          localStorage.setItem('zerf_chat_id', savedChatId)
        }
        if (savedToken && !localStorage.getItem('zerf_auth_token')) {
          localStorage.setItem('zerf_auth_token', savedToken)
        }
      } catch {}
      return savedChatId
    }

    return null
  }
  return null
}

export function getAuthHeaders(): Record<string, string> {
  const chatId = getTgChatId()
  let token = typeof window !== 'undefined' ? (localStorage.getItem('zerf_auth_token') || getCookie('zerf_auth_token')) : null

  // Sync cookie token → localStorage so future requests are consistent
  if (typeof window !== 'undefined' && token && !localStorage.getItem('zerf_auth_token')) {
    try { localStorage.setItem('zerf_auth_token', token) } catch {}
  }

  const initData = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : null
  const vkLaunch = typeof window !== 'undefined' ? localStorage.getItem('zerf_vk_launch') : null

  const headers: Record<string, string> = {}
  if (chatId) headers['x-chat-id'] = chatId
  if (token) headers['x-auth-token'] = token
  if (initData) headers['x-tg-init-data'] = initData
  if (vkLaunch) headers['x-vk-launch'] = vkLaunch
  return headers
}

/**
 * Single source of truth for "is this visitor authenticated?".
 * Returns true if the user has a valid authenticated chatId (Telegram, Google, Email, VK, etc.).
 */
export function isUserAuthenticated(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const chatId = getTgChatId()
    if (!chatId || chatId.startsWith('guest_')) return false
    return true
  } catch {
    return false
  }
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
  const cachedName = typeof window !== 'undefined' ? localStorage.getItem('zerf_user_name') : null
  const cachedPlan = typeof window !== 'undefined' ? localStorage.getItem('zerf_user_plan') : null
  if (cachedName && !mergedSettings.name) {
    mergedSettings.name = cachedName
  }
  if (cachedPlan && mergedSettings.userPlan === 'free') {
    mergedSettings.userPlan = cachedPlan as any
  }

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
      // Persist friend removal server-side so background sync doesn't resurrect them
      fetch(`/api/friends?id=${encodeURIComponent(action.id)}`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'TOGGLE_TASK') {
      const target = stateRef.current.tasks.find(t => t.id === action.id)
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
      if (!action.skipSync) {
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
      }
    } else if (action.type === 'ADD_NOTE') {
      if (!action.skipSync) {
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
      }
    } else if (action.type === 'ADD_GOAL') {
      if (!action.skipSync) {
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
      }
    } else if (action.type === 'ADD_HABIT') {
      if (!action.skipSync) {
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
      }
    } else if (action.type === 'UPDATE_HABIT') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, itemType: 'habit', ...action.updates }),
      }).catch(() => {})
    } else if (action.type === 'ADD_PROJECT') {
      recentlyAddedIdsRef.current.set(action.project.id, Date.now())
      fetch('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify(action.project),
      }).catch(() => {})
    } else if (action.type === 'UPDATE_PROJECT') {
      fetch('/api/projects', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, ...action.updates }),
      }).catch(() => {})
    }
  }, [broadcastSync])

  // Apply visual preset: theme class, accent override, density, radius, text scale
  useEffect(() => {
    applyVisualsToDocument({
      theme: normalizeTheme(state.settings.theme),
      accentId: state.settings.accentColor || 'default',
      textScale: (state.settings.textScale ?? 0) as TextScaleStep,
      density: (state.settings.density ?? 'default') as DensityMode,
      radius: (state.settings.borderRadius ?? 'default') as RadiusMode,
      roundShapes: state.settings.roundShapes !== false,
      customCss: state.settings.customCss,
    })
  }, [state.settings.theme, state.settings.accentColor, state.settings.textScale, state.settings.density, state.settings.borderRadius, state.settings.roundShapes, state.settings.customCss])

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zerf-settings', JSON.stringify(state.settings))
    } catch {}
  }, [state.settings])

  // Persist schedule groups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zerf_schedule_groups', JSON.stringify(state.scheduleGroups))
    } catch {}
  }, [state.scheduleGroups])

  // Persist all workspace state scoped to active user profile with debouncing
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current)

    saveDebounceTimerRef.current = setTimeout(() => {
      try {
        const currentChatId = getTgChatId()
        const filteredTasks = state.tasks.filter(t => !recentlyDeletedIdsRef.current.has(t.id))
        const filteredGoals = state.goals.filter(g => !recentlyDeletedIdsRef.current.has(g.id))
        const filteredNotes = state.notes.filter(n => !recentlyDeletedIdsRef.current.has(n.id))
        const filteredProjects = state.projects.filter(p => !recentlyDeletedIdsRef.current.has(p.id))
        const filteredFriends = state.friends.filter(f => !recentlyDeletedIdsRef.current.has(f.id))
        const filteredHabits = state.habits.filter(h => !recentlyDeletedIdsRef.current.has(h.id))

        const saveFn = () => {
          try {
            localStorage.setItem('zerf_cached_state', JSON.stringify({
              chatId: currentChatId,
              tasks: filteredTasks,
              goals: filteredGoals,
              notes: filteredNotes,
              projects: filteredProjects,
              friends: filteredFriends,
              habits: filteredHabits,
              scheduleGroups: state.scheduleGroups,
              chat: state.chat,
            }))
            if (state.scheduleGroups.length > 0) {
              localStorage.setItem('zerf_schedule_groups', JSON.stringify(state.scheduleGroups))
            }
          } catch {}
        }

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          window.requestIdleCallback(saveFn)
        } else {
          saveFn()
        }

        // Background cloud sync for chat & schedule groups across devices
        if (currentChatId) {
          if (state.chat.length > 1) {
            fetch('/api/tasks', {
              method: 'POST',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ syncType: 'chat', chat: state.chat }),
            }).catch(() => {})
          }
          if (state.scheduleGroups.length > 0) {
            fetch('/api/tasks', {
              method: 'POST',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ syncType: 'schedule_groups', scheduleGroups: state.scheduleGroups }),
            }).catch(() => {})
          }
        }
      } catch {}
    }, 400)

    return () => {
      if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current)
    }
  }, [state.tasks, state.goals, state.notes, state.projects, state.friends, state.habits, state.scheduleGroups, state.chat])

  // Core Sync Function with strict throttling to prevent function invocation burnout
  const syncBackendData = useCallback(async (force = false) => {
    if (syncInFlightRef.current) return
    const now = Date.now()
    if (!force && (now - lastSyncTimeRef.current < 2_000)) {
      return
    }
    lastSyncTimeRef.current = now
    syncInFlightRef.current = true
    if (force) setIsSyncing(true)
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
        signal: AbortSignal.timeout(25000),
      }).catch(err => {
        console.warn('[Zerf Sync Error]:', err)
        return null
      })

      if (res) {
        console.log('[Zerf Sync] /api/tasks response status:', res.status, 'x-chat-id:', headers['x-chat-id'])
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
        console.log('[Zerf Sync] Received tasks count:', data?.tasks?.length, data?.tasks)

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

          const loadStateUpdates: Partial<AppState> = {
            tasks: filteredTasks,
            goals: filteredGoals,
            notes: filteredNotes,
            friends: filteredFriends,
            habits: filteredHabits,
          }
          if (Array.isArray(data.scheduleGroups) && data.scheduleGroups.length > 0) {
            loadStateUpdates.scheduleGroups = data.scheduleGroups
            try { localStorage.setItem('zerf_schedule_groups', JSON.stringify(data.scheduleGroups)) } catch {}
          }
          if (Array.isArray(data.chat) && data.chat.length > 0) {
            loadStateUpdates.chat = data.chat
          }
          if (Array.isArray(data.zerficHistory) && data.zerficHistory.length > 0 && typeof window !== 'undefined') {
            try {
              localStorage.setItem('zerf_live_chat_history', JSON.stringify(data.zerficHistory))
              window.dispatchEvent(new CustomEvent('zerf_live_chat_synced', { detail: data.zerficHistory }))
            } catch {}
          }
          if (Array.isArray(data.installedExtensions) && typeof window !== 'undefined') {
            try {
              localStorage.setItem('zerf_installed_extensions', JSON.stringify(data.installedExtensions))
              if (Array.isArray(data.enabledExtensions)) {
                localStorage.setItem('zerf_enabled_extensions', JSON.stringify(data.enabledExtensions))
              }
              window.dispatchEvent(new CustomEvent('zerf_extensions_updated'))
            } catch {}
          }

          dispatch({
            type: 'LOAD_STATE',
            state: loadStateUpdates,
          })
        }

        // Sync profile, plan, avatar and sidebar configuration across devices
        // Throttled to at most once per 5 seconds unless forced
        const shouldFetchUser = force || (now - lastUserFetchTimeRef.current > 5000)

        if (shouldFetchUser) {
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
                  try { localStorage.setItem('zerf_user_plan', user.plan) } catch {}
                }
                if (user.name && user.name !== 'Пользователь Zerf') {
                  updates.name = user.name
                  try { localStorage.setItem('zerf_user_name', user.name) } catch {}
                }
                if (user.avatarEmoji && typeof window !== 'undefined') {
                  const curAvatar = localStorage.getItem('zerf_avatar_emoji')
                  if (curAvatar !== user.avatarEmoji) {
                    try {
                      localStorage.setItem('zerf_avatar_emoji', user.avatarEmoji)
                      window.dispatchEvent(new CustomEvent('zerf_avatar_changed', { detail: user.avatarEmoji }))
                    } catch {}
                  }
                }
                if (user.chatId && typeof window !== 'undefined' && !localStorage.getItem('zerf_chat_id')) {
                  try { localStorage.setItem('zerf_chat_id', String(user.chatId)) } catch {}
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
                if (user.autoDeleteMonths !== undefined) {
                  updates.autoDeleteMonths = Number(user.autoDeleteMonths)
                }
                if (user.sidebarConfig && typeof window !== 'undefined') {
                  try {
                    localStorage.setItem('zerf_sidebar_config_v2', JSON.stringify(user.sidebarConfig))
                    localStorage.setItem('zerf_sidebar_config', JSON.stringify(user.sidebarConfig))
                    window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed', { detail: user.sidebarConfig }))
                  } catch {}
                }
                if (Object.keys(updates).length > 0) {
                  dispatch({ type: 'UPDATE_SETTINGS', updates })
                }
              }
            })
            .catch(() => {})
        }
      }
    } catch {} finally {
      syncInFlightRef.current = false
      if (force) {
        setTimeout(() => setIsSyncing(false), 400)
      }
    }
  }, [])

  // Event-driven real-time updates via Server-Sent Events (SSE) + Lifecycle events
  useEffect(() => {
    // Initial sync
    syncBackendData(false)

    // Window and mobile lifecycle events
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

    // Background sync of Web Push subscription if permission is active
    ensurePushSubscribedOnBoot()

    // Cross-instance broadcast channel
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel('zerf_sync_channel')
      channel.onmessage = (e) => {
        if (e.data === 'sync') syncBackendData(false)
      }
    } catch {}

    // ── Real-Time SSE (Server-Sent Events) Stream (Zero Polling) ──
    let eventSource: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const connectSse = () => {
      try {
        const chatId = getTgChatId()
        if (!chatId) return

        // Auth via ?token= since EventSource cannot send custom headers
        let authToken = ''
        try {
          authToken = localStorage.getItem('zerf_auth_token') || document.cookie.match(/(?:^|; )zerf_auth_token=([^;]*)/)?.[1] || ''
          if (authToken) authToken = decodeURIComponent(authToken)
        } catch {}
        const sseUrl = `/api/events?chatId=${encodeURIComponent(chatId)}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`
        eventSource = new EventSource(sseUrl)

        eventSource.addEventListener('sync', () => {
          syncBackendData(true)
        })

        eventSource.addEventListener('task_update', () => {
          syncBackendData(true)
        })

        eventSource.addEventListener('task_created', () => {
          syncBackendData(true)
        })

        eventSource.addEventListener('task_deleted', () => {
          syncBackendData(true)
        })

        eventSource.addEventListener('ai_models_updated', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            if (data.models && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('zerf_ai_models_updated', { detail: data.models }))
            }
          } catch {}
        })

        eventSource.addEventListener('sidebar_config_changed', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            if (data.sidebarConfig && typeof window !== 'undefined') {
              localStorage.setItem('zerf_sidebar_config_v2', JSON.stringify(data.sidebarConfig))
              localStorage.setItem('zerf_sidebar_config', JSON.stringify(data.sidebarConfig))
              window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed', { detail: data.sidebarConfig }))
            }
          } catch {}
        })

        eventSource.addEventListener('reminder', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            showWebNotification(data.title || '⏰ Напоминание', {
              body: data.dueTime ? `Срок: ${data.dueTime}` : 'Время выполнить задачу!',
              tag: `rem-${data.taskId}`,
            })
          } catch {}
        })

        eventSource.onerror = () => {
          eventSource?.close()
          eventSource = null
          // Reconnect with backoff
          reconnectTimeout = setTimeout(connectSse, 10000)
        }
      } catch {}
    }

    connectSse()

    // 15s Background Live Sync Interval (Ensures phone and PC sync even if SSE is sleeping on mobile)
    const liveSyncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncBackendData(false)
      }
    }, 15000)

    return () => {
      window.removeEventListener('focus', handleSyncNow)
      window.removeEventListener('pageshow', handleSyncNow)
      window.removeEventListener('online', handleSyncNow)
      window.removeEventListener('zerf:sync', handleSyncWithSpinner)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(liveSyncInterval)
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      try { eventSource?.close() } catch {}
      try { channel?.close() } catch {}
    }
  }, [syncBackendData])

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
