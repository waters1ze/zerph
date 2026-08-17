'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp, getTgChatId } from '@/lib/store'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/topbar'
import { TaskDetail } from '@/components/task-detail'
import { NewTaskModal } from '@/components/new-task-modal'
import { AiChatPanel } from '@/components/ai-chat-panel'
import { VoiceRecorder } from '@/components/voice-recorder'
import { Menu } from 'lucide-react'

import { TodayView }    from '@/components/views/today-view'
import { InboxView }    from '@/components/views/inbox-view'
import { TasksView }    from '@/components/views/tasks-view'
import { GoalsView }    from '@/components/views/goals-view'
import { NotesView }    from '@/components/views/notes-view'
import { CalendarView } from '@/components/views/calendar-view'
import { StatsView }    from '@/components/views/stats-view'
import { FriendsView }  from '@/components/views/friends-view'
import { TeamsView }    from '@/components/views/teams-view'
import { SettingsView } from '@/components/views/settings-view'

import { ProjectsView } from '@/components/views/projects-view'
import { AdminView } from '@/components/views/admin-view'
import { ClockView } from '@/components/views/clock-view'
import { GraphView } from '@/components/views/graph-view'
import { ExtensionsView } from '@/components/views/extensions-view'
import { AuthGateModal } from '@/components/auth-gate-modal'
import { PullToRefresh } from '@/components/ui/pull-to-refresh'
import { cn } from '@/lib/utils'

export function AppShell() {
  const { state, dispatch, syncData } = useApp()
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zerf_sidebar_collapsed') === 'true'
    }
    return false
  })

  useEffect(() => {
    const handleCollapseChange = (e: any) => {
      setIsDesktopCollapsed(Boolean(e.detail))
    }
    window.addEventListener('zerf_sidebar_collapse_changed', handleCollapseChange)
    return () => window.removeEventListener('zerf_sidebar_collapse_changed', handleCollapseChange)
  }, [])

  const handleOpenNewTask = () => {
    const chatId = getTgChatId()
    if (!chatId || chatId.startsWith('guest_')) {
      setAuthModalOpen(true)
      return
    }
    setNewTaskOpen(true)
  }

  const handleOpenVoice = () => {
    const chatId = getTgChatId()
    if (!chatId || chatId.startsWith('guest_')) {
      setAuthModalOpen(true)
      return
    }
    setVoiceOpen(true)
  }

  useEffect(() => {
    const handleVoice = () => handleOpenVoice()
    window.addEventListener('zerf:open-voice', handleVoice)
    return () => window.removeEventListener('zerf:open-voice', handleVoice)
  }, [])

  // Handle PWA shortcut action / view query params on launch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const action = params.get('action')
      const view = params.get('view')

      if (action === 'new_task') {
        setTimeout(() => handleOpenNewTask(), 300)
      } else if (action === 'voice') {
        setTimeout(() => handleOpenVoice(), 300)
      }

      if (view && ['today', 'inbox', 'tasks', 'goals', 'notes', 'calendar', 'stats', 'friends', 'teams', 'projects', 'extensions', 'settings'].includes(view)) {
        dispatch({ type: 'SET_VIEW', view: view as any })
      }
    }
  }, [])

  // Close mobile sidebar when view changes
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [state.currentView])

  const VIEW_MAP: Record<string, React.ReactNode> = {
    today:      <TodayView />,
    inbox:      <InboxView />,
    tasks:      <TasksView />,
    clock:      <ClockView />,
    goals:      <GoalsView />,
    notes:      <NotesView />,
    graph:      <GraphView />,
    calendar:   <CalendarView />,
    stats:      <StatsView />,
    friends:    <FriendsView />,
    teams:      <TeamsView />,
    extensions: <ExtensionsView />,
    settings:   <SettingsView />,
    projects:   <ProjectsView />,
    admin:      <AdminView />,
  }

  const isFullHeight = state.currentView === 'notes' || state.currentView === 'graph' || state.currentView === 'settings' || state.currentView === 'extensions'

  return (
    <div className="app-shell flex h-[100dvh] min-h-[100dvh] bg-background overflow-hidden relative pb-[env(safe-area-inset-bottom,0px)]">
      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            {/* Dim backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/70 z-50 sm:hidden backdrop-blur-xs"
            />
            {/* Slide-in panel */}
            <motion.div
              key="mobile-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 left-0 h-full w-[280px] max-w-[85vw] z-50 sm:hidden overflow-y-auto no-scrollbar bg-card border-r border-border shadow-2xl flex flex-col"
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop Sidebar ── */}
      <div className={cn(
        'hidden sm:block shrink-0 h-full overflow-y-auto no-scrollbar border-r border-border transition-all duration-200',
        isDesktopCollapsed ? 'sm:w-16' : 'sm:w-56'
      )}>
        <Sidebar
          isCollapsed={isDesktopCollapsed}
          onToggleCollapse={() => {
            const next = !isDesktopCollapsed
            setIsDesktopCollapsed(next)
            try {
              localStorage.setItem('zerf_sidebar_collapsed', String(next))
              window.dispatchEvent(new CustomEvent('zerf_sidebar_collapse_changed', { detail: next }))
            } catch {}
          }}
        />
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          onNewTask={handleOpenNewTask}
          onMenuOpen={() => setMobileSidebarOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden relative">
          {/* View */}
          <main
            className={
              isFullHeight
                ? 'app-main flex-1 min-w-0 overflow-hidden p-0 sm:p-2 flex flex-col'
                : 'app-main flex-1 min-w-0 overflow-y-auto px-3.5 sm:px-6 py-3.5 sm:py-5'
            }
          >
            <PullToRefresh onRefresh={syncData}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.currentView}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className={isFullHeight ? 'flex-1 flex flex-col overflow-hidden h-full' : undefined}
                >
                  {VIEW_MAP[state.currentView] ?? <TodayView />}
                </motion.div>
              </AnimatePresence>
            </PullToRefresh>
          </main>

          {/* Task detail drawer — responsive overlay on mobile, inline panel on desktop */}
          <AnimatePresence>
            {state.isDetailOpen && state.selectedTaskId && (
              <>
                {/* Mobile backdrop for detail */}
                <motion.div
                  key="detail-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => dispatch({ type: 'TOGGLE_DETAIL', open: false })}
                  className="fixed inset-0 bg-black/60 z-40 sm:hidden backdrop-blur-xs"
                />
                <motion.div
                  key="detail"
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed sm:static right-0 top-0 bottom-0 z-50 sm:z-auto w-full max-w-[420px] sm:w-[360px] h-full shrink-0 overflow-hidden bg-card border-l border-border shadow-2xl sm:shadow-none"
                >
                  <TaskDetail />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AI Chat panel */}
      <AiChatPanel />

      {/* New task modal */}
      <NewTaskModal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />

      {/* Voice recorder */}
      <VoiceRecorder open={voiceOpen} onClose={() => setVoiceOpen(false)} />

      {/* Telegram Auth Gate Modal */}
      <AuthGateModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}

export default function Page() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  
  if (!mounted) return null

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
