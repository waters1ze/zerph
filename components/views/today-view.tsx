'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useApp, getAuthHeaders } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { HabitsWidget } from '@/components/habits-widget'
import { ScheduleWidget } from '@/components/schedule-widget'
import { ScheduleGroupModal } from '@/components/schedule-group-modal'
import { FocusTimerWidget } from '@/components/focus-timer-widget'
import { cn, isYearlyEventTask, isSchoolTask, isTaskOnDate, sanitizeTaskTitle } from '@/lib/utils'
import { CheckCircle2, Clock, AlertCircle, TrendingUp, Flame, Target, Cloud, Lightbulb, Sparkles, Briefcase, User, Zap, GraduationCap, Activity, X, Settings2, ChevronDown, ChevronUp } from 'lucide-react'
import { format, parseISO, isToday } from 'date-fns'
import { useState, useEffect } from 'react'
import type { ScheduleGroup } from '@/lib/types'

interface DailyContext {
  formattedDate: string
  weather: string
  tip: string
}

export function cleanTipText(tip?: string | null): string {
  if (!tip) return 'Фокусируйтесь на 1–2 ключевых задачах дня — это залог высокой продуктивности.'
  let cleaned = tip
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/<\/think>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^["«]|["»]$/g, '')
    .replace(/^Совет:\s*/i, '')
    .replace(/^\s*[-*•]\s*/, '')
    .trim()

  const lower = cleaned.toLowerCase()
  if (
    !cleaned ||
    cleaned.length < 8 ||
    lower.includes('think') ||
    lower.includes('process') ||
    lower.includes('analyze') ||
    lower.includes('user input') ||
    lower.includes('role:') ||
    lower.includes('focus:')
  ) {
    return 'Фокусируйтесь на 1–2 ключевых задачах дня — это залог высокой продуктивности.'
  }
  return cleaned
}

const getInitialDailyContext = (): DailyContext => {
  const now = new Date()
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  const formattedDate = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('zerf_daily_context')
      if (cached) {
        const parsed = JSON.parse(cached)
        return {
          formattedDate,
          weather: parsed.weather || 'Москва: Переменная облачность +20°C',
          tip: cleanTipText(parsed.tip),
        }
      }
    } catch {}
  }
  return {
    formattedDate,
    weather: 'Москва: Переменная облачность +20°C',
    tip: 'Фокусируйтесь на 1–2 ключевых задачах дня — это залог высокой продуктивности.',
  }
}

export function taskMatchesHabit(task: any, habit: { id: string; title: string }): boolean {
  if (!task || !habit) return false
  if (task.habitId === habit.id) return true

  const hTitle = habit.title.toLowerCase().trim()
  const tTitle = (task.title || '').toLowerCase()
  const tDesc = (task.description || '').toLowerCase()
  const tags: string[] = (task.tags || []).map((t: any) => String(t).toLowerCase())

  // Exact tag match
  if (tags.includes(hTitle)) return true

  // Specific semantic matching for gaming habits:
  // "Играть в игры" / "Игры" / "Гейминг" -> matches "поиграть", "игры", "игра", "cs", "counterstrike", "dota", "steam"
  if (/(?:игр|гейм|играть)/i.test(hTitle)) {
    if (/(?:поиграть|играть|сыграть|игры|игру|игрули|гейм|cs|counter.?strike|dota|steam|playstation|xbox)/i.test(tTitle + ' ' + tDesc) || tags.some((t: string) => /(?:игры|игра|гейминг|cs)/i.test(t))) {
      return true
    }
  }

  // "Прослушивание музыки" / "Музыка" -> "музык", "трек", "песн", "альбом", "плейлист", "spotify"
  if (/(?:музык|слушать|песн)/i.test(hTitle)) {
    if (/(?:музык|трек|песн|альбом|плейлист|spotify|яндекс\s*музык|слушать)/i.test(tTitle + ' ' + tDesc) || tags.some((t: string) => /(?:музыка|треки)/i.test(t))) {
      return true
    }
  }

  // "Утренняя тренировка" / "Тренировка" / "Спорт" / "Зал" -> "тренировк", "спорт", "зал", "бег", "пробежка", "отжимания", "приседания", "воркаут"
  if (/(?:тренировк|спорт|зал|воркаут|зарядк|фитнес|бег)/i.test(hTitle)) {
    if (/(?:тренировк|спорт|зал|воркаут|зарядк|фитнес|бег|пробежк|отжимания|приседания|жим|турник|растяжк|пресс)/i.test(tTitle + ' ' + tDesc) || tags.some((t: string) => /(?:спорт|тренировка|фитнес)/i.test(t))) {
      return true
    }
  }

  // "Чтение" / "Читать книги" -> "книг", "читать", "глав", "страниц"
  if (/(?:чтени|книг|читать)/i.test(hTitle)) {
    if (/(?:книг|читать|прочитать|глав|страниц|литератур)/i.test(tTitle + ' ' + tDesc) || tags.some((t: string) => /(?:книги|чтение)/i.test(t))) {
      return true
    }
  }

  // Generic keyword stem matching (words >= 4 chars)
  const keywords = hTitle.split(/[\s,.-]+/).filter(w => w.length >= 4)
  for (const kw of keywords) {
    const stem = kw.slice(0, 4)
    if (tTitle.includes(stem) || tDesc.includes(stem) || tags.some((t: string) => t.includes(stem))) {
      return true
    }
  }

  return false
}

export function TodayView() {
  const { state, dispatch } = useApp()
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null)
  const [eisenhowerSort, setEisenhowerSort] = useState(false)
  const [showAllLessons, setShowAllLessons] = useState(false)
  const [showDone, setShowDone] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('zerf_today_show_done') === 'true' } catch { return false }
  })
  const toggleShowDone = () => {
    setShowDone(prev => {
      const next = !prev
      try { localStorage.setItem('zerf_today_show_done', String(next)) } catch {}
      return next
    })
  }
  const [context, setContext] = useState<DailyContext>(getInitialDailyContext)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false)
  const [plannerLoading, setPlannerLoading] = useState(false)
  const [plannerMsg, setPlannerMsg] = useState<string | null>(null)
  const [rescheduleLoading, setRescheduleLoading] = useState(false)

  const handleSmartReschedule = async () => {
    if (overdueTasks.length === 0 || rescheduleLoading) return
    setRescheduleLoading(true)
    try {
      const res = await fetch('/api/tasks/smart-reschedule', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: overdueTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
        }),
      })
      const data = await res.json()
      if (data.ok && Array.isArray(data.rescheduled)) {
        for (const item of data.rescheduled) {
          dispatch({
            type: 'UPDATE_TASK',
            id: item.id,
            updates: {
              dueDate: item.dueDate,
              dueTime: item.dueTime || undefined,
              status: 'todo',
            },
          })
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setRescheduleLoading(false)
    }
  }

  const handleSaveGroup = (group: ScheduleGroup) => {
    const exists = state.scheduleGroups?.some(g => g.id === group.id)
    if (exists) {
      dispatch({ type: 'UPDATE_SCHEDULE_GROUP', id: group.id, updates: group })
    } else {
      dispatch({ type: 'ADD_SCHEDULE_GROUP', group })
    }
  }

  const handleDeleteGroup = (groupId: string) => {
    dispatch({ type: 'DELETE_SCHEDULE_GROUP', id: groupId })
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  const planDay = async () => {
    if (plannerLoading) return
    setPlannerLoading(true)
    setPlannerMsg(null)
    try {
      const res = await fetch('/api/ai-planner', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      const data = await res.json()
      if (data.success && data.slots?.length > 0) {
        // Update task dueTime in local state immediately
        for (const slot of data.slots) {
          dispatch({ type: 'UPDATE_TASK', id: slot.taskId, updates: { dueTime: slot.dueTime } })
        }
        setPlannerMsg(data.message || `Распланировано ${data.slots.length} задач`)
      } else {
        setPlannerMsg(data.message || 'Нечего планировать')
      }
    } catch {
      setPlannerMsg('Ошибка планировщика')
    } finally {
      setPlannerLoading(false)
      setTimeout(() => setPlannerMsg(null), 4000)
    }
  }

  const FIXED_TAGS = [
    { id: 'all', label: 'Все' },
    { id: 'работа', label: 'Работа', icon: Briefcase },
    { id: 'личное', label: 'Личное', icon: User },
    { id: 'срочно', label: 'Срочно', icon: Zap },
    { id: 'идеи', label: 'Идеи', icon: Lightbulb },
    { id: 'учеба', label: 'Учеба', icon: GraduationCap },
    { id: 'спорт', label: 'Спорт', icon: Activity },
  ]

  const matchesTag = (t: { tags?: string[]; priority?: string }) => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'срочно') {
      return t.priority === 'urgent' || t.tags?.some(tag => tag.toLowerCase().includes('срочн'))
    }
    return t.tags?.some(tag => tag.toLowerCase().includes(selectedTag))
  }

  // Fetch updated daily context in background without delaying initial render
  useEffect(() => {
    const savedCity = typeof window !== 'undefined' ? localStorage.getItem('zerf_city') || '' : ''
    const cityParam = savedCity ? `?city=${encodeURIComponent(savedCity)}` : ''
    fetch(`/api/daily-context${cityParam}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.formattedDate) {
          setContext(d)
          try {
            localStorage.setItem('zerf_daily_context', JSON.stringify(d))
          } catch {}
        }
      })
      .catch(() => {})
  }, [])

  const activeHabit = state.habits.find(h => h.id === selectedHabitId) || null

  const rawTodayTasks = state.tasks.filter(t => {
    if (activeHabit) {
      // When a habit is selected: show ALL tasks from ALL dates for this habit
      return taskMatchesHabit(t, activeHabit)
    }
    // Otherwise show today's tasks + repeating weekly routines, daily tasks, yearly events
    if (t.dueDate) {
      return isTaskOnDate(t, today, today)
    }
    return isToday(parseISO(t.createdAt))
  })
  const todayTasks = rawTodayTasks.filter(matchesTag)
  const doneTasks = todayTasks.filter(t => t.status === 'done')
  const activeTasks = todayTasks.filter(t => t.status !== 'done')
  const schoolActiveTasks = activeTasks.filter(isSchoolTask)
  const personalActiveTasks = activeTasks.filter(t => !isSchoolTask(t))
  const overdueTasks = activeHabit ? [] : state.tasks.filter(t => t.status === 'overdue')
  const completionRate = todayTasks.length ? Math.round((doneTasks.length / todayTasks.length) * 100) : 0

  const stats = [
    { label: 'Осталось',    value: activeTasks.length, icon: Clock, color: 'text-primary' },
    { label: 'Выполнено',   value: doneTasks.length, icon: CheckCircle2, color: 'text-[var(--status-done)]' },
    { label: 'Просрочено',  value: overdueTasks.length, icon: AlertCircle, color: 'text-[var(--status-overdue)]' },
    { label: 'Прогресс',    value: `${completionRate}%`, icon: TrendingUp, color: 'text-[var(--status-inprogress)]' },
  ]

  return (
    <div className="w-full max-w-none grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Main Left/Center Column ── */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
        {/* Daily context card */}
        {context && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-2.5 px-4 py-3.5 rounded-xl bg-card border border-border/60 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-foreground capitalize">{context.formattedDate}</p>
              <div className="flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">{context.weather}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 pt-1 border-t border-border/40">
              <Lightbulb className="w-3.5 h-3.5 text-primary/70 shrink-0 mt-0.5" />
              <p className="text-[12px] text-muted-foreground leading-relaxed italic">{cleanTipText(context.tip)}</p>
            </div>
          </motion.div>
        )}

        {/* Next Task Live Countdown Card */}
        {(() => {
          const nextTimedTask = activeTasks
            .filter(t => t.dueTime)
            .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''))[0]

          if (!nextTimedTask || !nextTimedTask.dueTime) return null

          return (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border border-primary/25 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wide uppercase text-primary">
                    Следующее дело в {nextTimedTask.dueTime}:
                  </p>
                  <p className="text-[13px] font-semibold text-foreground truncate max-w-[240px] sm:max-w-md">
                    {sanitizeTaskTitle(nextTimedTask.title)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'clock' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shrink-0"
              >
                <span>Таймер</span>
                <Sparkles className="w-3 h-3" />
              </button>
            </motion.div>
          )
        })()}

        {/* Stats row */}
        <div className="stats-grid-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.22 }}
                className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-card border border-border hover:border-border/80 transition-colors shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <Icon className={cn('w-4 h-4', s.color)} />
                </div>
                <p className="text-xl font-semibold text-foreground leading-none">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </motion.div>
            )
          })}
        </div>

        {/* Progress bar */}
        {todayTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-xs"
          >
            <Flame className="w-4 h-4 text-[var(--priority-high)] shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between mb-1.5">
                <span className="text-[12px] font-medium text-foreground">Прогресс за день</span>
                <span className="text-[12px] text-muted-foreground">{doneTasks.length} из {todayTasks.length} ({completionRate}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Smart Schedule Group Widget (Full Timeline for Today) */}
        <ScheduleWidget
          groups={state.scheduleGroups || []}
          onOpenManager={() => setIsScheduleModalOpen(true)}
          mode="full"
        />

        {/* Habits Widget */}
        <HabitsWidget
          selectedHabitId={selectedHabitId}
          onSelectHabit={setSelectedHabitId}
        />

        {/* Active Habit Banner */}
        {activeHabit && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/25">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">{activeHabit.icon || '📌'}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">Привычка: {activeHabit.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {todayTasks.length > 0
                    ? `Показаны все задачи по этой привычке со всех дней (${todayTasks.length})`
                    : 'По этой привычке пока нет созданных задач'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedHabitId(null)}
              className="px-2.5 py-1 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0 shadow-xs"
            >
              <X className="w-3 h-3" />
              <span>Все задачи</span>
            </button>
          </div>
        )}

        {/* Overdue tasks */}
        {overdueTasks.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <h2 className="text-xs font-bold text-destructive uppercase tracking-wider">
                  Просрочено ({overdueTasks.length})
                </h2>
              </div>
              <button
                onClick={handleSmartReschedule}
                disabled={rescheduleLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="ИИ умно распределит просроченные дела по дням недели"
              >
                <Sparkles className={cn("w-3.5 h-3.5", rescheduleLoading && "animate-spin")} />
                <span>{rescheduleLoading ? 'Перепланирую...' : '🔄 Перепланировать с ИИ'}</span>
              </button>
            </div>
            <div className="space-y-1">
              {overdueTasks.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
            </div>
          </div>
        )}

        {/* Tag Filters Bar (Responsive flex-wrap, no scrollbars) */}
        <div className="flex flex-wrap items-center gap-1.5 no-scrollbar select-none">
          {FIXED_TAGS.map(tag => {
            const isActive = selectedTag === tag.id
            const Icon = (tag as any).icon
            return (
              <button
                key={tag.id}
                onClick={() => setSelectedTag(tag.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                    : 'bg-card/70 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {Icon && <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />}
                <span>{tag.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tasks list */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                {activeHabit
                  ? `Задачи привычки «${activeHabit.title}» — ${activeTasks.length} осталось`
                  : `Сегодня — ${activeTasks.length} задач осталось`}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={planDay}
                disabled={plannerLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 disabled:opacity-60"
                title="ИИ распланирует временные слоты для задач без времени"
              >
                <Sparkles className={`w-3 h-3 ${plannerLoading ? 'animate-spin' : ''}`} />
                {plannerLoading ? 'Планирую...' : 'ИИ план'}
              </button>
              <button
                onClick={() => setEisenhowerSort(!eisenhowerSort)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border",
                  eisenhowerSort 
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                    : "bg-card text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
                )}
              >
                Авто-сорт
              </button>
            </div>
          </div>
          {/* AI Planner status toast */}
          {plannerMsg && (
            <div className="mb-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
              ✨ {plannerMsg}
            </div>
          )}
          {/* School Schedule Card for Today */}
          {!activeHabit && schoolActiveTasks.length > 0 && (() => {
            const sortedLessons = [...schoolActiveTasks].sort((a, b) =>
              (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99')
            )
            const currentLesson = sortedLessons[0]
            const remainingLessons = sortedLessons.slice(1)

            return (
              <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-sm shrink-0">
                      🏫
                    </div>
                    <h3 className="text-[13px] font-bold text-foreground">Школьное расписание</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {schoolActiveTasks.length} {schoolActiveTasks.length === 1 ? 'урок' : schoolActiveTasks.length < 5 ? 'урока' : 'уроков'} осталось
                    </span>
                  </div>
                  {remainingLessons.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllLessons(!showAllLessons)}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      {showAllLessons ? 'Свернуть' : `Все уроки (${sortedLessons.length})`}
                    </button>
                  )}
                </div>

                {/* Current immediate lesson */}
                <div className="space-y-1 mt-0.5">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">
                    {remainingLessons.length > 0 ? 'Текущий / Следующий урок:' : 'Урок:'}
                  </div>
                  <TaskItem key={currentLesson.id} task={currentLesson} index={0} compact />
                </div>

                {/* Remaining lessons (shown when showAllLessons is true or auto-revealed as lessons are completed) */}
                <AnimatePresence>
                  {showAllLessons && remainingLessons.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1 pt-1 border-t border-border/50"
                    >
                      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 px-1">
                        Следующие уроки дня:
                      </div>
                      {remainingLessons.map((t, i) => (
                        <TaskItem key={t.id} task={t} index={i + 1} compact />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })()}

          {activeTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-10 text-center bg-card/30 rounded-2xl border border-dashed border-border"
            >
              <CheckCircle2 className="w-10 h-10 text-[var(--status-done)]/60" />
              <p className="text-sm font-medium text-foreground">
                {activeHabit
                  ? `По привычке «${activeHabit.title}» нет активных задач`
                  : 'Все задачи на сегодня выполнены!'}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {activeHabit
                  ? 'Все задачи этой привычки выполнены или еще не созданы.'
                  : 'Отличная работа. Отдохни или запланируй дела на завтра.'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-0.5">
              {(activeHabit ? activeTasks : personalActiveTasks)
                .sort((a, b) => {
                  if (eisenhowerSort) {
                    const getScore = (p: string) => p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : 1
                    const aScore = getScore(a.priority)
                    const bScore = getScore(b.priority)
                    if (aScore !== bScore) return bScore - aScore
                  }
                  return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99')
                })
                .map((t, i) => <TaskItem key={t.id} task={t} index={i} />)
              }
            </div>
          )}
        </div>

        {/* Completed tasks (Collapsible, hidden by default) */}
        {doneTasks.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <button
              onClick={toggleShowDone}
              className="w-full flex items-center gap-2 px-1 py-1.5 group select-none cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-done)]/70 shrink-0" />
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                Выполнено сегодня · {doneTasks.length}
              </span>
              {showDone
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              <div className="flex-1 h-[1px] bg-border/25" />
            </button>
            {showDone && (
              <div className="space-y-0.5 opacity-75 pt-1">
                {doneTasks.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right Sidebar Desktop Dashboard Panel ── */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col gap-5 sticky top-2">
        {/* Quick Pomodoro Focus Widget */}
        <FocusTimerWidget />

        {/* Active Goals Snapshot */}
        {state.goals.length > 0 && (
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">Активные цели</h2>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'goals' })}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Все цели →
              </button>
            </div>

            <div className="space-y-3">
              {state.goals.slice(0, 3).map((goal) => (
                <div key={goal.id} className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: goal.color }} />
                      <p className="text-[12px] font-semibold text-foreground truncate">{goal.title}</p>
                    </div>
                    <span className="text-[11px] font-bold text-foreground shrink-0">{goal.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, background: goal.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Priority Breakdown (Mini Matrix) */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">Приоритеты на сегодня</h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">{todayTasks.length} задач</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-[var(--priority-urgent)]/10 border border-[var(--priority-urgent)]/20">
              <span className="text-[var(--priority-urgent)] font-bold">Срочные:</span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {todayTasks.filter(t => t.priority === 'urgent').length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--priority-high)]/10 border border-[var(--priority-high)]/20">
              <span className="text-[var(--priority-high)] font-bold">Высокие:</span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {todayTasks.filter(t => t.priority === 'high').length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--priority-medium)]/10 border border-[var(--priority-medium)]/20">
              <span className="text-[var(--priority-medium)] font-bold">Средние:</span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {todayTasks.filter(t => t.priority === 'medium').length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
              <span className="text-muted-foreground font-bold">Низкие:</span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {todayTasks.filter(t => t.priority === 'low').length}
              </p>
            </div>
          </div>
        </div>

        {/* AI Productivity Advice Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 flex items-start gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-foreground">Совет от Zerf Note</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Закрывайте задачи со статусом «Срочно» в первой половине дня. Это освободит до 40% энергии для творческих дел.
            </p>
          </div>
        </div>
      </div>

      {/* Schedule Group Manager Modal */}
      <ScheduleGroupModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        groups={state.scheduleGroups || []}
        onSaveGroup={handleSaveGroup}
        onDeleteGroup={handleDeleteGroup}
      />
    </div>
  )
}
