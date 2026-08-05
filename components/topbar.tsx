'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import { Search, Plus, MessageSquare, Bell, X, Command, Mic } from 'lucide-react'
import { format } from 'date-fns'
import { VoiceRecorder } from './voice-recorder'

const VIEW_LABELS: Record<string, string> = {
  today:    'Сегодня',
  inbox:    'Входящие',
  tasks:    'Задачи',
  goals:    'Цели',
  projects: 'Проекты',
  notes:    'Заметки',
  calendar: 'Календарь',
  chat:     'AI Чат',
  stats:    'Аналитика',
  friends:  'Команда',
  settings: 'Настройки',
}

interface Props {
  onNewTask?: () => void
}

export function TopBar({ onNewTask }: Props) {
  const { state, dispatch } = useApp()
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold text-foreground">
            {VIEW_LABELS[state.currentView] ?? 'Zerf'}
          </h1>
          {state.currentView === 'today' && (
            <span className="text-[12px] text-muted-foreground">
              {format(new Date(), 'EEEE, MMMM d')}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <motion.div
        animate={{ width: isSearchFocused ? 240 : 180 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search…"
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

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* New Task */}
        {['today', 'inbox', 'tasks'].includes(state.currentView) && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onNewTask}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New task</span>
          </motion.button>
        )}

        {/* Voice Command */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setVoiceOpen(true)}
          title="Voice command (Groq Whisper AI)"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          aria-label="Voice command"
        >
          <Mic className="w-4 h-4" />
        </motion.button>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        {/* AI Chat toggle — opens the sliding right panel */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
          title="AI Assistant (panel)"
          className={cn(
            'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium transition-all',
            state.isChatOpen
              ? 'bg-primary/15 text-primary'
              : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">AI</span>
        </motion.button>
      </div>

      <VoiceRecorder open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </header>
  )
}
