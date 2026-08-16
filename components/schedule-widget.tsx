'use client'

import { useState, useEffect } from 'react'
import type { ScheduleGroup, ScheduleLesson } from '@/lib/types'
import { 
  GraduationCap, BookOpen, Activity, Dumbbell, Palette, Music, 
  Trophy, Sparkles, Clock, MapPin, User, ChevronDown, ChevronUp, Settings2, CheckCircle2, Circle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduleWidgetProps {
  groups: ScheduleGroup[]
  onOpenManager: () => void
  mode?: 'compact' | 'full'
  className?: string
}

const ICONS_MAP: Record<string, any> = {
  GraduationCap,
  BookOpen,
  Activity,
  Dumbbell,
  Palette,
  Music,
  Trophy,
  Sparkles,
}

export function ScheduleWidget({
  groups,
  onOpenManager,
  mode = 'full',
  className,
}: ScheduleWidgetProps) {
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('10:00')
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState<number>(1)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [isExpanded, setIsExpanded] = useState<boolean>(mode === 'full')

  // Update current time & day
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const mins = now.getMinutes().toString().padStart(2, '0')
      setCurrentTimeStr(`${hours}:${mins}`)
      // JS getDay(): 0 = Sun, 1 = Mon .. 6 = Sat
      const jsDay = now.getDay()
      const mskDay = jsDay === 0 ? 7 : jsDay
      setCurrentDayOfWeek(mskDay)
    }
    updateTime()
    const interval = setInterval(updateTime, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load completed lessons from storage for today
  useEffect(() => {
    try {
      const todayKey = 'zerf_done_lessons_' + new Date().toISOString().slice(0, 10)
      const saved = localStorage.getItem(todayKey)
      if (saved) {
        setCompletedLessonIds(new Set(JSON.parse(saved)))
      }
    } catch {}
  }, [])

  const toggleLessonDone = (lessonId: string) => {
    setCompletedLessonIds(prev => {
      const next = new Set(prev)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      try {
        const todayKey = 'zerf_done_lessons_' + new Date().toISOString().slice(0, 10)
        localStorage.setItem(todayKey, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  // Active group (first active group or first group)
  const activeGroup = groups.find(g => g.isActive) || groups[0]

  if (!activeGroup) {
    if (mode === 'compact') return null
    return (
      <div className={cn('p-4 rounded-2xl border border-dashed border-border bg-card/50 flex items-center justify-between gap-4', className)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Группы расписания и уроков</h4>
            <p className="text-xs text-muted-foreground">Создайте группу «Школа» или «Тренировки» для умного отображения расписания</p>
          </div>
        </div>
        <button
          onClick={onOpenManager}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0"
        >
          Настроить
        </button>
      </div>
    )
  }

  const GroupIcon = ICONS_MAP[activeGroup.icon] || GraduationCap
  const todaySchedule = activeGroup.days?.find(d => d.dayOfWeek === currentDayOfWeek)
  const lessons = (todaySchedule?.enabled ? todaySchedule.lessons : []) || []

  // Check current/next lessons
  const toMinutes = (timeStr: string) => {
    if (!timeStr) return 0
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
  }
  const curMinutes = toMinutes(currentTimeStr)

  let activeLessonIndex = -1
  let nextLessonIndex = -1

  lessons.forEach((l, idx) => {
    const startM = toMinutes(l.startTime)
    const endM = toMinutes(l.endTime)
    if (curMinutes >= startM && curMinutes <= endM) {
      activeLessonIndex = idx
    } else if (curMinutes < startM && nextLessonIndex === -1) {
      nextLessonIndex = idx
    }
  })

  // Compact Mode (for TasksView — clean, smart card without flooding regular tasks)
  if (mode === 'compact') {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card overflow-hidden transition-all shadow-sm', className)}>
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ backgroundColor: activeGroup.color }}
            >
              <GroupIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{activeGroup.title}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                  {lessons.length > 0 ? `${lessons.length} уроков сегодня` : 'Выходной'}
                </span>
                {activeLessonIndex !== -1 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 animate-pulse hidden sm:inline-block">
                    Сейчас: {lessons[activeLessonIndex].name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {lessons.length > 0
                  ? `${lessons[0].startTime} – ${lessons[lessons.length - 1].endTime}`
                  : 'Занятий на сегодня не запланировано'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenManager}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Настроить расписание"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            {lessons.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={isExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable lessons list in compact mode */}
        {isExpanded && lessons.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-border/60 bg-card/60 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lessons.map((lesson, idx) => {
                const isCurrent = idx === activeLessonIndex
                const isDone = completedLessonIds.has(lesson.id)
                return (
                  <div
                    key={lesson.id}
                    onClick={() => toggleLessonDone(lesson.id)}
                    className={cn(
                      'p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer select-none',
                      isCurrent
                        ? 'border-primary/60 bg-primary/10 shadow-sm'
                        : isDone
                        ? 'border-border/40 bg-muted/20 opacity-60'
                        : 'border-border/60 bg-muted/10 hover:border-border'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button type="button" className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                        {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-muted-foreground">{idx + 1}.</span>
                          <span className={cn('text-xs font-semibold truncate text-foreground', isDone && 'line-through opacity-70')}>
                            {lesson.name || 'Урок'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{lesson.startTime}–{lesson.endTime}</span>
                          {lesson.room && <span>• {lesson.room}</span>}
                        </div>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground shrink-0">
                        Идет
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full Mode (for TodayView — prominent, rich timeline)
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ backgroundColor: activeGroup.color }}
          >
            <GroupIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">{activeGroup.title}</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                {lessons.length > 0 ? `${lessons.length} уроков` : 'Выходной'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {lessons.length > 0
                ? `Расписание на сегодня (${lessons[0].startTime} – ${lessons[lessons.length - 1].endTime})`
                : 'Сегодня уроков и занятий нет'}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenManager}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Настроить расписание</span>
          <span className="sm:hidden">Настроить</span>
        </button>
      </div>

      {/* Active Lesson Banner if in progress */}
      {activeLessonIndex !== -1 && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-primary/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                Идет прямо сейчас ({lessons[activeLessonIndex].startTime} – {lessons[activeLessonIndex].endTime})
              </span>
              <span className="text-sm font-bold text-foreground">
                {lessons[activeLessonIndex].name}
              </span>
              {lessons[activeLessonIndex].room && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({lessons[activeLessonIndex].room})
                </span>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono font-bold text-emerald-400">
              до {lessons[activeLessonIndex].endTime}
            </span>
          </div>
        </div>
      )}

      {/* Lessons Timeline Grid */}
      {lessons.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {lessons.map((lesson, idx) => {
            const isCurrent = idx === activeLessonIndex
            const isDone = completedLessonIds.has(lesson.id)
            const isNext = idx === nextLessonIndex

            return (
              <div
                key={lesson.id}
                onClick={() => toggleLessonDone(lesson.id)}
                className={cn(
                  'p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer select-none',
                  isCurrent
                    ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/40'
                    : isDone
                    ? 'border-border/40 bg-muted/20 opacity-60'
                    : isNext
                    ? 'border-border/90 bg-muted/40'
                    : 'border-border/60 bg-muted/10 hover:border-border'
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <button type="button" className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0">
                    {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-muted-foreground">{idx + 1}.</span>
                      <h5 className={cn('text-xs font-bold text-foreground truncate', isDone && 'line-through opacity-70')}>
                        {lesson.name || 'Занятие'}
                      </h5>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{lesson.startTime}–{lesson.endTime}</span>
                      </div>
                      {lesson.room && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{lesson.room}</span>
                        </div>
                      )}
                    </div>

                    {lesson.teacher && (
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                        {lesson.teacher}
                      </p>
                    )}
                  </div>
                </div>

                {isCurrent && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground shrink-0 shadow-sm">
                    Сейчас
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          Сегодня уроков нет. Вы можете добавить расписание в настройках группы.
        </div>
      )}
    </div>
  )
}
