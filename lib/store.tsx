'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import type {
  Task, Goal, Project, Note, Friend, ChatMessage,
  UserSettings, View, Priority, TaskStatus, GoalStatus,
} from './types'

// ─── Seed Data ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

const SEED_TASKS: Task[] = [
  {
    id: 't1', title: 'Review Q3 product roadmap', description: 'Go through the roadmap document and leave comments for the team.', priority: 'urgent', status: 'todo',
    dueDate: today, projectId: 'p1', goalId: 'g1', tags: ['product', 'q3'], assignees: [], isShared: false,
    createdAt: today + 'T08:00:00Z', updatedAt: today + 'T08:00:00Z', progress: 0,
    subtasks: [{ id: 'st1', title: 'Read roadmap doc', done: true }, { id: 'st2', title: 'Leave comments', done: false }],
  },
  {
    id: 't2', title: 'Prepare board presentation slides', priority: 'high', status: 'inprogress',
    dueDate: today, projectId: 'p1', tags: ['presentation'], assignees: ['f1'], isShared: true,
    createdAt: today + 'T09:00:00Z', updatedAt: today + 'T10:30:00Z', progress: 40,
    subtasks: [{ id: 'st3', title: 'Gather metrics', done: true }, { id: 'st4', title: 'Design slides', done: false }, { id: 'st5', title: 'Review with manager', done: false }],
  },
  {
    id: 't3', title: 'Sync with engineering on API changes', priority: 'medium', status: 'todo',
    dueDate: today, tags: ['sync', 'api'], assignees: [], isShared: false,
    createdAt: today + 'T07:30:00Z', updatedAt: today + 'T07:30:00Z',
  },
  {
    id: 't4', title: 'Update stakeholder newsletter', priority: 'low', status: 'done',
    dueDate: yesterday, tags: ['comms'], assignees: [], isShared: false,
    createdAt: yesterday + 'T09:00:00Z', updatedAt: yesterday + 'T14:00:00Z', completedAt: yesterday + 'T14:00:00Z',
  },
  {
    id: 't5', title: 'Onboarding documentation for new hires', priority: 'high', status: 'todo',
    dueDate: today, projectId: 'p2', tags: ['hr', 'docs'], assignees: [], isShared: false,
    createdAt: today + 'T06:00:00Z', updatedAt: today + 'T06:00:00Z',
  },
  {
    id: 't6', title: 'Define KPIs for customer success team', priority: 'high', status: 'overdue',
    dueDate: yesterday, goalId: 'g2', tags: ['kpi', 'cs'], assignees: ['f1', 'f2'], isShared: true,
    createdAt: yesterday + 'T08:00:00Z', updatedAt: yesterday + 'T08:00:00Z',
  },
  {
    id: 't7', title: 'Research competitor pricing models', priority: 'medium', status: 'todo',
    dueDate: today, tags: ['research', 'pricing'], assignees: [], isShared: false,
    createdAt: today + 'T07:00:00Z', updatedAt: today + 'T07:00:00Z',
    aiGenerated: true, source: 'AI suggested from roadmap discussion',
  },
]

const SEED_GOALS: Goal[] = [
  {
    id: 'g1', title: 'Launch v2 Product in Q4', description: 'Complete product v2 launch including all core features, QA, and rollout plan.',
    motivation: 'Drive 40% revenue growth by EOY', metric: 'Launch date + 100 enterprise signups',
    status: 'on_track', deadline: '2026-12-31', progress: 38,
    milestones: [
      { id: 'm1', title: 'Feature freeze', done: true, dueDate: '2026-09-01' },
      { id: 'm2', title: 'Beta launch', done: false, dueDate: '2026-10-15' },
      { id: 'm3', title: 'GA launch', done: false, dueDate: '2026-12-01' },
    ],
    projectIds: ['p1'], noteIds: ['n1'], createdAt: '2026-01-15T00:00:00Z', updatedAt: today + 'T00:00:00Z', color: '#6366f1',
  },
  {
    id: 'g2', title: 'Build high-performance CS team', description: 'Hire, train and establish metrics-driven customer success organisation.',
    motivation: 'Reduce churn below 3% annually', metric: 'NPS > 50, churn < 3%',
    status: 'at_risk', deadline: '2026-09-30', progress: 22,
    milestones: [
      { id: 'm4', title: 'Hire 3 CS leads', done: true },
      { id: 'm5', title: 'Define KPIs', done: false, dueDate: '2026-08-10' },
      { id: 'm6', title: 'First QBR', done: false, dueDate: '2026-09-01' },
    ],
    projectIds: ['p2'], noteIds: [], createdAt: '2026-03-01T00:00:00Z', updatedAt: today + 'T00:00:00Z', color: '#f59e0b',
  },
]

const SEED_PROJECTS: Project[] = [
  {
    id: 'p1', title: 'Product v2 Launch', description: 'All tasks related to the Q4 product launch.', goalId: 'g1',
    color: '#6366f1', icon: 'rocket', taskIds: ['t1', 't2'], noteIds: ['n1'],
    createdAt: '2026-01-15T00:00:00Z', updatedAt: today + 'T00:00:00Z', archived: false,
  },
  {
    id: 'p2', title: 'HR & Onboarding', description: 'New hire onboarding and HR process improvement.', goalId: 'g2',
    color: '#10b981', icon: 'users', taskIds: ['t5'], noteIds: [],
    createdAt: '2026-02-01T00:00:00Z', updatedAt: today + 'T00:00:00Z', archived: false,
  },
]

const SEED_NOTES: Note[] = [
  {
    id: 'n1', title: 'Product v2 Strategy Brief', type: 'note',
    content: `# Product v2 Strategy Brief\n\n## Overview\nThis document outlines the core strategy for the Q4 product launch.\n\n## Key Themes\n- **Performance**: Sub-200ms API response across all endpoints\n- **Collaboration**: Real-time multi-user editing\n- **AI Integration**: Embedded AI assistant for power users\n\n## Competitive Positioning\nWe differentiate from competitors by focusing on enterprise-grade reliability while maintaining a consumer-grade UX.\n\n## Risks\n- Engineering capacity in September\n- Third-party API dependencies\n\n## Action Items\n- [ ] Review with CTO by Aug 15\n- [ ] Legal sign-off on new data terms\n- [ ] Marketing brief due Aug 20\n\n## Sources\nBased on customer interviews (n=42) and market analysis report Q2-2026.`,
    tags: ['product', 'strategy', 'q4'], projectId: 'p1', goalId: 'g1', taskIds: ['t1'],
    createdAt: '2026-07-20T10:00:00Z', updatedAt: today + 'T09:00:00Z', pinned: true,
  },
  {
    id: 'n2', title: 'Weekly Standup Notes — Aug 4', type: 'meeting',
    content: `# Weekly Standup — August 4, 2026\n\n**Attendees:** Alex, Maria, Dmitri, Sam\n\n## Updates\n\n### Engineering\n- API migration 70% complete\n- Blocked on payment provider integration\n\n### Product\n- Wireframes approved\n- User testing scheduled for Aug 10\n\n### Marketing\n- Campaign briefs in review\n\n## Decisions\n1. Delay beta by 1 week to ensure quality\n2. Add extra QA sprint in September\n\n## Next Steps\n- [ ] Alex: unblock payment integration by Friday\n- [ ] Maria: schedule user testing\n- [ ] Dmitri: update roadmap with new dates`,
    tags: ['standup', 'meeting', 'weekly'], taskIds: [],
    createdAt: today + 'T09:30:00Z', updatedAt: today + 'T10:00:00Z',
  },
]

const SEED_FRIENDS: Friend[] = [
  { id: 'f1', name: 'Maria Ivanova', email: 'maria@corp.io', status: 'online', addedAt: '2026-03-01T00:00:00Z' },
  { id: 'f2', name: 'Alex Petrov', email: 'alex@corp.io', status: 'away', addedAt: '2026-04-01T00:00:00Z' },
  { id: 'f3', name: 'Sam Lee', email: 'sam@corp.io', status: 'offline', addedAt: '2026-05-10T00:00:00Z' },
]

const SEED_CHAT: ChatMessage[] = [
  {
    id: 'c1', role: 'assistant',
    content: 'Hello! I\'m your Nexus AI assistant. I can help you manage tasks, summarize notes, create plans, and answer questions about your projects. What would you like to do today?',
    createdAt: today + 'T08:00:00Z',
  },
]

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  name: 'Kirill Perekatnov',
  email: 'kirill@corp.io',
  avatar: '',
  accentColor: '#2d7a4f',
  notifications: { desktop: true, email: false, dueReminders: true, teamUpdates: true },
  integrations: { telegram: false, aiApiKey: '', aiModel: 'llama-3.3-70b-versatile', groqApiKey: '', telegramBotToken: '' },
  weekStartsOn: 1,
  focusModeEnabled: false,
}

// ─── State & Actions ──────────────────────────────────────────────────────────
interface AppState {
  tasks: Task[]
  goals: Goal[]
  projects: Project[]
  notes: Note[]
  friends: Friend[]
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
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'UPDATE_PROJECT'; id: string; updates: Partial<Project> }
  | { type: 'ADD_CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'UPDATE_SETTINGS'; updates: Partial<UserSettings> }
  | { type: 'ADD_FRIEND'; friend: Friend }
  | { type: 'REMOVE_FRIEND'; id: string }
  | { type: 'LOAD_STATE'; state: Partial<AppState> }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
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
    case 'ADD_PROJECT':
      return { ...state, projects: [action.project, ...state.projects] }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.id ? { ...p, ...action.updates, updatedAt: new Date().toISOString() } : p) }
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  // Apply theme class
  useEffect(() => {
    const theme = state.settings.theme
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else if (theme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.classList.remove('dark', 'light')
    }
  }, [state.settings.theme])

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zerf-settings', JSON.stringify(state.settings))
    } catch {}
  }, [state.settings])

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zerf-settings')
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UserSettings>
        dispatch({ type: 'UPDATE_SETTINGS', updates: parsed })
      }
    } catch {}
  }, [])

  // Sync from backend DB on mount
  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => {
        if (data.tasks || data.goals || data.notes) {
          dispatch({
            type: 'LOAD_STATE',
            state: {
              tasks: data.tasks || [],
              goals: data.goals || [],
              notes: data.notes || [],
            },
          })
        }
      })
      .catch(() => {})
  }, [])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
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
