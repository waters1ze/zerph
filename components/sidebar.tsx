'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, isYearlyEventTask } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'
import type { View } from '@/lib/types'
import {
  Sun, Inbox, CheckSquare, FileText, Calendar, Clock,
  Target, BarChart2, Users, Settings, FolderOpen, LayoutGrid, Crown, Network,
  UserCheck, Building2, Puzzle, ChevronRight, ChevronDown, Circle, User, Menu,
  PanelLeftClose, PanelLeftOpen, Folder
} from 'lucide-react'

export interface NavItem {
  id: View
  label: string
  icon: React.ElementType
  badge?: number
  section: string
}

export const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'today',      label: 'Сегодня',        icon: Sun,         section: 'workspace' },
  { id: 'inbox',      label: 'Входящие',       icon: Inbox,        section: 'workspace' },
  { id: 'tasks',      label: 'Задачи',         icon: CheckSquare, section: 'workspace' },
  { id: 'clock',      label: 'Часы и Таймеры', icon: Clock,       section: 'workspace' },
  { id: 'notes',      label: 'Заметки',        icon: FileText,    section: 'workspace' },
  { id: 'graph',      label: 'Граф знаний',    icon: Network,     section: 'workspace' },
  { id: 'calendar',   label: 'Календарь',      icon: Calendar,    section: 'planning' },
  { id: 'goals',      label: 'Цели',           icon: Target,      section: 'planning' },
  { id: 'projects',   label: 'Проекты',        icon: FolderOpen,  section: 'planning' },
  { id: 'extensions', label: 'Расширения',     icon: Puzzle,      section: 'planning' },
  { id: 'stats',      label: 'Аналитика',      icon: BarChart2,   section: 'аналитика' },
  { id: 'friends',    label: 'Друзья',         icon: UserCheck,   section: 'совместная работа' },
  { id: 'teams',      label: 'Команды',        icon: Building2,   section: 'совместная работа' },
  { id: 'settings',   label: 'Настройки',      icon: Settings,    section: 'аккаунт' },
]

export const SECTIONS = [
  { id: 'workspace',          label: 'Рабочее пространство' },
  { id: 'planning',           label: 'Планирование' },
  { id: 'аналитика',          label: 'Аналитика' },
  { id: 'совместная работа',  label: 'Совместная работа' },
  { id: 'аккаунт',            label: 'Аккаунт' },
]

export interface SidebarFolder {
  id: string
  title: string
  itemIds: string[]
}

export interface SidebarConfig {
  hiddenItems: string[]
  folders?: SidebarFolder[]
}

interface SidebarProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ isCollapsed: externalCollapsed, onToggleCollapse: externalToggle }: SidebarProps) {
  const { state, dispatch } = useApp()
  const { currentView, tasks, notes, settings } = state

  const [tgUser, setTgUser] = useState<{ name: string; username: string; photoUrl?: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingTeamRequestsCount, setPendingTeamRequestsCount] = useState<number>(0)

  // Local collapse state if not provided externally
  const [localCollapsed, setLocalCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zerf_sidebar_collapsed') === 'true'
    }
    return false
  })

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : localCollapsed

  const toggleCollapse = () => {
    if (externalToggle) {
      externalToggle()
    } else {
      const next = !localCollapsed
      setLocalCollapsed(next)
      try {
        localStorage.setItem('zerf_sidebar_collapsed', String(next))
        window.dispatchEvent(new CustomEvent('zerf_sidebar_collapse_changed', { detail: next }))
      } catch {}
    }
  }

  // Sidebar customization config
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_sidebar_config')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return { hiddenItems: [], folders: [] }
  })

  // Collapsed folders state
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  useEffect(() => {
    const handleConfigChange = () => {
      try {
        const saved = localStorage.getItem('zerf_sidebar_config')
        if (saved) setSidebarConfig(JSON.parse(saved))
      } catch {}
    }
    window.addEventListener('zerf_sidebar_config_changed', handleConfigChange)
    return () => window.removeEventListener('zerf_sidebar_config_changed', handleConfigChange)
  }, [])

  useEffect(() => {
    // Check if user is Admin
    const checkAdmin = async () => {
      try {
        const headers = getAuthHeaders()
        const cid = typeof window !== 'undefined' ? (localStorage.getItem('zerf_chat_id') || '') : ''
        const tgCid = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id : null
        if (cid === '6136950061' || cid === '5078516086' || String(tgCid) === '6136950061' || String(tgCid) === '5078516086') {
          setIsAdmin(true)
          return
        }

        const res = await fetch(`/api/admin/check`, { headers: { 'Content-Type': 'application/json', ...headers } })
        const data = await res.json()
        if (data.isAdmin) {
          setIsAdmin(true)
        }
      } catch {}
    }
    checkAdmin()

    // Fetch real profile from DB
    const fetchUserProfile = async () => {
      try {
        const headers = getAuthHeaders()
        if (Object.keys(headers).length > 0) {
          const res = await fetch('/api/telegram/user', { headers })
          const data = await res.json()
          if (data.connected && data.name) {
            setTgUser({
              name: data.name,
              username: data.username || 'Telegram',
              photoUrl: undefined,
            })
            if (data.isAdmin) {
              setIsAdmin(true)
            }
            dispatch({
              type: 'UPDATE_SETTINGS',
              updates: {
                name: data.name,
                integrations: { ...settings.integrations, telegram: true },
              },
            })
            return
          }
        }
      } catch {}

      // Fallback to Telegram WebApp context
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
        }
      }
    }

    fetchUserProfile()

    // Fetch pending team invites count
    const fetchPendingTeamRequests = async () => {
      try {
        const headers = getAuthHeaders()
        if (Object.keys(headers).length > 0) {
          const res = await fetch('/api/friends', { headers })
          const data = await res.json()
          if (Array.isArray(data.pendingRequests)) {
            setPendingTeamRequestsCount(data.pendingRequests.length)
          }
        }
      } catch {}
    }
    fetchPendingTeamRequests()
    const interval = setInterval(fetchPendingTeamRequests, 20000)
    return () => clearInterval(interval)
  }, [dispatch])

  const fullNavItems: NavItem[] = isAdmin
    ? [...BASE_NAV_ITEMS, { id: 'admin' as View, label: 'Админ-панель', icon: Crown, section: 'аккаунт' }]
    : BASE_NAV_ITEMS

  // Filter out items hidden by user in Settings
  const navItems = fullNavItems.filter(item => !sidebarConfig.hiddenItems?.includes(item.id))

  const todayCount = tasks.filter(t => {
    const d = t.dueDate
    const today = new Date().toISOString().slice(0, 10)
    return d === today && t.status !== 'done'
  }).length

  const inboxCount = tasks.filter(t => !t.projectId && !t.goalId && t.status !== 'done' && !isYearlyEventTask(t)).length
  const notesCount = notes.length

  const displayName = (settings.name && settings.name.trim() && settings.name !== 'Мой профиль' ? settings.name.trim() : null) || tgUser?.name || 'Мой профиль'
  const isConnected = settings.integrations.telegram || !!tgUser || (!!settings.name && settings.name !== 'Kirill Perekatnov')
  const userSubtext = tgUser?.username
    ? `${tgUser.username} · Подключено`
    : (isConnected ? 'Telegram Подключён' : 'Telegram Не подключён')

  return (
    <aside className={cn(
      'flex flex-col h-full bg-card text-card-foreground border-r border-border select-none font-sans transition-all duration-200',
      isCollapsed ? 'w-16 items-center' : 'w-full'
    )}>
      {/* Top Header with Hamburger Toggle */}
      <div className={cn(
        'px-3 pt-3 pb-2 flex items-center border-b border-border/50',
        isCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shadow-xs">
              Z
            </div>
            <span className="font-bold text-sm text-foreground tracking-tight">Zerf AI</span>
          </div>
        )}

        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={isCollapsed ? 'Развернуть меню (3 полоски)' : 'Свернуть меню'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Dynamic User Profile Card */}
      <div 
        onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
        className={cn(
          'mt-2 mb-2 rounded-xl bg-muted/50 border border-border/60 flex items-center cursor-pointer hover:bg-muted/80 transition-colors group',
          isCollapsed ? 'p-2 mx-1 justify-center' : 'mx-2 px-3 py-2.5 gap-2.5'
        )}
        title={`Профиль: ${displayName} (кликните для настроек)`}
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden border border-primary/30 text-primary group-hover:scale-105 transition-transform">
          {tgUser?.photoUrl ? (
            <img src={tgUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : displayName !== 'Мой профиль' ? (
            <span className="text-[11px] font-bold uppercase">{displayName[0]}</span>
          ) : (
            <User className="w-3.5 h-3.5" />
          )}
        </div>

        {!isCollapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate font-sans" title={displayName}>
                {displayName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate font-sans">
                {userSubtext}
              </p>
            </div>
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                isConnected ? 'bg-[var(--status-done)]' : 'bg-muted-foreground/30'
              )}
              title={isConnected ? 'Telegram Подключён' : 'Не подключён'}
            />
          </>
        )}
      </div>

      {/* Nav */}
      <nav className={cn(
        'flex-1 overflow-y-auto pb-4 space-y-1',
        isCollapsed ? 'px-1' : 'px-2'
      )}>
        {/* Render Custom Folders First if defined */}
        {sidebarConfig.folders && sidebarConfig.folders.length > 0 && (
          <div className="space-y-1 mb-2">
            {sidebarConfig.folders.map(folder => {
              const folderItems = navItems.filter(i => folder.itemIds.includes(i.id))
              if (!folderItems.length) return null
              const isFolderOpen = !collapsedFolders[folder.id]

              return (
                <div key={folder.id} className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden mb-1.5">
                  {!isCollapsed && (
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Folder className="w-3 h-3 text-primary" />
                        <span>{folder.title}</span>
                      </span>
                      {isFolderOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  )}

                  {(!isCollapsed ? isFolderOpen : true) && (
                    <div className={cn('space-y-0.5', !isCollapsed && 'px-1 pb-1')}>
                      {folderItems.map(item => {
                        const isActive = currentView === item.id
                        return (
                          <motion.button
                            key={item.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
                            className={cn(
                              'w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 font-sans cursor-pointer',
                              isCollapsed ? 'p-2 justify-center' : 'gap-2 px-2.5 py-1.5',
                              isActive
                                ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                                : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                            )}
                            title={item.label}
                          >
                            <item.icon className={cn(
                              'w-4 h-4 shrink-0 transition-colors',
                              isActive ? 'text-primary' : 'text-muted-foreground'
                            )} />
                            {!isCollapsed && <span className="flex-1 text-left line-clamp-1">{item.label}</span>}
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Regular Sections */}
        {SECTIONS.map(section => {
          // Exclude items that are already in custom folders
          const folderItemIds = new Set((sidebarConfig.folders || []).flatMap(f => f.itemIds))
          const items = navItems.filter(i => i.section === section.id && !folderItemIds.has(i.id))
          if (!items.length) return null

          return (
            <div key={section.id} className="mb-2">
              {!isCollapsed && (
                <p className="px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold text-muted-foreground/70 font-sans">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5 mt-0.5">
                {items.map(item => {
                  const isActive = currentView === item.id
                  const badge =
                    item.id === 'today' ? (todayCount || undefined) :
                    item.id === 'inbox' ? (inboxCount || undefined) :
                    item.id === 'notes' ? (notesCount || undefined) :
                    item.id === 'friends' ? (pendingTeamRequestsCount || undefined) :
                    item.badge

                  return (
                    <motion.button
                      key={item.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
                      className={cn(
                        'w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 font-sans cursor-pointer',
                        isCollapsed ? 'p-2.5 justify-center relative' : 'gap-2 px-2.5 py-1.5',
                        isActive
                          ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                          : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                      )}
                      title={item.label}
                    >
                      <item.icon className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )} strokeWidth={isActive ? 2.5 : 2} />

                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left line-clamp-1">{item.label}</span>
                          {badge !== undefined && badge > 0 && (
                            <span className={cn(
                              'flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold shadow-xs',
                              item.id === 'friends'
                                ? 'bg-amber-500 text-black animate-pulse'
                                : 'bg-primary text-primary-foreground'
                            )}>
                              {badge}
                            </span>
                          )}
                          {isActive && <ChevronRight className="w-3 h-3 text-primary shrink-0" />}
                        </>
                      )}

                      {isCollapsed && badge !== undefined && badge > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Bottom Status bar */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-2 border-t border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-sans">{todayCount} задач осталось</span>
            <div className="flex items-center gap-1.5">
              <Circle className="w-1.5 h-1.5 fill-[var(--status-done)] text-[var(--status-done)]" />
              <span className="text-[10px] text-muted-foreground font-medium font-sans">В сети</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
