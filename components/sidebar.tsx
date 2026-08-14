'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn, isBirthdayVisible } from '@/lib/utils'
import { useApp } from '@/lib/store'
import type { View } from '@/lib/types'
import { ChevronRight, Circle, User } from 'lucide-react'

import {
  Sun, Inbox, CheckSquare, FileText, Calendar, Clock,
  Target, BarChart2, Users, Settings, FolderOpen, LayoutGrid, Crown
} from 'lucide-react'

interface NavItem {
  id: View
  label: string
  icon: React.ElementType
  badge?: number
  section: string
}

const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'today',      label: 'Сегодня',     icon: Sun,         section: 'workspace' },
  { id: 'inbox',      label: 'Входящие',    icon: Inbox,        section: 'workspace' },
  { id: 'tasks',      label: 'Задачи',      icon: CheckSquare, section: 'workspace' },
  { id: 'clock',      label: 'Часы и Таймеры', icon: Clock,    section: 'workspace' },
  { id: 'notes',      label: 'Заметки',     icon: FileText,    section: 'workspace' },
  { id: 'calendar',   label: 'Календарь',   icon: Calendar,    section: 'planning' },
  { id: 'goals',      label: 'Цели',        icon: Target,      section: 'planning' },
  { id: 'projects',   label: 'Проекты',     icon: FolderOpen,  section: 'planning' },
  { id: 'eisenhower', label: 'Эйзенхауэр', icon: LayoutGrid,  section: 'planning' },
  { id: 'stats',      label: 'Аналитика',   icon: BarChart2,   section: 'аналитика' },
  { id: 'friends',    label: 'Команда',     icon: Users,       section: 'совместная работа' },
  { id: 'settings',   label: 'Настройки',   icon: Settings,    section: 'аккаунт' },
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
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check if user is Admin
    const checkAdmin = async () => {
      try {
        const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
        const res = await fetch(`/api/admin/check?chatId=${qChatId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(qChatId ? { 'x-chat-id': qChatId } : {})
          }
        })
        const data = await res.json()
        if (data.isAdmin) {
          setIsAdmin(true)
        }
      } catch {}
    }
    checkAdmin()

    if (typeof window !== 'undefined') {
      const tgWindow = window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { first_name?: string; last_name?: string; username?: string; photo_url?: string } } } } }
      const u = tgWindow.Telegram?.WebApp?.initDataUnsafe?.user
      if (u) {
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.first_name || 'Пользователь'
        setTgUser({
          name: fullName,
          username: u.username ? `@${u.username}` : 'Telegram',
          photoUrl: u.photo_url,
        })
        dispatch({
          type: 'UPDATE_SETTINGS',
          updates: {
            name: fullName,
            avatar: u.photo_url || '',
            integrations: { ...settings.integrations, telegram: true },
          },
        })
      }
    }
  }, [dispatch])

  const navItems: NavItem[] = isAdmin
    ? [...BASE_NAV_ITEMS, { id: 'admin' as View, label: 'Админ-панель', icon: Crown, section: 'аккаунт' }]
    : BASE_NAV_ITEMS

  const todayCount = tasks.filter(t => {
    const d = t.dueDate
    const today = new Date().toISOString().slice(0, 10)
    return d === today && t.status !== 'done'
  }).length

  const inboxCount = tasks.filter(t => !t.projectId && !t.goalId && t.status !== 'done' && isBirthdayVisible(t)).length
  const notesCount = notes.length

  const displayName = tgUser?.name || (settings.name && settings.name !== 'Kirill Perekatnov' ? settings.name : null) || 'Мой профиль'
  const isConnected = settings.integrations.telegram || !!tgUser || (!!settings.name && settings.name !== 'Kirill Perekatnov')
  const userSubtext = tgUser?.username || (isConnected ? 'Telegram Подключён' : 'Telegram Не подключён')

  return (
    <aside className="flex flex-col h-full bg-card text-card-foreground border-r border-border select-none w-full font-sans">
      {/* Dynamic User Profile Card */}
      <div className="mx-3 mt-4 mb-3 px-3.5 py-3 rounded-xl bg-muted/50 border border-border/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden border border-primary/30 text-primary">
          {tgUser?.photoUrl ? (
            <img src={tgUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : displayName !== 'Мой профиль' ? (
            <span className="text-[12px] font-bold uppercase">{displayName[0]}</span>
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground truncate font-sans">
            {displayName}
          </p>
          <p className="text-[11px] text-muted-foreground truncate font-sans">
            {userSubtext}
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
          const items = navItems.filter(i => i.section === section.id)
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
                      <item.icon className={cn(
                        'w-[15px] h-[15px] shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )} strokeWidth={isActive ? 2.5 : 2} />
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
