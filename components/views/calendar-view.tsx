'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn, isYearlyEventTask, isSchoolTask, isTaskOnDate } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, ArrowLeft,
  Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon,
  RefreshCw, Smartphone
} from 'lucide-react'
import type { Task, Note } from '@/lib/types'
import { TaskItem } from '@/components/task-item'
import { CalendarSyncModal } from '@/components/calendar-sync-modal'

// ── Priority color dots & badges ──────────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-[var(--priority-urgent)]',
  high:   'bg-[var(--priority-high)]',
  medium: 'bg-[var(--priority-medium)]',
  low:    'bg-[var(--priority-low)]',
}
const PRIORITY_BAR: Record<string, string> = {
  urgent: 'bg-[var(--priority-urgent)]/85 text-white',
  high:   'bg-[var(--priority-high)]/85 text-white',
  medium: 'bg-primary/80 text-primary-foreground',
  low:    'bg-muted-foreground/40 text-foreground',
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

export function isNoteOnDate(n: Note, ymd: string): boolean {
  if (!n) return false
  if (n.dueDate === ymd) return true
  const created = n.createdAt ? n.createdAt.slice(0, 10) : ''
  if (created === ymd) return true
  const updated = n.updatedAt ? n.updatedAt.slice(0, 10) : ''
  if (!n.dueDate && updated === ymd) return true
  return false
}

export function isTaskForCalendar(t: Task, ymd: string, todayYmd: string): boolean {
  if (isTaskOnDate(t, ymd, todayYmd)) return true
  if (t.status === 'done') {
    if (t.completedAt && t.completedAt.slice(0, 10) === ymd) return true
    if (t.dueDate === ymd) return true
  }
  return false
}

// ── Day Cell Component ────────────────────────────────────────────────────────
function DayCell({
  date,
  tasks,
  notes,
  isToday,
  isCurrentMonth,
  onClick,
}: {
  date: Date
  tasks: Task[]
  notes: Note[]
  isToday: boolean
  isCurrentMonth: boolean
  onClick: () => void
}) {
  const dayNum = date.getDate()
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const schoolTasks = activeTasks.filter(isSchoolTask)
  const otherActiveTasks = activeTasks.filter(t => !isSchoolTask(t))

  // Build unified display items for the cell
  const displayItems: Array<{
    id: string
    title: string
    priority?: string
    dueTime?: string | null
    type: 'school' | 'task' | 'note' | 'done'
  }> = []

  if (schoolTasks.length >= 2) {
    const firstTime = schoolTasks[0].dueTime ? schoolTasks[0].dueTime.split(/[\s–-]+/)[0] : ''
    displayItems.push({
      id: `school_group_${schoolTasks[0].id}`,
      title: `🏫 Школа (${schoolTasks.length} ур.)`,
      priority: 'medium',
      dueTime: firstTime || null,
      type: 'school',
    })
    otherActiveTasks.forEach(t => {
      displayItems.push({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueTime: t.dueTime,
        type: 'task',
      })
    })
  } else {
    activeTasks.forEach(t => {
      displayItems.push({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueTime: t.dueTime,
        type: 'task',
      })
    })
  }

  // Include notes on that day so past and current days are rich and populated
  notes.forEach(n => {
    displayItems.push({
      id: `note_${n.id}`,
      title: `📝 ${n.title || 'Заметка'}`,
      type: 'note',
    })
  })

  // Include completed tasks on that day
  doneTasks.forEach(t => {
    displayItems.push({
      id: `done_${t.id}`,
      title: `✓ ${t.title}`,
      priority: t.priority,
      dueTime: t.dueTime,
      type: 'done',
    })
  })

  const topItems = displayItems.slice(0, 2)
  const more = displayItems.length - 2
  const totalCount = tasks.length + notes.length

  return (
    <motion.div
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative min-h-[48px] sm:min-h-[60px] md:min-h-[70px] lg:min-h-[78px] xl:min-h-[86px] p-1.5 sm:p-2 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col justify-between overflow-hidden group shadow-2xs',
        isToday
          ? 'border-primary/80 bg-primary/10 shadow-sm shadow-primary/15 ring-1 ring-primary/40'
          : 'border-border/90 bg-card/80 hover:border-primary/60 hover:bg-card',
        !isCurrentMonth && 'opacity-25 hover:opacity-70'
      )}
    >
      {/* Day number & count header */}
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={cn(
            'text-[11px] sm:text-[12px] font-bold leading-none select-none transition-colors',
            isToday
              ? 'w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold shadow-xs'
              : 'text-foreground/85 group-hover:text-primary'
          )}
        >
          {dayNum}
        </span>
        {totalCount > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-muted/80 text-muted-foreground border border-border/40 select-none">
            {totalCount}
          </span>
        )}
      </div>

      {/* Item list inside day */}
      <div className="flex flex-col gap-0.5 flex-1 justify-start overflow-hidden w-full mt-0.5">
        {/* Desktop view (sm+): full item pills */}
        <div className="hidden sm:flex flex-col gap-[2px] overflow-hidden w-full">
          {topItems.map(item => {
            if (item.type === 'note') {
              return (
                <div key={item.id} className="flex items-center gap-1 w-full">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400" />
                  <div className="h-[17px] rounded-md flex-1 px-1.5 flex items-center overflow-hidden bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    <p className="text-[9.5px] font-medium truncate leading-none">
                      {item.title}
                    </p>
                  </div>
                </div>
              )
            }
            if (item.type === 'done') {
              return (
                <div key={item.id} className="flex items-center gap-1 w-full opacity-65">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />
                  <div className="h-[17px] rounded-md flex-1 px-1.5 flex items-center overflow-hidden bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    <p className="text-[9.5px] font-medium truncate leading-none line-through">
                      {item.title}
                    </p>
                  </div>
                </div>
              )
            }
            return (
              <div key={item.id} className="flex items-center gap-1 w-full">
                <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[item.priority || 'medium'] || 'bg-primary')} />
                <div className={cn('h-[17px] rounded-md flex-1 px-1.5 flex items-center overflow-hidden', PRIORITY_BAR[item.priority || 'medium'] || 'bg-primary/80 text-primary-foreground')}>
                  <p className="text-[9.5px] font-medium truncate leading-none">
                    {item.dueTime ? `${item.dueTime} ` : ''}{item.title}
                  </p>
                </div>
              </div>
            )
          })}
          {more > 0 && (
            <p className="text-[9px] text-muted-foreground/70 font-semibold pl-1.5">+{more} ещё</p>
          )}
        </div>

        {/* Mobile view (< sm): priority dot indicators */}
        <div className="flex sm:hidden flex-wrap items-center gap-1 pt-0.5">
          {notes.slice(0, 2).map(n => (
            <div key={n.id} className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400" />
          ))}
          {tasks.slice(0, 3).map(t => (
            <div
              key={t.id}
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                t.status === 'done' ? 'bg-emerald-400' : PRIORITY_DOT[t.priority] || 'bg-primary'
              )}
            />
          ))}
          {totalCount > 3 && (
            <span className="text-[8px] text-muted-foreground font-bold leading-none">+{totalCount - 3}</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Day Detail View ───────────────────────────────────────────────────────────
function DayDetail({ dateStr, onBack }: { dateStr: string; onBack: () => void }) {
  const { state, dispatch } = useApp()
  const date = new Date(dateStr + 'T12:00:00')
  const dayOfWeek = RU_DAYS_FULL[date.getDay()]
  const dayNum = date.getDate()
  const monthName = RU_MONTHS[date.getMonth()]
  const year = date.getFullYear()

  const realTodayYMD = toYMD(new Date())
  const dayTasks = (state.tasks || []).filter(t => isTaskForCalendar(t, dateStr, realTodayYMD))
  const dayNotes = (state.notes || []).filter(n => isNoteOnDate(n, dateStr))
  const activeTasks = dayTasks.filter(t => t.status !== 'done')
  const schoolActive = activeTasks.filter(isSchoolTask)
  const personalActive = activeTasks.filter(t => !isSchoolTask(t))
  const doneTasks = dayTasks.filter(t => t.status === 'done')
  const todayStr = toYMD(new Date())
  const isToday = dateStr === todayStr

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 w-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {dayNum} {monthName} {year !== new Date().getFullYear() ? year : ''}
            </h1>
            {isToday && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                Сегодня
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground capitalize">{dayOfWeek}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-4 text-[13px] text-muted-foreground bg-card/60 p-3 rounded-xl border border-border/60">
        <span className="flex items-center gap-1.5 font-medium text-foreground"><Clock className="w-4 h-4 text-primary" />{activeTasks.length} к выполнению</span>
        <span className="flex items-center gap-1.5 font-medium text-amber-400"><CalendarIcon className="w-4 h-4" />{dayNotes.length} заметок</span>
        <span className="flex items-center gap-1.5 font-medium text-emerald-400"><CheckCircle2 className="w-4 h-4" />{doneTasks.length} завершено</span>
      </div>

      {/* Linked Notes Section */}
      {dayNotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-widest font-bold text-amber-400 flex items-center gap-1.5">
            📝 Заметки за этот день ({dayNotes.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dayNotes.map(n => (
              <div
                key={n.id}
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'notes' })}
                className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/15 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-foreground">{n.title || 'Без названия'}</h4>
                  <span className="text-[11px] text-amber-400 font-semibold">Открыть →</span>
                </div>
                <p className="text-[12px] text-muted-foreground line-clamp-2 mt-1">
                  {(n.content || '').replace(/#{1,6}\s/g, '').slice(0, 120) || 'Текст заметки...'}
                </p>
                {n.tags && n.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {n.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-medium">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* School Schedule Group */}
      {schoolActive.length > 0 && (
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-sm shrink-0">
                🏫
              </div>
              <h3 className="text-[13px] font-bold text-foreground">Школьное расписание</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {schoolActive.length} {schoolActive.length === 1 ? 'урок' : schoolActive.length < 5 ? 'урока' : 'уроков'}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
              {schoolActive[0].dueTime ? `с ${schoolActive[0].dueTime.split(/[\s–-]+/)[0]}` : ''}
            </span>
          </div>
          <div className="space-y-1 mt-1">
            {schoolActive
              .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))
              .map((t, i) => (
                <TaskItem key={t.id} task={t} index={i} compact />
              ))}
          </div>
        </div>
      )}

      {/* Personal & Other Tasks */}
      {personalActive.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Задачи и дела</p>
          <div className="space-y-1">
            {personalActive
              .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))
              .map((t, i) => <TaskItem key={t.id} task={t} index={i} />)
            }
          </div>
        </div>
      ) : (
        schoolActive.length === 0 && dayNotes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-14 text-center bg-card/30 rounded-2xl border border-dashed border-border"
          >
            <CalendarIcon className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Задач и заметок на этот день нет</p>
          </motion.div>
        )
      )}

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
          <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Выполненные задачи
          </p>
          <div className="space-y-1 opacity-65">
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
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [syncModalOpen, setSyncModalOpen] = useState(false)

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

  const realTodayYMD = toYMD(new Date())

  // Group tasks by date for all cells in the calendar grid (including completed past tasks)
  const tasksByDate = cells.reduce((acc, cellDate) => {
    const ymd = toYMD(cellDate)
    const matching = (state.tasks || []).filter(t => isTaskForCalendar(t, ymd, realTodayYMD))
    if (matching.length > 0) {
      acc[ymd] = matching
    }
    return acc
  }, {} as Record<string, Task[]>)

  // Group notes by date for all cells in the calendar grid
  const notesByDate = cells.reduce((acc, cellDate) => {
    const ymd = toYMD(cellDate)
    const matching = (state.notes || []).filter(n => isNoteOnDate(n, ymd))
    if (matching.length > 0) {
      acc[ymd] = matching
    }
    return acc
  }, {} as Record<string, Note[]>)

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))
  const goToToday = () => { setCurrentMonth(new Date()); setSelectedDate(null) }

  // Mini month strip for year overview
  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const m = i
    const hasTasks = (state.tasks || []).some(t => {
      if (!t.dueDate || !t.dueDate.includes('-')) return false
      const [ty, tm] = t.dueDate.split('-').map(Number)
      const isYearly = isYearlyEventTask(t)
      if (isYearly) {
        const [, ytm, ytd] = t.dueDate.split('-').map(Number)
        const projectedDate = `${year}-${String(ytm).padStart(2, '0')}-${String(ytd).padStart(2, '0')}`
        return ytm - 1 === m && projectedDate >= realTodayYMD
      }
      return ty === year && tm - 1 === m
    })
    const hasNotes = (state.notes || []).some(n => {
      const dStr = n.dueDate || (n.createdAt ? n.createdAt.slice(0, 10) : '')
      if (!dStr.includes('-')) return false
      const [ny, nm] = dStr.split('-').map(Number)
      return ny === year && nm - 1 === m
    })
    return { month: i, label: RU_MONTHS[i].slice(0, 3), hasTasks: hasTasks || hasNotes }
  })

  return (
    <div className="flex flex-col gap-3 h-full w-full max-w-none">
      <AnimatePresence mode="wait">
        {selectedDate ? (
          <DayDetail key="detail" dateStr={selectedDate} onBack={() => setSelectedDate(null)} />
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-2.5 sm:gap-3.5 w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  {RU_MONTHS[month]} <span className="text-muted-foreground font-normal text-base sm:text-xl">{year}</span>
                </h1>
                {toYMD(currentMonth).slice(0, 7) !== today.slice(0, 7) && (
                  <button
                    onClick={goToToday}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                  >
                    Сегодня
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSyncModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-all cursor-pointer"
                  title="Синхронизация с Apple / Google Календарем"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Синхронизация</span>
                </button>
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Month mini-strip (year overview) */}
            <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 no-scrollbar select-none w-full">
              {allMonths.map(m => (
                <button
                  key={m.month}
                  onClick={() => setCurrentMonth(new Date(year, m.month, 1))}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-2.5 sm:px-3 py-1 rounded-lg text-[10px] sm:text-[11px] font-medium shrink-0 transition-all',
                    month === m.month
                      ? 'bg-primary text-primary-foreground shadow-sm font-bold ring-1 ring-primary/50'
                      : 'bg-card/70 border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {m.label}
                  {m.hasTasks && month !== m.month && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 w-full">
              {RU_DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-[10px] sm:text-[11px] uppercase tracking-widest font-bold text-muted-foreground/75 py-0.5 select-none">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 w-full">
              {cells.map((date, i) => {
                const ymd = toYMD(date)
                const isCurrentMonth = date.getMonth() === month
                const isToday = ymd === today
                const tasks = tasksByDate[ymd] || []
                const notes = notesByDate[ymd] || []
                return (
                  <DayCell
                    key={i}
                    date={date}
                    tasks={tasks}
                    notes={notes}
                    isToday={isToday}
                    isCurrentMonth={isCurrentMonth}
                    onClick={() => setSelectedDate(ymd)}
                  />
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 pt-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground">Легенда:</span>
              {[
                { label: 'Срочно', color: 'bg-[var(--priority-urgent)]' },
                { label: 'Высокий', color: 'bg-[var(--priority-high)]' },
                { label: 'Средний', color: 'bg-primary/70' },
                { label: 'Низкий', color: 'bg-[var(--priority-low)]' },
                { label: 'Заметка', color: 'bg-amber-400' },
                { label: 'Выполнено', color: 'bg-emerald-400' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', l.color)} />
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 font-medium">{l.label}</span>
                </div>
              ))}
            </div>

            {/* Upcoming tasks summary */}
            {(() => {
              const upcoming = state.tasks
                .filter(t => t.dueDate && t.dueDate > today && t.status !== 'done')
                .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                .slice(0, 6)
              if (!upcoming.length) return null
              return (
                <div className="border-t border-border/50 pt-5 mt-2 w-full">
                  <p className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-primary" /> Предстоящие задачи
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {upcoming.map(t => {
                      const d = new Date(t.dueDate! + 'T12:00:00')
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedDate(t.dueDate!)}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/70 hover:border-primary/50 text-left transition-all group shadow-2xs hover:shadow-xs"
                        >
                          <div className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[t.priority])} />
                          <span className="text-[13px] sm:text-sm font-medium text-foreground flex-1 truncate group-hover:text-primary transition-colors">{t.title}</span>
                          <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0 font-medium">
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

      {/* Calendar Sync Modal */}
      <CalendarSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
      />
    </div>
  )
}
