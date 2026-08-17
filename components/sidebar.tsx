'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { DEFAULT_SIDEBAR_FOLDERS, getInitialSidebarConfig, type SidebarConfig, type SidebarFolder } from '@/components/settings/sidebar-customizer-section'
import type { ExtensionItem } from '@/app/api/extensions/route'
import { ExtensionIcon } from '@/components/views/extensions-view'

export interface NavItem {
  id: View
  label: string
  icon: React.ElementType
  badge?: number
}

const NATIVE_NAV_ITEMS: Record<string, { label: string; icon: React.ElementType }> = {
  today:      { label: 'Сегодня',        icon: Sun },
  inbox:      { label: 'Входящие',       icon: Inbox },
  tasks:      { label: 'Задачи',         icon: CheckSquare },
  clock:      { label: 'Часы и Таймеры', icon: Clock },
  notes:      { label: 'Заметки',        icon: FileText },
  graph:      { label: 'Граф знаний',    icon: Network },
  calendar:   { label: 'Календарь',      icon: Calendar },
  goals:      { label: 'Цели',           icon: Target },
  projects:   { label: 'Проекты',        icon: FolderOpen },
  extensions: { label: 'Расширения',     icon: Puzzle },
  stats:      { label: 'Аналитика',      icon: BarChart2 },
  friends:    { label: 'Друзья',         icon: UserCheck },
  teams:      { label: 'Команды',        icon: Building2 },
  settings:   { label: 'Настройки',      icon: Settings },
  admin:      { label: 'Админ-панель',   icon: Crown },
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
  const [installedExts, setInstalledExts] = useState<ExtensionItem[]>([])

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
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfig>(getInitialSidebarConfig)

  // Collapsed folders state
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  useEffect(() => {
    const handleConfigChange = () => {
      setSidebarConfig(getInitialSidebarConfig())
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

      if (typeof window !== 'undefined') {
        const tgWindow = window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { first_name?: string; last_name?: string; username?: string; photo_url?: string } } } } }
        const u = tgWindow.Telegram?.WebApp?.initDataUnsafe?.user
        if (u) {
          const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.first_name || 'Пользователь'
          setTgUser({
            name: fullName,
            username: u.username || 'Telegram',
            photoUrl: u.photo_url,
          })
          dispatch({
            type: 'UPDATE_SETTINGS',
            updates: {
              name: fullName,
              integrations: { ...settings.integrations, telegram: true },
            },
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

    // Fetch installed extensions for sidebar
    const fetchInstalledExts = async () => {
      try {
        const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.success && Array.isArray(data.catalog) && Array.isArray(data.installedIds)) {
          const installed = data.catalog.filter((e: ExtensionItem) => data.installedIds.includes(e.id))
          setInstalledExts(installed)
        }
      } catch {}
    }
    fetchInstalledExts()

    const interval = setInterval(fetchPendingTeamRequests, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [dispatch])

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

  // Map of extensions for quick lookup
  const extensionsMap = useMemo(() => {
    const map = new Map<string, ExtensionItem>()
    installedExts.forEach(e => map.set(e.id, e))
    return map
  }, [installedExts])

  const activeFolders = useMemo(() => {
    return (sidebarConfig.folders || DEFAULT_SIDEBAR_FOLDERS).filter(f => !f.hidden)
  }, [sidebarConfig])

  return (
    <aside className={cn(
      'flex flex-col h-full bg-card text-card-foreground border-r border-border select-none font-sans transition-all duration-200',
      isCollapsed ? 'w-16 items-center' : 'w-full'
    )}>
      {/* Top Header: User Profile Card + Collapse Button in one row */}
      <div className={cn(
        'pt-2.5 pb-2 flex items-center border-b border-border/40',
        isCollapsed ? 'px-2 justify-center flex-col gap-2' : 'px-2.5 justify-between gap-1.5'
      )}>
        {/* Dynamic User Profile Card */}
        <div 
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
          className={cn(
            'flex-1 min-w-0 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 flex items-center cursor-pointer transition-colors group',
            isCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 gap-2.5'
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
                <p className="text-xs font-bold text-foreground truncate font-sans leading-tight" title={displayName}>
                  {displayName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate font-sans leading-tight mt-0.5">
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

        {/* Collapse Button directly next to User Profile */}
        <button
          onClick={toggleCollapse}
          className="p-2 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
          title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Dynamic Folders & Navigation */}
      <nav className={cn(
        'flex-1 overflow-y-auto pb-4 space-y-2',
        isCollapsed ? 'px-1' : 'px-2'
      )}>
        {activeFolders.map(folder => {
          const isFolderOpen = !collapsedFolders[folder.id]
          // Filter out items hidden by user
          const visibleItemIds = (folder.itemIds || []).filter(id => !sidebarConfig.hiddenItems?.includes(id))
          if (visibleItemIds.length === 0) return null

          return (
            <div key={folder.id} className="mb-1.5">
              {!isCollapsed && (
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="w-full px-2 py-1 flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-muted-foreground/80 hover:text-foreground font-sans cursor-pointer group"
                >
                  <span className="truncate">{folder.title}</span>
                  <span className="text-muted-foreground/50 group-hover:text-foreground">
                    {isFolderOpen ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                  </span>
                </button>
              )}

              {(!isCollapsed ? isFolderOpen : true) && (
                <div className="space-y-0.5 mt-0.5">
                  {visibleItemIds.map(itemId => {
                    const nativeItem = NATIVE_NAV_ITEMS[itemId]
                    const extensionItem = extensionsMap.get(itemId)

                    if (nativeItem) {
                      const isActive = currentView === itemId
                      const badge =
                        itemId === 'today' ? (todayCount || undefined) :
                        itemId === 'inbox' ? (inboxCount || undefined) :
                        itemId === 'notes' ? (notesCount || undefined) :
                        itemId === 'friends' ? (pendingTeamRequestsCount || undefined) :
                        undefined

                      const Icon = nativeItem.icon

                      return (
                        <motion.button
                          key={itemId}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => dispatch({ type: 'SET_VIEW', view: itemId as View })}
                          className={cn(
                            'w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 font-sans cursor-pointer',
                            isCollapsed ? 'p-2.5 justify-center relative' : 'gap-2 px-2.5 py-1.5',
                            isActive
                              ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                              : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                          )}
                          title={nativeItem.label}
                        >
                          <Icon className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          )} strokeWidth={isActive ? 2.5 : 2} />

                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-left line-clamp-1">{nativeItem.label}</span>
                              {badge !== undefined && badge > 0 && (
                                <span className={cn(
                                  'flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold shadow-xs',
                                  itemId === 'friends'
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
                    }

                    if (extensionItem) {
                      return (
                        <motion.button
                          key={itemId}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => dispatch({ type: 'SET_VIEW', view: 'extensions' })}
                          className={cn(
                            'w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 font-sans cursor-pointer',
                            isCollapsed ? 'p-2.5 justify-center relative' : 'gap-2 px-2.5 py-1.5',
                            'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                          )}
                          title={extensionItem.title}
                        >
                          <ExtensionIcon icon={extensionItem.icon} className="w-4 h-4 text-xs shrink-0" />
                          {!isCollapsed && (
                            <span className="flex-1 text-left line-clamp-1 truncate text-xs">
                              {extensionItem.title}
                            </span>
                          )}
                        </motion.button>
                      )
                    }

                    return null
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Admin panel link at bottom for admins if not placed in folders */}
        {isAdmin && !sidebarConfig.hiddenItems?.includes('admin') && (
          <div className="pt-2 border-t border-border/40 mt-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => dispatch({ type: 'SET_VIEW', view: 'admin' })}
              className={cn(
                'w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 font-sans cursor-pointer text-amber-400 hover:bg-amber-500/10',
                isCollapsed ? 'p-2.5 justify-center relative' : 'gap-2 px-2.5 py-1.5',
                currentView === 'admin' && 'bg-amber-500/20 font-bold border border-amber-500/30'
              )}
              title="Админ-панель"
            >
              <Crown className="w-4 h-4 shrink-0 text-amber-400" />
              {!isCollapsed && <span className="flex-1 text-left">Админ-панель</span>}
            </motion.button>
          </div>
        )}
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
