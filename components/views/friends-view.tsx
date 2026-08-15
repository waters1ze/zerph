'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Users, UserPlus, Trash2, CheckSquare, Circle,
  X, Mail, Send, Copy, Check, Share2, UserCheck, AlertCircle, Sparkles, RefreshCw,
  Clock, Calendar, CalendarDays, Lock, ShieldCheck, Plus
} from 'lucide-react'
import type { Friend } from '@/lib/types'

const STATUS_CONFIG = {
  online:  { label: 'В сети',  dot: 'bg-[var(--status-done)]' },
  away:    { label: 'Отошёл',  dot: 'bg-[var(--priority-medium)]' },
  offline: { label: 'Не в сети', dot: 'bg-muted-foreground/40' },
}

interface PendingRequest {
  id: string
  fromChatId: string
  fromName: string
  fromUsername: string | null
  status: string
}

function FriendCard({
  friend,
  onRemove,
  onSchedule,
}: {
  friend: Friend
  onRemove: () => void
  onSchedule: (friend: Friend) => void
}) {
  const { state } = useApp()
  const sharedTasks = state.tasks.filter((t: any) => 
    t.assignees.includes(friend.id) &&
    !t.tags?.includes('день рождения') &&
    !t.title.startsWith('🎂')
  )
  const doneTasks = sharedTasks.filter((t: any) => t.status === 'done')
  const sc = STATUS_CONFIG[friend.status] || STATUS_CONFIG.offline
  const isBot = (friend.username || '').toLowerCase().includes('bot') || (friend.name || '').toLowerCase().includes('zerph')
  const [allowTasks, setAllowTasks] = useState(friend.allowTasks ?? (isBot ? true : false))
  const [birthday, setBirthday] = useState(friend.birthday || '')
  const [updating, setUpdating] = useState(false)

  const toggleAllowTasks = async () => {
    const next = !allowTasks
    setAllowTasks(next)
    setUpdating(true)
    try {
      await fetch('/api/friends', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: friend.id, allowTasks: next }),
      })
    } catch {}
    finally { setUpdating(false) }
  }

  const handleBirthdayChange = async (val: string) => {
    setBirthday(val)
    try {
      await fetch('/api/friends', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: friend.id, birthday: val }),
      })
    } catch {}
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-card border border-border group font-sans"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <span className="text-sm font-bold text-primary">
              {friend.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', sc.dot)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-bold text-foreground">{friend.name}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" />
                {friend.email}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSchedule(friend)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold transition-all active:scale-95 shadow-sm"
                title="Посмотреть график и свободные окна"
              >
                <Clock className="w-3 h-3" />
                <span>График</span>
              </button>
              <button
                onClick={onRemove}
                title="Удалить из команды"
                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Task permission toggle */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40">
            <span className="text-[11px] text-muted-foreground">Разрешить задачи от этого человека</span>
            <button
              onClick={toggleAllowTasks}
              disabled={updating}
              className={cn(
                'w-8 h-4.5 rounded-full relative transition-colors p-0.5',
                allowTasks ? 'bg-emerald-500' : 'bg-muted-foreground/30'
              )}
            >
              <div className={cn(
                'w-3.5 h-3.5 rounded-full bg-white transition-transform',
                allowTasks ? 'translate-x-3.5' : 'translate-x-0'
              )} />
            </button>
          </div>

          {/* Birthday Date Input */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              🎂 День рождения
            </span>
            <input
              type="date"
              value={birthday}
              onChange={e => handleBirthdayChange(e.target.value)}
              className="px-2 py-1 rounded-lg bg-muted/50 border border-border text-[11px] text-foreground outline-none focus:border-primary cursor-pointer"
            />
          </div>

          {/* Shared tasks counter */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[11px] text-muted-foreground">
              {sharedTasks.length === 0
                ? 'Нет общих задач'
                : `Общих задач: ${sharedTasks.length}`
              }
            </span>
            {sharedTasks.length > 0 && (
              <>
                <span className="text-muted-foreground text-[10px]">·</span>
                <span className="text-[11px] text-muted-foreground">
                  Выполнено {doneTasks.length} из {sharedTasks.length}
                </span>
              </>
            )}
          </div>

          {/* Shared tasks list */}
          {sharedTasks.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {sharedTasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex items-center gap-2">
                  {task.status === 'done'
                    ? <CheckSquare className="w-3.5 h-3.5 text-[var(--status-done)] shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-border shrink-0" />
                  }
                  <span className={cn('text-[12px]', task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground')}>
                    {task.title}
                  </span>
                </div>
              ))}
              {sharedTasks.length > 3 && (
                <p className="text-[11px] text-muted-foreground pl-5">+ ещё {sharedTasks.length - 3}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function FriendsView() {
  const { state, dispatch } = useApp()
  const [mounted, setMounted] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [scheduleModal, setScheduleModal] = useState<{
    friend: Friend
    schedule: any | null
    loading: boolean
    daysCount: number
  } | null>(null)

  const handleOpenSchedule = async (friend: Friend, daysCount: number = 1) => {
    setScheduleModal(prev => ({
      friend,
      schedule: prev?.friend?.id === friend.id ? prev.schedule : null,
      loading: true,
      daysCount
    }))
    try {
      const targetId = friend.chatId || friend.id
      const res = await fetch(`/api/friends/schedule?friendId=${encodeURIComponent(targetId)}&days=${daysCount}`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      setScheduleModal({ friend, schedule: data, loading: false, daysCount })
    } catch {
      setScheduleModal(prev => prev ? { ...prev, loading: false } : null)
    }
  }

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotice({ type, text })
    setTimeout(() => setNotice(null), 5000)
  }

  const loadFriendsAndRequests = async () => {
    setLoadingRequests(true)
    try {
      const headers = getAuthHeaders()
      const res = await fetch('/api/friends', { headers })
      const data = await res.json()
      if (data.pendingRequests) {
        setPendingRequests(data.pendingRequests)
      }
      if (data.friends && Array.isArray(data.friends)) {
        dispatch({
          type: 'LOAD_STATE',
          state: { friends: data.friends }
        })
      }
    } catch {}
    finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    loadFriendsAndRequests()
  }, [])

  const isGuest = mounted && typeof window !== 'undefined' && !localStorage.getItem('zerf_chat_id')
  const chatId = mounted && typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : ''
  const inviteLink = `https://t.me/Zerph_bot?start=invite_${chatId || 'user'}`

  const copyInviteLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Handle Send Invite by Username
  const handleSendInvite = async () => {
    const rawUname = inviteUsername.trim()
    if (!rawUname) return

    setSendingInvite(true)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: rawUname,
          name: inviteName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showNotification('success', data.message)
        setInviteUsername('')
        setInviteName('')
        setShowInvite(false)
        loadFriendsAndRequests()
      } else if (data.notFound) {
        showNotification('info', data.message)
      } else {
        showNotification('error', data.error || 'Не удалось отправить приглашение')
      }
    } catch {
      showNotification('error', 'Ошибка связи с сервером')
    } finally {
      setSendingInvite(false)
    }
  }

  // Handle Respond to Request (Accept / Decline)
  const handleRespondRequest = async (fromChatId: string, action: 'accept' | 'decline') => {
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const res = await fetch('/api/friends', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fromChatId, action }),
      })
      const data = await res.json()
      if (data.success) {
        showNotification('success', data.message)
        loadFriendsAndRequests()
      }
    } catch {
      showNotification('error', 'Ошибка ответа на запрос')
    }
  }

  if (!mounted) {
    return (
      <div className="flex flex-col gap-5 max-w-2xl opacity-0">
        <h2 className="text-base font-bold text-foreground">Команда и совместная работа</h2>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm',
              notice.type === 'success' && 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
              notice.type === 'error' && 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400',
              notice.type === 'info' && 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
            )}
          >
            {notice.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{notice.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telegram Auth Notice Banner for Guest sessions */}
      {isGuest && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2 text-amber-200">
          <p className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
            ⚠️ Гостевой режим веб-версии
          </p>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Чтобы автоматически синхронизировать команду с Telegram-ботом, откройте веб-сайт или Mini App через кнопку в боте <span className="font-semibold text-amber-400">@Zerph_bot</span> (или напишите /start в боте)!
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Команда и совместная работа</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Приглашайте друзей и коллег по @username для совместной работы
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Пригласить по @username</span>
        </button>
      </div>

      {/* Quick Invite Link Banner */}
      <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <Share2 className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-foreground truncate">Инвайт-ссылка вашей команды</p>
            <p className="text-[11px] text-muted-foreground truncate">{inviteLink}</p>
          </div>
        </div>
        <button
          onClick={copyInviteLink}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium shrink-0 hover:opacity-90 transition-opacity"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
        </button>
      </div>

      {/* PENDING FRIEND REQUESTS SECTION */}
      {pendingRequests.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-bold text-foreground">
                Входящие приглашения в команду ({pendingRequests.length})
              </p>
            </div>
            <button
              onClick={loadFriendsAndRequests}
              className="text-muted-foreground hover:text-foreground"
              title="Обновить"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingRequests && 'animate-spin')} />
            </button>
          </div>

          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div
                key={req.id}
                className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {req.fromName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{req.fromName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {req.fromUsername || `ID: ${req.fromChatId}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRespondRequest(req.fromChatId, 'accept')}
                    className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-all"
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => handleRespondRequest(req.fromChatId, 'decline')}
                    className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal / Card */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-foreground font-bold text-[13px]">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Пригласить участника по Telegram @username</span>
                </div>
                <button
                  onClick={() => setShowInvite(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Достаточно просто указать Telegram @username человека. Если он пользуется ботом Zerf AI, ему мгновенно придет уведомление в Telegram с кнопкой подтверждения!
              </p>

              <div className="flex flex-col gap-2.5">
                <input
                  value={inviteUsername}
                  onChange={e => setInviteUsername(e.target.value)}
                  placeholder="@username друга в Telegram (например, @artem)"
                  className="h-9 px-3 rounded-xl bg-muted/50 border border-border/80 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"
                  autoFocus
                />
                <input
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Имя друга (необязательно, подтянется из Telegram)"
                  className="h-9 px-3 rounded-xl bg-muted/50 border border-border/80 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowInvite(false)}
                  className="h-8 px-3 rounded-xl border border-border text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={!inviteUsername.trim() || sendingInvite}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-40 hover:brightness-110 transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingInvite ? 'Отправка...' : 'Отправить приглашение'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Online summary */}
      <div className="grid grid-cols-3 gap-3">
        {(['online', 'away', 'offline'] as const).map(status => {
          const count = state.friends.filter(f => f.status === status).length
          const sc = STATUS_CONFIG[status]
          return (
            <div key={status} className="p-3.5 rounded-2xl bg-card border border-border flex items-center gap-2.5 shadow-sm">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', sc.dot)} />
              <div>
                <p className="text-base font-bold text-foreground leading-none">{count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sc.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Friends list */}
      {state.friends.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center bg-card/40 rounded-2xl border border-border/50">
          <Users className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">В вашей команде пока нет участников</p>
          <p className="text-xs text-muted-foreground">Укажите @username друга выше, чтобы отправить ему запрос в друзья</p>
          <button
            onClick={() => setShowInvite(true)}
            className="mt-2 flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-primary/10 text-primary text-[12px] font-semibold hover:bg-primary/20 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Пригласить первого участника</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {state.friends.map(f => (
            <FriendCard
              key={f.id}
              friend={f}
              onSchedule={handleOpenSchedule}
              onRemove={async () => {
                dispatch({ type: 'REMOVE_FRIEND', id: f.id })
                const targetId = f.chatId || f.id
                await fetch(`/api/friends?id=${encodeURIComponent(targetId)}`, {
                  method: 'DELETE',
                  headers: getAuthHeaders()
                }).catch(() => {})
                loadFriendsAndRequests()
              }}
            />
          ))}
        </div>
      )}

      {/* Schedule & Availability Modal */}
      <AnimatePresence>
        {scheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
                    <span className="text-sm font-bold text-primary">
                      {scheduleModal.friend.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <span>{scheduleModal.friend.name}</span>
                      {scheduleModal.schedule?.friend?.username && (
                        <span className="text-[11px] text-muted-foreground font-normal">
                          {scheduleModal.schedule.friend.username}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarDays className="w-3 h-3 text-primary" />
                      <span>Расписание и занятость на сегодня</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setScheduleModal(null)}
                  className="w-8 h-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {/* Period Selector Tabs */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs">
                  {[
                    { count: 1, label: 'Сегодня' },
                    { count: 3, label: '3 дня' },
                    { count: 7, label: 'Неделя' },
                  ].map(tab => (
                    <button
                      key={tab.count}
                      onClick={() => handleOpenSchedule(scheduleModal.friend, tab.count)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg font-semibold transition-all text-center text-[11px]',
                        (scheduleModal.daysCount || 1) === tab.count
                          ? 'bg-card text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {scheduleModal.loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs">Загрузка расписания...</p>
                  </div>
                ) : !scheduleModal.schedule ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Не удалось получить график пользователя.
                  </div>
                ) : scheduleModal.schedule.allowed === false ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Доступ к расписанию закрыт</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      <strong>{scheduleModal.friend.name}</strong> отключил(а) доступ к своему расписанию и приём задач от вас.
                    </p>
                    <div className="p-3 rounded-xl bg-card border border-border/80 text-[11px] text-foreground space-y-1 mt-1">
                      <p className="font-semibold text-primary flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Как открыть доступ:
                      </p>
                      <p className="text-muted-foreground">
                        Попросите <strong>{scheduleModal.friend.name}</strong> зайти во вкладку <strong>«Команда»</strong> и включить тумблер <em>«Разрешить задачи от этого человека»</em> на вашей карточке.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Days Rendering */}
                    {(scheduleModal.schedule.days || [
                      {
                        date: scheduleModal.schedule.date,
                        dateLabel: 'Сегодня',
                        slots: scheduleModal.schedule.slots || [],
                        freeWindows: scheduleModal.schedule.freeWindows || []
                      }
                    ]).map((day: any, dIdx: number) => (
                      <div key={day.date || dIdx} className="space-y-2.5 p-3 rounded-2xl bg-muted/20 border border-border/60">
                        {/* Day Title & Free Windows */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            <span>{day.dateLabel}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">({day.date})</span>
                          </span>
                        </div>

                        {/* Free windows */}
                        {day.freeWindows?.length > 0 && (
                          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>Свободно: {day.freeWindows.join(', ')}</span>
                          </div>
                        )}

                        {/* Slots */}
                        {(!day.slots || day.slots.length === 0) ? (
                          <p className="text-[11px] text-muted-foreground py-1">
                            ✨ На этот день задач нет, весь день свободен!
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {day.slots.map((s: any, idx: number) => (
                              <div
                                key={s.id || idx}
                                className={cn(
                                  'p-2 rounded-xl border flex items-center justify-between gap-2 text-xs',
                                  s.isPrivate
                                    ? 'bg-muted/40 border-border/50 text-muted-foreground'
                                    : 'bg-primary/5 border-primary/20 text-foreground font-medium'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {s.isPrivate ? (
                                    <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                                  ) : (
                                    <Users className="w-3 h-3 text-primary shrink-0" />
                                  )}
                                  <span className="truncate text-[11px]">
                                    {s.isPrivate ? '🔒 Задача' : s.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-[10px] font-semibold text-muted-foreground">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{s.dueTime || 'В течение дня'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Privacy Note */}
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-2 text-[10px] text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>Приватные задачи скрыты под замком (🔒 Задача). Открытые задачи и общие проекты видны с названиями, чтобы согласовать время.</span>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-border bg-muted/20 flex justify-end gap-2">
                <button
                  onClick={() => setScheduleModal(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
