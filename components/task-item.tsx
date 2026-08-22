'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn, sanitizeTaskTitle } from '@/lib/utils'
import { TaskCheckbox } from './task-checkbox'
import { PriorityBadge } from './priority-badge'
import { useApp } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Task, Friend } from '@/lib/types'
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

  // Live real-time clock ticker updated every second for active tasks with time
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!task.dueTime || isDone) return
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [task.dueTime, isDone])

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
    const startTimeStr = task.dueTime.split(/[\s–-]+/)[0].trim()
    const [h, m] = startTimeStr.split(':').map(Number)
    let due: Date
    if (task.dueDate && task.dueDate.includes('-') && !isNaN(h) && !isNaN(m)) {
      const [year, month, day] = task.dueDate.split('-').map(Number)
      due = new Date(year, month - 1, day, h, m, 0, 0)
    } else if (!isNaN(h) && !isNaN(m)) {
      due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
    } else {
      due = now
    }
    const diffMs = due.getTime() - now.getTime()

    // 1. Future (> 59 seconds left)
    if (diffMs >= 60000) {
      minutesLeft = Math.ceil(diffMs / 60000)
      if (minutesLeft < 60) {
        timeUntilText = `${minutesLeft} мин`
      } else if (minutesLeft < 1440) {
        const hours = Math.floor(minutesLeft / 60)
        const mins = minutesLeft % 60
        timeUntilText = mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`
      } else {
        const days = Math.floor(minutesLeft / 1440)
        const remMins = minutesLeft % 1440
        const hours = Math.floor(remMins / 60)
        timeUntilText = `${days} д ${hours} ч`
      }

      if (isTaskDueToday || minutesLeft <= 1440) {
        countdownLabel = `Осталось: ${timeUntilText}`
      }
    }
    // 2. Exact Moment (0 to 59s of the exact due minute)
    else if (diffMs >= 0 && diffMs < 60000) {
      countdownLabel = `Прямо сейчас!`
    }
    // 3. Past / Expired (the exact moment it passes 0)
    else {
      isPassed = true
      const pastSeconds = Math.floor(Math.abs(diffMs) / 1000)
      const pastMinutes = Math.floor(pastSeconds / 60)

      if (pastMinutes < 1) {
        countdownLabel = `Истекло только что`
      } else if (pastMinutes < 60) {
        countdownLabel = `Истекло ${pastMinutes} мин назад`
      } else if (pastMinutes < 1440) {
        const pastHours = Math.floor(pastMinutes / 60)
        const remMins = pastMinutes % 60
        countdownLabel = `Истекло ${pastHours} ч ${remMins > 0 ? `${remMins} мин ` : ''}назад`
      } else {
        const pastDays = Math.floor(pastMinutes / 1440)
        countdownLabel = `Истекло ${pastDays} д назад`
      }
    }
  }

  return (
    <motion.div
      layout="position"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
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
      <div className="mt-0.5" onClick={e => e.stopPropagation()}>
        <TaskCheckbox
          checked={isDone}
          onChange={() => dispatch({ type: 'TOGGLE_TASK', id: task.id, status: isDone ? 'todo' : 'done' })}
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
            isPassed && !isDone && 'text-foreground'
          )}>
            {sanitizeTaskTitle(task.title)}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={async (e) => {
                e.stopPropagation()
                const ok = await confirm({
                  title: 'Удалить задачу?',
                  description: `Задача «${task.title}» будет удалена навсегда.`,
                  confirmText: 'Удалить',
                  variant: 'danger',
                })
                if (ok) {
                  dispatch({ type: 'DELETE_TASK', id: task.id })
                }
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
                (isOverdue || isPassed) ? 'text-red-400 font-medium' : 'text-muted-foreground'
              )}>
                <CalendarDays className="w-3 h-3" />
                {dueDateLabel}
              </span>
            )}

            {task.dueTime && !isDone && (
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all shadow-xs select-none",
                isPassed
                  ? "bg-red-500/10 border-red-500/25 text-red-400 font-semibold"
                  : countdownLabel === 'Прямо сейчас!'
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse font-bold"
                  : minutesLeft <= 15
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              )}>
                <Clock className="w-3 h-3" />
                <span>{task.dueTime}</span>
                {countdownLabel && <span className="opacity-90">({countdownLabel})</span>}
              </span>
            )}

            {project && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />
                {project.title}
              </span>
            )}

            {/* Friend or Group Badge */}
            {(() => {
              const authorFriend = task.authorChatId && String(task.authorChatId) !== String(task.ownerChatId)
                ? state.friends.find(f => f.chatId === String(task.authorChatId) || f.id === String(task.authorChatId))
                : null
              const assigneeFriends = (task.assignees || [])
                .map(aId => state.friends.find(f => f.id === aId || f.chatId === aId))
                .filter((f): f is Friend => Boolean(f))
              const group = (state.friendGroups || []).find(g =>
                (g.memberIds || []).some(mId => (task.assignees || []).includes(mId)) ||
                (task.tags || []).some(tag => tag.toLowerCase() === g.name.toLowerCase())
              )

              if (group) {
                return (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
                    <span>{group.emoji || '👥'}</span>
                    <span>{group.name}</span>
                  </span>
                )
              }

              if (authorFriend) {
                return (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/60 text-foreground/80 border border-border/60">
                    <Users className="w-3 h-3 text-primary" />
                    <span>От: {authorFriend.name}</span>
                  </span>
                )
              }

              if (assigneeFriends.length > 0) {
                const names = assigneeFriends.map(f => f.name).join(', ')
                return (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/60 text-foreground/80 border border-border/60">
                    <Users className="w-3 h-3 text-primary" />
                    <span>С: {names}</span>
                  </span>
                )
              }

              if (task.isShared) {
                return (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/60 text-foreground/80 border border-border/60">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span>Общая задача</span>
                  </span>
                )
              }

              return null
            })()}

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
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
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
