'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { StatPeriod } from '@/lib/types'
import {
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  Target, Flame, Award, BarChart3, Users
} from 'lucide-react'

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function subtractDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

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

function BarMini({ pct, count, color, label }: { pct: number; count: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-muted-foreground w-24 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-[12px] font-semibold text-foreground w-12 shrink-0">{count} ({pct}%)</span>
    </div>
  )
}

const PERIODS: { id: StatPeriod; label: string }[] = [
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: '90d', label: '90 дней' },
  { id: '1y', label: '1 год' },
]

export function StatsView() {
  const { state } = useApp()
  const [period, setPeriod] = useState<StatPeriod>('30d')

  const tasks = state.tasks
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'inprogress').length
  const overdue = tasks.filter(t => t.status === 'overdue' || (t.dueDate && t.dueDate < dayKey(new Date()) && t.status !== 'done')).length
  const total = tasks.length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  const sharedTasks = tasks.filter(t => t.isShared || t.assignees?.length > 0).length
  const aiTasks = tasks.filter(t => t.aiGenerated).length

  const goalsOnTrack = state.goals.filter(g => g.status === 'on_track').length
  const goalsTotal = state.goals.length
  const avgGoalProgress = goalsTotal > 0
    ? Math.round(state.goals.reduce((a, g) => a + g.progress, 0) / goalsTotal)
    : 0

  // REAL calculation of completion counts per day for the last 7 days
  const weeklyBars = useMemo(() => {
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Сегодня']
    const map: Record<string, number> = {}

    tasks.filter(t => t.status === 'done').forEach(t => {
      const k = (t.completedAt || t.dueDate || t.updatedAt || '').slice(0, 10)
      if (k) map[k] = (map[k] || 0) + 1
    })

    return Array.from({ length: 7 }, (_, i) => {
      const d = subtractDays(6 - i)
      const k = dayKey(d)
      return {
        label: i === 6 ? 'Сегодня' : dayNames[(d.getDay() + 6) % 7],
        count: map[k] || 0,
      }
    })
  }, [tasks])

  const maxWeekly = Math.max(...weeklyBars.map(b => b.count), 1)

  const priorityBreakdown = [
    { label: 'Срочные', count: tasks.filter(t => t.priority === 'urgent').length, pct: total ? Math.round((tasks.filter(t => t.priority === 'urgent').length / total) * 100) : 0, color: 'var(--priority-urgent)' },
    { label: 'Высокие', count: tasks.filter(t => t.priority === 'high').length, pct: total ? Math.round((tasks.filter(t => t.priority === 'high').length / total) * 100) : 0, color: 'var(--priority-high)' },
    { label: 'Средние', count: tasks.filter(t => t.priority === 'medium').length, pct: total ? Math.round((tasks.filter(t => t.priority === 'medium').length / total) * 100) : 0, color: 'var(--priority-medium)' },
    { label: 'Низкие', count: tasks.filter(t => t.priority === 'low').length, pct: total ? Math.round((tasks.filter(t => t.priority === 'low').length / total) * 100) : 0, color: 'var(--priority-low)' },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header & Period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Живая аналитика</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Реальная статистика выполнения ваших задач</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border w-fit">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150',
                period === p.id
                  ? 'bg-card text-foreground shadow-sm border border-border/50 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Выполнено задач" value={done} sub={`из ${total} всего`} icon={CheckCircle2} color="text-[var(--status-done)]" delay={0} />
        <StatCard label="Процент выполнения" value={`${completionRate}%`} sub="за всё время" icon={TrendingUp} color="text-primary" delay={0.06} />
        <StatCard label="Просрочено" value={overdue} sub={overdue > 0 ? 'требует внимания' : 'всё чисто!'} icon={AlertCircle} color="text-[var(--status-overdue)]" delay={0.12} />
        <StatCard label="В процессе" value={inProgress} sub="активных задач" icon={Clock} color="text-[var(--status-inprogress)]" delay={0.18} />
      </div>

      {/* Weekly completion graph - REAL DATA */}
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <p className="text-[13px] font-bold text-foreground">Выполнено за 7 дней</p>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">Реальные данные</span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {weeklyBars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold text-foreground">{b.count > 0 ? b.count : ''}</span>
              <motion.div
                className={cn(
                  'w-full rounded-t-md transition-colors',
                  b.count > 0 ? 'bg-primary' : 'bg-muted/40'
                )}
                initial={{ height: 0 }}
                animate={{ height: `${b.count > 0 ? Math.max((b.count / maxWeekly) * 60, 8) : 4}px` }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
              <span className="text-[10px] font-medium text-muted-foreground">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-orange-400" />
          <p className="text-[13px] font-bold text-foreground">Распределение по приоритетам</p>
        </div>
        <div className="space-y-3">
          {priorityBreakdown.map(p => (
            <BarMini key={p.label} label={p.label} count={p.count} pct={p.pct} color={p.color} />
          ))}
        </div>
      </div>

      {/* Goals & Collaboration overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-primary" />
            <p className="text-[13px] font-bold text-foreground">Цели</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{avgGoalProgress}%</p>
          <p className="text-[12px] text-muted-foreground mt-1">средний прогресс</p>
          <div className="h-1.5 rounded-full bg-border overflow-hidden mt-3">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${avgGoalProgress}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">{goalsOnTrack} из {goalsTotal} целей в норме</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-[13px] font-bold text-foreground">Совместная работа</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{sharedTasks}</p>
          <p className="text-[12px] text-muted-foreground mt-1">общих задач</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Создано AI:</span>
              <span className="font-bold text-foreground">{aiTasks}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Участников команды:</span>
              <span className="font-bold text-foreground">{state.friends.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
