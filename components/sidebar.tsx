'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import type { View } from '@/lib/types'
import { ChevronRight, Circle } from 'lucide-react'

interface NavItem {
  id: View
  label: string
  icon: string
  badge?: number
  section: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'today',    label: 'Сегодня',     icon: '🗙️', section: 'workspace' },
  { id: 'inbox',    label: 'Входящие',    icon: '🕯️', section: 'workspace' },
  { id: 'tasks',    label: 'Задачи',      icon: '🕊️', section: 'workspace' },
  { id: 'notes',    label: 'Заметки',     icon: '📜', section: 'workspace' },
  { id: 'calendar', label: 'Календарь',   icon: '📆', section: 'planning' },
  { id: 'goals',    label: 'Цели',        icon: '⚔️', section: 'planning' },
  { id: 'projects', label: 'Проекты',     icon: '👑', section: 'planning' },
  { id: 'stats',    label: 'Аналитика',   icon: '💎', section: 'аналитика' },
  { id: 'friends',  label: 'Команда',     icon: '🥂', section: 'совместная работа' },
  { id: 'settings', label: 'Настройки',   icon: '⏳', section: 'аккаунт' },
]

const SECTIONS = [
  { id: 'workspace',          label: 'Рабочее пространство' },
  { id: 'planning',           label: 'Планирование' },
  { id: 'аналитика',          label: 'Аналитика' },
  { id: 'совместная работа',  label: 'Совместная работа' },
  { id: 'аккаунт',            label: 'Аккаунт' },
]

export function Sidebar() {
  const { state, dispatch } = useApp()
  const { currentView, tasks, notes, settings } = state

  const [tgUser, setTgUser] = useState<{ name: string; username: string; photoUrl?: string } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { first_name?: string; username?: string; photo_url?: string } } } } }).Telegram?.WebApp?.initDataUnsafe?.user) {
      const u = (window as unknown as { Telegram: { WebApp: { initDataUnsafe: { user: { first_name?: string; username?: string; photo_url?: string } } } } }).Telegram.WebApp.initDataUnsafe.user
      setTgUser({
        name: u.first_name || 'Пользователь',
        username: u.username ? `@${u.username}` : 'Telegram',
        photoUrl: u.photo_url,
      })
      dispatch({
        type: 'UPDATE_SETTINGS',
        updates: {
          name: u.first_name || '',
          avatar: u.photo_url || '',
          integrations: { ...settings.integrations, telegram: true },
        },
      })
    }
  }, [dispatch])

  const todayCount = tasks.filter(t => {
    const d = t.dueDate
    const today = new Date().toISOString().slice(0, 10)
    return d === today && t.status !== 'done'
  }).length

  const inboxCount = tasks.filter(t => !t.projectId && !t.goalId && t.status !== 'done').length
  const notesCount = notes.length

  const displayName = tgUser?.name || (settings.name && settings.name !== 'Kirill Perekatnov' ? settings.name : null)
  const isConnected = settings.integrations.telegram || !!tgUser || !!displayName

  return (
    <aside className="flex flex-col h-full bg-card text-card-foreground border-r border-border select-none w-full font-sans">
      {/* Top Profile / Telegram Status Block */}
      <div className="mx-3 mt-4 mb-3 px-3.5 py-3 rounded-xl bg-muted/50 border border-border/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden border border-primary/30">
          {tgUser?.photoUrl ? (
            <img src={tgUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[12px] font-bold text-primary font-sans">
              {displayName ? displayName[0] : '👤'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground truncate font-sans">
            {displayName || 'w-size'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate font-sans">
            {isConnected ? 'Telegram Подключён' : 'Telegram Не подключён'}
          </p>
        </div>
        <div
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isConnected ? 'bg-[var(--status-done)]' : 'bg-muted-foreground/30'
          )}
          title={isConnected ? 'Telegram Подключён' : 'Не подключён'}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {SECTIONS.map(section => {
          const items = NAV_ITEMS.filter(i => i.section === section.id)
          if (!items.length) return null
          return (
            <div key={section.id} className="mb-2">
              <p className="px-3 py-1 text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70 font-sans">
                {section.label}
              </p>
              <div className="space-y-0.5 mt-1">
                {items.map(item => {
                  const isActive = currentView === item.id
                  const badge =
                    item.id === 'today' ? (todayCount || undefined) :
                    item.id === 'inbox' ? (inboxCount || undefined) :
                    item.id === 'notes' ? (notesCount || undefined) :
                    item.badge

                  return (
                    <motion.button
                      key={item.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 font-sans',
                        isActive
                          ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-sm'
                          : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                      )}
                    >
                      <span className="text-base leading-none shrink-0 mono-emoji">{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          {badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Status bar */}
      <div className="px-4 pb-4 pt-3 border-t border-border bg-card">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-sans">{todayCount} задач осталось</span>
          <div className="flex items-center gap-1.5">
            <Circle className="w-2 h-2 fill-[var(--status-done)] text-[var(--status-done)]" />
            <span className="text-[11px] text-muted-foreground font-medium font-sans">В сети</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
