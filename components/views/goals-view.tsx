'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { Target, ChevronDown, CheckCircle2, Circle, Plus, TrendingUp, AlertTriangle, Clock3, Trash2, X, Sparkles } from 'lucide-react'
import type { Goal, Milestone } from '@/lib/types'

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
        <span className="text-[11px] text-muted-foreground shrink-0 font-sans">{format(parseISO(milestone.dueDate), 'd MMM')}</span>
      )}
    </div>
  )
}

function GoalCard({ goal, index }: { goal: Goal; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { state, dispatch } = useApp()
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

  const deleteGoal = () => {
    dispatch({ type: 'DELETE_GOAL', id: goal.id })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.22 }}
      className="rounded-2xl bg-card border border-border overflow-hidden group relative"
    >
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: (goal.color || '#2d7a4f') + '25' }}>
            <Target className="w-4 h-4" style={{ color: goal.color || '#2d7a4f' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-bold text-foreground leading-snug font-sans">{goal.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full font-sans', sc.bg, sc.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {sc.label}
                </span>
                <button
                  onClick={deleteGoal}
                  title="Удалить цель"
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {goal.description && (
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed font-sans">{goal.description}</p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-bold text-muted-foreground font-sans">Прогресс</span>
            <span className="text-[12px] font-bold text-foreground font-sans">{goal.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: goal.color || '#2d7a4f' }}
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 + 0.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {goal.deadline && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-sans">
              <Clock3 className="w-3 h-3" />
              Срок: {format(parseISO(goal.deadline), 'd MMM yyyy')}
            </span>
          )}
          {relatedTasks.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-sans">
              Выполнено задач: {doneTasks.length}/{relatedTasks.length}
            </span>
          )}
          <button
            onClick={() => dispatch({
              type: 'UPDATE_GOAL',
              id: goal.id,
              updates: { visibility: goal.visibility === 'public' ? 'private' : 'public' }
            })}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-sans cursor-pointer transition-colors",
              goal.visibility === 'public' 
                ? "bg-primary/20 text-primary hover:bg-primary/30" 
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title="Изменить видимость"
          >
            {goal.visibility === 'public' ? '👁 Видна всем' : '🔒 Приватная'}
          </button>
        </div>

        {/* Expand toggle for Milestones */}
        {goal.milestones?.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors font-sans"
          >
            Ключевые этапы ({goal.milestones.filter(m => m.done).length}/{goal.milestones.length})
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Milestones */}
      <AnimatePresence>
        {expanded && goal.milestones?.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-0.5 border-t border-border pt-3">
              {goal.milestones.map(m => (
                <MilestoneItem key={m.id} milestone={m} onToggle={() => toggleMilestone(m.id)} />
              ))}
              {goal.motivation && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-muted-foreground/70 italic font-sans">&ldquo;{goal.motivation}&rdquo;</p>
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
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [milestonesInput, setMilestonesInput] = useState('')

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
    setTitle(''); setDescription(''); setDeadline(''); setMilestonesInput('')
    setShowCreate(false)
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Долгосрочные цели</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">Отслеживайте прогресс ваших главных стремлений</p>
        </div>
        <button
          onClick={() => {
            if (state.settings.userPlan === 'free' && state.goals.filter(g => g.status !== 'completed').length >= 1) {
              alert('В бесплатной версии доступна максимум 1 активная долгосрочная цель. Пожалуйста, приобретите Premium через бота.')
              return
            }
            setShowCreate(true)
          }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 transition-opacity font-sans"
        >
          <Plus className="w-3.5 h-3.5" />
          + Новая цель
        </button>
      </div>

      {/* Create Modal/Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-2xl bg-card border border-primary/30 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Создание новой цели
                </p>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Название цели (например: Выучить английский до B2)"
                  className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border/60 text-[13px] text-foreground font-semibold placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Описание или главная мотивация…"
                  rows={2}
                  className="w-full p-3 rounded-xl bg-muted/50 border border-border/60 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors resize-none"
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Срок выполнения (дедлайн):</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border/60 text-[12px] text-foreground outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Ключевые этапы (каждый этап с новой строки):</label>
                  <textarea
                    value={milestonesInput}
                    onChange={e => setMilestonesInput(e.target.value)}
                    placeholder={'Пройти базовый курс\nСдать тесты\nПрактика с носителями языка'}
                    rows={3}
                    className="w-full p-3 rounded-xl bg-muted/50 border border-border/60 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="h-8 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateGoal}
                  disabled={!title.trim()}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Создать цель
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals List */}
      {state.goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center bg-card/40 rounded-2xl border border-border/50">
          <Target className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-sm font-bold text-foreground">У вас пока нет поставленных целей</p>
          <p className="text-xs text-muted-foreground">Поставьте вашу первую цель или надиктуйте её боту в Telegram!</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-2 flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary/10 text-primary text-[12px] font-bold hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Поставить первую цель
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {state.goals.map((goal, i) => <GoalCard key={goal.id} goal={goal} index={i} />)}
        </div>
      )}
    </div>
  )
}
