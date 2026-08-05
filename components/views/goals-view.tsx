'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { Target, ChevronDown, CheckCircle2, Circle, Plus, TrendingUp, AlertTriangle, Clock3 } from 'lucide-react'
import type { Goal, Milestone } from '@/lib/types'

function MilestoneItem({ milestone, onToggle }: { milestone: Milestone; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 cursor-pointer group" onClick={onToggle}>
      {milestone.done
        ? <CheckCircle2 className="w-4 h-4 text-[var(--status-done)] shrink-0" />
        : <Circle className="w-4 h-4 text-border group-hover:text-muted-foreground shrink-0 transition-colors" />
      }
      <span className={cn('text-[13px] flex-1', milestone.done ? 'line-through text-muted-foreground' : 'text-foreground')}>
        {milestone.title}
      </span>
      {milestone.dueDate && (
        <span className="text-[11px] text-muted-foreground shrink-0">{format(parseISO(milestone.dueDate), 'MMM d')}</span>
      )}
    </div>
  )
}

function GoalCard({ goal, index }: { goal: Goal; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { state, dispatch } = useApp()
  const relatedTasks = state.tasks.filter(t => t.goalId === goal.id)
  const doneTasks = relatedTasks.filter(t => t.status === 'done')

  const statusConfig = {
    on_track: { label: 'On track', icon: TrendingUp, color: 'text-[var(--status-done)]', bg: 'bg-[var(--status-done)]/10' },
    at_risk:  { label: 'At risk',  icon: AlertTriangle, color: 'text-[var(--priority-medium)]', bg: 'bg-[var(--priority-medium)]/10' },
    delayed:  { label: 'Delayed', icon: Clock3, color: 'text-[var(--status-overdue)]', bg: 'bg-[var(--status-overdue)]/10' },
    completed:{ label: 'Completed', icon: CheckCircle2, color: 'text-[var(--status-done)]', bg: 'bg-[var(--status-done)]/10' },
  }
  const sc = statusConfig[goal.status]
  const StatusIcon = sc.icon

  const toggleMilestone = (milestoneId: string) => {
    const updated = goal.milestones.map(m => m.id === milestoneId ? { ...m, done: !m.done } : m)
    const completedMilestones = updated.filter(m => m.done).length
    const progress = Math.round((completedMilestones / updated.length) * 100)
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, updates: { milestones: updated, progress } })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.22 }}
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: goal.color + '25' }}>
            <Target className="w-4 h-4" style={{ color: goal.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-foreground leading-snug">{goal.title}</h3>
              <span className={cn('flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0', sc.bg, sc.color)}>
                <StatusIcon className="w-3 h-3" />
                {sc.label}
              </span>
            </div>
            {goal.description && (
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{goal.description}</p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Progress</span>
            <span className="text-[12px] font-semibold text-foreground">{goal.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: goal.color }}
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 + 0.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {goal.deadline && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              <Clock3 className="w-3 h-3" />
              {format(parseISO(goal.deadline), 'MMM d, yyyy')}
            </span>
          )}
          {goal.metric && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              {goal.metric}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {doneTasks.length}/{relatedTasks.length} tasks done
          </span>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Milestones ({goal.milestones.filter(m => m.done).length}/{goal.milestones.length})
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Milestones */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-0.5 border-t border-border pt-3">
              {goal.milestones.map(m => (
                <MilestoneItem key={m.id} milestone={m} onToggle={() => toggleMilestone(m.id)} />
              ))}
              {goal.motivation && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-muted-foreground/70 italic">&ldquo;{goal.motivation}&rdquo;</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function GoalsView() {
  const { state } = useApp()

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Long-term goals track your biggest objectives</h2>
        </div>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          New goal
        </button>
      </div>

      {state.goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Target className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-sm font-medium text-muted-foreground">No goals yet</p>
          <p className="text-xs text-muted-foreground/60">Set your first long-term goal to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.goals.map((goal, i) => <GoalCard key={goal.id} goal={goal} index={i} />)}
        </div>
      )}
    </div>
  )
}
