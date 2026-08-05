'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from '@/lib/store'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/topbar'
import { TaskDetail } from '@/components/task-detail'
import { NewTaskModal } from '@/components/new-task-modal'
import { AiChatPanel } from '@/components/ai-chat-panel'
import { VoiceRecorder } from '@/components/voice-recorder'

import { TodayView }    from '@/components/views/today-view'
import { InboxView }    from '@/components/views/inbox-view'
import { TasksView }    from '@/components/views/tasks-view'
import { GoalsView }    from '@/components/views/goals-view'
import { ProjectsView } from '@/components/views/projects-view'
import { NotesView }    from '@/components/views/notes-view'
import { CalendarView } from '@/components/views/calendar-view'
import { StatsView }    from '@/components/views/stats-view'
import { FriendsView }  from '@/components/views/friends-view'
import { SettingsView } from '@/components/views/settings-view'

function AppShell() {
  const { state } = useApp()
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const handleVoice = () => setVoiceOpen(true)
    window.addEventListener('zerf:open-voice', handleVoice)
    return () => window.removeEventListener('zerf:open-voice', handleVoice)
  }, [])

  // Close mobile sidebar when view changes
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [state.currentView])

  const VIEW_MAP: Record<string, React.ReactNode> = {
    today:    <TodayView />,
    inbox:    <InboxView />,
    tasks:    <TasksView />,
    goals:    <GoalsView />,
    projects: <ProjectsView />,
    notes:    <NotesView />,
    calendar: <CalendarView />,
    stats:    <StatsView />,
    friends:  <FriendsView />,
    settings: <SettingsView />,
  }

  const isFullHeight = state.currentView === 'notes'

  return (
    <div className="app-shell flex h-screen bg-background overflow-hidden">

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
              className="fixed inset-0 bg-black/60 z-40 sm:hidden"
            />
            {/* Slide-in panel */}
            <motion.div
              key="mobile-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 left-0 h-full w-64 z-50 sm:hidden overflow-y-auto bg-background border-r border-border shadow-2xl"
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop Sidebar ── */}
      <div className="hidden sm:block sm:w-56 shrink-0 h-full overflow-y-auto border-r border-border">
        <Sidebar />
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          onNewTask={() => setNewTaskOpen(true)}
          onMenuOpen={() => setMobileSidebarOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* View */}
          <main
            className={
              isFullHeight
                ? 'app-main flex-1 min-w-0 overflow-hidden px-4 sm:px-6 py-4 sm:py-5 flex flex-col'
                : 'app-main flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5'
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={state.currentView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={isFullHeight ? 'flex-1 flex flex-col overflow-hidden' : undefined}
              >
                {VIEW_MAP[state.currentView] ?? <TodayView />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Task detail drawer */}
          <AnimatePresence>
            {state.isDetailOpen && state.selectedTaskId && (
              <motion.div
                key="detail"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="shrink-0 h-full overflow-hidden"
              >
                <TaskDetail />
              </motion.div>
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
    </div>
  )
}

export default function Page() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
