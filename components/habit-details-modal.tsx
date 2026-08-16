'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn, groupTasksByDate, isBirthdayTask } from '@/lib/utils'
import {
  X, Flame, CheckCircle2, Circle, Plus, Calendar,
  FileText, CheckSquare, Edit3, Trash2, Sparkles, Tag, Check
} from 'lucide-react'
import { TaskItem } from '@/components/task-item'
import type { Habit } from '@/lib/types'

interface HabitDetailsModalProps {
  habit: Habit
  isOpen: boolean
  onClose: () => void
  onEdit: (habit: Habit) => void
  onDelete: (habitId: string) => void
}

export function HabitDetailsModal({
  habit,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: HabitDetailsModalProps) {
  const { state, dispatch } = useApp()
  const [activeTab, setActiveTab] = useState<'all' | 'tasks' | 'notes'>('all')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)
  const isDoneToday = habit.lastCompletedAt === todayStr

  // Find all tasks and notes linked to this habit
  const linkedTasks = state.tasks.filter(t => 
    (t.habitId === habit.id || t.tags?.some(tag => tag.toLowerCase() === habit.title.toLowerCase())) &&
    !isBirthdayTask(t)
  )

  const linkedNotes = state.notes.filter(n =>
    n.habitId === habit.id || n.tags?.some(tag => tag.toLowerCase() === habit.title.toLowerCase())
  )

  const taskDateGroups = groupTasksByDate(linkedTasks)

  const toggleHabitCompletion = () => {
    const isCompletedToday = habit.lastCompletedAt === todayStr
    const newCompletedAt = isCompletedToday ? undefined : todayStr

    let newStreak = habit.streak
    if (isCompletedToday) {
      newStreak = Math.max(0, habit.streak - 1)
    } else {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toISOString().slice(0, 10)
      if (habit.lastCompletedAt === yStr) {
        newStreak += 1
      } else if (!habit.lastCompletedAt || habit.lastCompletedAt < yStr) {
        newStreak = 1
      }
    }

    dispatch({
      type: 'UPDATE_HABIT',
      id: habit.id,
      updates: { lastCompletedAt: newCompletedAt, streak: newStreak },
    })
  }

  const handleCreateLinkedTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    const now = new Date().toISOString()
    dispatch({
      type: 'ADD_TASK',
      task: {
        id: `t-${Date.now()}`,
        title: newTaskTitle.trim(),
        priority: 'medium',
        status: 'todo',
        dueDate: todayStr,
        habitId: habit.id,
        tags: [habit.title.toLowerCase()],
        assignees: [],
        isShared: false,
        createdAt: now,
        updatedAt: now,
      },
    })
    setNewTaskTitle('')
    setShowAddTask(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-2xl bg-card border border-border/80 shadow-2xl rounded-3xl overflow-hidden font-sans flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/60 bg-gradient-to-br from-card via-card to-primary/5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              {habit.icon || '🔥'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground leading-tight">
                  {habit.title}
                </h2>
                <span className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full">
                  <Flame className="w-3.5 h-3.5" /> {habit.streak} {habit.streak === 1 ? 'день' : habit.streak < 5 ? 'дня' : 'дней'} подряд
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Частота: {habit.frequency === 'daily' ? 'Каждый день' : 'Еженедельно'} • Связанных задач: {linkedTasks.length} • Заметок: {linkedNotes.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(habit)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Изменить привычку"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(habit.id)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted/60 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
              title="Удалить привычку"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Check-in Banner */}
        <div className="px-6 py-3.5 bg-muted/30 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2.5 h-2.5 rounded-full',
              isDoneToday ? 'bg-[var(--status-done)]' : 'bg-muted-foreground/40'
            )} />
            <span className="text-xs font-semibold text-foreground">
              {isDoneToday ? 'Привычка выполнена сегодня! Отличная работа!' : 'Привычка еще не выполнена сегодня'}
            </span>
          </div>

          <button
            onClick={toggleHabitCompletion}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs',
              isDoneToday
                ? 'bg-[var(--status-done)] text-white hover:opacity-90'
                : 'bg-primary text-primary-foreground hover:brightness-110'
            )}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isDoneToday ? 'Выполнено ✓' : 'Отметить за сегодня'}</span>
          </button>
        </div>

        {/* Tabs & Add Action */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-2 border-b border-border/40">
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/60">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                activeTab === 'all' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Все ({linkedTasks.length + linkedNotes.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
                activeTab === 'tasks' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CheckSquare className="w-3 h-3" /> Задачи ({linkedTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
                activeTab === 'notes' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <FileText className="w-3 h-3" /> Заметки ({linkedNotes.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddTask(p => !p)}
            className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить задачу</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Inline Add Task Form */}
          <AnimatePresence>
            {showAddTask && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreateLinkedTask}
                className="p-3.5 rounded-2xl bg-muted/40 border border-primary/30 flex flex-col gap-2.5 shadow-xs"
              >
                <p className="text-[11px] font-bold text-primary flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Новая задача для привычки «{habit.title}»
                </p>
                <div className="flex gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Например: Пробежать 3 км..."
                    className="flex-1 h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 hover:brightness-110 transition-all"
                  >
                    Добавить
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Linked Tasks Section (Grouped by Date) */}
          {(activeTab === 'all' || activeTab === 'tasks') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Задачи по датам
                </h3>
                <span className="text-[11px] font-semibold text-muted-foreground">({linkedTasks.length})</span>
              </div>

              {linkedTasks.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-muted/20 border border-dashed border-border/60">
                  <p className="text-xs text-muted-foreground">
                    К этой привычке пока не привязано ни одной задачи.
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    Нажмите «Добавить задачу» или создайте задачу с тегом #{habit.title.toLowerCase()}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {taskDateGroups.map(group => (
                    <div key={group.dateKey} className="space-y-1.5">
                      <div className="flex items-center gap-2 px-1 py-0.5 select-none">
                        <div className={cn(
                          'flex items-center gap-1.5 text-[11px] font-bold tracking-tight uppercase',
                          group.isToday ? 'text-primary' : group.isOverdue ? 'text-[var(--status-overdue)]' : 'text-muted-foreground'
                        )}>
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{group.label}</span>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border/50">
                          {group.tasks.length}
                        </span>
                        <div className="flex-1 h-[1px] bg-border/40 ml-2" />
                      </div>
                      <div className="space-y-1">
                        {group.tasks.map((t, idx) => (
                          <TaskItem key={t.id} task={t} index={idx} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Linked Notes Section */}
          {(activeTab === 'all' || activeTab === 'notes') && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Привязанные заметки
                </h3>
                <span className="text-[11px] font-semibold text-muted-foreground">({linkedNotes.length})</span>
              </div>

              {linkedNotes.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-muted/20 border border-dashed border-border/60">
                  <p className="text-xs text-muted-foreground">
                    К этой привычке пока нет привязанных заметок.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {linkedNotes.map(n => (
                    <div
                      key={n.id}
                      onClick={() => dispatch({ type: 'SET_VIEW', view: 'notes' })}
                      className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 hover:border-primary/40 transition-all cursor-pointer flex flex-col gap-1.5 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                          {n.folder || 'Общее'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {n.content?.slice(0, 120) || 'Без текста'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
