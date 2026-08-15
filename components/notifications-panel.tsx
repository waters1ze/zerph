'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCircle2, AlertCircle, Clock, CalendarDays, Users, Check, UserPlus } from 'lucide-react'
import { useApp, getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

interface PendingTeamRequest {
  id: string
  fromChatId: string
  fromName: string
  fromUsername: string | null
  status: string
}

export function NotificationsPanel() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const [pendingTeamRequests, setPendingTeamRequests] = useState<PendingTeamRequest[]>([])
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const today = dayKey(new Date())

  const overdue = state.tasks.filter(t => t.status === 'overdue' || (t.dueDate && t.dueDate < today && t.status !== 'done'))
  const todayTasks = state.tasks.filter(t => t.dueDate === today && t.status !== 'done')
  const upcoming = state.tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false
    const diff = (new Date(t.dueDate).getTime() - Date.now()) / 86400000
    return diff > 0 && diff <= 2
  })

  const allTaskNotifs = [
    ...overdue.map(t => ({ id: t.id, type: 'overdue' as const, title: t.title, sub: `Просрочено: ${t.dueDate}` })),
    ...todayTasks.map(t => ({ id: t.id, type: 'today' as const, title: t.title, sub: t.dueTime ? `Сегодня в ${t.dueTime}` : 'На сегодня' })),
    ...upcoming.map(t => ({ id: t.id, type: 'soon' as const, title: t.title, sub: `Завтра: ${t.dueDate}` })),
  ]

  const totalCount = allTaskNotifs.length + pendingTeamRequests.length

  const typeConfig = {
    overdue: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Просрочено' },
    today:   { icon: CalendarDays, color: 'text-primary', bg: 'bg-primary/10', label: 'Сегодня' },
    soon:    { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Скоро' },
  }

  // Fetch pending team invites
  const fetchPendingTeamRequests = async () => {
    try {
      const headers = getAuthHeaders()
      if (Object.keys(headers).length > 0) {
        const res = await fetch('/api/friends', { headers })
        const data = await res.json()
        if (Array.isArray(data.pendingRequests)) {
          setPendingTeamRequests(data.pendingRequests)
        }
      }
    } catch {}
  }

  useEffect(() => {
    fetchPendingTeamRequests()
    const interval = setInterval(fetchPendingTeamRequests, 20000)
    return () => clearInterval(interval)
  }, [])

  const handleRespondTeamRequest = async (fromChatId: string, action: 'accept' | 'decline', e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setRespondingId(fromChatId)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/friends', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fromChatId, action }),
      })
      const data = await res.json()
      if (data.success) {
        setPendingTeamRequests(prev => prev.filter(r => r.fromChatId !== fromChatId))
      }
    } catch {
    } finally {
      setRespondingId(null)
    }
  }

  const requestDesktopNotif = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted' && overdue.length > 0) {
        new Notification('Zerf — Просроченные задачи', {
          body: `У вас ${overdue.length} просроченных задач`,
          icon: '/zerph-logo.png',
        })
      }
    }
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => { setOpen(o => !o); if (!open) requestDesktopNotif() }}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
        aria-label="Уведомления"
      >
        <Bell className={cn('w-4 h-4', open ? 'text-primary' : 'text-muted-foreground')} />
        {totalCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm',
              pendingTeamRequests.length > 0 ? 'bg-amber-500 text-black animate-pulse' : 'bg-red-500 text-white'
            )}
          >
            {totalCount > 9 ? '9+' : totalCount}
          </motion.span>
        )}
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-10 z-40 w-84 max-w-[90vw] bg-card border border-border rounded-2xl shadow-2xl shadow-black/30 overflow-hidden font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="text-[13px] font-semibold text-foreground">Уведомления</span>
                  {totalCount > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {totalCount}
                    </span>
                  )}
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notifications list */}
              <div className="max-h-88 overflow-y-auto p-2 space-y-1.5">
                {/* 1. Pending Team Invites */}
                {pendingTeamRequests.map((req, i) => (
                  <motion.div
                    key={req.id || req.fromChatId}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[12px] font-bold text-foreground truncate">Запрос в команду</p>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/20 px-1.5 py-0.2 rounded">
                            Новый
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          <strong className="text-foreground">{req.fromName}</strong> {req.fromUsername ? `(${req.fromUsername})` : ''} приглашает вас в команду
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={(e) => handleRespondTeamRequest(req.fromChatId, 'accept', e)}
                        disabled={respondingId === req.fromChatId}
                        className="flex-1 flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg bg-amber-500 text-black text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                        <span>Принять</span>
                      </button>
                      <button
                        onClick={(e) => handleRespondTeamRequest(req.fromChatId, 'decline', e)}
                        disabled={respondingId === req.fromChatId}
                        className="py-1 px-2.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-[11px] font-medium hover:bg-muted/80 active:scale-95 transition-all disabled:opacity-50"
                      >
                        Отклонить
                      </button>
                    </div>
                  </motion.div>
                ))}

                {/* 2. Tasks & Deadlines */}
                {allTaskNotifs.map((notif, i) => {
                  const cfg = typeConfig[notif.type]
                  const Icon = cfg.icon
                  return (
                    <motion.button
                      key={notif.id + notif.type}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (pendingTeamRequests.length + i) * 0.04 }}
                      onClick={() => {
                        dispatch({ type: 'SET_VIEW', view: 'tasks' })
                        setOpen(false)
                      }}
                      className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                        <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{notif.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{notif.sub}</p>
                      </div>
                      <span className={cn('text-[10px] font-medium shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </motion.button>
                  )
                })}

                {totalCount === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <CheckCircle2 className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">Всё под контролем!</p>
                    <p className="text-[11px] text-muted-foreground/60">Нет активных уведомлений</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {totalCount > 0 && (
                <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => { dispatch({ type: 'SET_VIEW', view: 'tasks' }); setOpen(false) }}
                    className="text-[12px] text-primary hover:underline font-medium"
                  >
                    Все задачи →
                  </button>
                  {pendingTeamRequests.length > 0 && (
                    <button
                      onClick={() => { dispatch({ type: 'SET_VIEW', view: 'friends' }); setOpen(false) }}
                      className="text-[12px] text-amber-500 hover:underline font-medium"
                    >
                      Открыть Команду →
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
