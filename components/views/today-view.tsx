'use client'

import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, AlertCircle, TrendingUp, Flame, Target } from 'lucide-react'
import { parseISO, isToday } from 'date-fns'

export function TodayView() {
  const { state } = useApp()
  const today = new Date().toISOString().slice(0, 10)

  const todayTasks = state.tasks.filter(t => t.dueDate === today || isToday(parseISO(t.createdAt)))
  const doneTasks = todayTasks.filter(t => t.status === 'done')
  const activeTasks = todayTasks.filter(t => t.status !== 'done')
  const overdueTasks = state.tasks.filter(t => t.status === 'overdue')
  const completionRate = todayTasks.length ? Math.round((doneTasks.length / todayTasks.length) * 100) : 0

  const stats = [
    { label: 'Remaining', value: activeTasks.length, icon: Clock, color: 'text-primary' },
    { label: 'Done today', value: doneTasks.length, icon: CheckCircle2, color: 'text-[var(--status-done)]' },
    { label: 'Overdue', value: overdueTasks.length, icon: AlertCircle, color: 'text-[var(--status-overdue)]' },
    { label: 'Completion', value: `${completionRate}%`, icon: TrendingUp, color: 'text-[var(--status-inprogress)]' },
  ]

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.22 }}
              className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-card border border-border hover:border-border/80 transition-colors"
            >
              <div className="flex items-center justify-between">
                <Icon className={cn('w-4 h-4', s.color)} />
              </div>
              <p className="text-xl font-semibold text-foreground leading-none">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Progress bar */}
      {todayTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border"
        >
          <Flame className="w-4 h-4 text-[var(--priority-high)] shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between mb-1.5">
              <span className="text-[12px] font-medium text-foreground">Daily progress</span>
              <span className="text-[12px] text-muted-foreground">{doneTasks.length} of {todayTasks.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${completionRate}%` }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Active goals quick view */}
      {state.goals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Target className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Active goals</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {state.goals.slice(0, 2).map((goal, i) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="p-3 rounded-xl bg-card border border-border"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: goal.color }} />
                  <p className="text-[12px] font-medium text-foreground truncate flex-1">{goal.title}</p>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    goal.status === 'on_track' ? 'bg-[var(--status-done)]/15 text-[var(--status-done)]' :
                    goal.status === 'at_risk'  ? 'bg-[var(--priority-medium)]/15 text-[var(--priority-medium)]' :
                    'bg-[var(--status-overdue)]/15 text-[var(--status-overdue)]'
                  )}>
                    {goal.status === 'on_track' ? 'On track' : goal.status === 'at_risk' ? 'At risk' : 'Delayed'}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: goal.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.progress}%` }}
                    transition={{ duration: 0.7, delay: 0.4 + i * 0.08 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{goal.progress}% complete</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Task sections */}
      {overdueTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-[var(--status-overdue)]" />
            <h2 className="text-[12px] font-semibold text-[var(--status-overdue)] uppercase tracking-wide">Overdue</h2>
          </div>
          <div className="space-y-0.5">
            {overdueTasks.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
            Today — {activeTasks.length} remaining
          </h2>
        </div>
        {activeTasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-10 text-center"
          >
            <CheckCircle2 className="w-10 h-10 text-[var(--status-done)]/50" />
            <p className="text-sm font-medium text-foreground">All done for today!</p>
            <p className="text-[13px] text-muted-foreground">Great work. Come back tomorrow.</p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {activeTasks.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        )}
      </div>

      {doneTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
          </div>
          <div className="space-y-0.5">
            {doneTasks.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        </div>
      )}
    </div>
  )
}
