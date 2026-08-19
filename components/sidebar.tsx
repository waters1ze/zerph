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
  PanelLeftClose, PanelLeftOpen, Folder, X
} from 'lucide-react'
import { DEFAULT_SIDEBAR_FOLDERS, getInitialSidebarConfig, type SidebarConfig, type SidebarFolder } from '@/components/settings/sidebar-customizer-section'
import type { ExtensionItem } from '@/app/api/extensions/route'
import { ExtensionIcon } from '@/components/views/extensions-view'
import { ZerfAvatar } from '@/components/ui/zerf-avatar'
import { planAtLeast, type PlanId } from '@/lib/plans'
import { ZerficLiveModal } from '@/components/views/zerfic-live-modal'

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

// Client-side in-memory request cache to minimize Vercel function invocations
let cachedAdminCheck: { isAdmin: boolean; timestamp: number } | null = null
let cachedUserProfile: { data: any; timestamp: number } | null = null
let cachedPendingCount: { count: number; timestamp: number } | null = null
let cachedInstalledExts: { exts: ExtensionItem[]; timestamp: number } | null = null

export function Sidebar({ isCollapsed: externalCollapsed, onToggleCollapse: externalToggle }: SidebarProps) {
  const { state, dispatch } = useApp()
  const { currentView, tasks, notes, settings } = state

  const [tgUser, setTgUser] = useState<{ name: string; username: string; photoUrl?: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingTeamRequestsCount, setPendingTeamRequestsCount] = useState<number>(0)
  const [installedExts, setInstalledExts] = useState<ExtensionItem[]>([])
  const [enabledExtIds, setEnabledExtIds] = useState<string[]>([])
  const [disabledNotice, setDisabledNotice] = useState<string | null>(null)
  const [showZerficLiveModal, setShowZerficLiveModal] = useState<boolean>(false)

  // User Avatar Emoji State
  const [userAvatarEmoji, setUserAvatarEmoji] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zerf_avatar_emoji') || 'zerfik_spirit'
    }
    return 'zerfik_spirit'
  })

  useEffect(() => {
    const handleAvatarChange = (e: any) => {
      if (e?.detail) setUserAvatarEmoji(e.detail)
    }
    window.addEventListener('zerf_avatar_changed', handleAvatarChange as EventListener)
    return () => window.removeEventListener('zerf_avatar_changed', handleAvatarChange as EventListener)
  }, [])

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
    const handleConfigChange = (e?: any) => {
      if (e?.detail && typeof e.detail === 'object' && Array.isArray(e.detail.folders)) {
        setSidebarConfig(e.detail)
      } else {
        setSidebarConfig(getInitialSidebarConfig())
      }
    }
    window.addEventListener('zerf_sidebar_config_changed', handleConfigChange)
    return () => window.removeEventListener('zerf_sidebar_config_changed', handleConfigChange)
  }, [])

  useEffect(() => {
    const now = Date.now()

    // Check if user is Admin with cache
    const checkAdmin = async () => {
      try {
        if (cachedAdminCheck && now - cachedAdminCheck.timestamp < 300_000) {
          setIsAdmin(cachedAdminCheck.isAdmin)
          return
        }

        const headers = getAuthHeaders()
        const res = await fetch(`/api/admin/check`, { headers: { 'Content-Type': 'application/json', ...headers } })
        const data = await res.json()
        cachedAdminCheck = { isAdmin: Boolean(data.isAdmin), timestamp: Date.now() }
        if (data.isAdmin) {
          setIsAdmin(true)
        }
      } catch {}
    }
    checkAdmin()

    // Fetch real profile from DB with cache
    const fetchUserProfile = async () => {
      try {
        if (cachedUserProfile && now - cachedUserProfile.timestamp < 120_000) {
          const data = cachedUserProfile.data
          if (data.connected && data.name) {
            setTgUser({ name: data.name, username: data.username || 'Telegram', photoUrl: undefined })
            if (data.isAdmin) setIsAdmin(true)
            if (data.sidebarConfig) {
              setSidebarConfig(data.sidebarConfig)
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

        const headers = getAuthHeaders()
        if (Object.keys(headers).length > 0) {
          const res = await fetch('/api/telegram/user', { headers })
          const data = await res.json()
          cachedUserProfile = { data, timestamp: Date.now() }
          if (data.connected && data.name) {
            setTgUser({
              name: data.name,
              username: data.username || 'Telegram',
              photoUrl: undefined,
            })
            if (data.isAdmin) {
              setIsAdmin(true)
            }
            if (data.sidebarConfig && typeof window !== 'undefined') {
              try {
                localStorage.setItem('zerf_sidebar_config_v2', JSON.stringify(data.sidebarConfig))
                localStorage.setItem('zerf_sidebar_config', JSON.stringify(data.sidebarConfig))
                setSidebarConfig(data.sidebarConfig)
                window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed', { detail: data.sidebarConfig }))
              } catch {}
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

    // Fetch pending team join requests count with cache
    const fetchPendingTeamRequests = async () => {
      try {
        if (cachedPendingCount && Date.now() - cachedPendingCount.timestamp < 180_000) {
          setPendingTeamRequestsCount(cachedPendingCount.count)
          return
        }

        const headers = getAuthHeaders()
        if (Object.keys(headers).length > 0) {
          const res = await fetch('/api/teams', { headers })
          const data = await res.json()
          if (data.success && Array.isArray(data.pendingRequests)) {
            cachedPendingCount = { count: data.pendingRequests.length, timestamp: Date.now() }
            setPendingTeamRequestsCount(data.pendingRequests.length)
          }
        }
      } catch {}
    }
    fetchPendingTeamRequests()

    // Fetch installed and enabled extensions for sidebar with cache
    const fetchInstalledExts = async (force = false) => {
      try {
        if (!force && cachedInstalledExts && Date.now() - cachedInstalledExts.timestamp < 120_000) {
          setInstalledExts(cachedInstalledExts.exts)
          return
        }

        const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.success && Array.isArray(data.catalog)) {
          const installedIds = Array.isArray(data.installedIds) ? data.installedIds : []
          const enabledIds = Array.isArray(data.enabledIds) ? data.enabledIds : installedIds
          setEnabledExtIds(enabledIds)
          const myExts = Array.isArray(data.myExtensions) ? data.myExtensions : []
          const myIds = myExts.map((e: any) => e.id)
          // Keep ALL installed or user-owned extensions so they NEVER disappear from sidebar
          const activeExts = data.catalog.filter((e: ExtensionItem) =>
            installedIds.includes(e.id) || enabledIds.includes(e.id) || myIds.includes(e.id)
          )
          cachedInstalledExts = { exts: activeExts, timestamp: Date.now() }
          setInstalledExts(activeExts)
        }
      } catch {}
    }
    fetchInstalledExts()

    const handleSidebarConfigChanged = (e?: any) => {
      if (e?.detail) {
        setSidebarConfig(e.detail)
      } else {
        setSidebarConfig(getInitialSidebarConfig())
      }
      cachedInstalledExts = null
      fetchInstalledExts(true)
    }
    const handleOpenZerficLive = () => dispatch({ type: 'SET_VIEW', view: 'live' })

    window.addEventListener('zerf_sidebar_config_changed', handleSidebarConfigChanged)
    window.addEventListener('zerf_extensions_updated', handleSidebarConfigChanged)
    window.addEventListener('zerf_extension_installed', handleSidebarConfigChanged)
    window.addEventListener('zerf_open_zerfic_live', handleOpenZerficLive)
    window.addEventListener('zerf_sync', handleSidebarConfigChanged)

    const interval = setInterval(fetchPendingTeamRequests, 10 * 60 * 1000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('zerf_sidebar_config_changed', handleSidebarConfigChanged)
      window.removeEventListener('zerf_extensions_updated', handleSidebarConfigChanged)
      window.removeEventListener('zerf_extension_installed', handleSidebarConfigChanged)
      window.removeEventListener('zerf_open_zerfic_live', handleOpenZerficLive)
      window.removeEventListener('zerf_sync', handleSidebarConfigChanged)
    }
  }, [dispatch])

  const todayCount = tasks.filter(t => {
    const d = t.dueDate
    const today = new Date().toISOString().slice(0, 10)
    return d === today && t.status !== 'done' && !(t as any).isDeleted
  }).length

  const activeTasksCount = tasks.filter(t => t.status !== 'done' && !(t as any).isDeleted && !isYearlyEventTask(t)).length
  const todayStr = new Date().toISOString().slice(0, 10)
  const completedTodayCount = tasks.filter(t => t.status === 'done' && !(t as any).isDeleted && (((t as any).completedAt && String((t as any).completedAt).startsWith(todayStr)) || (t.dueDate === todayStr))).length

  // Inbound tasks only: shared with others, delegated to me, or created by other authors
  const inboxCount = tasks.filter(t => {
    if (t.status === 'done' || (t as any).isDeleted || isYearlyEventTask(t)) return false
    const tags = (t.tags || []).map(x => String(x).toLowerCase())
    const isSharedOrDelegated = t.isShared || tags.includes('общая') || tags.includes('общие') || tags.includes('совместная') || tags.includes('поручение') || tags.includes('делегировано') || tags.includes('поручено') || tags.includes('входящие')
    const hasMultipleAssignees = Array.isArray(t.assignees) && t.assignees.length > 1
    const isFromOtherAuthor = Boolean(t.authorChatId && t.ownerChatId && String(t.authorChatId) !== String(t.ownerChatId))
    return isSharedOrDelegated || hasMultipleAssignees || isFromOtherAuthor
  }).length
  const notesCount = notes.length

  const displayName = (settings.name && settings.name.trim() && settings.name !== 'Мой профиль' ? settings.name.trim() : null) || tgUser?.name || 'Мой профиль'
  const isConnected = settings.integrations.telegram || !!tgUser || (!!settings.name && settings.name !== 'Kirill Perekatnov')
  const userSubtext = tgUser?.username
    ? `${tgUser.username} · Подключено`
    : (isConnected ? 'Telegram Подключён' : 'Telegram Не подключён')

  // Map of extensions for quick lookup strictly from user's installed extensions
  const extensionsMap = useMemo(() => {
    const map = new Map<string, Partial<ExtensionItem>>()
    // Built-in starter extension fallback
    map.set('ext_entropy_search', {
      id: 'ext_entropy_search',
      title: 'Entropy AI Search',
      icon: '🔮',
      isPublished: true,
      minPlan: 'free',
    })
    installedExts.forEach(e => map.set(e.id, e))
    return map
  }, [installedExts])

  const activeFolders = useMemo(() => {
    return (sidebarConfig.folders || DEFAULT_SIDEBAR_FOLDERS).filter(f => !f.hidden)
  }, [sidebarConfig])

  // Track itemIds assigned to visible folders
  const assignedItemIds = useMemo(() => {
    const set = new Set<string>()
    activeFolders.forEach(f => {
      (f.itemIds || []).forEach(id => set.add(id))
    })
    return set
  }, [activeFolders])

  // Active extensions that are enabled but not yet inside any folder
  const unassignedActiveExts = useMemo(() => {
    return installedExts.filter(ext =>
      !assignedItemIds.has(ext.id) &&
      !sidebarConfig.hiddenItems?.includes(ext.id)
    )
  }, [installedExts, assignedItemIds, sidebarConfig.hiddenItems])

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
            'flex-1 min-w-0 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 flex items-center cursor-pointer transition-colors group touch-manipulation',
            isCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 gap-2.5'
          )}
          title={`Профиль: ${displayName} (кликните для настроек)`}
        >
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden border border-primary/30 text-primary group-hover:scale-105 transition-transform">
            {userAvatarEmoji ? (
              <ZerfAvatar emoji={userAvatarEmoji} size="sm" />
            ) : tgUser?.photoUrl ? (
              <img src={tgUser.photoUrl} alt="Avatar" className="w-full h-full object-cover grayscale contrast-125" />
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
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate font-sans leading-tight mt-0.5">
                  <span className="text-foreground/90 font-medium">{activeTasksCount} активных</span>
                  <span className="opacity-40">•</span>
                  <span>{completedTodayCount} выполнено</span>
                </div>
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
          const visibleItemIds = (folder.itemIds || []).filter(id => id === 'settings' || !sidebarConfig.hiddenItems?.includes(id))
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
                        itemId === 'tasks' ? (activeTasksCount || undefined) :
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
                      const userPlan = (state.settings?.userPlan as PlanId) || 'free'
                      const isPlanRestricted = Boolean(
                        extensionItem.minPlan &&
                        extensionItem.minPlan !== 'free' &&
                        !planAtLeast(userPlan, extensionItem.minPlan as PlanId)
                      )
                      const isEntropy = itemId === 'ext_entropy_search' || extensionItem.id === 'ext_entropy_search' || extensionItem.title?.toLowerCase().includes('entropy')
                      const isZerfic = itemId === 'ext_zerfic_live' || itemId === 'zerfic-live' || extensionItem.id === 'ext_zerfic_live' || extensionItem.id === 'zerfic-live' || extensionItem.title?.toLowerCase().includes('zerfic')
                      const isSelected = isEntropy ? currentView === 'entropy' : isZerfic ? currentView === 'live' : currentView === 'extensions'
                      const isOwnerDisabled = extensionItem.isPublished === false || (extensionItem as any).isDisabledByOwner === true
                      const isUserDisabled = Boolean(extensionItem.id && !enabledExtIds.includes(extensionItem.id) && !isOwnerDisabled)

                      return (
                        <motion.button
                          key={itemId}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            if (isOwnerDisabled) {
                              setDisabledNotice(`🔴 Расширение «${extensionItem.title}» отключено автором или снято с публикации`)
                              setTimeout(() => setDisabledNotice(null), 4000)
                              dispatch({ type: 'SET_VIEW', view: 'extensions' })
                              return
                            }
                            if (isPlanRestricted) {
                              setDisabledNotice(`🔒 Расширение «${extensionItem.title}» приостановлено: требуется тариф ${extensionItem.minPlan?.toUpperCase() || 'PRO'}. Оно сохранено на вашей панели!`)
                              setTimeout(() => setDisabledNotice(null), 5000)
                              dispatch({ type: 'SET_VIEW', view: 'extensions' })
                              return
                            }
                            if (isEntropy) {
                              dispatch({ type: 'SET_VIEW', view: 'entropy' })
                              window.dispatchEvent(new CustomEvent('zerf_open_entropy_search'))
                              return
                            }
                            if (isZerfic) {
                              dispatch({ type: 'SET_VIEW', view: 'live' })
                              window.dispatchEvent(new CustomEvent('zerf_open_zerfic_live'))
                              return
                            }
                            dispatch({ type: 'SET_VIEW', view: 'extensions' })
                          }}
                          className={cn(
                            'w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 font-sans cursor-pointer',
                            isCollapsed ? 'p-2.5 justify-center relative' : 'gap-2 px-2.5 py-1.5',
                            isSelected
                              ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                              : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                          )}
                          title={
                            isOwnerDisabled
                              ? `${extensionItem.title} (🔴 Отключено автором)`
                              : isPlanRestricted
                                ? `${extensionItem.title} (🔴 Приостановлено: требуется тариф ${extensionItem.minPlan?.toUpperCase()})`
                                : isUserDisabled
                                  ? `${extensionItem.title} (⚪ Отключено в настройках)`
                                  : extensionItem.title
                          }
                        >
                          <ExtensionIcon icon={extensionItem.icon} className="w-4 h-4 text-xs shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className={cn('flex-1 text-left line-clamp-1 truncate text-xs', (isOwnerDisabled || isPlanRestricted) && 'text-muted-foreground')}>
                                {extensionItem.title}
                              </span>
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
                                  isOwnerDisabled || isPlanRestricted
                                    ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                                    : isUserDisabled
                                      ? 'bg-muted-foreground/40'
                                      : 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]'
                                )}
                                title={
                                  isOwnerDisabled
                                    ? '🔴 Отключено автором / Недоступно'
                                    : isPlanRestricted
                                      ? `🔴 Приостановлено (требуется тариф ${extensionItem.minPlan?.toUpperCase()})`
                                      : isUserDisabled
                                        ? '⚪ Отключено в настройках'
                                        : '🟢 Активно'
                                }
                              />
                            </>
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

        {/* Dynamic active extensions that are not in any folder yet */}
        {unassignedActiveExts.length > 0 && (
          <div className="mb-1.5 pt-1">
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => toggleFolder('extensions_dynamic')}
                className="w-full px-2 py-1 flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-muted-foreground/80 hover:text-foreground font-sans cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">Расширения</span>
                  <span className="text-emerald-400 font-mono text-[9px] font-semibold">{unassignedActiveExts.length}</span>
                </div>
                <span className="text-muted-foreground/50 group-hover:text-foreground">
                  {!collapsedFolders['extensions_dynamic'] ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                </span>
              </button>
            )}
            {(!isCollapsed ? !collapsedFolders['extensions_dynamic'] : true) && (
              <div className="space-y-0.5 mt-0.5">
              {unassignedActiveExts.map(ext => {
                const userPlan = (state.settings?.userPlan as PlanId) || 'free'
                const isPlanRestricted = Boolean(
                  ext.minPlan &&
                  ext.minPlan !== 'free' &&
                  !planAtLeast(userPlan, ext.minPlan as PlanId)
                )
                const isEntropy = ext.id === 'ext_entropy_search' || ext.title?.toLowerCase().includes('entropy')
                const isZerfic = ext.id === 'ext_zerfic_live' || ext.id === 'zerfic-live' || ext.title?.toLowerCase().includes('zerfic')
                const isSelected = isEntropy ? currentView === 'entropy' : isZerfic ? currentView === 'live' : currentView === 'extensions'
                const isOwnerDisabled = ext.isPublished === false || (ext as any).isDisabledByOwner === true
                const isUserDisabled = !enabledExtIds.includes(ext.id) && !isOwnerDisabled

                return (
                  <motion.button
                    key={ext.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (isOwnerDisabled) {
                        setDisabledNotice(`🔴 Расширение «${ext.title}» отключено автором или снято с публикации`)
                        setTimeout(() => setDisabledNotice(null), 4000)
                        dispatch({ type: 'SET_VIEW', view: 'extensions' })
                        return
                      }
                      if (isPlanRestricted) {
                        setDisabledNotice(`🔒 Расширение «${ext.title}» приостановлено: требуется тариф ${ext.minPlan?.toUpperCase() || 'PRO'}. Оно сохранено на вашей панели!`)
                        setTimeout(() => setDisabledNotice(null), 5000)
                        dispatch({ type: 'SET_VIEW', view: 'extensions' })
                        return
                      }
                      if (isEntropy) {
                        dispatch({ type: 'SET_VIEW', view: 'entropy' })
                        window.dispatchEvent(new CustomEvent('zerf_open_entropy_search'))
                        return
                      }
                      if (isZerfic) {
                        dispatch({ type: 'SET_VIEW', view: 'live' })
                        window.dispatchEvent(new CustomEvent('zerf_open_zerfic_live'))
                        return
                      }
                      dispatch({ type: 'SET_VIEW', view: 'extensions' })
                    }}
                    className={cn(
                      'w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 font-sans cursor-pointer',
                      isCollapsed ? 'p-2.5 justify-center relative' : 'gap-2 px-2.5 py-1.5',
                      isSelected
                        ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                        : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                    )}
                    title={
                      isOwnerDisabled
                        ? `${ext.title} (🔴 Отключено автором)`
                        : isPlanRestricted
                          ? `${ext.title} (🔴 Приостановлено: требуется тариф ${ext.minPlan?.toUpperCase()})`
                          : isUserDisabled
                            ? `${ext.title} (⚪ Отключено в настройках)`
                            : ext.title
                    }
                  >
                    <ExtensionIcon icon={ext.icon} className="w-4 h-4 text-xs shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className={cn('flex-1 text-left line-clamp-1 truncate text-xs', (isOwnerDisabled || isPlanRestricted) && 'text-muted-foreground')}>
                          {ext.title}
                        </span>
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
                            isOwnerDisabled || isPlanRestricted
                              ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                              : isUserDisabled
                                ? 'bg-muted-foreground/40'
                                : 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]'
                          )}
                          title={
                            isOwnerDisabled
                              ? '🔴 Отключено автором / Недоступно'
                              : isPlanRestricted
                                ? `🔴 Приостановлено (требуется тариф ${ext.minPlan?.toUpperCase()})`
                                : isUserDisabled
                                  ? '⚪ Отключено в настройках'
                                  : '🟢 Активно'
                          }
                        />
                      </>
                    )}
                  </motion.button>
                )
              })}
            </div>
          )}
          </div>
        )}

        {/* Marketplace of Extensions & Themes Direct Link (Modal Overlay, hidden by default) */}
        {sidebarConfig.showMarketplace === true && (
          <div className="pt-2 border-t border-border/40 mt-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('zerf_open_marketplace'))
              }}
              className={cn(
                'w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 font-sans cursor-pointer text-primary hover:bg-primary/10',
                isCollapsed ? 'p-2.5 justify-center relative' : 'gap-2 px-2.5 py-1.5'
              )}
              title="Магазин расширений и тем"
            >
              <Puzzle className="w-4 h-4 shrink-0 text-primary" />
              {!isCollapsed && <span className="flex-1 text-left truncate">Магазин расширений</span>}
            </motion.button>
          </div>
        )}

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

      {/* Bottom Daily Status Bar (Strict Rectangular Card, No Profile) */}
      <div className={cn('border-t border-border/60 bg-card/80 transition-all pb-[max(0.5rem,env(safe-area-inset-bottom))]', isCollapsed ? 'p-2 flex justify-center' : 'p-2.5')}>
        {!isCollapsed ? (
          <div
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'today' })}
            className="p-3 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/70 hover:border-primary/40 transition-all cursor-pointer group shadow-2xs select-none touch-manipulation"
            title="Открыть задачи на сегодня"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-xs bg-emerald-500 shadow-xs shrink-0" />
                <span className="text-[11px] font-bold text-foreground truncate uppercase tracking-wider font-sans">
                  Сегодня
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                {completedTodayCount}/{todayCount + completedTodayCount}
                <span className="text-[10px] opacity-70 ml-1 font-normal">
                  ({todayCount + completedTodayCount > 0 ? Math.round((completedTodayCount / (todayCount + completedTodayCount)) * 100) : 0}%)
                </span>
              </span>
            </div>

            {/* Daily Progress Bar */}
            <div className="w-full h-1.5 rounded-xs bg-muted overflow-hidden mb-2 border border-border/50">
              <div
                className="h-full bg-emerald-500 rounded-xs transition-all duration-300"
                style={{ width: `${todayCount + completedTodayCount > 0 ? Math.round((completedTodayCount / (todayCount + completedTodayCount)) * 100) : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono leading-none">
              <span className="text-amber-400 font-semibold">{todayCount} активных</span>
              <span className="text-emerald-400 font-semibold">{completedTodayCount} сделано</span>
            </div>
          </div>
        ) : (
          <div
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'today' })}
            className="w-10 h-10 rounded-lg border border-border/70 hover:border-primary/50 bg-muted/30 hover:bg-muted/60 flex flex-col items-center justify-center cursor-pointer transition-all select-none group"
            title={`Сегодня: ${todayCount} активных, ${completedTodayCount} сделано`}
          >
            <span className="text-xs font-mono font-bold text-emerald-400 group-hover:scale-105 transition-transform">
              {todayCount}
            </span>
          </div>
        )}
      </div>

      {/* Floating Notice when clicking disabled extension */}
      <AnimatePresence>
        {disabledNotice && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-16 left-4 z-[300] max-w-xs p-3 rounded-2xl bg-card/95 border border-rose-500/40 text-foreground shadow-2xl text-xs flex items-center gap-2 backdrop-blur-xl pointer-events-auto"
          >
            <span className="flex-1 leading-snug">{disabledNotice}</span>
            <button
              type="button"
              onClick={() => setDisabledNotice(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zerfic Live Voice Companion Dedicated Modal */}
      <ZerficLiveModal
        isOpen={showZerficLiveModal}
        onClose={() => setShowZerficLiveModal(false)}
      />
    </aside>
  )
}
