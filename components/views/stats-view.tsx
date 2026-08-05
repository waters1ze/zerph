'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { StatPeriod } from '@/lib/types'
import {
  CheckCircle2, Clock, AlertCircle, TrendingUp,
  Target, Flame, Award, BarChart3, Zap, CalendarDays, Star
} from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function subtractDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const PERIOD_DAYS: Record<StatPeriod, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

// ─── small ui ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, delay = 0 }: {
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
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', color.replace('text-', 'bg-').replace(']', '/15]'))}>
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

function Bar({ pct, color, label, count }: { pct: number; color: string; label: string; count: number }) {
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
      <span className="text-[12px] font-semibold text-foreground w-8 shrink-0 text-right">{count}</span>
    </div>
  )
}

// ─── heatmap cell ─────────────────────────────────────────────────────────────

function HeatCell({ count, date }: { count: number; date: string }) {
  const intensity =
    count === 0 ? 'bg-muted/30' :
    count === 1 ? 'bg-primary/20' :
    count === 2 ? 'bg-primary/40' :
    count <= 4  ? 'bg-primary/65' : 'bg-primary'

  return (
    <div
      title={`${date}: ${count} задач`}
      className={cn('w-3.5 h-3.5 rounded-sm transition-colors', intensity)}
    />
  )
}

// ─── streak calculator ────────────────────────────────────────────────────────

function calcStreak(completedDates: Set<string>): number {
  let streak = 0
  const d = new Date()
  while (true) {
    const k = dayKey(d)
    if (completedDates.has(k)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else break
  }
  return streak
}

// ─── main component ───────────────────────────────────────────────────────────

const PERIODS: { id: StatPeriod; label: string }[] = [
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: '90d', label: '90 дней' },
  { id: '1y', label: 'Год' },
]

export function StatsView() {
  const { state } = useApp()
  const [period, setPeriod] = useState<StatPeriod>('30d')
  const tasks = state.tasks
  const days = PERIOD_DAYS[period]

  // ── all-time counts ──
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'inprogress').length
  const overdue = tasks.filter(t => t.status === 'overdue').length
  const total = tasks.length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  // ── per-day map (completed tasks by dueDate or completedAt) ──
  const dailyMap = useMemo(() => {
    const m: Record<string, number> = {}
    tasks.filter(t => t.status === 'done').forEach(t => {
      const k = (t.completedAt || t.dueDate || t.updatedAt || '').slice(0, 10)
      if (k) m[k] = (m[k] || 0) + 1
    })
    return m
  }, [tasks])

  // ── period bucket ──
  const periodStart = subtractDays(days - 1)
  const periodStartKey = dayKey(periodStart)

  const periodDone = useMemo(() =>
    Object.entries(dailyMap)
      .filter(([k]) => k >= periodStartKey)
      .reduce((s, [, v]) => s + v, 0)
  , [dailyMap, periodStartKey])

  // ── 30-day heatmap rows (7 columns = weeks) ──
  const heatmapDays = useMemo(() => {
    const arr: { date: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = subtractDays(i)
      const k = dayKey(d)
      arr.push({ date: k, count: dailyMap[k] || 0 })
    }
    return arr
  }, [dailyMap])

  // ── weekly bar (last 7 days) ──
  const weeklyBars = useMemo(() => {
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    return Array.from({ length: 7 }, (_, i) => {
      const d = subtractDays(6 - i)
      const k = dayKey(d)
      const dayOfWeek = (d.getDay() + 6) % 7
      return { label: i === 6 ? 'Сегодня' : dayNames[dayOfWeek], count: dailyMap[k] || 0, date: k }
    })
  }, [dailyMap])
  const maxBar = Math.max(...weeklyBars.map(b => b.count), 1)

  // ── streak ──
  const completedDatesSet = useMemo(() =>
    new Set(Object.keys(dailyMap))
  , [dailyMap])
  const streak = calcStreak(completedDatesSet)

  // ── priority breakdown ──
  const priorityData = [
    { label: 'Срочные', count: tasks.filter(t => t.priority === 'urgent').length, color: 'var(--priority-urgent)' },
    { label: 'Высокие', count: tasks.filter(t => t.priority === 'high').length, color: 'var(--priority-high)' },
    { label: 'Средние', count: tasks.filter(t => t.priority === 'medium').length, color: 'var(--priority-medium)' },
    { label: 'Низкие', count: tasks.filter(t => t.priority === 'low').length, color: 'var(--priority-low)' },
  ]

  // ── goals ──
  const goalsOnTrack = state.goals.filter(g => g.status === 'on_track').length
  const goalsTotal = state.goals.length
  const avgGoalProgress = goalsTotal > 0
    ? Math.round(state.goals.reduce((a, g) => a + g.progress, 0) / goalsTotal)
    : 0

  const aiTasks = tasks.filter(t => t.aiGenerated).length
  const todayCount = tasks.filter(t => t.dueDate === dayKey(new Date()) && t.status !== 'done').length

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-8">

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Живая аналитика</h2>
          <span className="text-[11px] text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Live</span>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
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
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Выполнено задач" value={done} sub={`из ${total} всего`} icon={CheckCircle2} color="text-[var(--status-done)]" delay={0} />
        <StatCard label="Процент выполнения" value={`${completionRate}%`} sub="за всё время" icon={TrendingUp} color="text-primary" delay={0.06} />
        <StatCard label="Просрочено" value={overdue} sub={overdue > 0 ? 'требует внимания' : 'всё чисто!'} icon={AlertCircle} color="text-[var(--status-overdue)]" delay={0.12} />
        <StatCard label="В работе" value={inProgress} sub={`сегодня: ${todayCount}`} icon={Clock} color="text-[var(--status-inprogress)]" delay={0.18} />
      </div>

      {/* Streak + period summary */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <p className="text-[12px] font-semibold text-foreground">Серия дней</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{streak}<span className="text-[16px] ml-1 text-muted-foreground">дн</span></p>
          <p className="text-[11px] text-muted-foreground">подряд с выполненными задачами</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <p className="text-[12px] font-semibold text-foreground">За период</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{periodDone}</p>
          <p className="text-[11px] text-muted-foreground">задач за {days} дней</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-2xl bg-card border border-border flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <p className="text-[12px] font-semibold text-foreground">AI создано</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{aiTasks}</p>
          <p className="text-[11px] text-muted-foreground">задач через голос/AI</p>
        </motion.div>
      </div>

      {/* Weekly bar chart - REAL DATA */}
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Выполнено за 7 дней</p>
          </div>
          <span className="text-[11px] text-muted-foreground">реальные данные</span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {weeklyBars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground">{b.count > 0 ? b.count : ''}</span>
              <motion.div
                className={cn(
                  'w-full rounded-t-md',
                  b.date === dayKey(new Date()) ? 'bg-primary' : 'bg-primary/50'
                )}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((b.count / maxBar) * 80, b.count > 0 ? 6 : 2)}px` }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              />
              <span className={cn(
                'text-[10px]',
                b.date === dayKey(new Date()) ? 'text-primary font-semibold' : 'text-muted-foreground/70'
              )}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day heatmap */}
      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-muted-foreground" />
          <p className="text-[13px] font-semibold text-foreground">Тепловая карта активности (30 дней)</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {heatmapDays.map((d) => (
            <HeatCell key={d.date} count={d.count} date={d.date} />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-muted-foreground">Меньше</span>
          {['bg-muted/30', 'bg-primary/20', 'bg-primary/40', 'bg-primary/65', 'bg-primary'].map((c, i) => (
            <div key={i} className={cn('w-3 h-3 rounded-sm', c)} />
          ))}
          <span className="text-[10px] text-muted-foreground">Больше</span>
        </div>
      </div>

      {/* Priority + Goals */}
      <div className="grid grid-cols-2 gap-3">
        {/* Priority breakdown */}
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">По приоритетам</p>
          </div>
          <div className="space-y-3">
            {priorityData.map(p => (
              <Bar
                key={p.label}
                label={p.label}
                count={p.count}
                pct={total > 0 ? Math.round((p.count / total) * 100) : 0}
                color={p.color}
              />
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="flex flex-col gap-3">
          <div className="p-4 rounded-2xl bg-card border border-border flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-muted-foreground" />
              <p className="text-[13px] font-semibold text-foreground">Цели</p>
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
            <p className="text-[11px] text-muted-foreground mt-2">{goalsOnTrack}/{goalsTotal} на треке</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-muted-foreground" />
              <p className="text-[13px] font-semibold text-foreground">Сводка</p>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Всего задач', v: total },
                { label: 'Заметок', v: state.notes.length },
                { label: 'Голос/AI', v: aiTasks },
                { label: 'Командные', v: tasks.filter(t => t.isShared).length },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold text-foreground">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
