'use client'

/**
 * Telegram Mini App page — full Zerf interface
 * Works both inside Telegram (via WebApp) and in browser (via ?chatId=xxx link)
 */

import { useEffect } from 'react'
import { useState } from 'react'
import { AppProvider, useApp } from '@/lib/store'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/topbar'
import { TaskDetail } from '@/components/task-detail'
import { NewTaskModal } from '@/components/new-task-modal'
import { AiChatPanel } from '@/components/ai-chat-panel'
import { AnimatePresence, motion } from 'framer-motion'

import { TodayView }    from '@/components/views/today-view'
import { InboxView }    from '@/components/views/inbox-view'
import { TasksView }    from '@/components/views/tasks-view'
import { GoalsView }    from '@/components/views/goals-view'
import { ProjectsView } from '@/components/views/projects-view'
import { NotesView }    from '@/components/views/notes-view'
import { StatsView }    from '@/components/views/stats-view'
import { FriendsView }  from '@/components/views/friends-view'
import { SettingsView } from '@/components/views/settings-view'

function TgAppShell() {
  const { state } = useApp()
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Expand Telegram WebApp to full screen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        tg.ready()
        tg.expand()
        tg.disableVerticalSwipes?.()
      }
    }
  }, [])

  const VIEW_MAP: Record<string, React.ReactNode> = {
    today:    <TodayView />,
    inbox:    <InboxView />,
    tasks:    <TasksView />,
    goals:    <GoalsView />,
    projects: <ProjectsView />,
    notes:    <NotesView />,
    stats:    <StatsView />,
    friends:  <FriendsView />,
    settings: <SettingsView />,
  }

  const isFullHeight = state.currentView === 'notes'

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Desktop sidebar (visible on md+) */}
      <div className="hidden md:block w-56 shrink-0 h-full overflow-y-auto">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-0 top-0 z-50 w-56 h-full md:hidden"
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onNewTask={() => setNewTaskOpen(true)} />

        <div className="flex flex-1 overflow-hidden">
          <main
            className={
              isFullHeight
                ? 'flex-1 min-w-0 overflow-hidden px-4 py-4 flex flex-col'
                : 'flex-1 min-w-0 overflow-y-auto px-4 py-4'
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

          <AnimatePresence>
            {state.isDetailOpen && state.selectedTaskId && (
              <motion.div
                key="detail"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
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

      <AiChatPanel />
      <NewTaskModal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </div>
  )
}

export default function TelegramPage() {
  return (
    <AppProvider>
      <TgAppShell />
    </AppProvider>
  )
}
