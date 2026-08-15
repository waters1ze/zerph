'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import type {
  Task, Goal, Project, Note, Friend, ChatMessage,
  UserSettings, View, Priority, TaskStatus, GoalStatus, Habit
} from './types'

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
    content: 'Hello! I\'m your Zerf AI assistant. I can help you manage tasks, summarize notes, create plans, and answer questions about your projects. What would you like to do today?',
    createdAt: today + 'T08:00:00Z',
  },
]

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  name: '',
  email: '',
  avatar: '',
  accentColor: '#2d7a4f',
  notifications: { desktop: true, email: false, dueReminders: true, teamUpdates: true, reminderIntervalMinutes: 5, reminderRepeatCount: 3 },
  integrations: { telegram: false, aiApiKey: '', aiModel: 'llama-3.3-70b-versatile', groqApiKey: '', telegramBotToken: '' },
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
  | { type: 'REPLACE_HABIT'; tempId: string; habit: Habit }
  | { type: 'DELETE_HABIT'; id: string }
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
    case 'UPDATE_NOTE':
      return { ...state, notes: state.notes.map(n => n.id === action.id ? { ...n, ...action.updates, updatedAt: new Date().toISOString() } : n) }
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.id), selectedNoteId: null }
    case 'ADD_GOAL':
      return { ...state, goals: [action.goal, ...state.goals] }
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
const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null)

function setPermanentCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  const date = new Date()
  date.setTime(date.getTime() + 10 * 365 * 24 * 60 * 60 * 1000) // 10 years
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[]\/+^])/g, '\\$1') + '=([^;]*)'))
  return matches ? decodeURIComponent(matches[1]) : null
}

const ROOT_ADMIN_IDS_LIST = ['6136950061', '5078516086']

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

    // 2. VK Mini App launch context (vk_user_id from launch URL)
    const vkUserId =
      urlParams.get('vk_user_id') ||
      hashParams.get('vk_user_id') ||
      urlParams.get('userId') ||
      urlParams.get('user_id')
    if (vkUserId) {
      const vkId = String(vkUserId)
      try {
        localStorage.setItem('zerf_chat_id', vkId)
        setPermanentCookie('zerf_chat_id', vkId)
      } catch {}
      return vkId
    }

    // 3. One-time login token from bot (/login command) — verified server-side and consumed
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

    // 3. Saved authenticated session on this device (check both localStorage and permanent cookie for PWA)
    let savedChatId = localStorage.getItem('zerf_chat_id') || getCookie('zerf_chat_id')
    let savedToken = localStorage.getItem('zerf_auth_token') || getCookie('zerf_auth_token')

    // PURGE PROTECTION: If an unauthorized device cached the ROOT ADMIN ID without valid token:
    if (savedChatId && ROOT_ADMIN_IDS_LIST.includes(savedChatId) && !savedToken && !u?.id) {
      try {
        localStorage.removeItem('zerf_chat_id')
        localStorage.removeItem('zerf_auth_token')
        localStorage.removeItem('zerf_cached_state')
        localStorage.removeItem('zerf-settings')
        localStorage.removeItem('zerf-usage')
        localStorage.removeItem('zerf_birthday')
        document.cookie = 'zerf_chat_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        document.cookie = 'zerf_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      } catch {}
      return null
    }

    // Only return chatId if authenticated with a session token or Telegram WebApp
    if (savedChatId && savedToken) {
      try {
        localStorage.setItem('zerf_chat_id', savedChatId)
        localStorage.setItem('zerf_auth_token', savedToken)
        setPermanentCookie('zerf_chat_id', savedChatId)
        setPermanentCookie('zerf_auth_token', savedToken)
      } catch {}
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
  
  const headers: Record<string, string> = {}
  if (chatId) headers['x-chat-id'] = chatId
  if (token) headers['x-auth-token'] = token
  if (initData) headers['x-tg-init-data'] = initData
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

  return {
    ...initialState,
    tasks: Array.isArray(cachedData.tasks) ? cachedData.tasks : [],
    goals: Array.isArray(cachedData.goals) ? cachedData.goals : [],
    notes: Array.isArray(cachedData.notes) ? cachedData.notes : [],
    projects: Array.isArray(cachedData.projects) ? cachedData.projects : [],
    friends: Array.isArray(cachedData.friends) ? cachedData.friends : [],
    habits: Array.isArray(cachedData.habits) ? cachedData.habits : [],
    settings: { ...initialState.settings, ...savedSettings },
    ...(savedView ? { currentView: savedView } : {})
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, initAppState)

  const enhancedDispatch: React.Dispatch<Action> = useCallback((action: Action) => {
    // Perform state change locally immediately
    dispatch(action)

    // Sync deletion / updates to cloud DB via API
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }

    if (action.type === 'DELETE_TASK') {
      fetch(`/api/tasks?id=${action.id}&type=task`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'DELETE_NOTE') {
      fetch(`/api/tasks?id=${action.id}&type=note`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'DELETE_GOAL') {
      fetch(`/api/tasks?id=${action.id}&type=goal`, { method: 'DELETE', headers }).catch(() => {})
    } else if (action.type === 'TOGGLE_TASK') {
      const target = state.tasks.find(t => t.id === action.id)
      const nextStatus = target ? (target.status === 'done' ? 'todo' : 'done') : 'done'
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, status: nextStatus }),
      }).catch(() => {})
    } else if (action.type === 'ADD_TASK') {
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(action.task),
      }).catch(() => {})
    } else if (action.type === 'ADD_NOTE') {
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemType: 'note', ...action.note }),
      }).catch(() => {})
    } else if (action.type === 'UPDATE_NOTE') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, itemType: 'note', ...action.updates }),
      }).catch(() => {})
    } else if (action.type === 'ADD_GOAL') {
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemType: 'goal', ...action.goal }),
      }).catch(() => {})
    } else if (action.type === 'UPDATE_GOAL') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, itemType: 'goal', ...action.updates }),
      }).catch(() => {})
    } else if (action.type === 'ADD_HABIT') {
      fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemType: 'habit', title: action.habit.title, icon: action.habit.icon, frequency: action.habit.frequency }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.habit) {
            dispatch({ type: 'REPLACE_HABIT', tempId: action.habit.id, habit: data.habit })
          }
        })
        .catch(() => {})
    } else if (action.type === 'UPDATE_HABIT') {
      fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: action.id, itemType: 'habit', ...action.updates }),
      }).catch(() => {})
    } else if (action.type === 'DELETE_HABIT') {
      fetch(`/api/tasks?id=${action.id}&type=habit`, { method: 'DELETE', headers }).catch(() => {})
    }
  }, [state.tasks, state.habits])

  // Apply theme class
  useEffect(() => {
    const theme = state.settings.theme
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      document.body.classList.add('dark')
      document.body.classList.remove('light')
    } else if (theme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
      document.body.classList.remove('dark')
      document.body.classList.add('light')
    } else {
      root.classList.remove('dark', 'light')
      document.body.classList.remove('dark', 'light')
    }
  }, [state.settings.theme])

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
      localStorage.setItem('zerf_cached_state', JSON.stringify({
        chatId: currentChatId,
        tasks: state.tasks,
        goals: state.goals,
        notes: state.notes,
        projects: state.projects,
        friends: state.friends,
        habits: state.habits,
      }))
    } catch {}
  }, [state.tasks, state.goals, state.notes, state.projects, state.friends, state.habits])

  // Sync from backend DB on mount (with user isolation)
  useEffect(() => {
    const headers = getAuthHeaders()
    const chatId = headers['x-chat-id']

    fetch('/api/tasks', { headers })
      .then(r => {
        if (!r.ok) {
          dispatch({
            type: 'LOAD_STATE',
            state: { tasks: [], goals: [], notes: [], friends: [], habits: [] }
          })
          return null
        }
        return r.json()
      })
      .then(data => {
        if (!data) return
        if (data.tasks !== undefined) {
          dispatch({
            type: 'LOAD_STATE',
            state: {
              tasks: data.tasks || [],
              goals: data.goals || [],
              notes: data.notes || [],
              friends: data.friends || [],
              habits: data.habits || [],
            },
          })
        }
      })
      .catch(() => {})

    // Check connected Telegram profile from Neon DB for active user
    const userUrl = chatId ? `/api/telegram/user?chatId=${chatId}` : '/api/telegram/user'
    fetch(userUrl, { headers })
      .then(r => r.json())
      .then(user => {
        if (user.connected && user.name) {
          dispatch({
            type: 'UPDATE_SETTINGS',
            updates: {
              name: user.name,
              userPlan: user.plan || 'free',
            },
          })
        }
      })
      .catch(() => {})

    if (chatId) {
      fetch(`/api/birthdays?chatId=${chatId}`, { headers }).catch(() => {})
    }

    // Check Telegram reminders
    const interval = setInterval(() => {
      fetch('/api/reminders/check').catch(() => {})
    }, 15000)
    fetch('/api/reminders/check').catch(() => {})

    // Hydrate currentView safely on client mount
    try {
      const savedView = localStorage.getItem('zerf_current_view') as View | null
      if (savedView && savedView !== state.currentView) {
        dispatch({ type: 'SET_VIEW', view: savedView })
      }
    } catch {}

    return () => clearInterval(interval)
  }, [])

  return <AppContext.Provider value={{ state, dispatch: enhancedDispatch }}>{children}</AppContext.Provider>
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
