'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Target, FileText, Plus, Check, Clock, AlertCircle, Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Task { id: string; title: string; status: string; priority: string; dueDate?: string; description?: string }
interface Goal { id: string; title: string; progress: number; status: string; deadline?: string; color?: string }
interface Note { id: string; title: string; content: string; type: string; createdAt: string }

const PRIORITY_PILL: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-500/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  medium: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void
        expand: () => void
        close: () => void
        themeParams?: { bg_color?: string; text_color?: string }
        HapticFeedback?: { impactOccurred: (style: 'light' | 'medium' | 'heavy') => void }
        MainButton?: { setText: (t: string) => void; show: () => void; hide: () => void }
      }
    }
  }
}

export default function TelegramApp() {
  const [tab, setTab] = useState<'today' | 'tasks' | 'goals' | 'notes'>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) { tg.ready(); tg.expand() }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      setTasks(data.tasks || [])
      setGoals(data.goals || [])
      setNotes(data.notes || [])
    } catch { /* use empty */ }
    finally { setLoading(false) }
  }

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t
    ))
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
  }

  const addTask = async () => {
    if (!newTaskTitle.trim() || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle, priority: 'medium', dueDate: today }),
      })
      const data = await res.json()
      if (data.task) setTasks(prev => [data.task, ...prev])
      setNewTaskTitle('')
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
    } finally { setAdding(false) }
  }

  const todayTasks = tasks.filter(t => t.dueDate === today || !t.dueDate)
  const doneTodayCount = tasks.filter(t => t.status === 'done').length
  const totalCount = tasks.length
  const completionPct = totalCount ? Math.round((doneTodayCount / totalCount) * 100) : 0

  const TABS = [
    { id: 'today' as const, label: 'Today', icon: Clock },
    { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare },
    { id: 'goals' as const, label: 'Goals', icon: Target },
    { id: 'notes' as const, label: 'Notes', icon: FileText },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <p className="text-[14px] font-semibold text-foreground">Zerf</p>
          <p className="text-[12px] text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background select-none">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground leading-none">Zerf</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {doneTodayCount}/{totalCount} · {completionPct}% done
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {/* TODAY */}
            {tab === 'today' && (
              <>
                {/* Progress card */}
                <div className="p-4 rounded-2xl bg-card border border-border">
                  <div className="flex justify-between items-center mb-2.5">
                    <p className="text-[13px] font-semibold text-foreground">Daily progress</p>
                    <p className="text-[12px] text-muted-foreground">{doneTodayCount} of {totalCount}</p>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${completionPct}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  {completionPct === 100 && (
                    <p className="text-[11px] text-primary mt-2 font-medium">🎉 All done for today!</p>
                  )}
                </div>

                {/* Quick add */}
                <div className="flex gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="Quick add task…"
                    className="flex-1 h-11 px-3.5 rounded-xl bg-card border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                  />
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={addTask}
                    disabled={!newTaskTitle.trim() || adding}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Task list */}
                <div className="space-y-1.5">
                  {todayTasks.length === 0 ? (
                    <div className="text-center py-10">
                      <Check className="w-10 h-10 text-primary/30 mx-auto mb-2" />
                      <p className="text-[13px] text-muted-foreground">No tasks yet</p>
                    </div>
                  ) : todayTasks.map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
                      onClick={() => toggleTask(task.id)}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                        task.status === 'done' ? 'bg-primary border-primary' : 'border-border'
                      )}>
                        {task.status === 'done' && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-[13px] font-medium leading-snug',
                          task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'
                        )}>
                          {task.title}
                        </p>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full border inline-block mt-1',
                          PRIORITY_PILL[task.priority] || PRIORITY_PILL.medium
                        )}>
                          {task.priority}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* TASKS */}
            {tab === 'tasks' && (
              <div className="space-y-1.5">
                {tasks.length === 0 ? (
                  <div className="text-center py-14">
                    <CheckSquare className="w-10 h-10 text-primary/30 mx-auto mb-2" />
                    <p className="text-[13px] text-muted-foreground">No tasks yet</p>
                  </div>
                ) : tasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border"
                    onClick={() => toggleTask(task.id)}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                      task.status === 'done' ? 'bg-primary border-primary' : 'border-border'
                    )}>
                      {task.status === 'done' && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-[13px] font-medium',
                        task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'
                      )}>{task.title}</p>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full border shrink-0',
                      PRIORITY_PILL[task.priority] || PRIORITY_PILL.medium
                    )}>{task.priority}</span>
                  </div>
                ))}
              </div>
            )}

            {/* GOALS */}
            {tab === 'goals' && (
              <div className="space-y-3">
                {goals.length === 0 ? (
                  <div className="text-center py-14">
                    <Target className="w-10 h-10 text-primary/30 mx-auto mb-2" />
                    <p className="text-[13px] text-muted-foreground">No goals yet</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Send a voice message to the bot to create one</p>
                  </div>
                ) : goals.map(goal => (
                  <div key={goal.id} className="p-4 rounded-2xl bg-card border border-border space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: goal.color || '#2d7a4f' }} />
                        <p className="text-[13px] font-semibold text-foreground">{goal.title}</p>
                      </div>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium',
                        goal.status === 'on_track' ? 'bg-emerald-500/15 text-emerald-400' :
                        goal.status === 'at_risk' ? 'bg-orange-500/15 text-orange-400' :
                        'bg-red-500/15 text-red-400'
                      )}>
                        {goal.status === 'on_track' ? '✅ On track' : goal.status === 'at_risk' ? '⚠️ At risk' : '❌ Delayed'}
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[11px] text-muted-foreground">Progress</span>
                        <span className="text-[11px] font-semibold text-foreground">{goal.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: goal.color || '#2d7a4f' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${goal.progress}%` }}
                          transition={{ duration: 0.7 }}
                        />
                      </div>
                    </div>
                    {goal.deadline && (
                      <p className="text-[11px] text-muted-foreground">📅 {goal.deadline}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* NOTES */}
            {tab === 'notes' && (
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <div className="text-center py-14">
                    <FileText className="w-10 h-10 text-primary/30 mx-auto mb-2" />
                    <p className="text-[13px] text-muted-foreground">No notes yet</p>
                  </div>
                ) : notes.map(note => (
                  <div key={note.id} className="p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[12px]">
                        {note.type === 'journal' ? '📓' : note.type === 'meeting' ? '🤝' : '📌'}
                      </span>
                      <p className="text-[13px] font-semibold text-foreground flex-1 truncate">{note.title}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                      {note.content.replace(/[#*>`\[\]]/g, '').trim().slice(0, 140)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-2">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border px-2 pt-2 pb-3">
        <div className="flex items-center justify-around max-w-sm mx-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                tab === id
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
