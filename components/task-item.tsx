'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { TaskCheckbox } from './task-checkbox'
import { PriorityBadge } from './priority-badge'
import { useApp } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Task } from '@/lib/types'
import { CalendarDays, Users, Sparkles, ChevronRight, Trash2, Clock } from 'lucide-react'
import { format, isToday, isPast, parseISO } from 'date-fns'

interface Props {
  task: Task
  index?: number
  compact?: boolean
}

export function TaskItem({ task, index = 0, compact = false }: Props) {
  const { state, dispatch } = useApp()
  const confirm = useConfirmDialog()
  const isDone = task.status === 'done'
  const isOverdue = task.status === 'overdue' || (task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== 'done')
  const project = task.projectId ? state.projects.find(p => p.id === task.projectId) : null

  const dueDateLabel = task.dueDate
    ? isToday(parseISO(task.dueDate))
      ? 'Today'
      : format(parseISO(task.dueDate), 'MMM d')
    : null

  const isTaskDueToday = !task.dueDate || isToday(parseISO(task.dueDate))

  let countdownLabel: string | null = null
  let timeUntilText: string | null = null
  let minutesLeft = 0
  let isPassed = false
  if (task.dueTime && !isDone) {
    const now = new Date()
    const [h, m] = task.dueTime.split(':').map(Number)
    let due: Date
    if (task.dueDate && task.dueDate.includes('-')) {
      const [year, month, day] = task.dueDate.split('-').map(Number)
      due = new Date(year, month - 1, day, h, m)
    } else {
      due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
    }
    const diffMs = due.getTime() - now.getTime()
    minutesLeft = Math.round(diffMs / 60000)

    if (minutesLeft > 0) {
      if (minutesLeft < 60) {
        timeUntilText = `${minutesLeft} мин`
      } else if (minutesLeft < 1440) {
        const hours = Math.floor(minutesLeft / 60)
        const mins = minutesLeft % 60
        timeUntilText = `${hours} ч ${mins} мин`
      } else {
        const days = Math.floor(minutesLeft / 1440)
        const remMins = minutesLeft % 1440
        const hours = Math.floor(remMins / 60)
        const mins = remMins % 60
        timeUntilText = `${days} д ${hours} ч ${mins} мин`
      }

      if (isTaskDueToday || minutesLeft <= 1440) {
        countdownLabel = `⌛ Осталось: ${timeUntilText}`
      }
    } else if (minutesLeft >= -5 && minutesLeft <= 0) {
      countdownLabel = `🔔 Напоминание прямо сейчас!`
    } else if (isTaskDueToday) {
      isPassed = true
      countdownLabel = `⚠️ Истекло (${Math.abs(minutesLeft)} мин назад)`
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => dispatch({ type: 'SELECT_TASK', id: task.id })}
      className={cn(
        'group flex items-start gap-3 rounded-xl px-3.5 py-3 cursor-pointer',
        'border border-transparent hover:border-border/50',
        'hover:bg-accent/40 transition-all duration-150',
        isDone && 'opacity-45 hover:opacity-60',
        state.selectedTaskId === task.id && 'bg-accent/60 border-border/50',
        compact ? 'py-2.5' : 'py-3'
      )}
    >
      {/* checkbox */}
      <div className="mt-0.5">
        <TaskCheckbox
          checked={isDone}
          onChange={() => dispatch({ type: 'TOGGLE_TASK', id: task.id })}
          priority={task.priority}
          size={compact ? 16 : 18}
        />
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className={cn(
            'text-sm font-medium leading-snug text-foreground',
            isDone && 'line-through text-muted-foreground',
            compact ? 'text-[13px]' : ''
          )}>
            {task.title}
          </span>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={async (e) => {
                e.stopPropagation()
                const ok = await confirm({
                  title: `Удалить задачу «${task.title}»?`,
                  description: 'Задача будет удалена без возможности восстановления.',
                  confirmText: 'Удалить',
                  variant: 'danger',
                })
                if (ok) {
                  dispatch({ type: 'DELETE_TASK', id: task.id })
                }
              }}
              className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
              title="Удалить задачу"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5" />
          </div>
        </div>

        {!compact && (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <PriorityBadge priority={task.priority} />

            {dueDateLabel && (
              <span className={cn('inline-flex items-center gap-1 text-[11px]',
                isOverdue ? 'text-[var(--status-overdue)]' : 'text-muted-foreground'
              )}>
                <CalendarDays className="w-3 h-3" />
                {dueDateLabel}
              </span>
            )}

            {task.dueTime && !isDone && (
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all shadow-xs",
                isPassed
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : minutesLeft <= 15
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300 animate-pulse"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              )}>
                <Clock className="w-3 h-3" />
                {task.dueTime} {countdownLabel ? `(${countdownLabel})` : ''}
              </span>
            )}

            {project && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />
                {project.title}
              </span>
            )}

            {task.isShared && (
              <span className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md",
                "bg-muted/60 text-foreground/80 border border-border/60"
              )}>
                <Users className="w-3 h-3 text-muted-foreground" />
                {(task.tags?.includes('общая') || task.tags?.includes('совместная')) ? '▪ Общая задача' : '▫ Порученная задача'}
              </span>
            )}

            {task.aiGenerated && (
              <span className="inline-flex items-center gap-1 text-[11px] text-primary/70">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
          </div>
        )}

        {/* Reminder Countdown Bar - Only for today's tasks within 24h */}
        {!compact && task.dueTime && !isDone && isTaskDueToday && minutesLeft > 0 && minutesLeft <= 1440 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(5, Math.min(100, (1 - minutesLeft / 1440) * 100))}%` }}
                transition={{ duration: 0.6, delay: index * 0.04 }}
              />
            </div>
            <span className="text-[10px] font-mono font-medium text-amber-400 shrink-0">
              {timeUntilText}
            </span>
          </div>
        )}

        {/* progress bar for tasks with subtasks */}
        {!compact && task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100)}%` }}
                transition={{ duration: 0.5, delay: index * 0.04 + 0.1 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
