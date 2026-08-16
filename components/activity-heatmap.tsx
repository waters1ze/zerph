'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Calendar, Sparkles } from 'lucide-react'

interface ActivityHeatmapProps {
  completedDates?: string[] // Array of 'YYYY-MM-DD'
  totalCompleted?: number
  currentStreak?: number
}

export function ActivityHeatmap({ completedDates = [], totalCompleted = 0, currentStreak = 0 }: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number } | null>(null)

  // Map counts per date
  const dateCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    completedDates.forEach(d => {
      if (d) {
        const cleanDate = d.slice(0, 10)
        counts[cleanDate] = (counts[cleanDate] || 0) + 1
      }
    })
    return counts
  }, [completedDates])

  // Generate 52 weeks (364 days) grid leading up to today
  const gridWeeks = useMemo(() => {
    const weeks: Array<Array<{ date: string; count: number; dayOfWeek: number; monthName?: string }>> = []
    const now = new Date()
    
    // Start from Sunday of 52 weeks ago
    const start = new Date(now)
    start.setDate(now.getDate() - 364)
    // Align to Sunday
    const startDay = start.getDay()
    start.setDate(start.getDate() - startDay)

    let current = new Date(start)
    let currentWeek: Array<{ date: string; count: number; dayOfWeek: number; monthName?: string }> = []
    let lastMonth = -1

    while (current <= now || currentWeek.length > 0) {
      const dateStr = current.toISOString().slice(0, 10)
      const count = dateCounts[dateStr] || 0
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
        currentWeek.push({ date: '', count: 0, dayOfWeek: currentWeek.length })
      }
      weeks.push(currentWeek)
    }

    return weeks
  }, [dateCounts])

  const getColorClass = (count: number) => {
    if (count === 0) return 'bg-muted/40 border border-border/30'
    if (count === 1) return 'bg-emerald-900/60 border border-emerald-800/80 text-emerald-300'
    if (count === 2) return 'bg-emerald-700 border border-emerald-600'
    if (count <= 4) return 'bg-emerald-500 border border-emerald-400'
    return 'bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-500/20'
  }

  return (
    <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Тепловая карта активности (365 дней)</h3>
            <p className="text-[11px] text-muted-foreground">Каждый квадрат — выполненные задачи за день</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{currentStreak} дн. стрик</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Всего: <strong className="text-foreground">{totalCompleted}</strong> задач
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
                      title={`${day.date}: ${day.count} задач`}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer Legend & Tooltip readout */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
        <div>
          {hoveredDay ? (
            <span className="text-foreground font-medium">
              <span className="mono-emoji mr-1">📅</span> {hoveredDay.date}: <strong>{hoveredDay.count}</strong> задач выполнено
            </span>
          ) : (
            <span>Наведите на квадрат, чтобы увидеть детали</span>
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
