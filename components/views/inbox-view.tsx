'use client'

import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { Inbox, Users, Bell } from 'lucide-react'

import { isBirthdayTask } from '@/lib/utils'

export function InboxView() {
  const { state } = useApp()

  const uncategorized = state.tasks.filter(t => !t.projectId && !t.goalId && !isBirthdayTask(t))
  const sharedWithMe = state.tasks.filter(t => t.isShared && !isBirthdayTask(t))

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Shared tasks */}
      {sharedWithMe.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              🤝 Поручения и совместные задачи — {sharedWithMe.length}
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
            📥 Входящие задачи — {uncategorized.length}
          </h2>
        </div>
        {uncategorized.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-12 text-center"
          >
            <Inbox className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">Входящие чисты</p>
            <p className="text-xs text-muted-foreground/60">Все задачи привязаны к проектам или выполнены</p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {uncategorized.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        )}
      </div>

    </div>
  )
}
