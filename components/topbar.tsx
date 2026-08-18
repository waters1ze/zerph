'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import { NotificationsPanel } from '@/components/notifications-panel'
import { Search, Plus, MessageSquare, Bell, X, Command, Mic, Menu, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { VoiceRecorder } from './voice-recorder'
import { Clock } from 'lucide-react'
import { playAlarmChime, showWebNotification } from '@/lib/notifications'

const VIEW_LABELS: Record<string, string> = {
  today:      'Сегодня',
  inbox:      'Входящие',
  tasks:      'Задачи',
  clock:      'Часы и Таймеры',
  goals:      'Цели',
  projects:   'Проекты',
  notes:      'Заметки',
  graph:      'Граф знаний',
  calendar:   'Календарь',
  chat:       'AI Чат',
  stats:      'Аналитика',
  friends:    'Друзья',
  teams:      'Команды',
  extensions: 'Расширения',
  entropy:    'Entropy AI Search',
  settings:   'Настройки',
  admin:      'Админ-панель',
}

function getDynamicViewTitle(view: string): string {
  // 1. Direct label match
  if (VIEW_LABELS[view]) return VIEW_LABELS[view]

  // 2. Extensions and custom views from localStorage / catalog
  if (typeof window !== 'undefined') {
    try {
      // Check catalog cache
      const catalogRaw = localStorage.getItem('zerf_ext_catalog_cache')
      if (catalogRaw) {
        const parsed = JSON.parse(catalogRaw)
        const list = Array.isArray(parsed) ? parsed : (parsed.extensions || parsed.items || [])
        const match = list.find((e: any) => e.id === view || e.name === view)
        if (match?.title || match?.name) {
          return match.title || match.name
        }
      }

      // Check sidebar custom config
      const sidebarRaw = localStorage.getItem('zerf_sidebar_config_v2')
      if (sidebarRaw) {
        const parsed = JSON.parse(sidebarRaw)
        const customItems = parsed.customItems || []
        const match = customItems.find((e: any) => e.id === view)
        if (match?.title) return match.title
      }

      // Check installed extensions list
      const installedRaw = localStorage.getItem('zerf_installed_extensions')
      if (installedRaw) {
        const parsed = JSON.parse(installedRaw)
        if (Array.isArray(parsed)) {
          const match = parsed.find((e: any) => e.id === view || e.name === view)
          if (match?.title || match?.name) return match.title || match.name
        }
      }
    } catch {}
  }

  // 3. Ext prefix fallback
  if (view.startsWith('ext_')) {
    const rawName = view.replace(/^ext_/, '').replace(/_/g, ' ')
    return rawName.charAt(0).toUpperCase() + rawName.slice(1)
  }

  return view.charAt(0).toUpperCase() + view.slice(1)
}

interface Props {
  onNewTask?: () => void
  onMenuOpen?: () => void
  isMobileLayout?: boolean
}

export function TopBar({ onNewTask, onMenuOpen, isMobileLayout }: Props) {
  const { state, dispatch, syncData, isSyncing } = useApp()
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [nextTaskCountdown, setNextTaskCountdown] = useState<{ title: string; timeStr: string } | null>(null)
  const notifiedTasksRef = useRef<Set<string>>(new Set())

  // Background ticker for live countdown & in-browser audio alarms
  useEffect(() => {
    const checkTicker = () => {
      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      // 1. Find upcoming task with time across closest dates
      const nowMs = now.getTime()
      const upcoming = state.tasks
        .filter(t => t.status !== 'done' && t.dueTime)
        .map(t => {
          const d = t.dueDate || todayStr
          const [h, m] = (t.dueTime || '23:59').split(':').map(Number)
          const target = new Date(d)
          target.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0)
          return { task: t, targetTs: target.getTime() }
        })
        .filter(x => x.targetTs > nowMs)
        .sort((a, b) => a.targetTs - b.targetTs)

      const next = upcoming[0]
      if (next) {
        const diffMs = next.targetTs - nowMs
        const totalSec = Math.floor(diffMs / 1000)
        const totalDays = Math.floor(totalSec / 86400)
        const months = Math.floor(totalDays / 30)
        const days = totalDays % 30
        const hrs = Math.floor((totalSec % 86400) / 3600)
        const mins = Math.floor((totalSec % 3600) / 60)
        const secs = totalSec % 60

        let formatted = ''
        if (months > 0) {
          formatted = `${months}мес ${days}д`
        } else if (days > 0) {
          formatted = `${days}д ${hrs}ч`
        } else if (hrs > 0) {
          formatted = `${hrs}ч ${String(mins).padStart(2, '0')}м`
        } else {
          formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        }

        setNextTaskCountdown({
          title: next.task.title,
          timeStr: formatted
        })
      } else {
        setNextTaskCountdown(null)
      }

      // 2. In-browser audio & push notification when task is due right now
      state.tasks.forEach(t => {
        if (t.status !== 'done' && t.dueTime === currentHHMM && (t.dueDate === todayStr || !t.dueDate)) {
          const key = `${t.id}-${todayStr}-${currentHHMM}`
          if (!notifiedTasksRef.current.has(key)) {
            notifiedTasksRef.current.add(key)
            playAlarmChime('alarm')
            showWebNotification(`⏰ Напоминание: ${t.title}`, {
              body: `Время: ${t.dueTime}. Нажмите, чтобы открыть задачу.`,
              onClick: () => {
                dispatch({ type: 'SELECT_TASK', id: t.id })
              }
            })
          }
        }
      })
    }

    checkTicker()
    const interval = setInterval(checkTicker, 1000)
    return () => clearInterval(interval)
  }, [state.tasks, dispatch])

  return (
    <header className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20">

      {/* Hamburger — mobile & Telegram Mini App mode */}
      <button
        onClick={onMenuOpen}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0',
          !isMobileLayout && 'sm:hidden'
        )}
        aria-label="Открыть меню"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold text-foreground truncate">
            {getDynamicViewTitle(state.currentView)}
          </h1>
          {state.currentView === 'today' && !isMobileLayout && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              {format(new Date(), 'EEEE, MMMM d')}
            </span>
          )}
        </div>

        {/* Live Task Countdown Pill in TopBar */}
        {nextTaskCountdown && !isMobileLayout && (
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'clock' })}
            title="Нажмите, чтобы открыть экран обратного отсчета и таймеров"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 text-[11px] font-semibold text-primary transition-all animate-pulse"
          >
            <Clock className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{nextTaskCountdown.title}:</span>
            <span className="font-mono font-bold">{nextTaskCountdown.timeStr}</span>
          </button>
        )}
      </div>

      {/* Search — desktop only (hidden in mobile layout) */}
      {!isMobileLayout && (
        <motion.div
          animate={{ width: isSearchFocused ? 240 : 180 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden sm:block"
        >
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск…"
            value={state.searchQuery}
            onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="w-full h-8 pl-7 pr-8 rounded-lg text-[13px] bg-muted/60 border border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-ring/30 outline-none transition-all placeholder:text-muted-foreground"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
            {state.searchQuery ? (
              <button
                className="pointer-events-auto p-0.5 hover:text-foreground text-muted-foreground transition-colors"
                onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })}
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <kbd className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-mono">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            )}
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* New Task - Global */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onNewTask}
          className="flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className={cn('hidden', !isMobileLayout && 'sm:inline')}>Задача</span>
        </motion.button>

        {/* Streak Flame Badge */}
        <div
          title="Стрик продуктивности: выполняйте задачи каждый день, чтобы получать бонусы!"
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-muted/60 border border-border text-foreground text-xs font-bold shrink-0 cursor-default"
        >
          <span className="text-sm mono-emoji">🔥</span>
          <span>{state.tasks.filter(t => t.status === 'done').length > 0 ? Math.max(1, state.tasks.filter(t => t.status === 'done').length) : 0}</span>
        </div>

        {/* Voice */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setVoiceOpen(true)}
          title="Голосовая команда"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
          aria-label="Голосовая команда"
        >
          <Mic className="w-4 h-4" />
        </motion.button>

        {/* Live Refresh / Sync */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => syncData()}
          title="Синхронизировать задачи"
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0',
            isSyncing && 'text-primary'
          )}
          aria-label="Синхронизировать задачи"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin text-primary')} />
        </motion.button>

        {/* Notifications */}
        <NotificationsPanel />

        {/* AI Chat — desktop only */}
        {!isMobileLayout && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
            title="ИИ-ассистент Zerf Note"
            className={cn(
              'hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium transition-all',
              state.isChatOpen
                ? 'bg-primary/15 text-primary'
                : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ИИ Чат</span>
          </motion.button>
        )}
      </div>

      <VoiceRecorder open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </header>
  )
}
