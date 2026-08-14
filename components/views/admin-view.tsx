'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Crown, Users, Sparkles, Check, Search, RefreshCw,
  Send, UserX, AlertCircle, Copy, Clock, MessageSquare, Mic,
  CheckCircle2, XCircle, ChevronDown, RotateCcw, Megaphone, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'

interface AdminUser {
  chatId: string
  firstName: string | null
  lastName: string | null
  username: string | null
  plan: string
  isPremiumActive: boolean
  daysRemaining: number
  subscriptionExpiry: string | null
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

type FilterPlan = 'all' | 'premium' | 'free' | 'admin'

export function AdminView() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterPlan>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Modals state
  const [premiumModalUser, setPremiumModalUser] = useState<AdminUser | null>(null)
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
        }
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
        }
      })
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
        setStats(data.stats || null)
      } else {
        showNotice('error', data.error || 'Ошибка загрузки данных админа')
      }
    } catch {
      showNotice('error', 'Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  const fetchFeedbackReport = async (notifyAdmins = false) => {
    setFeedbackLoading(true)
    try {
      const headers = getAuthHeaders()
      const res = await fetch('/api/admin/channel/feedback', {
        method: notifyAdmins ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: notifyAdmins ? JSON.stringify({ notifyAdmins: true }) : undefined,
      })
      const data = await res.json()
      if (data.ok && data.report) {
        setFeedbackReport(data.report)
        if (notifyAdmins) {
          showNotice('success', 'Отчет успешно отправлен админам в Telegram!')
        } else {
          showNotice('success', 'Аналитика ИИ успешно обновлена!')
        }
      } else {
        showNotice('error', data.error || 'Ошибка загрузки отчета')
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
  }, [])

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 4000)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Action: Grant / Revoke Premium
  const handleSubscriptionAction = async (chatId: string, action: 'grant' | 'revoke', days = 30) => {
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
        body: JSON.stringify({ chatId, action, days })
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
    const confirmText = nextAdminState
      ? `Назначить пользователя ${targetUser.firstName || targetUser.chatId} администратором?`
      : `Отозвать права администратора у пользователя ${targetUser.firstName || targetUser.chatId}?`

    if (!window.confirm(confirmText)) return

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
      alert('Нельзя удалить аккаунт владельца!')
      return
    }
    const name = targetUser.firstName || targetUser.username || targetUser.chatId
    if (!window.confirm(`Вы уверены, что хотите удалить пользователя ${name} (ID: ${targetUser.chatId})? Все его данные будут удалены.`)) return

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
    if (!window.confirm(`Отправить рассылку выбранной группе (${broadcastTarget})?`)) return
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
    if (filter === 'premium') return u.isPremiumActive
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-transparent border border-amber-500/20 backdrop-blur-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
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
              onClick={() => fetchFeedbackReport(false)}
              disabled={feedbackLoading}
              className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium border border-border flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', feedbackLoading && 'animate-spin')} />
              <span>Обновить ИИ</span>
            </button>
            <button
              onClick={() => fetchFeedbackReport(true)}
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
                <span className="text-xs font-semibold text-foreground">Настроение аудитории</span>
                {(feedbackReport.totalAnalyzed || 0) > 0 ? (
                  <>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex">
                        <div
                          style={{ width: `${feedbackReport.sentimentSummary?.positivePercent || 0}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Позитив: ${feedbackReport.sentimentSummary?.positivePercent || 0}%`}
                        />
                        <div
                          style={{ width: `${feedbackReport.sentimentSummary?.neutralPercent || 0}%` }}
                          className="bg-amber-500 h-full"
                          title={`Нейтрально: ${feedbackReport.sentimentSummary?.neutralPercent || 0}%`}
                        />
                        <div
                          style={{ width: `${feedbackReport.sentimentSummary?.negativePercent || 0}%` }}
                          className="bg-rose-500 h-full"
                          title={`Критика: ${feedbackReport.sentimentSummary?.negativePercent || 0}%`}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                      <span className="text-emerald-500 font-medium">+{feedbackReport.sentimentSummary?.positivePercent || 0}% позитив</span>
                      <span className="text-rose-500 font-medium">-{feedbackReport.sentimentSummary?.negativePercent || 0}% критика</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 py-2 px-3 rounded-lg bg-muted/60 text-[11px] text-muted-foreground">
                    Нет комментариев за текущую неделю. Сводка формируется еженедельно перед отправкой отчета.
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
                {(feedbackReport.topRequests || []).slice(0, 3).map((req: string, idx: number) => (
                  <div key={idx} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary font-bold">▪</span>
                    <span className="text-foreground">{req}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Executive AI Summary */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-between">
              <span className="text-xs font-semibold text-primary mb-1">Выжимка от ИИ-Аналитика</span>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                "{feedbackReport.executiveSummary}"
              </p>
              <div className="mt-2 text-[10px] text-primary/80 font-medium">
                Анализ обновляется автоматически в реальном времени
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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'premium', 'free', 'admin'] as FilterPlan[]).map(p => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                filter === p
                  ? 'bg-foreground text-background font-semibold shadow-sm'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 'all' && `Все (${users.length})`}
              {p === 'premium' && `⭐ Premium (${users.filter(u => u.isPremiumActive).length})`}
              {p === 'free' && `🆓 Free (${users.filter(u => !u.isPremiumActive).length})`}
              {p === 'admin' && `👑 Админы (${users.filter(u => u.isAdmin).length})`}
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
          <div className="p-12 text-center text-xs text-muted-foreground">
            Пользователи не найдены по заданным критериям
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredUsers.map(u => {
              const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Без имени'
              const isActionRunning = actionLoading?.includes(u.chatId)

              return (
                <div
                  key={u.chatId}
                  className="p-4 hover:bg-muted/20 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
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
                        {u.isPremiumActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wide uppercase border border-emerald-500/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Premium
                            {u.daysRemaining > 0 && u.daysRemaining < 999 && ` (${u.daysRemaining} дн.)`}
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
                          className="hover:text-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                          title="Нажмите, чтобы скопировать Chat ID"
                        >
                          <span>ID: {u.chatId}</span>
                          {copiedId === u.chatId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                        </button>

                        <span>• Сегодня: 🎙 {u.voiceCountToday} | 📌 {u.notesCountToday} | 💬 {u.chatMessagesToday}</span>
                        {u.lastActiveAt && (
                          <span>• Был: {new Date(u.lastActiveAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Subscription Dropdown / Button */}
                    <button
                      onClick={() => setPremiumModalUser(u)}
                      disabled={isActionRunning}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/30 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{u.isPremiumActive ? 'Изменить Premium' : 'Выдать Premium'}</span>
                    </button>

                    {/* Revoke Premium */}
                    {u.isPremiumActive && (
                      <button
                        onClick={() => handleSubscriptionAction(u.chatId, 'revoke')}
                        disabled={isActionRunning}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-500/20 transition-all disabled:opacity-50"
                        title="Отозвать Premium (сбросить на Free)"
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-500 font-bold">
                  <Sparkles className="w-5 h-5" />
                  <span>Управление Premium</span>
                </div>
                <button
                  onClick={() => setPremiumModalUser(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Закрыть ✕
                </button>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 text-xs text-foreground space-y-1">
                <p className="font-semibold">{[premiumModalUser.firstName, premiumModalUser.lastName].filter(Boolean).join(' ') || premiumModalUser.chatId}</p>
                <p className="text-muted-foreground">ID: {premiumModalUser.chatId} {premiumModalUser.username && `• ${premiumModalUser.username}`}</p>
                <p className="text-muted-foreground">
                  Текущий статус: {premiumModalUser.isPremiumActive ? `✨ Premium (осталось ${premiumModalUser.daysRemaining} дн.)` : 'Free (Бесплатный)'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Выберите период начисления:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 7)}
                    className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/20 hover:border-primary/40 border border-border text-xs font-medium transition-all text-left"
                  >
                    ⚡ +7 дней (Спринт)
                  </button>
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 30)}
                    className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/20 hover:border-primary/40 border border-border text-xs font-medium transition-all text-left"
                  >
                    ⭐ +30 дней (1 месяц)
                  </button>
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 90)}
                    className="p-2.5 rounded-xl bg-muted/60 hover:bg-primary/20 hover:border-primary/40 border border-border text-xs font-medium transition-all text-left"
                  >
                    🚀 +90 дней (Квартал)
                  </button>
                  <button
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', 365)}
                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold transition-all text-left"
                  >
                    👑 +1 год (365 дней)
                  </button>
                </div>
              </div>

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
                    onClick={() => handleSubscriptionAction(premiumModalUser.chatId, 'grant', parseInt(customDays, 10) || 30)}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs transition-all hover:brightness-110"
                  >
                    Выдать
                  </button>
                </div>
              </div>
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
                    { id: 'premium', label: `Только Premium (${users.filter(u => u.isPremiumActive).length})` },
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
