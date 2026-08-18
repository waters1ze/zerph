'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn, isBirthdayVisible, isBirthdayTask, isHolidayTask } from '@/lib/utils'
import type { StatPeriod } from '@/lib/types'
import {
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  Target, Flame, Award, BarChart3, Users, LayoutGrid
} from 'lucide-react'
import { ActivityHeatmap } from '@/components/activity-heatmap'

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

  // Filter out birthday and yearly holiday reminders from analytics statistics
  const tasks = useMemo(() => {
    return state.tasks.filter(t => !isBirthdayTask(t) && !isHolidayTask(t))
  }, [state.tasks])
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'inprogress').length
  const overdue = tasks.filter(t => t.status === 'overdue' || (t.dueDate && t.dueDate < dayKey(new Date()) && t.status !== 'done')).length
  const total = tasks.length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  const activeFriendsSet = new Set(state.friends.map(f => String(f.chatId || f.id || f.username)))
  const hasCollab = state.friends.length > 0
  const sharedTasks = hasCollab
    ? tasks.filter(t => (t.isShared && state.friends.length > 0) || (t.assignees && t.assignees.some(a => activeFriendsSet.has(String(a))))).length
    : 0
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

  const todayDate = new Date()
  const tomorrowDate = new Date(todayDate)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = tomorrowDate.toISOString().slice(0, 10)

  const activeTasks = tasks.filter(t => t.status !== 'done' && isBirthdayVisible(t, 2))
  const q1 = activeTasks.filter(t => t.priority === 'urgent' || (t.priority === 'high' && t.dueDate && t.dueDate <= tomorrow))
  const q2 = activeTasks.filter(t => (!t.dueDate || t.dueDate > tomorrow) && (t.priority === 'high' || t.priority === 'medium'))
  const q3 = activeTasks.filter(t => (t.priority === 'medium' || t.priority === 'low') && t.dueDate && t.dueDate <= tomorrow)
  const q4 = activeTasks.filter(t => t.priority === 'low' && (!t.dueDate || t.dueDate > tomorrow))

  // Comprehensive user activities log (tasks, notes, goals, focus)
  const allActivities = useMemo(() => {
    const list: Array<{ date: string; type: 'task' | 'note' | 'goal' | 'focus'; label: string }> = []

    // 1. Done & created tasks
    tasks.forEach(t => {
      if (t.status === 'done') {
        const d = (t.completedAt || t.updatedAt || t.createdAt || '').slice(0, 10)
        if (d) list.push({ date: d, type: 'task', label: `Выполнена задача «${t.title}»` })
      } else if (t.createdAt) {
        list.push({ date: t.createdAt.slice(0, 10), type: 'task', label: `Создана задача «${t.title}»` })
      }
    })

    // 2. Notes created and edited
    state.notes.forEach(n => {
      if (n.createdAt) {
        list.push({ date: n.createdAt.slice(0, 10), type: 'note', label: `Заметка «${n.title || 'Без названия'}»` })
      }
      if (n.updatedAt && n.updatedAt.slice(0, 10) !== (n.createdAt || '').slice(0, 10)) {
        list.push({ date: n.updatedAt.slice(0, 10), type: 'note', label: `Редактирование заметки «${n.title || 'Без названия'}»` })
      }
    })

    // 3. Goals created and updated
    state.goals.forEach(g => {
      if (g.createdAt) {
        list.push({ date: g.createdAt.slice(0, 10), type: 'goal', label: `Цель «${g.title}»` })
      }
      if (g.updatedAt && g.updatedAt.slice(0, 10) !== (g.createdAt || '').slice(0, 10)) {
        list.push({ date: g.updatedAt.slice(0, 10), type: 'goal', label: `Прогресс цели «${g.title}»` })
      }
    })

    return list
  }, [tasks, state.notes, state.goals])

  return (
    <div className="flex flex-col gap-6 w-full max-w-none">
      {/* Header & Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">Живая аналитика</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Реальная статистика выполнения ваших задач и продуктивности</p>
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

      {/* Top stats grid - Full width 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard label="Выполнено задач" value={done} sub={`из ${total} всего`} icon={CheckCircle2} color="text-[var(--status-done)]" delay={0} />
        <StatCard label="Процент выполнения" value={`${completionRate}%`} sub="за всё время" icon={TrendingUp} color="text-primary" delay={0.06} />
        <StatCard label="Просрочено" value={overdue} sub={overdue > 0 ? 'требует внимания' : 'всё чисто!'} icon={AlertCircle} color="text-[var(--status-overdue)]" delay={0.12} />
        <StatCard label="В процессе" value={inProgress} sub="активных задач" icon={Clock} color="text-[var(--status-inprogress)]" delay={0.18} />
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column: Eisenhower Matrix */}
        <div className="lg:col-span-6 flex flex-col p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <p className="text-[14px] font-bold text-foreground">Матрица Эйзенхауэра</p>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {activeTasks.length} активных
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
            {/* Q1 */}
            <div className="p-3.5 rounded-xl bg-[var(--priority-urgent)]/10 border border-[var(--priority-urgent)]/20 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[12px] font-bold text-[var(--priority-urgent)]">Срочно + Важно</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--priority-urgent)]/20 text-[var(--priority-urgent)]">
                  {q1.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 no-scrollbar flex-1">
                {q1.map(t => (
                  <p key={t.id} className="text-[11px] text-foreground truncate bg-card/40 px-2 py-1 rounded-md border border-border/30">
                    • {t.title}
                  </p>
                ))}
                {q1.length === 0 && <p className="text-[11px] text-muted-foreground italic py-3 text-center">Нет срочных задач</p>}
              </div>
            </div>

            {/* Q2 */}
            <div className="p-3.5 rounded-xl bg-[var(--status-done)]/10 border border-[var(--status-done)]/20 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[12px] font-bold text-[var(--status-done)]">Важно + Несрочно</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--status-done)]/20 text-[var(--status-done)]">
                  {q2.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 no-scrollbar flex-1">
                {q2.map(t => (
                  <p key={t.id} className="text-[11px] text-foreground truncate bg-card/40 px-2 py-1 rounded-md border border-border/30">
                    • {t.title}
                  </p>
                ))}
                {q2.length === 0 && <p className="text-[11px] text-muted-foreground italic py-3 text-center">Нет задач</p>}
              </div>
            </div>

            {/* Q3 */}
            <div className="p-3.5 rounded-xl bg-[var(--priority-medium)]/10 border border-[var(--priority-medium)]/20 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[12px] font-bold text-[var(--priority-medium)]">Срочно + Неважно</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--priority-medium)]/20 text-[var(--priority-medium)]">
                  {q3.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 no-scrollbar flex-1">
                {q3.map(t => (
                  <p key={t.id} className="text-[11px] text-foreground truncate bg-card/40 px-2 py-1 rounded-md border border-border/30">
                    • {t.title}
                  </p>
                ))}
                {q3.length === 0 && <p className="text-[11px] text-muted-foreground italic py-3 text-center">Нет задач</p>}
              </div>
            </div>

            {/* Q4 */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[12px] font-bold text-muted-foreground">Несрочно + Неважно</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {q4.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 no-scrollbar flex-1">
                {q4.map(t => (
                  <p key={t.id} className="text-[11px] text-foreground truncate bg-card/40 px-2 py-1 rounded-md border border-border/30">
                    • {t.title}
                  </p>
                ))}
                {q4.length === 0 && <p className="text-[11px] text-muted-foreground italic py-3 text-center">Нет задач</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Weekly Bar Chart + Priority Breakdown + Goals */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Weekly completion graph */}
          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-bold text-foreground">Выполнено за 7 дней</p>
              </div>
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                Реальные данные
              </span>
            </div>
            <div className="flex items-end gap-2.5 h-28 pt-2">
              {weeklyBars.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-bold text-foreground">{b.count > 0 ? b.count : ''}</span>
                  <motion.div
                    className={cn(
                      'w-full rounded-t-md transition-colors',
                      b.count > 0 ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-muted/40'
                    )}
                    initial={{ height: 0 }}
                    animate={{ height: `${b.count > 0 ? Math.max((b.count / maxWeekly) * 70, 10) : 4}px` }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Priority breakdown */}
          <div className="p-4 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-orange-400" />
              <p className="text-[13px] font-bold text-foreground">Распределение по приоритетам</p>
            </div>
            <div className="space-y-2.5">
              {priorityBreakdown.map(p => (
                <BarMini key={p.label} label={p.label} count={p.count} pct={p.pct} color={p.color} />
              ))}
            </div>
          </div>

          {/* Goals & Collaboration Mini Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-bold text-foreground">Цели</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{avgGoalProgress}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">средний прогресс</p>
              <div className="h-1.5 rounded-full bg-border overflow-hidden mt-2.5">
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
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-bold text-foreground">Команда & AI</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{sharedTasks}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">общих задач</p>
              <div className="mt-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Создано AI:</span>
                  <span className="font-bold text-foreground">{aiTasks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Контактов:</span>
                  <span className="font-bold text-foreground">{state.friends.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 365-Day Activity Heatmap - Spanning 100% */}
      <div className="w-full">
        <ActivityHeatmap activities={allActivities} />
      </div>
    </div>
  )
}
