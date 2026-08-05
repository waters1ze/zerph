'use client'

import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { Inbox, Users, Bell } from 'lucide-react'

export function InboxView() {
  const { state } = useApp()

  const uncategorized = state.tasks.filter(t => !t.projectId && !t.goalId)
  const sharedWithMe = state.tasks.filter(t => t.isShared)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Shared tasks */}
      {sharedWithMe.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              Shared with you — {sharedWithMe.length}
            </h2>
          </div>
          <div className="space-y-0.5">
            {sharedWithMe.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        </div>
      )}

      {/* Uncategorized tasks */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Inbox className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
            Uncategorized — {uncategorized.length}
          </h2>
        </div>
        {uncategorized.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-12 text-center"
          >
            <Inbox className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">Inbox is clear</p>
            <p className="text-xs text-muted-foreground/60">All tasks are assigned to projects or goals</p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {uncategorized.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        )}
      </div>

      {/* Notifications placeholder */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Bell className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Notifications</h2>
        </div>
        <div className="space-y-2">
          {[
            { text: 'Maria Ivanova completed "Gather metrics" subtask', time: '2h ago' },
            { text: 'Alex Petrov assigned you to "Define KPIs" task', time: '5h ago' },
            { text: 'Reminder: Board presentation is due today', time: '8h ago' },
          ].map((n, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground">{n.text}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{n.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
