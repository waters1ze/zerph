'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, ArrowLeft,
  Clock, CheckCircle2, AlertCircle, Calendar
} from 'lucide-react'
import type { Task } from '@/lib/types'
import { TaskItem } from '@/components/task-item'

// ── Priority color dots ───────────────────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-[var(--priority-urgent)]',
  high:   'bg-[var(--priority-high)]',
  medium: 'bg-[var(--priority-medium)]',
  low:    'bg-[var(--priority-low)]',
}
const PRIORITY_BAR: Record<string, string> = {
  urgent: 'bg-[var(--priority-urgent)]/80',
  high:   'bg-[var(--priority-high)]/80',
  medium: 'bg-primary/70',
  low:    'bg-[var(--priority-low)]/70',
}

const RU_MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
]
const RU_DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const RU_DAYS_FULL = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Day cell in grid ──────────────────────────────────────────────────────────
function DayCell({
  date,
  tasks,
  isToday,
  isCurrentMonth,
  onClick,
}: {
  date: Date
  tasks: Task[]
  isToday: boolean
  isCurrentMonth: boolean
  onClick: () => void
}) {
  const dayNum = date.getDate()
  const hasTasks = tasks.length > 0
  const topTasks = tasks.slice(0, 3)
  const more = tasks.length - 3

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={hasTasks || isToday ? onClick : undefined}
      className={cn(
        'relative min-h-[88px] p-2 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col gap-1',
        isToday
          ? 'border-primary/50 bg-primary/8 shadow-sm shadow-primary/10'
          : 'border-border/50 bg-card/60 hover:border-primary/25 hover:bg-accent/10',
        !isCurrentMonth && 'opacity-30',
        hasTasks && 'cursor-pointer'
      )}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={cn(
            'text-[13px] font-semibold leading-none',
            isToday
              ? 'w-6 h-6 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px]'
              : 'text-foreground/80'
          )}
        >
          {dayNum}
        </span>
        {tasks.length > 0 && (
          <span className="text-[9px] text-muted-foreground/60 font-medium">{tasks.length}</span>
        )}
      </div>

      {/* Task mini-bars */}
      <div className="flex flex-col gap-[3px] flex-1">
        {topTasks.map(t => (
          <div key={t.id} className="flex items-center gap-1.5 group">
            <div className={cn('w-1 h-1 rounded-full shrink-0', PRIORITY_DOT[t.priority])} />
            <div className={cn('h-[14px] rounded-sm flex-1 px-1 flex items-center', PRIORITY_BAR[t.priority])}>
              <p className="text-[9px] text-white/90 font-medium truncate leading-none">
                {t.dueTime ? `${t.dueTime} · ` : ''}{t.title}
              </p>
            </div>
          </div>
        ))}
        {more > 0 && (
          <p className="text-[9px] text-muted-foreground/50 pl-2.5">+{more} ещё</p>
        )}
      </div>
    </motion.div>
  )
}

// ── Day Detail View ───────────────────────────────────────────────────────────
function DayDetail({ dateStr, onBack }: { dateStr: string; onBack: () => void }) {
  const { state } = useApp()
  const date = new Date(dateStr + 'T12:00:00')
  const dayOfWeek = RU_DAYS_FULL[date.getDay()]
  const dayNum = date.getDate()
  const monthName = RU_MONTHS[date.getMonth()]
  const year = date.getFullYear()

  const dayTasks = state.tasks.filter(t => t.dueDate === dateStr)
  const activeTasks = dayTasks.filter(t => t.status !== 'done')
  const doneTasks = dayTasks.filter(t => t.status === 'done')
  const todayStr = toYMD(new Date())
  const isToday = dateStr === todayStr

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              {dayNum} {monthName} {year !== new Date().getFullYear() ? year : ''}
            </h1>
            {isToday && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                Сегодня
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground capitalize">{dayOfWeek}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{activeTasks.length} активных</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{doneTasks.length} выполнено</span>
      </div>

      {/* Active tasks */}
      {activeTasks.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Задачи</p>
          <div className="space-y-0.5">
            {activeTasks
              .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))
              .map((t, i) => <TaskItem key={t.id} task={t} index={i} />)
            }
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-10 text-center"
        >
          <Calendar className="w-10 h-10 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">Задач на этот день нет</p>
        </motion.div>
      )}

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div className="flex flex-col gap-1 pt-2 border-t border-border/50">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" /> Завершено
          </p>
          <div className="space-y-0.5 opacity-60">
            {doneTasks.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Main CalendarView ─────────────────────────────────────────────────────────
export function CalendarView() {
  const { state } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = toYMD(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Build calendar grid for current month
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday-first week offset
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
  const cells: Date[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startOffset + i)
    cells.push(d)
  }

  // Group tasks by date
  const tasksByDate = state.tasks.reduce((acc, t) => {
    if (t.dueDate) {
      if (!acc[t.dueDate]) acc[t.dueDate] = []
      acc[t.dueDate].push(t)
    }
    return acc
  }, {} as Record<string, Task[]>)

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))
  const goToToday = () => { setCurrentMonth(new Date()); setSelectedDate(null) }

  // Mini month strip for year overview
  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, i, 1)
    const m = i
    const hasTasks = state.tasks.some(t => {
      if (!t.dueDate) return false
      const [ty, tm] = t.dueDate.split('-').map(Number)
      return ty === year && tm - 1 === m
    })
    return { month: i, label: RU_MONTHS[i].slice(0, 3), hasTasks }
  })

  return (
    <div className="flex flex-col gap-4 h-full max-w-3xl">
      <AnimatePresence mode="wait">
        {selectedDate ? (
          <DayDetail key="detail" dateStr={selectedDate} onBack={() => setSelectedDate(null)} />
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">
                  {RU_MONTHS[month]} <span className="text-muted-foreground font-normal text-base">{year}</span>
                </h1>
                {toYMD(currentMonth).slice(0, 7) !== today.slice(0, 7) && (
                  <button
                    onClick={goToToday}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                  >
                    Сегодня
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Month mini-strip (year overview) */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {allMonths.map(m => (
                <button
                  key={m.month}
                  onClick={() => setCurrentMonth(new Date(year, m.month, 1))}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium shrink-0 transition-all',
                    month === m.month
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground border border-transparent hover:border-border/50'
                  )}
                >
                  {m.label}
                  {m.hasTasks && month !== m.month && (
                    <div className="w-1 h-1 rounded-full bg-primary/50" />
                  )}
                </button>
              ))}
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1.5">
              {RU_DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((date, i) => {
                const ymd = toYMD(date)
                const isCurrentMonth = date.getMonth() === month
                const isToday = ymd === today
                const tasks = (tasksByDate[ymd] || []).filter(t => t.status !== 'done')
                return (
                  <DayCell
                    key={i}
                    date={date}
                    tasks={tasks}
                    isToday={isToday}
                    isCurrentMonth={isCurrentMonth}
                    onClick={() => setSelectedDate(ymd)}
                  />
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 pt-1">
              <span className="text-[10px] text-muted-foreground/60">Приоритеты:</span>
              {[
                { label: 'Срочно', color: 'bg-[var(--priority-urgent)]' },
                { label: 'Высокий', color: 'bg-[var(--priority-high)]' },
                { label: 'Средний', color: 'bg-primary/70' },
                { label: 'Низкий', color: 'bg-[var(--priority-low)]' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className={cn('w-2 h-2 rounded-full', l.color)} />
                  <span className="text-[10px] text-muted-foreground/70">{l.label}</span>
                </div>
              ))}
            </div>

            {/* Upcoming tasks summary */}
            {(() => {
              const upcoming = state.tasks
                .filter(t => t.dueDate && t.dueDate > today && t.status !== 'done')
                .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                .slice(0, 5)
              if (!upcoming.length) return null
              return (
                <div className="border-t border-border/50 pt-4 mt-1">
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Предстоящие
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {upcoming.map(t => {
                      const d = new Date(t.dueDate! + 'T12:00:00')
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedDate(t.dueDate!)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/30 text-left transition-colors group"
                        >
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[t.priority])} />
                          <span className="text-[13px] text-foreground flex-1 truncate group-hover:text-primary transition-colors">{t.title}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {d.getDate()} {RU_MONTHS[d.getMonth()].slice(0, 3)}
                            {t.dueTime ? ` · ${t.dueTime}` : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
