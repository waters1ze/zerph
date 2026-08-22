'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Calendar, Sparkles } from 'lucide-react'

export interface ActivityItem {
  date: string // 'YYYY-MM-DD'
  type?: 'task' | 'note' | 'goal' | 'focus'
  label?: string
}

interface ActivityHeatmapProps {
  activities?: ActivityItem[]
  completedDates?: string[] // Backward compatibility
  totalCompleted?: number
  currentStreak?: number
}

export function ActivityHeatmap({
  activities = [],
  completedDates = [],
  totalCompleted,
  currentStreak,
}: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{
    date: string
    count: number
    notesCount: number
    tasksCount: number
    goalsCount: number
    sampleLabels: string[]
  } | null>(null)

  // Map counts and breakdowns per date
  const { dateCounts, dateBreakdowns, totalCount, realStreak } = useMemo(() => {
    const counts: Record<string, number> = {}
    const breakdowns: Record<string, { notes: number; tasks: number; goals: number; labels: string[] }> = {}

    const addEntry = (rawDate: string, type: 'task' | 'note' | 'goal' | 'focus' = 'task', label?: string) => {
      if (!rawDate) return
      const d = rawDate.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return

      counts[d] = (counts[d] || 0) + 1
      if (!breakdowns[d]) {
        breakdowns[d] = { notes: 0, tasks: 0, goals: 0, labels: [] }
      }
      if (type === 'note') breakdowns[d].notes += 1
      else if (type === 'goal') breakdowns[d].goals += 1
      else breakdowns[d].tasks += 1

      if (label && breakdowns[d].labels.length < 3) {
        breakdowns[d].labels.push(label)
      }
    }

    // Process structured activities
    activities.forEach(a => addEntry(a.date, a.type, a.label))

    // Process legacy completedDates
    completedDates.forEach(d => addEntry(d, 'task'))

    // Calculate total
    const total = Object.values(counts).reduce((acc, c) => acc + c, 0)

    // Calculate real consecutive streak
    let streak = 0
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    
    // Check from today or yesterday
    const checkDate = new Date(now)
    if (!counts[todayStr]) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10)
      if ((counts[dStr] || 0) > 0) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return {
      dateCounts: counts,
      dateBreakdowns: breakdowns,
      totalCount: total,
      realStreak: streak,
    }
  }, [activities, completedDates])

  // Generate 52 weeks (364 days) grid leading up to today
  const gridWeeks = useMemo(() => {
    const weeks: Array<Array<{
      date: string
      count: number
      dayOfWeek: number
      monthName?: string
      notesCount: number
      tasksCount: number
      goalsCount: number
      sampleLabels: string[]
    }>> = []
    const now = new Date()

    // Start from Sunday of 52 weeks ago
    const start = new Date(now)
    start.setDate(now.getDate() - 364)
    const startDay = start.getDay()
    start.setDate(start.getDate() - startDay)

    const current = new Date(start)
    let currentWeek: Array<{
      date: string
      count: number
      dayOfWeek: number
      monthName?: string
      notesCount: number
      tasksCount: number
      goalsCount: number
      sampleLabels: string[]
    }> = []
    let lastMonth = -1

    while (current <= now || currentWeek.length > 0) {
      const dateStr = current.toISOString().slice(0, 10)
      const count = dateCounts[dateStr] || 0
      const b = dateBreakdowns[dateStr] || { notes: 0, tasks: 0, goals: 0, labels: [] }
      const month = current.getMonth()
      let monthName: string | undefined = undefined

      if (month !== lastMonth && current.getDate() <= 7) {
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
        monthName = monthNames[month]
        lastMonth = month
      }

      currentWeek.push({
        date: dateStr,
        count,
        dayOfWeek: current.getDay(),
        monthName,
        notesCount: b.notes,
        tasksCount: b.tasks,
        goalsCount: b.goals,
        sampleLabels: b.labels,
      })

      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }

      current.setDate(current.getDate() + 1)
      if (current > now && currentWeek.length === 0) break
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({
          date: '',
          count: 0,
          dayOfWeek: currentWeek.length,
          notesCount: 0,
          tasksCount: 0,
          goalsCount: 0,
          sampleLabels: [],
        })
      }
      weeks.push(currentWeek)
    }

    return weeks
  }, [dateCounts, dateBreakdowns])

  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-muted/40 border border-border/30'
    if (count === 1) return 'bg-emerald-900/60 border border-emerald-800/80 text-emerald-300'
    if (count === 2) return 'bg-emerald-700 border border-emerald-600'
    if (count <= 4) return 'bg-emerald-500 border border-emerald-400'
    return 'bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-500/20'
  }

  const effectiveTotal = typeof totalCompleted === 'number' && totalCompleted > totalCount ? totalCompleted : totalCount
  const effectiveStreak = typeof currentStreak === 'number' && currentStreak > realStreak ? currentStreak : realStreak

  return (
    <div className="p-5 rounded-3xl bg-card border border-border shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Тепловая карта активности (365 дней)</h3>
            <p className="text-[11px] text-muted-foreground">Каждый квадрат — активность за день (заметки, задачи, цели)</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{effectiveStreak} дн. стрик</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Всего: <strong className="text-foreground">{effectiveTotal}</strong> активностей
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto pb-3 pt-1 scrollbar-thin scroll-smooth">
        <div className="flex gap-1 min-w-[700px]">
          {gridWeeks.map((week, wIdx) => {
            const labelMonth = week.find(d => d.monthName)?.monthName
            return (
              <div key={wIdx} className="flex flex-col gap-1 items-center">
                {/* Month label header */}
                <div className="h-4 text-[9px] font-semibold text-muted-foreground/80 select-none">
                  {labelMonth || ''}
                </div>

                {/* 7 Days of the week */}
                {week.map((day, dIdx) => {
                  if (!day.date) {
                    return <div key={dIdx} className="w-3 h-3 rounded-xs opacity-0" />
                  }

                  return (
                    <motion.div
                      key={day.date}
                      whileHover={{ scale: 1.35 }}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`w-3 h-3 rounded-xs cursor-pointer transition-colors duration-150 ${getColorClass(day.count)}`}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer Legend & Tooltip readout */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40 flex-wrap gap-2">
        <div>
          {hoveredDay ? (
            <span className="text-foreground font-medium flex items-center gap-1.5 flex-wrap">
              <span>📅 {hoveredDay.date}:</span>
              <strong>{hoveredDay.count} {hoveredDay.count === 1 ? 'активность' : hoveredDay.count >= 2 && hoveredDay.count <= 4 ? 'активности' : 'активностей'}</strong>
              {hoveredDay.count > 0 && (
                <span className="text-muted-foreground">
                  (
                  {[
                    hoveredDay.notesCount > 0 && `${hoveredDay.notesCount} заметок`,
                    hoveredDay.tasksCount > 0 && `${hoveredDay.tasksCount} задач`,
                    hoveredDay.goalsCount > 0 && `${hoveredDay.goalsCount} целей`,
                  ].filter(Boolean).join(', ')}
                  )
                </span>
              )}
            </span>
          ) : (
            <span>Наведите на квадрат, чтобы увидеть детали активности за день</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span>Меньше</span>
          <div className="w-2.5 h-2.5 rounded-xs bg-muted/40 border border-border/30" />
          <div className="w-2.5 h-2.5 rounded-xs bg-emerald-900/60 border border-emerald-800" />
          <div className="w-2.5 h-2.5 rounded-xs bg-emerald-700" />
          <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
          <div className="w-2.5 h-2.5 rounded-xs bg-emerald-400" />
          <span>Больше</span>
        </div>
      </div>
    </div>
  )
}
