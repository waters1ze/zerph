'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Users, UserPlus, Trash2, CheckSquare, Circle,
  X, Mail, Send, Copy, Check, Share2, UserCheck, AlertCircle, Sparkles, RefreshCw,
  Clock, Calendar, CalendarDays, Lock, ShieldCheck, Plus, Flame, CheckCircle2, Cake, Shield
} from 'lucide-react'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { FriendGroupsSection } from '@/components/friends/friend-groups-section'
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
  onProfile,
}: {
  friend: Friend
  onRemove: () => void
  onSchedule: (friend: Friend) => void
  onProfile: (friend: Friend) => void
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
  const normalizedBirthday = useMemo(() => {
    const raw = friend.birthday || ''
    if (!raw) return ''
    const clean = raw.trim()
    // YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
    }
    // DD.MM.YYYY
    const ruMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
    if (ruMatch) {
      return `${ruMatch[3]}-${ruMatch[2].padStart(2, '0')}-${ruMatch[1].padStart(2, '0')}`
    }
    return clean
  }, [friend.birthday])

  const [birthday, setBirthday] = useState(normalizedBirthday)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setBirthday(normalizedBirthday)
  }, [normalizedBirthday])

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
        <div 
          onClick={() => onProfile(friend)}
          className="relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          title="Открыть профиль"
        >
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
            <div 
              onClick={() => onProfile(friend)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              title="Открыть профиль"
            >
              <p className="text-[13px] font-bold text-foreground">{friend.name}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" />
                {friend.email}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onProfile(friend)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-[11px] font-semibold transition-all active:scale-95 shadow-sm"
                title="Посмотреть профиль пользователя"
              >
                <Users className="w-3 h-3 text-primary" />
                <span>Профиль</span>
              </button>
              <button
                onClick={() => onSchedule(friend)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all active:scale-95 shadow-sm",
                  friend.friendAllowedMe
                    ? "bg-primary/10 hover:bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                title={friend.friendAllowedMe ? "Посмотреть график и свободные окна" : "График закрыт пользователем (нажмите для подробностей)"}
              >
                {friend.friendAllowedMe ? <Clock className="w-3 h-3 text-primary" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
                <span>График</span>
              </button>
              <button
                onClick={onRemove}
                title="Удалить из друзей"
                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Task permission toggle */}
          <div className="flex flex-col gap-1 pt-2.5 mt-2.5 border-t border-border/40">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground font-medium">Разрешить задачи от этого человека</span>
              <button
                type="button"
                onClick={toggleAllowTasks}
                disabled={updating}
                aria-label="Переключить разрешение задач"
                className={cn(
                  'w-11 h-6 rounded-full relative transition-colors duration-200 p-0.5 inline-flex items-center shrink-0 cursor-pointer',
                  allowTasks ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out',
                  allowTasks ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              {friend.friendAllowedMe ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3" /> Пользователь открыл вам доступ к графику
                </span>
              ) : (
                <span className="text-muted-foreground/75 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Пользователь пока не открыл вам доступ к графику
                </span>
              )}
            </div>
          </div>

          {/* Birthday Date Input */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="mono-emoji">🎂</span> День рождения
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
  const [outgoingRequests, setOutgoingRequests] = useState<Array<{ id: string; toChatId: string; toName: string; toUsername: string | null; status: string }>>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [scheduleModal, setScheduleModal] = useState<{
    friend: Friend
    schedule: any | null
    loading: boolean
    daysCount: number
  } | null>(null)
  const [profileModal, setProfileModal] = useState<{
    friend: Friend
    profile: any | null
    loading: boolean
  } | null>(null)

  const handleOpenProfile = async (friend: Friend) => {
    setProfileModal({ friend, profile: null, loading: true })
    try {
      const targetId = friend.chatId || friend.id
      const res = await fetch(`/api/friends/profile?chatId=${encodeURIComponent(targetId)}`, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      setProfileModal({ friend, profile: data, loading: false })
    } catch {
      setProfileModal(prev => prev ? { ...prev, loading: false } : null)
    }
  }

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
      if (data.outgoingRequests) {
        setOutgoingRequests(data.outgoingRequests)
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

  // Handle Cancel Outgoing Request
  const handleCancelOutgoing = async (toChatId: string) => {
    try {
      const res = await fetch(`/api/friends?id=${encodeURIComponent(toChatId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        showNotification('success', 'Приглашение отменено')
        loadFriendsAndRequests()
      }
    } catch {
      showNotification('error', 'Ошибка отмены приглашения')
    }
  }

  const confirm = useConfirmDialog()

  // Calculate team tasks and upcoming birthdays
  const teamTasks = useMemo(() => {
    return state.tasks.filter(t => 
      t.assignees && t.assignees.length > 0 &&
      !t.tags?.includes('день рождения') &&
      !t.title.startsWith('🎂')
    )
  }, [state.tasks])

  const friendBirthdays = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentDay = now.getDate()

    const list: Array<{
      friend: Friend
      bDay: number
      bMonth: number
      diffDays: number
      bDateFormatted: string
    }> = []

    for (const f of state.friends) {
      const bdayRaw = f.birthday || state.tasks?.find((t: any) => 
        (t.tags?.includes('день рождения') || t.title?.startsWith('🎂')) &&
        (t.assignees?.includes(f.id) || t.assignees?.includes(f.chatId) || (f.name && t.title?.toLowerCase().includes(f.name.toLowerCase())))
      )?.dueDate
      if (!bdayRaw) continue

      let bDay = 0
      let bMonth = 0

      // YYYY-MM-DD
      const isoMatch = bdayRaw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
      if (isoMatch) {
        bMonth = parseInt(isoMatch[2], 10)
        bDay = parseInt(isoMatch[3], 10)
      } else {
        const ruMatch = bdayRaw.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{4}))?$/)
        if (ruMatch) {
          bDay = parseInt(ruMatch[1], 10)
          bMonth = parseInt(ruMatch[2], 10)
          if (bDay <= 12 && bMonth > 12) {
            const tmp = bDay
            bDay = bMonth
            bMonth = tmp
          }
        }
      }

      if (!bMonth || !bDay || bMonth < 1 || bMonth > 12 || bDay < 1 || bDay > 31) continue

      let nextBDate = new Date(now.getFullYear(), bMonth - 1, bDay)
      if (nextBDate < new Date(now.getFullYear(), currentMonth - 1, currentDay)) {
        nextBDate = new Date(now.getFullYear() + 1, bMonth - 1, bDay)
      }
      const diffDays = Math.ceil((nextBDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      list.push({
        friend: f,
        bDay,
        bMonth,
        diffDays,
        bDateFormatted: `${bDay < 10 ? '0' + bDay : bDay}.${bMonth < 10 ? '0' + bMonth : bMonth}`
      })
    }

    return list.sort((a, b) => a.diffDays - b.diffDays)
  }, [state.friends, state.tasks])

  if (!mounted) {
    return (
      <div className="flex flex-col gap-5 w-full opacity-0">
        <h2 className="text-base font-bold text-foreground">Команда и совместная работа</h2>
      </div>
    )
  }

  return (
    <div className="w-full font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'mb-4 p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-sm',
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
        <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2 text-amber-200">
          <p className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
            ⚠️ Гостевой режим веб-версии
          </p>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Чтобы автоматически синхронизировать список друзей с Telegram-ботом, откройте веб-сайт или Mini App через кнопку в боте <span className="font-semibold text-amber-400">@Zerph_bot</span> (или напишите /start в боте)!
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-bold text-foreground">Друзья и контакты</h2>
          <p className="text-xs text-muted-foreground">
            Обменивайтесь заметками и задачами, просматривайте расписание и дни рождения друзей
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Добавить друга</span>
        </button>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Friends List & Invites (8 cols on large screens) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Quick Invite Link Banner */}
          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Share2 className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">Ваша ссылка для добавления в друзья</p>
                <p className="text-[11px] text-muted-foreground truncate">{inviteLink}</p>
              </div>
            </div>
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>

          {/* GROUPS WITH FRIENDS SECTION */}
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-xs">
            <FriendGroupsSection />
          </div>

          {/* PENDING INCOMING FRIEND REQUESTS SECTION */}
          {pendingRequests.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-bold text-foreground">
                    Входящие заявки в друзья ({pendingRequests.length})
                  </p>
                </div>
                <button
                  onClick={loadFriendsAndRequests}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                  title="Обновить"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loadingRequests && 'animate-spin')} />
                </button>
              </div>

              <div className="space-y-2">
                {pendingRequests.map(req => {
                  const unameDisplay = req.fromUsername
                    ? (req.fromUsername.startsWith('@') ? req.fromUsername : `@${req.fromUsername}`)
                    : `ID: ${req.fromChatId}`
                  return (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {req.fromName[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{req.fromName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{unameDisplay}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRespondRequest(req.fromChatId, 'accept')}
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          Принять
                        </button>
                        <button
                          onClick={() => handleRespondRequest(req.fromChatId, 'decline')}
                          className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-all cursor-pointer"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* OUTGOING SENT FRIEND REQUESTS SECTION */}
          {outgoingRequests.length > 0 && (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-foreground">
                    Отправленные приглашения ({outgoingRequests.length})
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {outgoingRequests.map(req => {
                  const unameDisplay = req.toUsername
                    ? (req.toUsername.startsWith('@') ? req.toUsername : `@${req.toUsername}`)
                    : `ID: ${req.toChatId}`
                  return (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {req.toName[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{req.toName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{unameDisplay}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          Ожидает подтверждения
                        </span>
                        <button
                          onClick={() => handleCancelOutgoing(req.toChatId)}
                          className="px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer"
                          title="Отменить приглашение"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
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
                <div className="p-5 rounded-3xl bg-card border border-primary/40 space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>Пригласить участника по Telegram @username</span>
                    </div>
                    <button
                      onClick={() => setShowInvite(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Укажите Telegram @username человека. Если он пользуется ботом Zerph AI, ему мгновенно придет уведомление в Telegram с кнопкой подтверждения!
                  </p>

                  <div className="flex flex-col gap-2.5">
                    <input
                      value={inviteUsername}
                      onChange={e => setInviteUsername(e.target.value)}
                      placeholder="@username друга в Telegram (например, @artem)"
                      className="h-10 px-3.5 rounded-xl bg-muted/50 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors font-medium"
                      autoFocus
                    />
                    <input
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="Имя друга (необязательно, подтянется из Telegram)"
                      className="h-10 px-3.5 rounded-xl bg-muted/50 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors font-medium"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
                    <button
                      onClick={() => setShowInvite(false)}
                      className="h-8 px-4 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleSendInvite}
                      disabled={!inviteUsername.trim() || sendingInvite}
                      className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shadow-xs"
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
                <div key={status} className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center gap-2.5 shadow-xs">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', sc.dot)} />
                  <div>
                    <p className="text-base font-bold text-foreground leading-none">{count}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{sc.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Friends list */}
          {state.friends.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center bg-card/40 rounded-3xl border border-border/50">
              <Users className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm font-bold text-foreground">У вас пока нет добавленных друзей</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Укажите @username друга по кнопке ниже или отправьте ему вашу персональную ссылку-приглашение
              </p>
              <button
                onClick={() => setShowInvite(true)}
                className="mt-2 flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Добавить друга</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {state.friends.map(f => (
                <FriendCard
                  key={f.id}
                  friend={f}
                  onProfile={handleOpenProfile}
                  onSchedule={handleOpenSchedule}
                  onRemove={async () => {
                    const ok = await confirm({
                      title: `Удалить ${f.name} из друзей?`,
                      description: 'Пользователь больше не сможет отправлять вам совместные заметки и задачи.',
                      confirmText: 'Удалить из друзей',
                      variant: 'danger',
                    })
                    if (!ok) return

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
        </div>

        {/* Right Column: Shared Tasks, Birthdays & Access Security (4 cols on large screens) */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col gap-4 sticky top-2">
          {/* Friends Tasks Section */}
          <div className="p-5 rounded-3xl bg-card border border-border/80 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-primary" />
                Задачи с друзьями
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">({teamTasks.length})</span>
            </div>

            {teamTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 leading-relaxed">
                Пока нет общих задач с друзьями. Выберите друга и поручите задачу в один клик!
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {teamTasks.slice(0, 6).map(t => (
                  <div
                    key={t.id}
                    onClick={() => {
                      dispatch({ type: 'SELECT_TASK', id: t.id })
                      dispatch({ type: 'SET_VIEW', view: 'tasks' })
                    }}
                    className="p-2.5 rounded-2xl bg-muted/30 border border-border/60 hover:border-primary/40 transition-all cursor-pointer group flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-xs font-semibold truncate leading-snug group-hover:text-primary transition-colors', t.status === 'done' && 'line-through text-muted-foreground')}>
                        {t.title}
                      </p>
                      {t.dueDate && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Дедлайн: {t.dueDate}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                      t.status === 'done' ? 'bg-[var(--status-done)]/10 text-[var(--status-done)]' : 'bg-primary/10 text-primary'
                    )}>
                      {t.status === 'done' ? 'Готово' : 'В работе'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Friends Birthdays */}
          <div className="p-5 rounded-3xl bg-card border border-border/80 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-pink-500" />
                Дни рождения друзей
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">({friendBirthdays.length})</span>
            </div>

            {friendBirthdays.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 leading-relaxed">
                Дни рождения друзей не указаны. Их можно указать в карточке каждого друга слева!
              </p>
            ) : (
              <div className="space-y-2">
                {friendBirthdays.slice(0, 4).map(b => (
                  <div
                    key={b.friend.id}
                    className="p-2.5 rounded-2xl bg-pink-500/5 border border-pink-500/20 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-pink-500/15 text-pink-500 flex items-center justify-center font-bold text-xs shrink-0">
                        {b.friend.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{b.friend.name}</p>
                        <p className="text-[10px] text-muted-foreground">{b.bDateFormatted}</p>
                      </div>
                    </div>

                    <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full shrink-0">
                      {b.diffDays === 0 ? 'Сегодня! 🎉' : b.diffDays === 1 ? 'Завтра 🎂' : `Через ${b.diffDays} дн.`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy and Mutual Access Notice */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-muted/40 via-card to-card border border-border/80 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-[var(--status-done)]" />
              <span>Взаимный доступ и приватность</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Чтобы поручать и делегировать задачи, оба участника должны включить переключатель «Разрешить задачи». Это предотвращает спам и гарантирует безопасность ваших списков.
            </p>
          </div>
        </div>
      </div>

      {/* User Profile Modal */}
      <AnimatePresence>
        {profileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]"
            >
              {/* Profile Header */}
              <div className="p-5 border-b border-border flex items-start justify-between bg-gradient-to-br from-primary/10 via-muted/30 to-card">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold text-lg border border-primary/30 shadow-inner">
                    {profileModal.friend.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>{profileModal.profile?.user?.name || profileModal.friend.name}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <span>{profileModal.profile?.user?.username || profileModal.friend.username || profileModal.friend.email}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setProfileModal(null)}
                  className="w-8 h-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Body */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {profileModal.loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs">Загрузка профиля...</p>
                  </div>
                ) : !profileModal.profile ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Не удалось загрузить данные профиля.
                  </div>
                ) : (
                  <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
                          <Flame className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {profileModal.profile.user?.streakDays || 0} дн.
                          </p>
                          <p className="text-[10px] text-muted-foreground">Серия продуктивности</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {profileModal.profile.user?.totalCompletedTasks || 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Выполнено задач</p>
                        </div>
                      </div>
                    </div>

                    {/* Birthday display */}
                    {profileModal.profile.user?.birthday && (
                      <div className="p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <span>🎂</span> День рождения
                        </span>
                        <span className="font-semibold text-foreground">
                          {profileModal.profile.user.birthday}
                        </span>
                      </div>
                    )}

                    {/* Task Delegation Permission Status */}
                    <div className={cn(
                      'p-3.5 rounded-xl border flex items-start gap-2.5 text-xs',
                      profileModal.profile.allowTasks
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
                    )}>
                      {profileModal.profile.allowTasks ? (
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                      ) : (
                        <Lock className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      )}
                      <div>
                        <p className="font-bold text-[12px]">
                          {profileModal.profile.allowTasks ? 'Отправка задач разрешена' : 'Отправка задач закрыта'}
                        </p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          {profileModal.profile.allowTasks
                            ? 'Вы можете поручать задачи этому другу и смотреть его график.'
                            : 'Пользователь отключил прием задач от вас. Для открытия доступа он должен включить тумблер в своей вкладке «Друзья».'}
                        </p>
                      </div>
                    </div>

                    {/* Shared Tasks List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span>Совместные задачи ({profileModal.profile.sharedTasks?.length || 0})</span>
                        </p>
                      </div>

                      {(!profileModal.profile.allowTasks) ? (
                        <div className="p-4 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
                          <Lock className="w-5 h-5 text-muted-foreground/40 mb-1" />
                          <span>Задачи скрыты настройками приватности пользователя</span>
                        </div>
                      ) : (!profileModal.profile.sharedTasks || profileModal.profile.sharedTasks.length === 0) ? (
                        <div className="p-4 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground">
                          ✨ Нет совместных задач
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {profileModal.profile.sharedTasks.map((t: any) => (
                            <div
                              key={t.id}
                              className={cn(
                                'p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs',
                                t.status === 'done'
                                  ? 'bg-muted/20 border-border/40 text-muted-foreground line-through'
                                  : 'bg-card border-border/80 text-foreground'
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate text-[12px] font-medium">{t.title}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
                                {t.dueDate && <span>{t.dueDate}</span>}
                                {t.dueTime && <span>{t.dueTime}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Profile Footer */}
              <div className="p-3.5 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    const f = profileModal.friend
                    setProfileModal(null)
                    handleOpenSchedule(f)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Открыть график</span>
                </button>
                <button
                  onClick={() => setProfileModal(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                        Попросите <strong>{scheduleModal.friend.name}</strong> зайти во вкладку <strong>«Друзья»</strong> и включить тумблер <em>«Разрешить задачи от этого человека»</em> на вашей карточке.
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
