'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { StatPeriod } from '@/lib/types'
import {
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  Target, FolderKanban, Flame, Award, BarChart3
} from 'lucide-react'

function StatCard({
  label, value, sub, icon: Icon, color, delay = 0,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.22 }}
      className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-3"
    >
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', color + '/15')}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
    </motion.div>
  )
}

function BarMini({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-muted-foreground w-20 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-[12px] font-semibold text-foreground w-8 shrink-0">{pct}%</span>
    </div>
  )
}

const PERIODS: { id: StatPeriod; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '1y', label: '1 year' },
]

export function StatsView() {
  const { state } = useApp()
  const [period, setPeriod] = useState<StatPeriod>('30d')

  const tasks = state.tasks
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'inprogress').length
  const overdue = tasks.filter(t => t.status === 'overdue').length
  const todo = tasks.filter(t => t.status === 'todo').length
  const total = tasks.length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  const sharedTasks = tasks.filter(t => t.isShared).length
  const aiTasks = tasks.filter(t => t.aiGenerated).length

  const goalsOnTrack = state.goals.filter(g => g.status === 'on_track').length
  const goalsTotal = state.goals.length
  const avgGoalProgress = goalsTotal > 0
    ? Math.round(state.goals.reduce((a, g) => a + g.progress, 0) / goalsTotal)
    : 0

  const priorityBreakdown = [
    { label: 'Urgent', pct: total ? Math.round((tasks.filter(t => t.priority === 'urgent').length / total) * 100) : 0, color: 'var(--priority-urgent)' },
    { label: 'High', pct: total ? Math.round((tasks.filter(t => t.priority === 'high').length / total) * 100) : 0, color: 'var(--priority-high)' },
    { label: 'Medium', pct: total ? Math.round((tasks.filter(t => t.priority === 'medium').length / total) * 100) : 0, color: 'var(--priority-medium)' },
    { label: 'Low', pct: total ? Math.round((tasks.filter(t => t.priority === 'low').length / total) * 100) : 0, color: 'var(--priority-low)' },
  ]

  // Fake weekly completion data for sparkline
  const weeklyData = [4, 6, 3, 7, 5, 8, done].slice(-7)
  const maxWeekly = Math.max(...weeklyData, 1)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Period selector */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border w-fit">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150',
              period === p.id
                ? 'bg-card text-foreground shadow-sm border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Top stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tasks completed" value={done} sub={`of ${total} total`} icon={CheckCircle2} color="text-[var(--status-done)]" delay={0} />
        <StatCard label="Completion rate" value={`${completionRate}%`} sub="all time" icon={TrendingUp} color="text-primary" delay={0.06} />
        <StatCard label="Overdue" value={overdue} sub={overdue > 0 ? 'needs attention' : 'clean!'} icon={AlertCircle} color="text-[var(--status-overdue)]" delay={0.12} />
        <StatCard label="In progress" value={inProgress} icon={Clock} color="text-[var(--status-inprogress)]" delay={0.18} />
      </div>

      {/* Weekly completion sparkline */}
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Weekly completions</p>
          </div>
          <span className="text-[12px] text-muted-foreground">Last 7 days</span>
        </div>
        <div className="flex items-end gap-2 h-20">
          {weeklyData.map((v, i) => {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today']
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <motion.div
                  className="w-full rounded-t-md bg-primary/80"
                  initial={{ height: 0 }}
                  animate={{ height: `${(v / maxWeekly) * 64}px` }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  style={{ minHeight: 4 }}
                />
                <span className="text-[10px] text-muted-foreground/70">{days[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-muted-foreground" />
          <p className="text-[13px] font-semibold text-foreground">Priority breakdown</p>
        </div>
        <div className="space-y-3">
          {priorityBreakdown.map(p => (
            <BarMini key={p.label} label={p.label} pct={p.pct} color={p.color} />
          ))}
        </div>
      </div>

      {/* Goals overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Goals</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{avgGoalProgress}%</p>
          <p className="text-[12px] text-muted-foreground mt-1">avg. progress</p>
          <div className="h-1.5 rounded-full bg-border overflow-hidden mt-3">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${avgGoalProgress}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">{goalsOnTrack}/{goalsTotal} on track</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Collaboration</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{sharedTasks}</p>
          <p className="text-[12px] text-muted-foreground mt-1">shared tasks</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">AI-suggested</span>
              <span className="font-semibold text-foreground">{aiTasks}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Team members</span>
              <span className="font-semibold text-foreground">{state.friends.length}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Active projects</span>
              <span className="font-semibold text-foreground">{state.projects.filter(p => !p.archived).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
