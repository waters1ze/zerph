'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Target, FileText, Plus, Check, Clock, AlertCircle, Sparkles, RefreshCw, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Task { id: string; title: string; status: string; priority: string; dueDate?: string; description?: string }
interface Goal { id: string; title: string; progress: number; status: string; deadline?: string; color?: string }
interface Note { id: string; title: string; content: string; type: string; createdAt: string }

type Lang = 'ru' | 'en'

const T = {
  ru: {
    loading: 'Загрузка рабочего пространства…',
    today: 'Сегодня', tasks: 'Задачи', goals: 'Цели', notes: 'Заметки',
    dailyProgress: 'Прогресс за день', allDone: '🎉 Все задачи выполнены!',
    quickAdd: 'Быстро добавить задачу…', noTasks: 'Задач нет', noGoals: 'Целей нет',
    noNotes: 'Заметок нет', of: 'из', progress: 'Прогресс',
    onTrack: '✅ В норме', atRisk: '⚠️ Риск', delayed: '❌ Отложено',
    addVoice: 'Отправь голосовое сообщение боту',
    priority: { urgent: 'Срочно', high: 'Высокий', medium: 'Средний', low: 'Низкий' },
    done: 'выполнено',
  },
  en: {
    loading: 'Loading your workspace…',
    today: 'Today', tasks: 'Tasks', goals: 'Goals', notes: 'Notes',
    dailyProgress: 'Daily progress', allDone: '🎉 All done for today!',
    quickAdd: 'Quick add task…', noTasks: 'No tasks yet', noGoals: 'No goals yet',
    noNotes: 'No notes yet', of: 'of', progress: 'Progress',
    onTrack: '✅ On track', atRisk: '⚠️ At risk', delayed: '❌ Delayed',
    addVoice: 'Send a voice message to the bot',
    priority: { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' },
    done: 'done',
  },
}

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
  const [tab, setTab] = useState<'today' | 'tasks' | 'goals' | 'notes' | 'premium'>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [lang, setLang] = useState<Lang>('ru')
  const [usage, setUsage] = useState<any>(null)
  const [loadingPay, setLoadingPay] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const t = T[lang]

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) { tg.ready(); tg.expand() }
    // Restore saved language preference
    const saved = localStorage.getItem('zerf_lang') as Lang | null
    if (saved === 'en' || saved === 'ru') setLang(saved)
    loadData()
  }, [])

  const toggleLang = () => {
    const next: Lang = lang === 'ru' ? 'en' : 'ru'
    setLang(next)
    localStorage.setItem('zerf_lang', next)
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
  }

  const getTgChatId = () => {
    if (typeof window !== 'undefined') {
      const u = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } })?.Telegram?.WebApp?.initDataUnsafe?.user
      if (u?.id) return String(u.id)
    }
    return null
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const chatId = getTgChatId()
      const headers: Record<string, string> = {}
      if (chatId) headers['x-chat-id'] = chatId

      const [taskRes, usageRes] = await Promise.all([
        fetch('/api/tasks', { headers }),
        fetch('/api/subscription', { headers }),
      ])
      const data = await taskRes.json()
      setTasks(data.tasks || [])
      setGoals(data.goals || [])
      setNotes(data.notes || [])
      const usageData = await usageRes.json()
      setUsage(usageData)
    } catch { /* use empty */ }
    finally { setLoading(false) }
  }

  const handleSubscribe = async () => {
    const chatId = getTgChatId()
    if (!chatId) {
      alert('Сначала откройте мини-приложение из Telegram бота')
      return
    }
    setLoadingPay(true)
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-chat-id': chatId },
        body: JSON.stringify({ ownerChatId: chatId }),
      })
      const data = await res.json()
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank')
      }
    } catch {
      alert('Ошибка при создании ссылки на оплату')
    } finally {
      setLoadingPay(false)
    }
  }

  const toggleTask = async (taskId: string) => {
    let nextStatus = 'done'
    setTasks(prev => prev.map(tk => {
      if (tk.id === taskId) {
        nextStatus = tk.status === 'done' ? 'todo' : 'done'
        return { ...tk, status: nextStatus }
      }
      return tk
    }))
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')

    try {
      const chatId = getTgChatId()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (chatId) headers['x-chat-id'] = chatId

      await fetch('/api/tasks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: taskId, status: nextStatus }),
      })
    } catch {}
  }

  const addTask = async () => {
    if (!newTaskTitle.trim() || adding) return
    setAdding(true)
    try {
      const chatId = getTgChatId()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (chatId) headers['x-chat-id'] = chatId

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: newTaskTitle, priority: 'medium', dueDate: today, ownerChatId: chatId }),
      })
      const data = await res.json()
      if (data.task) setTasks(prev => [data.task, ...prev])
      setNewTaskTitle('')
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
    } finally { setAdding(false) }
  }

  const todayTasks = tasks.filter(tk => tk.dueDate === today || !tk.dueDate)
  const doneTodayCount = tasks.filter(tk => tk.status === 'done').length
  const totalCount = tasks.length
  const completionPct = totalCount ? Math.round((doneTodayCount / totalCount) * 100) : 0

  const TABS = [
    { id: 'today' as const, label: t.today, icon: Clock },
    { id: 'tasks' as const, label: t.tasks, icon: CheckSquare },
    { id: 'goals' as const, label: t.goals, icon: Target },
    { id: 'notes' as const, label: t.notes, icon: FileText },
    { id: 'premium' as const, label: '⭐', icon: Sparkles },
  ]

  const priorityLabel = (p: string) => t.priority[p as keyof typeof t.priority] || p

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <p className="text-[14px] font-semibold text-foreground">Zerf</p>
          <p className="text-[12px] text-muted-foreground">{t.loading}</p>
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
                {doneTodayCount}/{totalCount} · {completionPct}% {t.done}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              title="Переключить язык / Switch language"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'ru' ? 'EN' : 'RU'}
            </button>
            <button
              onClick={loadData}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
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
                    <p className="text-[13px] font-semibold text-foreground">{t.dailyProgress}</p>
                    <p className="text-[12px] text-muted-foreground">{doneTodayCount} {t.of} {totalCount}</p>
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
                    <p className="text-[11px] text-primary mt-2 font-medium">{t.allDone}</p>
                  )}
                </div>

                {/* Quick add */}
                <div className="flex gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder={t.quickAdd}
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
                      <p className="text-[13px] text-muted-foreground">{t.noTasks}</p>
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
                          {priorityLabel(task.priority)}
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
                    <p className="text-[13px] text-muted-foreground">{t.noTasks}</p>
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
                    )}>{priorityLabel(task.priority)}</span>
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
                    <p className="text-[13px] text-muted-foreground">{t.noGoals}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{t.addVoice}</p>
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
                        {goal.status === 'on_track' ? t.onTrack : goal.status === 'at_risk' ? t.atRisk : t.delayed}
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[11px] text-muted-foreground">{t.progress}</span>
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
                    <p className="text-[13px] text-muted-foreground">{t.noNotes}</p>
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
                      {new Date(note.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {/* PREMIUM */}
            {tab === 'premium' && (
              <div className="space-y-4">
                {/* Status Card */}
                <div className={cn(
                  'rounded-2xl p-5 border',
                  usage?.plan === 'premium'
                    ? 'bg-gradient-to-br from-amber-500/20 to-emerald-500/10 border-amber-500/30'
                    : 'bg-card border-border'
                )}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">⭐</div>
                    <div>
                      <p className="text-[15px] font-bold text-foreground">
                        {usage?.plan === 'premium' ? 'Zerf Premium' : 'Бесплатный тариф'}
                      </p>
                      {usage?.plan === 'premium' && usage?.subscriptionExpiry && (
                        <p className="text-[11px] text-amber-400">
                          Активна до: {new Date(usage.subscriptionExpiry).toLocaleDateString('ru-RU')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Usage bars */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">🎙 Голосовые</span>
                        <span className="font-medium">
                          {usage?.plan === 'premium'
                            ? `${Math.round((usage?.voice?.secondsUsed || 0) / 60)} / 10 мин`
                            : `${usage?.voice?.used || 0} / 2 в день`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all" style={{
                          width: usage?.plan === 'premium'
                            ? `${Math.min(100, ((usage?.voice?.secondsUsed || 0) / 600) * 100)}%`
                            : `${Math.min(100, ((usage?.voice?.used || 0) / 2) * 100)}%`
                        }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">📌 Заметки</span>
                        <span className="font-medium">{usage?.plan === 'premium' ? 'Безлимитно ✨' : `${usage?.notes?.used || 0} / 2 в день`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: usage?.plan === 'premium' ? '0%' : `${Math.min(100, ((usage?.notes?.used || 0) / 2) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">💬 ИИ чат</span>
                        <span className="font-medium">{usage?.plan === 'premium' ? 'Безлимитно ✨' : `${usage?.chat?.used || 0} / 10 в день`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: usage?.plan === 'premium' ? '0%' : `${Math.min(100, ((usage?.chat?.used || 0) / 10) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buy / Features */}
                {usage?.plan !== 'premium' && (
                  <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                    <p className="text-[14px] font-bold text-foreground">✨ Zerf Premium — 99 ₽/мес</p>
                    <div className="space-y-2">
                      {[
                        '🎙 Голос: неограниченно (до 10 мин/день)',
                        '📌 Заметки: безлимитно',
                        '💬 Zerf AI: безлимитно',
                        '⚡ Сброс лимитов: каждые 24 часа',
                        '🔔 Умные напоминания',
                      ].map(f => (
                        <div key={f} className="flex items-center gap-2 text-[12px] text-foreground">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSubscribe}
                      disabled={loadingPay}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-[14px] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50"
                    >
                      {loadingPay ? '⏳ Переход на оплату…' : '💳 Оплатить через ЮMoney (99 ₽)'}
                    </button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Оплата через ЮMoney. После оплаты подписка активируется автоматически во всём приложении.
                    </p>
                  </div>
                )}

                {usage?.plan === 'premium' && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                    <p className="text-[13px] font-medium text-emerald-400">✅ Все функции разблокированы!</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Подписка активна во всех устройствах и в боте</p>
                  </div>
                )}
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
