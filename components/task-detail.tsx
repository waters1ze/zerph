'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskCheckbox } from './task-checkbox'
import { PriorityBadge } from './priority-badge'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import {
  X, Tag, FolderKanban, Sparkles,
  Trash2, ChevronDown, Target, Edit3, Check
} from 'lucide-react'
import type { Priority, TaskStatus } from '@/lib/types'
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select'
import { DatePicker } from '@/components/ui/date-picker'

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'К исполнению', inprogress: 'В процессе', done: 'Завершено', overdue: 'Просрочено'
}

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'urgent', label: 'Срочный',  color: 'var(--priority-urgent)' },
  { value: 'high',   label: 'Высокий',  color: 'var(--priority-high)' },
  { value: 'medium', label: 'Средний',  color: 'var(--priority-medium)' },
  { value: 'low',    label: 'Низкий',   color: 'var(--priority-low)' },
]

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'todo',       label: 'К исполнению' },
  { value: 'inprogress', label: 'В процессе' },
  { value: 'done',       label: 'Завершено' },
  { value: 'overdue',    label: 'Просрочено' },
]

export function TaskDetail() {
  const { state, dispatch } = useApp()
  const [showSource, setShowSource] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')

  const task = state.selectedTaskId ? state.tasks.find(t => t.id === state.selectedTaskId) : null
  const project = task?.projectId ? state.projects.find(p => p.id === task.projectId) : null
  const goal = task?.goalId ? state.goals.find(g => g.id === task.goalId) : null

  if (!task) return null

  const isDone = task.status === 'done'

  const startEditTitle = () => {
    setEditTitle(task.title)
    setIsEditingTitle(true)
  }

  const saveTitle = () => {
    if (editTitle.trim()) {
      dispatch({ type: 'UPDATE_TASK', id: task.id, updates: { title: editTitle.trim() } })
    }
    setIsEditingTitle(false)
  }

  return (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full bg-card border-l border-border overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Task detail</span>
        <button
          onClick={() => dispatch({ type: 'SELECT_TASK', id: null })}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Title + checkbox */}
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <TaskCheckbox
              checked={isDone}
              onChange={() => dispatch({ type: 'TOGGLE_TASK', id: task.id })}
              priority={task.priority}
              size={20}
            />
          </div>
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-start gap-2">
                <textarea
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); saveTitle() } if (e.key === 'Escape') setIsEditingTitle(false) }}
                  className="flex-1 text-base font-semibold bg-transparent border-b border-primary outline-none resize-none text-foreground leading-snug"
                  rows={2}
                />
                <button onClick={saveTitle} className="mt-0.5 text-primary hover:opacity-80">
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                className="group flex items-start gap-1.5 cursor-pointer"
                onClick={startEditTitle}
              >
                <h2 className={cn('text-base font-semibold text-foreground leading-snug', isDone && 'line-through text-muted-foreground')}>
                  {task.title}
                </h2>
                <Edit3 className="w-3.5 h-3.5 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">ПРИОРИТЕТ</p>
            <CustomSelect
              value={task.priority}
              onChange={v => dispatch({ type: 'UPDATE_TASK', id: task.id, updates: { priority: v as Priority } })}
              options={PRIORITY_OPTIONS}
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">СТАТУС</p>
            <CustomSelect
              value={task.status}
              onChange={v => dispatch({ type: 'UPDATE_TASK', id: task.id, updates: { status: v as TaskStatus } })}
              options={STATUS_OPTIONS}
            />
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">ДАТА</p>
            <DatePicker
              value={task.dueDate}
              onChange={v => dispatch({ type: 'UPDATE_TASK', id: task.id, updates: { dueDate: v } })}
            />
          </div>

          {/* Due Time */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-widest text-amber-400/90 font-semibold flex items-center gap-1">
              ⏰ ВРЕМЯ НАПОМИНАНИЯ
            </p>
            <input
              type="time"
              value={task.dueTime ?? ''}
              onChange={e => dispatch({ type: 'UPDATE_TASK', id: task.id, updates: { dueTime: e.target.value || undefined } })}
              className="text-[12px] bg-muted/50 rounded-lg px-2.5 py-1 border border-amber-500/30 text-amber-400 outline-none font-mono cursor-pointer"
            />
          </div>
        </div>

        {/* Live Notification Countdown */}
        {task.dueTime && !isDone && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide">
                🔔 Telegram Напоминание
              </p>
              <p className="text-xs text-foreground/80 mt-0.5">
                Прийдёт в Telegram ровно в <strong className="text-amber-400 font-mono">{task.dueTime}</strong>
              </p>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
              ⏰ {task.dueTime}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">ОПИСАНИЕ</p>
          <textarea
            defaultValue={task.description ?? ''}
            onBlur={e => dispatch({ type: 'UPDATE_TASK', id: task.id, updates: { description: e.target.value } })}
            placeholder="Добавить описание…"
            rows={3}
            className="w-full text-[13px] text-foreground/80 bg-muted/40 rounded-lg px-3 py-2.5 border border-border/50 outline-none resize-none placeholder:text-muted-foreground/50 focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Subtasks ({task.subtasks.filter(s => s.done).length}/{task.subtasks.length})
            </p>
            <div className="space-y-1.5">
              {task.subtasks.map(sub => (
                <div
                  key={sub.id}
                  onClick={() => {
                    const updated = task.subtasks!.map(s => s.id === sub.id ? { ...s, done: !s.done } : s)
                    dispatch({ type: 'UPDATE_TASK', id: task.id, updates: { subtasks: updated } })
                  }}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    sub.done ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                  )}>
                    {sub.done && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  </div>
                  <span className={cn('text-[13px]', sub.done ? 'line-through text-muted-foreground' : 'text-foreground')}>
                    {sub.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project & Goal */}
        {(project || goal) && (
          <div className="flex flex-col gap-2.5">
            {project && (
              <div className="flex items-center gap-2">
                <FolderKanban className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="w-2 h-2 rounded-full" style={{ background: project.color }} />
                <span className="text-[13px] text-foreground">{project.title}</span>
              </div>
            )}
            {goal && (
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[13px] text-foreground">{goal.title}</span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">ТЕГИ</p>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border/50">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Collaborators */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="p-3.5 rounded-xl bg-accent/40 border border-border/60">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5 flex items-center gap-1.5">
              👥 КОМАНДА И УЧАСТНИКИ ЗАДАЧИ
            </p>
            <div className="flex flex-wrap gap-2">
              {task.assignees.map(aid => {
                const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : ''
                const isMe = currentChatId && String(currentChatId) === String(aid)
                const friend = state.friends.find(f => f.id === aid || f.chatId === aid)
                const name = isMe ? 'Вы (Владелец)' : (friend?.name || `Участник #${aid.slice(-4)}`)
                return (
                  <div key={aid} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border/60 shadow-xs">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">
                        {isMe ? 'ВЫ' : name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[12px] font-medium text-foreground">{name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* AI Description & Summary */}
        {task.summary && task.summary !== task.title && (
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              ИИ Описание и Разбор
            </p>
            <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {task.summary}
            </p>
          </div>
        )}

        {/* Raw Voice Transcript */}
        {(task.source || task.rawText) && (
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
            <button
              onClick={() => setShowSource(!showSource)}
              className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                🎙️ Исходная голосовая запись
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showSource && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showSource && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="mt-2 text-[12px] text-muted-foreground/90 italic leading-relaxed bg-black/20 p-2.5 rounded-lg border border-border/30">
                    «{task.source || task.rawText}»
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-border flex items-center justify-between shrink-0">
        <button
          onClick={() => dispatch({ type: 'DELETE_TASK', id: task.id })}
          className="flex items-center gap-1.5 text-[12px] text-destructive/70 hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Удалить задачу
        </button>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} size="md" />
          {task.completedAt && (
            <span className="text-[11px] text-muted-foreground">
              Done {format(parseISO(task.completedAt), 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
