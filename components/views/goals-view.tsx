'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Target, ChevronDown, CheckCircle2, Circle, Plus,
  TrendingUp, AlertTriangle, Clock3, Trash2, X, Sparkles,
  CheckSquare, Calendar, Flag, Award, BookOpen, Lightbulb
} from 'lucide-react'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Goal, Milestone, GoalStatus } from '@/lib/types'

function MilestoneItem({ milestone, onToggle }: { milestone: Milestone; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 cursor-pointer group" onClick={onToggle}>
      {milestone.done
        ? <CheckCircle2 className="w-4 h-4 text-[var(--status-done)] shrink-0" />
        : <Circle className="w-4 h-4 text-border group-hover:text-muted-foreground shrink-0 transition-colors" />
      }
      <span className={cn('text-[13px] flex-1 font-sans', milestone.done ? 'line-through text-muted-foreground' : 'text-foreground')}>
        {milestone.title}
      </span>
      {milestone.dueDate && (
        <span className="text-[11px] text-muted-foreground shrink-0 font-sans">
          {format(parseISO(milestone.dueDate), 'd MMM', { locale: ru })}
        </span>
      )}
    </div>
  )
}

function GoalCard({ goal, index }: { goal: Goal; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { state, dispatch } = useApp()
  const confirm = useConfirmDialog()
  const relatedTasks = state.tasks.filter(t => t.goalId === goal.id)
  const doneTasks = relatedTasks.filter(t => t.status === 'done')

  const statusConfig = {
    on_track: { label: 'В норме', icon: TrendingUp, color: 'text-[var(--status-done)]', bg: 'bg-[var(--status-done)]/10' },
    at_risk:  { label: 'Под риском', icon: AlertTriangle, color: 'text-[var(--priority-medium)]', bg: 'bg-[var(--priority-medium)]/10' },
    delayed:  { label: 'Задерживается', icon: Clock3, color: 'text-[var(--status-overdue)]', bg: 'bg-[var(--status-overdue)]/10' },
    completed:{ label: 'Завершено', icon: CheckCircle2, color: 'text-[var(--status-done)]', bg: 'bg-[var(--status-done)]/10' },
  }
  const sc = statusConfig[goal.status] || statusConfig.on_track
  const StatusIcon = sc.icon

  const toggleMilestone = (milestoneId: string) => {
    const updated = goal.milestones.map(m => m.id === milestoneId ? { ...m, done: !m.done } : m)
    const completedMilestones = updated.filter(m => m.done).length
    const progress = updated.length > 0 ? Math.round((completedMilestones / updated.length) * 100) : goal.progress
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, updates: { milestones: updated, progress } })
  }

  const handleDeleteGoal = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirm({
      title: `Удалить цель «${goal.title}»?`,
      description: 'Все этапы и привязка задач к этой цели будут сброшены.',
      confirmText: 'Удалить цель',
      variant: 'danger',
    })
    if (!ok) return
    dispatch({ type: 'DELETE_GOAL', id: goal.id })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.22 }}
      className="rounded-2xl bg-card border border-border/80 overflow-hidden group relative hover:border-primary/40 transition-all shadow-xs"
    >
      <div className="p-5">
        <div className="flex items-start gap-3.5 mb-3.5">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-inner"
            style={{ background: (goal.color || '#2d7a4f') + '25' }}
          >
            <Target className="w-5 h-5" style={{ color: goal.color || '#2d7a4f' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-bold text-foreground leading-snug font-sans">{goal.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full font-sans', sc.bg, sc.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {sc.label}
                </span>
                <button
                  onClick={handleDeleteGoal}
                  title="Удалить цель"
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {goal.description && (
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed font-sans">{goal.description}</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-bold text-muted-foreground font-sans">Прогресс цели</span>
            <span className="text-[12px] font-bold text-foreground font-sans">{goal.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: goal.color || '#2d7a4f' }}
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Meta Bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40 font-sans">
          <div className="flex items-center gap-3">
            {goal.deadline && (
              <span className="flex items-center gap-1 font-semibold text-foreground/80">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>До {format(parseISO(goal.deadline), 'd MMMM yyyy', { locale: ru })}</span>
              </span>
            )}
            {relatedTasks.length > 0 && (
              <span className="flex items-center gap-1 font-medium">
                <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Задачи: {doneTasks.length}/{relatedTasks.length}</span>
              </span>
            )}
          </div>

          {goal.milestones?.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <span>{goal.milestones.filter(m => m.done).length}/{goal.milestones.length} этапов</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Milestones */}
      <AnimatePresence>
        {expanded && goal.milestones?.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-1 border-t border-border/50 pt-3 bg-muted/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Ключевые этапы (Milestones)
              </p>
              {goal.milestones.map(m => (
                <MilestoneItem key={m.id} milestone={m} onToggle={() => toggleMilestone(m.id)} />
              ))}
              {goal.motivation && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-[11px] text-muted-foreground/80 italic font-sans flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary shrink-0" />
                    <span>&ldquo;{goal.motivation}&rdquo;</span>
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function GoalsView() {
  const { state, dispatch } = useApp()
  const confirm = useConfirmDialog()
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [motivation, setMotivation] = useState('')
  const [deadline, setDeadline] = useState('')
  const [milestonesInput, setMilestonesInput] = useState('')

  // Statistics calculation
  const totalGoals = state.goals.length
  const completedGoals = state.goals.filter(g => g.status === 'completed' || g.progress === 100).length
  const onTrackGoals = state.goals.filter(g => g.status === 'on_track' && g.progress < 100).length
  const atRiskGoals = state.goals.filter(g => g.status === 'at_risk' || g.status === 'delayed').length
  const avgProgress = totalGoals > 0
    ? Math.round(state.goals.reduce((sum, g) => sum + g.progress, 0) / totalGoals)
    : 0

  // Filtered goals
  const filteredGoals = useMemo(() => {
    if (selectedStatus === 'all') return state.goals
    if (selectedStatus === 'completed') return state.goals.filter(g => g.status === 'completed' || g.progress === 100)
    if (selectedStatus === 'on_track') return state.goals.filter(g => g.status === 'on_track' && g.progress < 100)
    if (selectedStatus === 'at_risk') return state.goals.filter(g => g.status === 'at_risk' || g.status === 'delayed')
    return state.goals
  }, [state.goals, selectedStatus])

  // Collect upcoming milestones across all active goals
  const upcomingMilestones = useMemo(() => {
    const list: { goalTitle: string; milestone: Milestone; goalId: string }[] = []
    state.goals.forEach(g => {
      g.milestones?.forEach(m => {
        if (!m.done) {
          list.push({ goalTitle: g.title, milestone: m, goalId: g.id })
        }
      })
    })
    return list.slice(0, 5)
  }, [state.goals])

  const handleCreateGoal = () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    const ms = milestonesInput
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map((mTitle, i) => ({ id: `ms_${Date.now()}_${i}`, title: mTitle, done: false }))

    const newGoal: Goal = {
      id: `g_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      motivation: motivation.trim() || undefined,
      status: 'on_track',
      deadline: deadline || undefined,
      progress: 0,
      milestones: ms,
      projectIds: [],
      noteIds: [],
      createdAt: now,
      updatedAt: now,
      color: '#2d7a4f',
      visibility: 'private',
    }

    dispatch({ type: 'ADD_GOAL', goal: newGoal })
    setTitle(''); setDescription(''); setMotivation(''); setDeadline(''); setMilestonesInput('')
    setShowCreate(false)
  }

  return (
    <div className="w-full font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Долгосрочные цели и стремления
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ставьте амбициозные ориентиры, разбивайте их на этапы и отслеживайте достижение
          </p>
        </div>
        <button
          onClick={() => {
            if (state.settings.userPlan === 'free' && state.goals.filter(g => g.status !== 'completed').length >= 1) {
              confirm({
                title: 'Лимит активных целей',
                description: 'В бесплатной версии доступна максимум 1 активная долгосрочная цель. Пожалуйста, приобретите Premium через бота.',
                confirmText: 'Понятно',
                variant: 'primary',
              })
              return
            }
            setShowCreate(true)
          }}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Поставить цель</span>
        </button>
      </div>

      {/* Main 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Goals List & Form (8 cols on large screens) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-card/60 p-1 rounded-2xl border border-border/80 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Все цели', count: totalGoals },
              { id: 'on_track', label: 'В норме', count: onTrackGoals },
              { id: 'at_risk', label: 'Под риском', count: atRiskGoals },
              { id: 'completed', label: 'Достигнутые', count: completedGoals },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                  selectedStatus === tab.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-md font-bold',
                  selectedStatus === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Create Goal Form */}
          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-5 rounded-3xl bg-card border border-primary/40 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Поставить новую долгосрочную цель
                    </p>
                    <button
                      onClick={() => setShowCreate(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Название цели:</label>
                      <input
                        autoFocus
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Например: Запустить стартап до конца года или Выучить C++"
                        className="w-full h-10 px-3.5 rounded-xl bg-muted/50 border border-border/80 text-xs text-foreground font-semibold placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Описание / Стратегия:</label>
                        <textarea
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder="Каких результатов вы хотите достичь…"
                          rows={2}
                          className="w-full p-2.5 rounded-xl bg-muted/50 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Главная мотивация (почему это важно?):</label>
                        <textarea
                          value={motivation}
                          onChange={e => setMotivation(e.target.value)}
                          placeholder="Что даст вам достижение этой цели…"
                          rows={2}
                          className="w-full p-2.5 rounded-xl bg-muted/50 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors resize-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Срок выполнения (дедлайн):</label>
                      <input
                        type="date"
                        value={deadline}
                        onChange={e => setDeadline(e.target.value)}
                        className="w-full sm:w-64 h-9 px-3 rounded-xl bg-muted/50 border border-border/80 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Ключевые этапы (каждый этап с новой строки):</label>
                      <textarea
                        value={milestonesInput}
                        onChange={e => setMilestonesInput(e.target.value)}
                        placeholder={'1. Написать MVP проекта\n2. Провести первые 10 тестов\n3. Запустить релиз'}
                        rows={3}
                        className="w-full p-3 rounded-xl bg-muted/50 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                    <button
                      onClick={() => setShowCreate(false)}
                      className="h-8 px-4 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleCreateGoal}
                      disabled={!title.trim()}
                      className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Создать цель</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Goals List */}
          {filteredGoals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center bg-card/40 rounded-3xl border border-border/50">
              <Target className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm font-bold text-foreground">
                {selectedStatus === 'all' ? 'У вас пока нет поставленных целей' : 'Целей в данной категории не найдено'}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Поставьте вашу первую цель или надиктуйте её боту Zerf в Telegram голосом!
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Поставить цель</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredGoals.map((goal, i) => <GoalCard key={goal.id} goal={goal} index={i} />)}
            </div>
          )}
        </div>

        {/* Right Column: Statistics, Milestones & OKR Advice (4 cols on large screens) */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col gap-4 sticky top-2">
          {/* Progress Overview Card */}
          <div className="p-5 rounded-3xl bg-card border border-border/80 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Award className="w-4 h-4 text-primary" />
                Сводка прогресса
              </span>
              <span className="text-sm font-bold text-primary">{avgProgress}% общий</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60">
                <p className="text-2xl font-bold text-foreground">{totalGoals}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Всего целей</p>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--status-done)]/10 border border-[var(--status-done)]/20">
                <p className="text-2xl font-bold text-[var(--status-done)]">{completedGoals}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Достигнуто</p>
              </div>
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <p className="text-2xl font-bold text-primary">{onTrackGoals}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">В норме</p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-2xl font-bold text-amber-500">{atRiskGoals}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Под риском</p>
              </div>
            </div>
          </div>

          {/* Upcoming Key Milestones Card */}
          <div className="p-5 rounded-3xl bg-card border border-border/80 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Flag className="w-4 h-4 text-amber-500" />
                Ближайшие этапы
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">({upcomingMilestones.length})</span>
            </div>

            {upcomingMilestones.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Все этапы выполнены или не добавлены.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingMilestones.map(({ goalTitle, milestone, goalId }) => (
                  <div
                    key={milestone.id}
                    onClick={() => {
                      const goal = state.goals.find(g => g.id === goalId)
                      if (goal) {
                        const updated = goal.milestones.map(m => m.id === milestone.id ? { ...m, done: true } : m)
                        const completedMilestones = updated.filter(m => m.done).length
                        const progress = updated.length > 0 ? Math.round((completedMilestones / updated.length) * 100) : goal.progress
                        dispatch({ type: 'UPDATE_GOAL', id: goalId, updates: { milestones: updated, progress } })
                      }
                    }}
                    className="p-3 rounded-2xl bg-muted/30 border border-border/60 hover:border-primary/40 transition-all cursor-pointer group flex items-start gap-2.5"
                  >
                    <Circle className="w-4 h-4 text-border group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                        {milestone.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        Цель: {goalTitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OKR & SMART Methodology Advice */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <Lightbulb className="w-4 h-4" />
              <span>Методология OKR и SMART</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Делите большие цели на 3–5 измеримых ключевых результатов (Key Results). Привязывайте ежедневные задачи к цели в редакторе задач, чтобы видеть вклад каждого дня!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
