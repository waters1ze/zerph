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
  section?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'today',    label: 'Сегодня',     icon: '🗙️', section: 'workspace' },
  { id: 'inbox',    label: 'Входящие',    icon: '🕯️' },
  { id: 'tasks',    label: 'Задачи',      icon: '🕊️' },
  { id: 'calendar', label: 'Календарь',   icon: '📆', section: 'planning' },
  { id: 'goals',    label: 'Цели',        icon: '⚔️' },
  { id: 'projects', label: 'Проекты',     icon: '👑' },
  { id: 'notes',    label: 'Заметки',     icon: '📜' },
  { id: 'stats',    label: 'Аналитика',   icon: '💎', section: 'аналитика' },
  { id: 'friends',  label: 'Команда',     icon: '🥂', section: 'совместная работа' },
  { id: 'settings', label: 'Настройки',   icon: '⏳', section: 'аккаунт' },
]

// Mobile bottom nav — only key sections
const MOBILE_NAV: NavItem[] = [
  { id: 'today',    label: 'Сегодня',   icon: '🗙️' },
  { id: 'tasks',    label: 'Задачи',   icon: '🕊️' },
  { id: 'calendar', label: 'Календарь', icon: '📆' },
  { id: 'notes',    label: 'Заметки',  icon: '📜' },
  { id: 'settings', label: 'Настройки', icon: '⏳' },
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
  const { currentView, tasks, settings } = state

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

  const displayName = tgUser?.name || (settings.name && settings.name !== 'Kirill Perekatnov' ? settings.name : null)
  const isConnected = settings.integrations.telegram || !!tgUser || !!displayName

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="desktop-sidebar flex flex-col h-full bg-sidebar border-r border-sidebar-border select-none">
        {/* Brand */}
        <div className="px-5 pt-6 pb-4 flex flex-col justify-center">
          <h1 className="text-2xl italic font-serif tracking-wide gold-shimmer select-none font-bold">
            Zerph
          </h1>
          <p className="text-[9px] text-muted-foreground/70 tracking-[0.2em] uppercase font-medium mt-1">
            Task Intelligence
          </p>
        </div>

        {/* User */}
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-sidebar-accent/50 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {tgUser?.photoUrl ? (
              <img src={tgUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-semibold text-primary">
                {displayName ? displayName[0] : '👤'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-sidebar-foreground truncate">
              {displayName || 'Профиль не привязан'}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {isConnected ? (tgUser?.username || 'Telegram Подключён') : 'Telegram Не подключён'}
            </p>
          </div>
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              isConnected ? 'bg-[var(--status-done)]' : 'bg-muted-foreground/30'
            )}
            title={isConnected ? 'Подключён' : 'Не подключён'}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {SECTIONS.map(section => {
            const items = NAV_ITEMS.filter(i =>
              i.section === section.id ||
              (!i.section && section.id === 'workspace' && ['inbox', 'tasks'].includes(i.id))
            )
            if (!items.length) return null
            return (
              <div key={section.id} className="mb-1">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                  {section.label}
                </p>
                {items.map(item => {
                  const isActive = currentView === item.id
                  const badge = item.id === 'today' ? (todayCount || undefined) : item.id === 'inbox' ? (inboxCount || undefined) : item.badge

                  return (
                    <motion.button
                      key={item.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
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
            )
          })}
        </nav>

        {/* Status bar */}
        <div className="px-4 pb-4 pt-2 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{todayCount} задач осталось</span>
            <div className="flex items-center gap-1">
              <Circle className="w-2 h-2 fill-[var(--status-done)] text-[var(--status-done)]" />
              <span className="text-[11px] text-muted-foreground">В сети</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav bar ── */}
      <nav className="mobile-bottom-nav">
        {MOBILE_NAV.map(item => {
          const isActive = currentView === item.id
          const badge = item.id === 'today' ? todayCount : 0
          return (
            <button
              key={item.id}
              onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
              className={cn('mobile-nav-item', isActive && 'active')}
            >
              <span className="text-xl leading-none mono-emoji relative">
                {item.icon}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                    {badge}
                  </span>
                )}
              </span>
              <span className="label">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
