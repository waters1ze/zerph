'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import type { View } from '@/lib/types'
import {
  LayoutDashboard, Inbox, CheckSquare, Target, FolderKanban,
  FileText, BarChart3, Users, Settings,
  ChevronRight, Circle
} from 'lucide-react'
import Image from 'next/image'

interface NavItem {
  id: View
  label: string
  icon: React.ElementType
  badge?: number
  section?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'today',    label: 'Today',    icon: LayoutDashboard, section: 'workspace' },
  { id: 'inbox',    label: 'Inbox',    icon: Inbox },
  { id: 'tasks',    label: 'Tasks',    icon: CheckSquare },
  { id: 'goals',    label: 'Goals',    icon: Target,          section: 'planning' },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'notes',    label: 'Notes',    icon: FileText },
  { id: 'stats',    label: 'Analytics',icon: BarChart3,       section: 'intelligence' },
  { id: 'friends',  label: 'Team',     icon: Users,           section: 'collaboration' },
  { id: 'settings', label: 'Settings', icon: Settings,        section: 'account' },
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
    }
  }, [])

  const todayCount = tasks.filter(t => {
    const d = t.dueDate
    const today = new Date().toISOString().slice(0, 10)
    return d === today && t.status !== 'done'
  }).length

  const inboxCount = tasks.filter(t => !t.projectId && !t.goalId && t.status !== 'done').length

  const sections: { id: string; label: string }[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'planning', label: 'Planning' },
    { id: 'intelligence', label: 'Analytics' },
    { id: 'collaboration', label: 'Collaboration' },
    { id: 'account', label: 'Account' },
  ]

  return (
    <aside className="flex flex-col h-full bg-sidebar border-r border-sidebar-border select-none">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-md shadow-black/30 ring-1 ring-white/5">
          <Image
            src="/zerph-logo.png"
            alt="Zerph logo"
            width={36}
            height={36}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <div className="flex flex-col">
          <p className="text-[15px] font-bold leading-none tracking-tight gold-shimmer">Zerph</p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-none tracking-wide uppercase">Task Intelligence</p>
        </div>
      </div>

      {/* User */}
      {(() => {
        const isConnected = settings.integrations.telegram || !!tgUser
        const displayName = tgUser?.name || (settings.name && settings.name !== 'Kirill Perekatnov' ? settings.name : null)

        return (
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
                {isConnected ? (tgUser?.username || 'Telegram Connected') : 'Telegram Not Connected'}
              </p>
            </div>
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                isConnected ? 'bg-[var(--status-done)]' : 'bg-muted-foreground/30'
              )}
              title={isConnected ? 'Connected' : 'Not Connected'}
            />
          </div>
        )
      })()}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {sections.map(section => {
          const items = NAV_ITEMS.filter(i => i.section === section.id || (!i.section && section.id === 'workspace' && ['inbox','tasks'].includes(i.id)))
          if (!items.length) return null
          return (
            <div key={section.id} className="mb-1">
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                {section.label}
              </p>
              {items.map(item => {
                const Icon = item.icon
                const isActive = currentView === item.id
                const badge = item.id === 'today' ? (todayCount || undefined) : item.id === 'inbox' ? (inboxCount || undefined) : item.badge

                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : '')} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                        {badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-3 h-3 text-primary" />}
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
          <span className="text-[11px] text-muted-foreground">{todayCount} tasks remaining</span>
          <div className="flex items-center gap-1">
            <Circle className="w-2 h-2 fill-[var(--status-done)] text-[var(--status-done)]" />
            <span className="text-[11px] text-muted-foreground">Online</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
