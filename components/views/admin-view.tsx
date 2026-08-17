'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Crown, Users, Sparkles, Check, Search, RefreshCw,
  Send, UserX, AlertCircle, Copy, Clock, MessageSquare, Mic,
  CheckCircle2, XCircle, ChevronDown, RotateCcw, Megaphone, Trash2,
  Ticket, Percent, Tag, Plus, BarChart2, TrendingUp, TrendingDown,
  DollarSign, UserCheck, Activity, Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'

interface AdminUser {
  chatId: string
  firstName: string | null
  lastName: string | null
  username: string | null
  plan: string
  rawPlan?: string
  isPremiumActive: boolean
  daysRemaining: number
  subscriptionExpiry: string | null
  trialActivatedAt?: string | null
  isTrialActive?: boolean
  referredBy?: string | null
  isAdmin: boolean
  isRoot: boolean
  voiceCountToday: number
  voiceSecondsToday: number
  notesCountToday: number
  chatMessagesToday: number
  referralCount: number
  lastActiveAt: string | null
  addedAt: string
}

interface AdminStats {
  totalUsers: number
  activePremium: number
  activeToday: number
  totalTasks: number
  totalGoals: number
  totalNotes: number
}

interface AdminMetrics {
  dau: number
  wau: number
  mrr: number
  retentionD1: number | null
  retentionD7: number | null
  conversionPct: number
  newUsersWeek: number
  newUsersMonth: number
  registrationsChart: { date: string; count: number }[]
}

interface AdminPromoCode {
  id: string
  code: string
  discountPercent: number
  targetPlan: string
  durationDays: number
  maxActivations: number
  usedCount: number
  usedByChatIds: string[]
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

type FilterPlan = 'all' | 'sub' | 'plus' | 'pro' | 'corp' | 'trial' | 'free' | 'admin'

export function AdminView() {
  const confirm = useConfirmDialog()
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'promocodes' | 'metrics'>('users')
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterPlan>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Promo codes management state
  const [promoCodes, setPromoCodes] = useState<AdminPromoCode[]>([])
  const [promoLoading, setPromoLoading] = useState(false)
  const [newPromoCode, setNewPromoCode] = useState('')
  const [newDiscountPercent, setNewDiscountPercent] = useState('100')
  const [newTargetPlan, setNewTargetPlan] = useState('all')
  const [newDurationDays, setNewDurationDays] = useState('30')
  const [newMaxActivations, setNewMaxActivations] = useState('10')

  // Modals state
  const [premiumModalUser, setPremiumModalUser] = useState<AdminUser | null>(null)
  const [modalPlan, setModalPlan] = useState<'plus' | 'pro' | 'corp'>('plus')
  const [customDays, setCustomDays] = useState('30')
  const [messageModalUser, setMessageModalUser] = useState<AdminUser | null>(null)
  const [directMsgText, setDirectMsgText] = useState('')
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'premium' | 'free'>('all')

  // AI Channel Comments Feedback
  const [feedbackReport, setFeedbackReport] = useState<any | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [isViewerRoot, setIsViewerRoot] = useState<boolean>(false)

  const checkViewerRole = async () => {
    try {
      const res = await fetch(`/api/admin/check`, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.isRoot) setIsViewerRoot(true)
    } catch {}
  }

  const fetchAdminData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users`, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(25000),
      })
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
        setStats(data.stats || null)
        setMetrics(data.metrics || null)
      } else {
        showNotice('error', data.error || 'Ошибка загрузки данных админа')
      }
    } catch {
      showNotice('error', 'Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const fetchFeedbackReport = async (notifyAdmins = false, forceRefresh = false) => {
    setFeedbackLoading(true)
    try {
      const headers = getAuthHeaders()
      const url = notifyAdmins
        ? '/api/admin/channel/feedback'
        : `/api/admin/channel/feedback${forceRefresh ? '?refresh=true' : ''}`
      const res = await fetch(url, {
        method: notifyAdmins ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: notifyAdmins ? JSON.stringify({ notifyAdmins: true }) : undefined,
        signal: AbortSignal.timeout(25000),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok && data.report) {
        setFeedbackReport(data.report)
        if (notifyAdmins) {
          showNotice('success', 'Отчет успешно отправлен админам в Telegram!')
        } else if (forceRefresh) {
          showNotice('success', 'Свежий ИИ-анализ комментариев сформирован!')
        }
      } else {
        showNotice('error', res.status === 403
          ? 'Нет доступа: войдите как владелец/админ (сессия могла истечь — перезайдите по ссылке из бота /login)'
          : data.error || 'Ошибка загрузки отчета')
      }
    } catch {
      showNotice('error', 'Ошибка загрузки отчета по комментариям')
    } finally {
      setFeedbackLoading(false)
    }
  }

  useEffect(() => {
    checkViewerRole()
    fetchAdminData()
    fetchFeedbackReport()
    fetchPromoCodes()
  }, [])

  const fetchPromoCodes = async () => {
    setPromoLoading(true)
    try {
      const res = await fetch('/api/admin/promocode', {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.promoCodes) {
        setPromoCodes(data.promoCodes)
      }
    } catch {}
    finally {
      setPromoLoading(false)
    }
  }

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPromoCode.trim()) return
    setActionLoading('create_promo')
    try {
      const res = await fetch('/api/admin/promocode', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: newPromoCode.trim(),
          discountPercent: Number(newDiscountPercent) || 100,
          targetPlan: newTargetPlan,
          durationDays: Number(newDurationDays) || 30,
          maxActivations: Number(newMaxActivations) || 1,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', `Промокод ${newPromoCode.toUpperCase()} создан!`)
        setNewPromoCode('')
        fetchPromoCodes()
      } else {
        showNotice('error', data.error || 'Ошибка создания промокода')
      }
    } catch {
      showNotice('error', 'Ошибка запроса к серверу')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeletePromoCode = async (id: string, code: string) => {
    const ok = await confirm({
      title: `Удалить промокод ${code}?`,
      description: 'Пользователи больше не смогут его активировать.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/admin/promocode?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', `Промокод ${code} удален`)
        fetchPromoCodes()
      }
    } catch {
      showNotice('error', 'Ошибка удаления')
    }
  }

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 4000)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Action: Grant / Revoke Subscription
  const handleSubscriptionAction = async (chatId: string, action: 'grant' | 'revoke', days = 30, plan: 'plus' | 'pro' | 'corp' = modalPlan) => {
    setActionLoading(`sub_${chatId}`)
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ chatId, action, days, plan })
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', data.message || 'Подписка успешно обновлена')
        setPremiumModalUser(null)
        fetchAdminData()
      } else {
        showNotice('error', data.error || 'Ошибка изменения подписки')
      }
    } catch {
      showNotice('error', 'Ошибка запроса к серверу')
    } finally {
      setActionLoading(null)
    }
  }

  // Action: Toggle Admin Role
  const handleToggleAdminRole = async (targetUser: AdminUser) => {
    const nextAdminState = !targetUser.isAdmin
    const confirmTitle = nextAdminState
      ? `Назначить ${targetUser.firstName || targetUser.chatId} администратором?`
      : `Отозвать права администратора у ${targetUser.firstName || targetUser.chatId}?`

    const ok = await confirm({
      title: confirmTitle,
      description: nextAdminState
        ? 'Пользователь получит доступ к админ-панели и управлению тарифами.'
        : 'Пользователь потеряет доступ к панели управления.',
      confirmText: nextAdminState ? 'Назначить' : 'Отозвать',
      variant: nextAdminState ? 'primary' : 'warning',
    })
    if (!ok) return

    setActionLoading(`role_${targetUser.chatId}`)
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      const res = await fetch('/api/admin/role', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ targetChatId: targetUser.chatId, makeAdmin: nextAdminState })
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', data.message)
        fetchAdminData()
      } else {
        showNotice('error', data.error || 'Ошибка изменения роли')
      }
    } catch {
      showNotice('error', 'Ошибка запроса к серверу')
    } finally {
      setActionLoading(null)
    }
  }

  // Action: Reset Daily Usage
  const handleResetUsage = async (chatId: string) => {
    setActionLoading(`reset_${chatId}`)
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ chatId, action: 'reset_usage' })
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', data.message || 'Лимиты успешно сброшены!')
        fetchAdminData()
      } else {
        showNotice('error', data.error || 'Ошибка сброса лимитов')
      }
    } catch {
      showNotice('error', 'Ошибка запроса к серверу')
    } finally {
      setActionLoading(null)
    }
  }

  // Action: Send Direct Telegram Message
  const handleSendDirectMessage = async () => {
    if (!messageModalUser || !directMsgText.trim()) return
    setActionLoading('direct_msg')
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      const res = await fetch('/api/admin/message', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ targetChatId: messageModalUser.chatId, text: directMsgText })
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', 'Сообщение успешно доставлено пользователю!')
        setMessageModalUser(null)
        setDirectMsgText('')
      } else {
        showNotice('error', data.error || 'Ошибка отправки сообщения')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

  // Action: Delete User
  const handleDeleteUser = async (targetUser: AdminUser) => {
    if (targetUser.isRoot) {
      showNotice('error', 'Нельзя удалить аккаунт владельца!')
      return
    }
    const name = targetUser.firstName || targetUser.username || targetUser.chatId
    const ok = await confirm({
      title: `Удалить пользователя ${name}?`,
      description: `ID: ${targetUser.chatId}. Все данные, задачи и заметки пользователя будут безвозвратно удалены.`,
      confirmText: 'Удалить навсегда',
      variant: 'danger',
    })
    if (!ok) return

    setActionLoading(`delete_${targetUser.chatId}`)
    try {
      const res = await fetch(`/api/admin/users?chatId=${targetUser.chatId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', `Пользователь ${name} удален`)
        fetchAdminData()
      } else {
        showNotice('error', data.error || 'Ошибка удаления пользователя')
      }
    } catch {
      showNotice('error', 'Ошибка запроса к серверу')
    } finally {
      setActionLoading(null)
    }
  }

  // Action: Send Broadcast
  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) return
    const targetLabel = broadcastTarget === 'all' ? 'Всем пользователям' : broadcastTarget === 'premium' ? 'Только Premium' : 'Только Free'
    const ok = await confirm({
      title: 'Отправить рассылку в Telegram?',
      description: `Получатели: ${targetLabel}. Сообщение будет разослано через бота Zerf AI.`,
      confirmText: 'Отправить рассылку',
      variant: 'primary',
    })
    if (!ok) return

    setActionLoading('broadcast')
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ text: broadcastText, targetGroup: broadcastTarget })
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', data.message)
        setBroadcastOpen(false)
        setBroadcastText('')
      } else {
        showNotice('error', data.error || 'Ошибка рассылки')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

  // Filter & Search
  const filteredUsers = users.filter(u => {
    // Search query
    const s = search.toLowerCase().trim()
    const matchesSearch = !s ||
      (u.firstName && u.firstName.toLowerCase().includes(s)) ||
      (u.lastName && u.lastName.toLowerCase().includes(s)) ||
      (u.username && u.username.toLowerCase().includes(s)) ||
      u.chatId.includes(s)

    if (!matchesSearch) return false

    // Filter pill
    if (filter === 'sub') return u.isPremiumActive
    if (filter === 'plus') return u.plan === 'plus' && u.isPremiumActive
    if (filter === 'pro') return u.plan === 'pro' && u.isPremiumActive
    if (filter === 'corp') return u.plan === 'corp' && u.isPremiumActive
    if (filter === 'trial') return Boolean(u.isTrialActive)
    if (filter === 'free') return !u.isPremiumActive
    if (filter === 'admin') return u.isAdmin
    return true
  })

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-16 font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-sm font-medium backdrop-blur-md',
              notification.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/10 to-transparent border border-border backdrop-blur-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Админ-панель Zerf AI</h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-semibold tracking-wide uppercase border border-amber-500/30">
                PRO CONTROL
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Управление подписками, ролями администраторов и пользователями в реальном времени
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBroadcastOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Рассылка</span>
          </button>
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-all disabled:opacity-50"
            title="Обновить данные"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Пользователей</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-2xl font-bold text-foreground">{stats.totalUsers}</span>
            <span className="text-[11px] text-muted-foreground mt-0.5">в базе данных</span>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Premium подписки</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-2xl font-bold text-amber-500">{stats.activePremium}</span>
            <span className="text-[11px] text-muted-foreground mt-0.5">активных планов</span>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Активны сегодня</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-2xl font-bold text-emerald-500">{stats.activeToday}</span>
            <span className="text-[11px] text-muted-foreground mt-0.5">посещали сегодня</span>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
              <span>Всего задач</span>
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
            </div>
            <span className="text-2xl font-bold text-foreground">{stats.totalTasks}</span>
            <span className="text-[11px] text-muted-foreground mt-0.5">создано в системе</span>
          </div>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeAdminTab === 'users'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          <span>Пользователи и Подписки ({users.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveAdminTab('promocodes')
            fetchPromoCodes()
          }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeAdminTab === 'promocodes'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <Ticket className="w-4 h-4" />
          <span>🎟️ Промокоды ({promoCodes.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('metrics')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeAdminTab === 'metrics'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <BarChart2 className="w-4 h-4" />
          <span>📊 Аналитика</span>
        </button>
      </div>

      {/* ── TAB 1: Users & Analytics ── */}
      {activeAdminTab === 'users' && (
        <div className="space-y-6">
          {/* AI Channel Feedback & Comments Analytics Card */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">ИИ-Анализ комментариев из канала @zerph_off</h3>
                  <p className="text-[11px] text-muted-foreground">Нейросеть считывает обсуждения подписчиков и формирует выжимку запросов</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchFeedbackReport(false, true)}
                  disabled={feedbackLoading}
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', feedbackLoading && 'animate-spin')} />
                  <span>Обновить ИИ</span>
                </button>
                <button
                  onClick={() => fetchFeedbackReport(true, true)}
                  disabled={feedbackLoading}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Отправить админам в TG</span>
                </button>
              </div>
            </div>

            {feedbackReport ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sentiment breakdown */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Настроение аудитории</span>
                      {(feedbackReport.newCommentsCount || 0) > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                          Новых: {feedbackReport.newCommentsCount}
                        </span>
                      )}
                    </div>
                    {(feedbackReport.totalAnalyzed || 0) > 0 && (feedbackReport.sentimentSummary?.positivePercent > 0 || feedbackReport.sentimentSummary?.negativePercent > 0 || feedbackReport.sentimentSummary?.neutralPercent > 0) ? (
                      <>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex">
                            <div
                              style={{ width: `${feedbackReport.sentimentSummary?.positivePercent || 0}%` }}
                              className="bg-emerald-500 h-full transition-all duration-500"
                              title={`Позитив: ${feedbackReport.sentimentSummary?.positivePercent || 0}%`}
                            />
                            <div
                              style={{ width: `${feedbackReport.sentimentSummary?.neutralPercent || 0}%` }}
                              className="bg-amber-500 h-full transition-all duration-500"
                              title={`Нейтрально: ${feedbackReport.sentimentSummary?.neutralPercent || 0}%`}
                            />
                            <div
                              style={{ width: `${feedbackReport.sentimentSummary?.negativePercent || 0}%` }}
                              className="bg-rose-500 h-full transition-all duration-500"
                              title={`Критика: ${feedbackReport.sentimentSummary?.negativePercent || 0}%`}
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                          <span className="text-emerald-500 font-medium">+{feedbackReport.sentimentSummary?.positivePercent || 0}% позитив</span>
                          <span className="text-amber-500 font-medium">{feedbackReport.sentimentSummary?.neutralPercent || 0}% нейтрально</span>
                          <span className="text-rose-500 font-medium">-{feedbackReport.sentimentSummary?.negativePercent || 0}% критика</span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 py-2 px-3 rounded-lg bg-muted/60 text-[11px] text-muted-foreground">
                        Комментариев за неделю пока нет. Анализ формируется еженедельно перед отправкой сводки.
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Всего комментариев: <strong className="text-foreground">{feedbackReport.totalAnalyzed || 0}</strong>
                  </p>
                </div>

                {/* Top feature requests */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex flex-col">
                  <span className="text-xs font-semibold text-foreground mb-2">Топ запросов функций от подписчиков</span>
                  <div className="space-y-1.5 flex-1">
                    {(feedbackReport.topRequests || []).length > 0 ? (
                      (feedbackReport.topRequests || []).slice(0, 3).map((req: string, idx: number) => (
                        <div key={idx} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary font-bold">▪</span>
                          <span className="text-foreground">{req}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-muted-foreground italic">Запросов пока не зафиксировано</div>
                    )}
                  </div>
                </div>

                {/* Executive AI Summary */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-between">
                  <span className="text-xs font-semibold text-primary mb-1">Выжимка от ИИ-Аналитика</span>
                  <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                    "{feedbackReport.executiveSummary}"
                  </p>
                  <div className="mt-2 text-[10px] text-primary/80 font-medium">
                    Формируется еженедельно по пятницам (или по кнопке «Обновить ИИ»)
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Загрузка аналитики комментариев...
              </div>
            )}
          </div>

          {/* Toolbar: Search & Filter Pills */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по имени, @username или Chat ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-muted/50 border border-border/80 outline-none focus:border-primary transition-all text-foreground"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              {[
                { id: 'all' as FilterPlan, label: `Все (${users.length})` },
                { id: 'sub' as FilterPlan, label: `⭐ С подпиской (${users.filter(u => u.isPremiumActive).length})` },
                { id: 'plus' as FilterPlan, label: `✨ Plus (${users.filter(u => u.plan === 'plus' && u.isPremiumActive).length})` },
                { id: 'pro' as FilterPlan, label: `🚀 Pro (${users.filter(u => u.plan === 'pro' && u.isPremiumActive).length})` },
                { id: 'corp' as FilterPlan, label: `🏢 Corp (${users.filter(u => u.plan === 'corp' && u.isPremiumActive).length})` },
                { id: 'trial' as FilterPlan, label: `⏳ Триал (${users.filter(u => u.isTrialActive).length})` },
                { id: 'free' as FilterPlan, label: `🆓 Free (${users.filter(u => !u.isPremiumActive).length})` },
                { id: 'admin' as FilterPlan, label: `👑 Админы (${users.filter(u => u.isAdmin).length})` },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
                    filter === item.id
                      ? 'bg-foreground text-background font-semibold shadow-sm'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users List Table */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Загрузка списка пользователей...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
                <span>{users.length === 0 ? 'Не удалось загрузить пользователей' : 'Пользователи не найдены'}</span>
                {users.length === 0 && (
                  <button
                    onClick={() => fetchAdminData()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Повторить
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredUsers.map(u => {
                  const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Без имени'
                  const isActionRunning = !!actionLoading && actionLoading.includes(u.chatId)

                  return (
                    <div
                      key={u.chatId}
                      className={cn(
                        'p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors',
                        u.isRoot && 'bg-amber-500/[0.03]'
                      )}
                    >
                      {/* User Profile Details */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs uppercase text-primary shrink-0">
                          {fullName[0]}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{fullName}</span>

                            {u.username && (
                              <a
                                href={`https://t.me/${u.username.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline font-medium"
                              >
                                {u.username}
                              </a>
                            )}

                            {/* Role Badge */}
                            {u.isRoot ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold tracking-wide uppercase border border-rose-500/30 flex items-center gap-1">
                                <Crown className="w-3 h-3" /> Владелец
                              </span>
                            ) : u.isAdmin ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold tracking-wide uppercase border border-amber-500/30 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Админ
                              </span>
                            ) : null}

                            {/* Plan Badge */}
                            {u.isRoot ? (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold tracking-wide uppercase border border-indigo-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Corp (Lifetime)
                              </span>
                            ) : u.isTrialActive ? (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold tracking-wide uppercase border border-cyan-500/30 flex items-center gap-1">
                                ⏳ Триал (24ч)
                              </span>
                            ) : u.isPremiumActive ? (
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border flex items-center gap-1',
                                u.plan === 'corp'
                                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                                  : u.plan === 'pro'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              )}>
                                <Sparkles className="w-3 h-3" />
                                <span>{u.plan.toUpperCase()}</span>
                                {u.daysRemaining > 0 && u.daysRemaining < 999 && (
                                  <span className="opacity-80">({u.daysRemaining} дн.)</span>
                                )}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold tracking-wide uppercase border border-border">
                                Free
                              </span>
                            )}
                          </div>

                          {/* User Metadata */}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            <button
                              onClick={() => copyToClipboard(u.chatId)}
                              className="hover:text-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                              title="Нажмите, чтобы скопировать Chat ID"
                            >
                              <span>ID: {u.chatId}</span>
                              {copiedId === u.chatId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                            </button>

                            {/* Detailed Subscription status line */}
                            {u.isRoot ? (
                              <span className="text-indigo-500 dark:text-indigo-400 font-semibold">• Бессрочный доступ (Владелец)</span>
                            ) : u.isTrialActive ? (
                              <span className="text-cyan-500 font-medium">• 1-дневный триал активен</span>
                            ) : u.isPremiumActive && u.subscriptionExpiry ? (
                              <span className="text-foreground/90 font-medium">
                                • Тариф {u.plan.toUpperCase()} до {new Date(u.subscriptionExpiry).toLocaleDateString('ru-RU')} ({u.daysRemaining} дн.)
                              </span>
                            ) : u.subscriptionExpiry && !u.isPremiumActive ? (
                              <span className="text-rose-500">• Подписка истекла {new Date(u.subscriptionExpiry).toLocaleDateString('ru-RU')}</span>
                            ) : (
                              <span>• Тариф Free</span>
                            )}

                            <span>• Сегодня: 🎙 {u.voiceCountToday} | 📌 {u.notesCountToday} | 💬 {u.chatMessagesToday}</span>

                            {u.referredBy && (
                              <span className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">
                                👤 Приглашён ID: {u.referredBy}
                              </span>
                            )}

                            {u.referralCount > 0 && (
                              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                🎁 Рефералов: {u.referralCount}
                              </span>
                            )}

                            {u.lastActiveAt && (
                              <span>• Был: {new Date(u.lastActiveAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {/* Subscription Management Button */}
                        <button
                          onClick={() => {
                            setPremiumModalUser(u)
                            setModalPlan(u.plan === 'pro' ? 'pro' : u.plan === 'corp' ? 'corp' : 'plus')
                          }}
                          disabled={isActionRunning}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/30 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Управление подпиской</span>
                        </button>

                        {/* Revoke Subscription */}
                        {u.isPremiumActive && !u.isRoot && (
                          <button
                            onClick={() => handleSubscriptionAction(u.chatId, 'revoke')}
                            disabled={isActionRunning}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
                            title="Отозвать подписку (сбросить на Free)"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Admin Role Toggle (Visible ONLY to root / owner admin) */}
                        {isViewerRoot && !u.isRoot && (
                          <button
                            onClick={() => handleToggleAdminRole(u)}
                            disabled={isActionRunning}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95',
                              u.isAdmin
                                ? 'bg-muted/80 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 border-border hover:border-rose-500/30'
                                : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/30'
                            )}
                            title={u.isAdmin ? 'Снять права админа' : 'Назначить администратором'}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            <span>{u.isAdmin ? 'Снять админа' : 'Сделать админом'}</span>
                          </button>
                        )}

                        {/* Send Telegram Message */}
                        <button
                          onClick={() => {
                            setMessageModalUser(u)
                            setDirectMsgText('')
                          }}
                          disabled={isActionRunning}
                          className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-all"
                          title="Отправить сообщение в Telegram"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Limits */}
                        <button
                          onClick={() => handleResetUsage(u.chatId)}
                          disabled={isActionRunning}
                          className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-all"
                          title="Сбросить дневные лимиты"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete User (Not Owner) */}
                        {isViewerRoot && !u.isRoot && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isActionRunning}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all"
                            title="Удалить пользователя из системы"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: Promo Codes Control Center ── */}
      {activeAdminTab === 'promocodes' && (
        <div className="space-y-6">
          {/* Create Promo Code Form */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-border/50 pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Создать новый промокод</h3>
                <p className="text-xs text-muted-foreground">
                  Настройте размер скидки (например 30% или 100% бесплатно), лимит активаций и тариф
                </p>
              </div>
            </div>

            <form onSubmit={handleCreatePromoCode} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Promo Code String */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Код промокода
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: SUMMER30, FREEVIP"
                    value={newPromoCode}
                    onChange={e => setNewPromoCode(e.target.value.toUpperCase())}
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs font-mono font-bold tracking-wider text-foreground outline-none focus:border-primary uppercase"
                  />
                </div>

                {/* Discount % */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Размер скидки (%)
                  </label>
                  <select
                    value={newDiscountPercent}
                    onChange={e => setNewDiscountPercent(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="100">100% (Полностью бесплатно)</option>
                    <option value="50">50% скидка</option>
                    <option value="30">30% скидка</option>
                    <option value="20">20% скидка</option>
                    <option value="10">10% скидка</option>
                  </select>
                </div>

                {/* Target Plan */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Применимо к тарифу
                  </label>
                  <select
                    value={newTargetPlan}
                    onChange={e => setNewTargetPlan(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">Любой тариф (Plus, Pro, Corp)</option>
                    <option value="plus">Только Zerf Plus (99 ₽)</option>
                    <option value="pro">Только Zerf Pro (299 ₽)</option>
                    <option value="corp">Только Zerf Corp</option>
                  </select>
                </div>

                {/* Duration in Days */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Длительность доступа (дней)
                  </label>
                  <select
                    value={newDurationDays}
                    onChange={e => setNewDurationDays(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="7">7 дней (1 неделя)</option>
                    <option value="14">14 дней (2 недели)</option>
                    <option value="30">30 дней (1 месяц)</option>
                    <option value="90">90 дней (3 месяца)</option>
                    <option value="180">180 дней (полгода)</option>
                    <option value="365">365 дней (1 год)</option>
                  </select>
                </div>

                {/* Max Activations Count */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Лимит человек (активаций)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={newMaxActivations}
                    onChange={e => setNewMaxActivations(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>

                {/* Submit button */}
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={actionLoading === 'create_promo' || !newPromoCode.trim()}
                    className="w-full h-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{actionLoading === 'create_promo' ? 'Создание...' : 'Создать промокод'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Active Promo Codes List Table */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground">Список всех промокодов</span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                  {promoCodes.length}
                </span>
              </div>
              <button
                onClick={fetchPromoCodes}
                disabled={promoLoading}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Обновить список"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', promoLoading && 'animate-spin')} />
              </button>
            </div>

            {promoLoading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Загрузка промокодов...</span>
              </div>
            ) : promoCodes.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                Промокодов пока нет. Создайте первый промокод в форме выше.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {promoCodes.map(promo => {
                  const isExhausted = promo.usedCount >= promo.maxActivations

                  return (
                    <div
                      key={promo.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border',
                          promo.discountPercent === 100
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        )}>
                          <Ticket className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-foreground tracking-wider">
                              {promo.code}
                            </span>
                            <span className="cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(promo.code)}>
                              {copiedId === promo.code ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </span>

                            <span className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                              promo.discountPercent === 100
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                            )}>
                              {promo.discountPercent === 100 ? '100% Бесплатно' : `${promo.discountPercent}% скидка`}
                            </span>

                            <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold border border-border">
                              Тариф: {promo.targetPlan === 'unlimited' ? 'Безлимит' : promo.targetPlan === 'premium' ? 'Premium' : 'Все тарифы'}
                            </span>
                          </div>

                          <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                            <span>Срок подписки: <b>{promo.durationDays} дн.</b></span>
                            <span>•</span>
                            <span>
                              Активаций: <strong className={isExhausted ? 'text-rose-500' : 'text-foreground'}>{promo.usedCount} / {promo.maxActivations}</strong>
                            </span>
                            {isExhausted && (
                              <span className="text-rose-500 font-bold text-[10px]">(Лимит исчерпан)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleDeletePromoCode(promo.id, promo.code)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all"
                          title="Удалить промокод"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Premium Manager */}
      <AnimatePresence>
        {premiumModalUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-amber-500 font-bold">
                  <Sparkles className="w-5 h-5" />
                  <span>Управление подпиской пользователя</span>
                </div>
                <button
                  onClick={() => setPremiumModalUser(null)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/50 text-xs text-foreground space-y-1.5 border border-border/60">
                <p className="font-bold text-sm">{[premiumModalUser.firstName, premiumModalUser.lastName].filter(Boolean).join(' ') || premiumModalUser.chatId}</p>
                <p className="text-muted-foreground font-mono">ID: {premiumModalUser.chatId} {premiumModalUser.username && `• ${premiumModalUser.username}`}</p>
                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">Текущий тариф:</span>
                  <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-bold uppercase">
                    {premiumModalUser.plan}
                  </span>
                  {premiumModalUser.isPremiumActive && premiumModalUser.subscriptionExpiry ? (
                    <span className="text-muted-foreground">
                      до {new Date(premiumModalUser.subscriptionExpiry).toLocaleDateString('ru-RU')} ({premiumModalUser.daysRemaining} дн.)
                    </span>
                  ) : premiumModalUser.isRoot ? (
                    <span className="text-indigo-500 font-semibold">Бессрочно (Владелец)</span>
                  ) : (
                    <span className="text-muted-foreground">Бесплатный</span>
                  )}
                </div>
              </div>

              {/* 1. Target Plan Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  1. Выберите тариф:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalPlan('plus')}
                    className={cn(
                      'p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5',
                      modalPlan === 'plus'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                        : 'bg-muted/40 border-border/70 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="text-xs">✨ Plus</span>
                    <span className="text-[10px] opacity-70">99 ₽/мес</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalPlan('pro')}
                    className={cn(
                      'p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5',
                      modalPlan === 'pro'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                        : 'bg-muted/40 border-border/70 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="text-xs">🚀 Pro</span>
                    <span className="text-[10px] opacity-70">299 ₽/мес</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalPlan('corp')}
                    className={cn(
                      'p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5',
                      modalPlan === 'corp'
                        ? 'bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                        : 'bg-muted/40 border-border/70 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="text-xs">🏢 Corp</span>
                    <span className="text-[10px] opacity-70">Безлимит</span>
                  </button>
                </div>
              </div>

              {/* 2. Duration Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  2. Выберите срок начисления:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 7, modalPlan)}
                    className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/20 hover:border-primary/40 border border-border text-xs font-medium transition-all text-left cursor-pointer"
                  >
                    ✦ +7 дней (Спринт)
                  </button>
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 30, modalPlan)}
                    className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/20 hover:border-primary/40 border border-border text-xs font-medium transition-all text-left cursor-pointer"
                  >
                    ✦ +30 дней (1 месяц)
                  </button>
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 90, modalPlan)}
                    className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/20 hover:border-primary/40 border border-border text-xs font-medium transition-all text-left cursor-pointer"
                  >
                    ✦ +90 дней (3 месяца)
                  </button>
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 365, modalPlan)}
                    className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold transition-all text-left cursor-pointer"
                  >
                    ★ +1 год (365 дней)
                  </button>
                </div>
              </div>

              {/* 3. Custom days & Revoke */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <label className="text-xs font-medium text-muted-foreground">Или введите количество дней вручную:</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-muted/50 border border-border outline-none text-foreground"
                  />
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', parseInt(customDays, 10) || 30, modalPlan)}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs transition-all hover:brightness-110 cursor-pointer"
                  >
                    Выдать {modalPlan.toUpperCase()}
                  </button>
                </div>
              </div>

              {/* Danger Zone: Revoke */}
              {premiumModalUser.isPremiumActive && !premiumModalUser.isRoot && (
                <div className="pt-2 border-t border-border/60 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'revoke')}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Снять подписку (Free)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPremiumModalUser(null)}
                    className="px-3 py-1.5 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Direct Telegram Message */}
      <AnimatePresence>
        {messageModalUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Send className="w-5 h-5 text-primary" />
                  <span>Сообщение пользователю</span>
                </div>
                <button
                  onClick={() => setMessageModalUser(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Закрыть ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Сообщение будет мгновенно отправлено в Telegram от имени бота пользователю{' '}
                <strong className="text-foreground">{messageModalUser.firstName || messageModalUser.chatId}</strong>.
              </p>

              <textarea
                rows={4}
                placeholder="Введите текст сообщения (поддерживается Markdown)..."
                value={directMsgText}
                onChange={e => setDirectMsgText(e.target.value)}
                className="w-full p-3 text-xs rounded-xl bg-muted/50 border border-border outline-none focus:border-primary text-foreground resize-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setMessageModalUser(null)}
                  className="px-3.5 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSendDirectMessage}
                  disabled={!directMsgText.trim() || actionLoading === 'direct_msg'}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading === 'direct_msg' ? 'Отправка...' : 'Отправить в TG'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── TAB 3: Analytics & Metrics ── */}
      {activeAdminTab === 'metrics' && (
        <div className="space-y-5">
          {!metrics ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Загружаем метрики…
            </div>
          ) : (
            <>
              {/* Row 1: Core KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>DAU</span>
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="text-2xl font-bold text-emerald-500">{metrics.dau}</span>
                  <span className="text-[11px] text-muted-foreground">активны сегодня</span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>WAU</span>
                    <Calendar className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-2xl font-bold text-blue-500">{metrics.wau}</span>
                  <span className="text-[11px] text-muted-foreground">за 7 дней</span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>MRR</span>
                    <DollarSign className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-2xl font-bold text-amber-500">{metrics.mrr.toLocaleString('ru')} ₽</span>
                  <span className="text-[11px] text-muted-foreground">выручка в месяц</span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Конверсия</span>
                    <UserCheck className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-2xl font-bold text-purple-500">{metrics.conversionPct}%</span>
                  <span className="text-[11px] text-muted-foreground">free → paid</span>
                </div>
              </div>

              {/* Row 2: Retention + New users */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Retention D1</span>
                    {metrics.retentionD1 !== null && metrics.retentionD1 >= 40
                      ? <TrendingUp className="w-4 h-4 text-emerald-500" />
                      : <TrendingDown className="w-4 h-4 text-rose-400" />}
                  </div>
                  <span className={`text-2xl font-bold ${metrics.retentionD1 === null ? 'text-muted-foreground' : metrics.retentionD1 >= 40 ? 'text-emerald-500' : 'text-rose-400'}`}>
                    {metrics.retentionD1 !== null ? `${metrics.retentionD1}%` : '—'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">вернулись на 2-й день</span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Retention D7</span>
                    {metrics.retentionD7 !== null && metrics.retentionD7 >= 20
                      ? <TrendingUp className="w-4 h-4 text-emerald-500" />
                      : <TrendingDown className="w-4 h-4 text-rose-400" />}
                  </div>
                  <span className={`text-2xl font-bold ${metrics.retentionD7 === null ? 'text-muted-foreground' : metrics.retentionD7 >= 20 ? 'text-emerald-500' : 'text-rose-400'}`}>
                    {metrics.retentionD7 !== null ? `${metrics.retentionD7}%` : '—'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">вернулись на 7-й день</span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Новых за 7 дн</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-2xl font-bold text-blue-400">+{metrics.newUsersWeek}</span>
                  <span className="text-[11px] text-muted-foreground">регистраций</span>
                </div>

                <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-1">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Новых за 30 дн</span>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-2xl font-bold text-primary">+{metrics.newUsersMonth}</span>
                  <span className="text-[11px] text-muted-foreground">регистраций</span>
                </div>
              </div>

              {/* Registrations bar chart */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Регистрации за 30 дней</h3>
                </div>
                {(() => {
                  const chart = metrics.registrationsChart
                  const maxCount = Math.max(...chart.map(d => d.count), 1)
                  return (
                    <div className="flex items-end gap-0.5 h-28 w-full">
                      {chart.map((d) => {
                        const pct = (d.count / maxCount) * 100
                        const isToday = d.date === new Date().toISOString().slice(0, 10)
                        const dayLabel = new Date(d.date).getDate()
                        return (
                          <div key={d.date} className="flex flex-col items-center flex-1 h-full justify-end gap-0.5 group relative" title={`${d.date}: ${d.count} рег.`}>
                            <div
                              style={{ height: `${Math.max(pct, d.count > 0 ? 6 : 1)}%` }}
                              className={`w-full rounded-t transition-all ${isToday ? 'bg-primary' : 'bg-primary/30 group-hover:bg-primary/60'}`}
                            />
                            {/* tooltip on hover */}
                            {d.count > 0 && (
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-popover border border-border text-[10px] text-foreground px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {d.count}
                              </div>
                            )}
                            {/* show day number every 5 days */}
                            {(dayLabel === 1 || dayLabel % 5 === 0 || isToday) && (
                              <span className={`text-[9px] ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{dayLabel}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL: Mass Broadcast */}
      <AnimatePresence>
        {broadcastOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Megaphone className="w-5 h-5 text-primary" />
                  <span>Массовая рассылка всем пользователям</span>
                </div>
                <button
                  onClick={() => setBroadcastOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Закрыть ✕
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Получатели:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: `Всем (${users.length})` },
                    { id: 'premium', label: `С подпиской (${users.filter(u => u.isPremiumActive).length})` },
                    { id: 'free', label: `Только Free (${users.filter(u => !u.isPremiumActive).length})` }
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setBroadcastTarget(item.id as any)}
                      className={cn(
                        'p-2 rounded-xl text-xs font-medium border transition-all text-center',
                        broadcastTarget === item.id
                          ? 'bg-primary/20 border-primary text-primary font-semibold'
                          : 'bg-muted/40 border-border text-muted-foreground'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Текст рассылки (Markdown):</label>
                <textarea
                  rows={5}
                  placeholder="Привет! Рады сообщить о выходе нового обновления Zerf AI..."
                  value={broadcastText}
                  onChange={e => setBroadcastText(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-muted/50 border border-border outline-none focus:border-primary text-foreground resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setBroadcastOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSendBroadcast}
                  disabled={!broadcastText.trim() || actionLoading === 'broadcast'}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading === 'broadcast' ? 'Отправка рассылки...' : '🚀 Запустить рассылку'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
