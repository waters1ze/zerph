'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings, useApp, getTgChatId, getAuthHeaders } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Sun, Moon, Monitor, Bell, BellOff, Link, Key,
  User, Mail, Palette, Save, Check, MessageSquare,
  Zap, Globe, Shield, ChevronRight, Smartphone, Sparkles,
  Lock, ExternalLink, Download, Layers, CheckCircle2, ArrowRight,
  Send, Plus, CheckCircle
} from 'lucide-react'
import { SessionsPanel } from '@/components/sessions-panel'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { PLAN_CATALOG } from '@/lib/plans'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-1">{title}</h3>
      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function Row({ label, description, children }: { label: React.ReactNode; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description && <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-border'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
        style={{ left: checked ? 'calc(100% - 18px)' : '2px' }}
      />
    </button>
  )
}

const THEMES = [
  { id: 'light', label: 'Светлая', icon: Sun },
  { id: 'dark',  label: 'Тёмная',  icon: Moon },
  { id: 'system',label: 'Системная',icon: Monitor },
] as const

type SettingsTab = 'account' | 'notifications' | 'automation' | 'appearance' | 'pwa' | 'subscription' | 'data'

export function SettingsView() {
  const { state, dispatch } = useApp()
  const { settings, update } = useSettings()
  const { language, setLanguage } = useLanguage()
  const confirm = useConfirmDialog()
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const [saved, setSaved] = useState(false)

  // Auth form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState(state.settings.name || '')
  const [isRegister, setIsRegister] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSuccess, setAuthSuccess] = useState<string | null>(null)

  // Multi-Provider Linking States
  const [profileData, setProfileData] = useState<{
    email?: string | null
    hasPassword?: boolean
    vkId?: string | null
    googleEmail?: string | null
    username?: string | null
    name?: string
    plan?: string
    isPremium?: boolean
    newsDisabled?: boolean
  }>({})
  const [newsToggleLoading, setNewsToggleLoading] = useState(false)
  const [showEmailLinkModal, setShowEmailLinkModal] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkPassword, setLinkPassword] = useState('')

  const cachedUsage = typeof window !== 'undefined' ? localStorage.getItem('zerf-usage') : null
  const [usage, setUsage] = useState<any>(cachedUsage ? JSON.parse(cachedUsage) : null)
  const [loadingPay, setLoadingPay] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const [copiedShortcut, setCopiedShortcut] = useState(false)
  const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null

  const cachedBirthday = typeof window !== 'undefined' ? localStorage.getItem('zerf_birthday') || '' : ''
  const [userBirthday, setUserBirthday] = useState(cachedBirthday)
  const cachedTimezone = typeof window !== 'undefined' ? localStorage.getItem('zerf_timezone') || 'Europe/Moscow' : 'Europe/Moscow'
  const [userTimezone, setUserTimezone] = useState(cachedTimezone)
  const isAdmin = currentChatId === '6136950061' || currentChatId === '5078516086'

  // Subscriptions & Promo Code States
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://zeprh.vercel.app'
  const effectiveChatId = currentChatId && !currentChatId.startsWith('guest_') ? currentChatId : 'ВАШ_CHAT_ID'
  const personalShortcutUrl = `${originUrl}/api/shortcuts?chatId=${effectiveChatId}&text=`

  const fetchProfile = () => {
    if (currentChatId) {
      fetch(`/api/telegram/user?chatId=${currentChatId}`, {
        headers: getAuthHeaders(),
      })
        .then(r => r.json())
        .then(d => {
          if (d.connected) {
            setProfileData({
              email: d.email,
              hasPassword: d.hasPassword,
              vkId: d.vkId,
              googleEmail: d.googleEmail,
              username: d.username,
              name: d.name,
              plan: d.plan,
              isPremium: d.isPremium,
              newsDisabled: d.newsDisabled,
            })
            if (d.email) setLinkEmail(d.email)
          }
          if (d.birthday) {
            setUserBirthday(d.birthday)
            try { localStorage.setItem('zerf_birthday', d.birthday) } catch {}
          }
        })
        .catch(() => {})
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [currentChatId])

  const handleUserBirthdayChange = async (val: string) => {
    setUserBirthday(val)
    try { localStorage.setItem('zerf_birthday', val) } catch {}
    if (!currentChatId) return
    try {
      await fetch(`/api/telegram/user?chatId=${currentChatId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ birthday: val }),
      })
    } catch {}
  }

  const handleTimezoneChange = async (tz: string) => {
    setUserTimezone(tz)
    try { localStorage.setItem('zerf_timezone', tz) } catch {}
    if (!currentChatId) return
    try {
      await fetch('/api/user/timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: currentChatId, timezone: tz }),
      })
    } catch {}
  }

  const handleActivatePromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoInput.trim()) return
    setPromoLoading(true)
    setPromoMsg(null)
    try {
      const res = await fetch('/api/promocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoInput.trim(),
          chatId: currentChatId || '6136950061',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPromoMsg({ type: 'error', text: data.error || 'Ошибка активации промокода' })
      } else {
        setPromoMsg({ type: 'success', text: data.message })
        setPromoInput('')
        fetchProfile()
      }
    } catch {
      setPromoMsg({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setPromoLoading(false)
    }
  }

  const handleLinkEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthSuccess(null)
    setAuthLoading(true)

    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: linkEmail, password: linkPassword })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка привязки Email')
      setAuthSuccess('Email и пароль успешно привязаны к вашему аккаунту!')
      setProfileData(prev => ({ ...prev, email: linkEmail, hasPassword: true }))
      setShowEmailLinkModal(false)
      fetchProfile()
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка сети')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLinkGoogle = async () => {
    const emailPrompt = prompt('Введите ваш Google Email для привязки к этому аккаунту:', profileData.googleEmail || '')
    if (!emailPrompt || !emailPrompt.includes('@')) return
    setAuthLoading(true)
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleEmail: emailPrompt })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка привязки Google')
      setProfileData(prev => ({ ...prev, googleEmail: emailPrompt }))
      setAuthSuccess('Google аккаунт успешно привязан!')
      setTimeout(() => setAuthSuccess(null), 3000)
    } catch (err: any) {
      alert(err.message || 'Ошибка привязки')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLinkVk = async () => {
    const vkPrompt = prompt('Введите ваш ID ВКонтакте (например, 240878278):', profileData.vkId || '')
    if (!vkPrompt) return
    setAuthLoading(true)
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ vkId: vkPrompt })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка привязки VK')
      setProfileData(prev => ({ ...prev, vkId: vkPrompt }))
      setAuthSuccess('ВКонтакте успешно привязан к профилю!')
      setTimeout(() => setAuthSuccess(null), 3000)
    } catch (err: any) {
      alert(err.message || 'Ошибка привязки')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthSuccess(null)
    setAuthLoading(true)

    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isRegister ? 'register' : 'login',
          email,
          password,
          firstName: name
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка входа')
      }

      localStorage.setItem('zerf_chat_id', data.chatId)
      if (data.token) localStorage.setItem('zerf_auth_token', data.token)
      if (data.firstName) {
        localStorage.setItem('zerf_user_name', data.firstName)
        update({ name: data.firstName })
      }

      setAuthSuccess(data.message || 'Успешно!')
      setTimeout(() => {
        window.location.reload()
      }, 700)
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка сети')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Выйти из аккаунта?',
      description: 'Вы выйдете из текущего аккаунта на этом устройстве.',
      confirmText: 'Выйти',
      variant: 'danger',
    })
    if (ok) {
      try {
        localStorage.removeItem('zerf_chat_id')
        localStorage.removeItem('zerf_auth_token')
        localStorage.removeItem('zerf_birthday')
        document.cookie = 'zerf_chat_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        document.cookie = 'zerf_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      } catch {}
      window.location.reload()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span><span className="mono-emoji mr-1.5">⚙️</span>Настройки Zerf Note</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Управление единым аккаунтом, связками входа, голосовыми командами и внешним видом
          </p>
        </div>

        {currentChatId && !currentChatId.startsWith('guest_') && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ID: {currentChatId}
            </span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/80 overflow-x-auto">
        <button
          onClick={() => setActiveTab('account')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'account' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <User className="w-3.5 h-3.5" />
          <span>Профиль & Вход</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'notifications' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bell className="w-3.5 h-3.5 text-primary" />
          <span>Уведомления & Каналы</span>
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'automation' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Голос & Siri (iOS / Android)</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'appearance' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Оформление</span>
        </button>

        <button
          onClick={() => setActiveTab('pwa')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'pwa' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>PWA Приложение</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'subscription' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Тариф & Лимиты</span>
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'data' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Данные & Экспорт</span>
        </button>
      </div>

      {/* ── TAB 1: Account & Multi-Provider Authentication ──────────────────── */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <Section title="Ваш Профиль">
            <Row label="Имя пользователя" description="Отображается в команде, совместных проектах и чате">
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  update({ name: e.target.value })
                  if (currentChatId) {
                    fetch(`/api/telegram/user?chatId=${currentChatId}`, {
                      method: 'POST',
                      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: e.target.value })
                    }).catch(() => {})
                  }
                }}
                placeholder="Ваше имя"
                className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors w-48"
              />
            </Row>

            <Row label={<span className="flex items-center gap-1.5"><span className="mono-emoji">🎂</span> День рождения</span>} description="Друзья в Zerf Note автоматически увидят напоминание в календаре">
              <input
                type="date"
                value={userBirthday}
                onChange={e => handleUserBirthdayChange(e.target.value)}
                className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors w-44 cursor-pointer"
              />
            </Row>

            <Row label={<span className="flex items-center gap-1.5"><span className="mono-emoji">⏱</span> Часовой пояс</span>} description="Время отправки утренних сводок, вечерних отчетов и напоминаний">
              <select
                value={userTimezone}
                onChange={e => handleTimezoneChange(e.target.value)}
                className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors cursor-pointer w-52"
              >
                <option value="Europe/Kaliningrad">Калининград (UTC+2)</option>
                <option value="Europe/Moscow">Москва / СПб (UTC+3)</option>
                <option value="Europe/Samara">Самара (UTC+4)</option>
                <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                <option value="Asia/Omsk">Омск (UTC+6)</option>
                <option value="Asia/Krasnoyarsk">Красноярск / Новосибирск (UTC+7)</option>
                <option value="Asia/Irkutsk">Иркутск (UTC+8)</option>
                <option value="Asia/Yakutsk">Якутск (UTC+9)</option>
                <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
                <option value="Asia/Magadan">Магадан (UTC+11)</option>
                <option value="Asia/Kamchatka">Камчатка (UTC+12)</option>
                <option value="UTC">UTC (00:00)</option>
                <option value="America/New_York">Нью-Йорк (UTC-5)</option>
                <option value="America/Los_Angeles">Лос-Анджелес (UTC-8)</option>
              </select>
            </Row>
          </Section>

          {/* Multi-Provider Linked Accounts Hub */}
          <Section title="Связанные способы входа в этот аккаунт">
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Вы можете привязать <b>Email</b>, <b>Telegram</b>, <b>ВКонтакте</b> и <b>Google</b> к этому единому профилю. Вы сможете входить с любого устройства любым удобным способом — все задачи и заметки сохраняются в одном месте.
              </p>

              {authSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* Providers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. Telegram Card */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#229ED9]/15 text-[#229ED9] flex items-center justify-center font-bold">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Telegram</p>
                        <p className="text-[11px] text-muted-foreground">
                          {profileData.username ? profileData.username : `@Zerph_bot (ID: ${currentChatId || 'не привязан'})`}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      Подключен
                    </span>
                  </div>
                  <a
                    href="https://t.me/Zerph_bot?start=login"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Открыть диалог с ботом</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                </div>

                {/* 2. Email & Password Card */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">Email & Пароль</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {profileData.email ? profileData.email : 'Не привязан к аккаунту'}
                        </p>
                      </div>
                    </div>
                    {profileData.email ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                        Привязан
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 shrink-0">
                        Свободен
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setShowEmailLinkModal(!showEmailLinkModal)}
                    className="w-full py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Key className="w-3 h-3" />
                    <span>{profileData.email ? 'Сменить Email / Пароль' : 'Привязать Email и Пароль'}</span>
                  </button>
                </div>

                {/* 3. VK Card */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#0077FF]/15 text-[#0077FF] flex items-center justify-center font-bold text-xs">
                        VK
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">ВКонтакте</p>
                        <p className="text-[11px] text-muted-foreground">
                          {profileData.vkId ? `VK ID: ${profileData.vkId}` : 'Сообщество / Mini App'}
                        </p>
                      </div>
                    </div>
                    {profileData.vkId ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                        Привязан
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border">
                        Доступен
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLinkVk}
                      className="flex-1 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center justify-center gap-1"
                    >
                      <span>{profileData.vkId ? 'Изменить VK ID' : 'Указать VK ID'}</span>
                    </button>
                    <a
                      href="https://vk.com/im?sel=-240878278"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-[#0077FF]/10 text-[#0077FF] text-xs font-semibold hover:bg-[#0077FF]/20 transition-colors flex items-center justify-center"
                      title="Открыть чат VK"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* 4. Google Card */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center font-bold text-xs">
                        G
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">Google Вход</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {profileData.googleEmail ? profileData.googleEmail : 'Быстрый вход в 1 клик'}
                        </p>
                      </div>
                    </div>
                    {profileData.googleEmail ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                        Привязан
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border shrink-0">
                        Доступен
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLinkGoogle}
                    className="w-full py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>{profileData.googleEmail ? 'Изменить Google Email' : 'Привязать Google'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Modal/Form for Email Linking */}
              <AnimatePresence>
                {showEmailLinkModal && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleLinkEmailSubmit}
                    className="p-4 rounded-2xl bg-muted/50 border border-primary/30 space-y-3 mt-3 overflow-hidden"
                  >
                    <p className="text-xs font-bold text-foreground">
                      {profileData.email ? 'Изменить Email и пароль для входа' : 'Привязать Email и установить пароль:'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={linkEmail}
                          onChange={e => setLinkEmail(e.target.value)}
                          placeholder="alex@gmail.com"
                          className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Новый пароль</label>
                        <input
                          type="password"
                          required
                          value={linkPassword}
                          onChange={e => setLinkPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {authError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                        {authError}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm"
                      >
                        {authLoading ? 'Сохранение...' : 'Сохранить и привязать'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmailLinkModal(false)}
                        className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Logout Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-all"
                >
                  Выйти из этого аккаунта
                </button>
              </div>
            </div>
          </Section>

          {currentChatId && !currentChatId.startsWith('guest_') && (
            <Section title="Безопасность и активные сессии">
              <SessionsPanel />
            </Section>
          )}
        </div>
      )}

      {/* ── TAB 2: Notifications & Channels ─────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <Section title="Куда доставлять напоминания и уведомления">
            <div className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Выберите удобные каналы для мгновенного получения уведомлений о задачах, напоминаниях и отчетах:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Telegram */}
                <div
                  onClick={() => update({
                    notifications: {
                      ...settings.notifications,
                      telegram: settings.notifications.telegram === false ? true : false
                    }
                  })}
                  className={cn(
                    'p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3',
                    settings.notifications.telegram !== false
                      ? 'bg-primary/10 border-primary/40 shadow-sm'
                      : 'bg-card border-border hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold">
                      <Send className="w-4 h-4" />
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      settings.notifications.telegram !== false
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    )}>
                      {settings.notifications.telegram !== false ? 'Включено' : 'Выключено'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Telegram-бот</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Личные сообщения от @Zerph_bot</p>
                  </div>
                </div>

                {/* 2. VK */}
                <div
                  onClick={() => update({
                    notifications: {
                      ...settings.notifications,
                      vk: settings.notifications.vk === false ? true : false
                    }
                  })}
                  className={cn(
                    'p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3',
                    settings.notifications.vk !== false
                      ? 'bg-primary/10 border-primary/40 shadow-sm'
                      : 'bg-card border-border hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      settings.notifications.vk !== false
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    )}>
                      {settings.notifications.vk !== false ? 'Включено' : 'Выключено'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">ВКонтакте</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Сообщения сообщества VK</p>
                  </div>
                </div>

                {/* 3. Browser / Web Push */}
                <div
                  onClick={async () => {
                    const nextVal = settings.notifications.web === false ? true : false
                    update({
                      notifications: {
                        ...settings.notifications,
                        web: nextVal,
                        desktop: nextVal
                      }
                    })
                    if (nextVal && typeof window !== 'undefined' && 'Notification' in window) {
                      try {
                        const perm = await Notification.requestPermission()
                        if (perm === 'granted') {
                          new Notification('⏰ Zerf Note: Уведомления включены!', {
                            body: 'Теперь вы будете получать напоминания прямо на сайте и на рабочем столе.',
                            icon: '/icon.png'
                          })
                        }
                      } catch {}
                    }
                  }}
                  className={cn(
                    'p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3',
                    settings.notifications.web !== false
                      ? 'bg-primary/10 border-primary/40 shadow-sm'
                      : 'bg-card border-border hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                      <Bell className="w-4 h-4" />
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      settings.notifications.web !== false
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    )}>
                      {settings.notifications.web !== false ? 'Включено' : 'Выключено'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Сайт & Web Push</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Браузерные всплывающие пуши и звук</p>
                  </div>
                </div>
              </div>
            </div>

            <Row
              label="Браузерные Push-уведомления (Desktop / Mobile Web)"
              description="Всплывающие карточки напоминаний поверх всех окон браузера"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (typeof window !== 'undefined' && 'Notification' in window) {
                      const perm = await Notification.requestPermission()
                      if (perm === 'granted') {
                        new Notification('🔔 Тестовое уведомление Zerf AI', {
                          body: 'Проверка работы уведомлений на сайте выполнена успешно!',
                          icon: '/icon.png'
                        })
                      } else {
                        alert('Уведомления заблокированы в браузере. Разрешите их в настройках сайта.')
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors"
                >
                  Тест пуша
                </button>
                <Toggle
                  checked={settings.notifications.web !== false}
                  onChange={async v => {
                    update({
                      notifications: {
                        ...settings.notifications,
                        web: v,
                        desktop: v
                      }
                    })
                    if (v && typeof window !== 'undefined' && 'Notification' in window) {
                      await Notification.requestPermission()
                    }
                  }}
                />
              </div>
            </Row>

            <Row
              label="Звуковой сигнал напоминаний (Chime / Alarm)"
              description="Воспроизведение звукового оповещения при наступлении срока задачи"
            >
              <Toggle
                checked={settings.notifications.dueReminders ?? true}
                onChange={v => update({
                  notifications: {
                    ...settings.notifications,
                    dueReminders: v
                  }
                })}
              />
            </Row>

            <Row
              label="Интервал повторов напоминаний"
              description="За сколько минут присылать повторные напоминания"
            >
              <select
                value={settings.notifications.reminderIntervalMinutes || 5}
                onChange={e => update({
                  notifications: {
                    ...settings.notifications,
                    reminderIntervalMinutes: Number(e.target.value)
                  }
                })}
                className="text-xs bg-muted/50 rounded-xl px-3 py-1.5 border border-border outline-none cursor-pointer text-foreground"
              >
                <option value={5}>5 минут (Рекомендуется)</option>
                <option value={10}>10 минут</option>
                <option value={15}>15 минут</option>
                <option value={30}>30 минут</option>
              </select>
            </Row>

            <Row
              label="Количество ступеней напоминания"
              description="Сколько раз повторять напоминание до завершения задачи"
            >
              <select
                value={settings.notifications.reminderRepeatCount || 3}
                onChange={e => update({
                  notifications: {
                    ...settings.notifications,
                    reminderRepeatCount: Number(e.target.value)
                  }
                })}
                className="text-xs bg-muted/50 rounded-xl px-3 py-1.5 border border-border outline-none cursor-pointer text-foreground"
              >
                <option value={1}>1 раз (Только в срок)</option>
                <option value={2}>2 раза (Заранее и в срок)</option>
                <option value={3}>3 раза (Рекомендуется)</option>
                <option value={5}>5 раз (Настойчиво)</option>
              </select>
            </Row>
          </Section>
        </div>
      )}

      {/* ── TAB 3: Voice Automation (iOS & Android) ──────────────────────────── */}
      {activeTab === 'automation' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>🔑</span> Ваш персональный шлюз голосового ввода:
              </p>
              <code className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block break-all">
                {personalShortcutUrl}[Текст]
              </code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(personalShortcutUrl)
                setCopiedShortcut(true)
                setTimeout(() => setCopiedShortcut(false), 2000)
              }}
              className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border shrink-0 transition-colors"
            >
              {copiedShortcut ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* iPhone Siri Card */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                    <span>🍏</span> Для iPhone (Siri, Action Button и жесты)
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                    Шаблон в 1 клик
                  </span>
                </div>

                <a
                  href="https://www.icloud.com/shortcuts/3d56a887eab84805808f984b93c50a97"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <span>🍏 Установить команду на iPhone</span>
                </a>

                <div className="space-y-2 text-[11px] text-muted-foreground">
                  <p className="font-semibold text-foreground">Пошаговая настройка:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-0.5">
                    <li>Нажмите кнопку выше и в окне на iPhone выберите <b>«Добавить команду»</b>.</li>
                    <li>В 3-м блоке *(«Получить содержимое URL»)* проверьте ваш Chat ID: <code>chatId={effectiveChatId}</code>.</li>
                    <li>Скажите Siri: <i>«Привет, Siri, Запиши в zerf»</i>!</li>
                  </ol>

                  {/* Blueprint block */}
                  <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-1.5 font-mono text-[10px] mt-2">
                    <div className="text-foreground font-bold font-sans text-[11px] mb-1">
                      📱 Структура блоков на iPhone:
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-sky-400 font-sans">
                      🎤 <b>1. Продиктовать текст</b> (Русский)
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-indigo-400 font-sans">
                      🔗 <b>2. URL Кодировать</b> [Продиктованный текст]
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-emerald-400 break-all font-sans">
                      🌐 <b>3. Получить содержимое URL:</b><br />
                      <span className="font-mono text-[9px]">{personalShortcutUrl}</span><span className="text-indigo-400 font-bold">[Кодированный в URL текст]</span>
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-rose-400 font-sans">
                      🔊 <b>4. Произнести текст</b> [Содержимое URL]
                    </div>
                  </div>

                  {/* Gestures and Fast Entry */}
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-[11px] mt-2 text-foreground">
                    <div className="font-bold text-primary flex items-center gap-1.5 text-xs">
                      <span>✨</span> Быстрый вход жестами и виджетами на iPhone:
                    </div>
                    <p>• <b>Двойной стук по крышке (Back Tap):</b> <i>Настройки ➔ Универсальный доступ ➔ Касание ➔ Касание задней панели ➔ «Двойное касание» ➔ выберите «Запиши в zerf»</i>.</p>
                    <p>• <b>Action Button (iPhone 15/16 Pro):</b> <i>Настройки ➔ Кнопка действия ➔ Быстрая команда ➔ «Запиши в zerf»</i>.</p>
                    <p>• <b>Виджет на экране блокировки:</b> <i>Зажмите Lock Screen ➔ Настроить ➔ Добавить виджет «Команды» ➔ «Запиши в zerf»</i>.</p>
                    <p>• <b>Иконка на экран «Домой»:</b> <i>Откройте сайт в Safari ➔ Поделиться ➔ «На экран "Домой"»</i>.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Android Card */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                    <span>⚙️</span> Для Android (Виджет в 1 клик)
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    HTTP Shortcuts
                  </span>
                </div>

                <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground">Пошаговая инструкция для Android:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-0.5">
                    <li>Установите бесплатное приложение <b>HTTP Shortcuts</b> из Google Play.</li>
                    <li>Нажмите значок <b>+</b> ➔ Создайте <b>Обычный ярлык</b> (Regular Shortcut).</li>
                    <li>В разделе <i>«Переменные»</i> добавьте переменную <code>voice_input</code> с типом <i>«Голосовой ввод»</i>.</li>
                    <li>В поле <b>URL запроса</b> укажите:
                      <div className="text-[10px] font-mono bg-muted/90 p-2 rounded-lg my-1 break-all border border-border text-emerald-400">
                        {personalShortcutUrl}{'{voice_input}'}
                      </div>
                    </li>
                    <li>В разделе <i>«Ответ» (Response)</i> включите: <b>Озвучивать текст (TTS)</b>.</li>
                    <li>Вынесите созданный ярлык-виджет на главный экран Android!</li>
                    <li>Для установки PWA: откройте сайт в Chrome ➔ Меню ➔ «Установить приложение».</li>
                  </ol>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground">
                ✨ Теперь по нажатию виджета сразу открывается микрофон: надиктовали задачу или вопрос — бот озвучит ответ и сохранит всё в ваш аккаунт!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Appearance & Language ─────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <Section title="Тема оформления">
            <Row label="Цветовая тема" description="Выберите светлую, тёмную или системную тему">
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
                {THEMES.map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id}
                      onClick={() => update({ theme: t.id })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                        settings.theme === t.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </Row>

            <Row label="Первый день недели" description="С какого дня начинается календарная сетка">
              <select
                value={settings.weekStartsOn ?? 1}
                onChange={e => update({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
                className="text-xs bg-muted/50 rounded-xl px-3 py-1.5 border border-border outline-none cursor-pointer text-foreground"
              >
                <option value={1}>Понедельник (Рекомендуется)</option>
                <option value={0}>Воскресенье</option>
              </select>
            </Row>
          </Section>
        </div>
      )}

      {/* ── TAB 4: PWA App Installation ─────────────────────────────────────── */}
      {activeTab === 'pwa' && (
        <div className="space-y-6">
          <Section title="Установка на устройства">
            <div className="p-4 space-y-3.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Установите Zerf Note как отдельное приложение на телефон или компьютер. Оно работает без адресной строки браузера, запускается мгновенно и сохраняет авторизацию навсегда.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <span>🍏</span> На iPhone (iOS Safari)
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    1. Откройте сайт в <b>Safari</b>.<br />
                    2. Нажмите кнопку <b>«Поделиться»</b> (квадрат со стрелочкой вверх).<br />
                    3. Выберите <b>«На экран „Домой“»</b>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <span>🤖</span> На Android (Chrome)
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    1. Откройте сайт в <b>Chrome</b>.<br />
                    2. Нажмите <b>три точки (меню)</b> вверху справа.<br />
                    3. Нажмите <b>«Установить приложение»</b>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <span>💻</span> На ПК (Windows / Mac)
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    1. Откройте сайт в <b>Chrome</b> или <b>Edge</b>.<br />
                    2. В адресной строке нажмите значок <b>⊕ «Установить»</b>.<br />
                    3. Приложение появится на панели задач!
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB 5: Subscription, Plans & Promo Codes ────────────────────────── */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <Section title="Тарифные планы">
            <div className="p-5 space-y-5">
              {/* Billing Cycle Switcher (Monthly / Yearly -15%) */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
                <div>
                  <p className="text-xs font-bold text-foreground">Период оплаты</p>
                  <p className="text-[11px] text-muted-foreground">При оплате на 1 год действует постоянная скидка 15%</p>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      billingCycle === 'monthly'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Месяц
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1',
                      billingCycle === 'yearly'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>Год</span>
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.2 rounded-full",
                      billingCycle === 'yearly' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    )}>
                      -15%
                    </span>
                  </button>
                </div>
              </div>

              {/* 4 Pricing Cards Grid (free / plus / pro / corp) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {PLAN_CATALOG.map(entry => {
                  const isCurrent = (profileData.plan || 'free') === entry.id
                  const highlight = entry.id === 'plus'
                  const price = billingCycle === 'monthly' ? entry.priceMonthly : entry.priceYearly
                  const purchasable = entry.id === 'plus' || entry.id === 'pro'
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        'p-4 rounded-2xl bg-card flex flex-col justify-between space-y-4 shadow-sm relative',
                        isCurrent ? 'border-2 border-emerald-500/50' : highlight ? 'border-2 border-primary/40' : 'border border-border'
                      )}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={cn('text-xs font-bold uppercase tracking-wider', highlight ? 'text-primary' : 'text-foreground')}>
                            {entry.name}
                          </span>
                          {isCurrent ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Текущий
                            </span>
                          ) : highlight ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              Популярный
                            </span>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-2xl font-extrabold text-foreground">
                            {price === null ? 'По запросу' : price === 0 ? '0 ₽' : `${price} ₽`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {price === null ? 'для команд' : price === 0 ? 'бесплатно навсегда' : billingCycle === 'monthly' ? 'в месяц' : 'в год (скидка 15%)'}
                          </p>
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-foreground/90 pt-2 border-t border-border/50">
                          {entry.features.map(f => (
                            <li key={f} className="flex items-start gap-1.5">✓ {f}</li>
                          ))}
                        </ul>
                      </div>
                      {purchasable ? (
                        <button
                          onClick={async () => {
                            setLoadingPay(true)
                            try {
                              const res = await fetch('/api/subscription', {
                                method: 'POST',
                                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                                body: JSON.stringify({ plan: entry.id, period: billingCycle })
                              })
                              const data = await res.json()
                              if (data.paymentUrl) {
                                window.open(data.paymentUrl, '_blank')
                              } else {
                                alert(data.error || 'Не удалось создать счёт. Войдите в аккаунт и попробуйте снова.')
                              }
                            } catch {
                              alert('Ошибка сети при создании счёта')
                            } finally {
                              setLoadingPay(false)
                            }
                          }}
                          disabled={loadingPay}
                          className={cn(
                            'w-full py-2.5 rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md disabled:opacity-60',
                            highlight
                              ? 'bg-primary text-primary-foreground shadow-primary/20'
                              : 'bg-foreground text-background'
                          )}
                        >
                          Оформить {entry.name}{price ? ` (${price} ₽)` : ''}
                        </button>
                      ) : entry.id === 'corp' ? (
                        <a
                          href="https://t.me/Zerph_bot"
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2.5 rounded-xl bg-muted/60 text-foreground text-xs font-bold text-center hover:bg-muted transition-all block"
                        >
                          Связаться с нами
                        </a>
                      ) : (
                        <button disabled className="w-full py-2 rounded-xl bg-muted/60 text-muted-foreground text-xs font-semibold cursor-default">
                          Активен по умолчанию
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* News digests opt-out (Plus+) */}
              {profileData.isPremium && (
                <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Новостные сводки</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Утреннее приветствие, вечерний обзор и «главное на сегодня». Отключение доступно на Plus и выше.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={newsToggleLoading}
                    onClick={async () => {
                      setNewsToggleLoading(true)
                      try {
                        const res = await fetch('/api/telegram/user', {
                          method: 'POST',
                          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                          body: JSON.stringify({ newsDisabled: !profileData.newsDisabled })
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setProfileData(p => ({ ...p, newsDisabled: !p.newsDisabled }))
                        } else {
                          alert(data.error || 'Не удалось изменить настройку')
                        }
                      } catch {
                        alert('Ошибка сети')
                      } finally {
                        setNewsToggleLoading(false)
                      }
                    }}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60',
                      profileData.newsDisabled ? 'bg-primary' : 'bg-muted border border-border'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                      profileData.newsDisabled ? 'left-[22px]' : 'left-0.5'
                    )} />
                  </button>
                </div>
              )}

              {/* Promo Code Activation Box */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                <div>
                  <p className="text-xs font-bold text-foreground">Активация промокода</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Введите промокод от администратора для получения скидки или бесплатного периода подписки
                  </p>
                </div>

                <form onSubmit={handleActivatePromo} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={e => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="ПРОМОКОД (например: PROMO30)"
                    className="flex-1 h-9 px-3.5 rounded-xl bg-muted/50 border border-border text-xs font-mono font-bold tracking-wider text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
                  />
                  <button
                    type="submit"
                    disabled={promoLoading || !promoInput.trim()}
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
                  >
                    {promoLoading ? 'Проверка...' : 'Применить'}
                  </button>
                </form>

                {promoMsg && (
                  <p className={cn(
                    'text-xs font-medium px-3 py-2 rounded-xl border',
                    promoMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  )}>
                    {promoMsg.text}
                  </p>
                )}
              </div>

              {/* Referral Invite Card */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span className="mono-emoji">🎁</span> Реферальная программа
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Пригласите 3 друзей и получите Premium подписку на 1 месяц бесплатно!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cid = getTgChatId()
                    const refLink = `https://t.me/Zerph_bot?start=ref_${cid}`
                    navigator.clipboard.writeText(refLink)
                    setCopiedRef(true)
                    setTimeout(() => setCopiedRef(false), 2000)
                  }}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span className="mono-emoji">🎁</span>
                  <span>{copiedRef ? 'Ссылка скопирована!' : 'Пригласить друга'}</span>
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB 6: Data & Privacy ────────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <Section title="Резервное копирование и экспорт">
            <Row label="Экспорт всех данных (JSON)" description="Скачать полный архив задач, заметок, целей и проектов">
              <button
                onClick={() => {
                  const { tasks, goals, notes, projects } = state
                  const data = JSON.stringify({ exportedAt: new Date().toISOString(), tasks, goals, notes, projects }, null, 2)
                  const blob = new Blob([data], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `zerf-note-export-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать JSON</span>
              </button>
            </Row>
          </Section>
        </div>
      )}
    </div>
  )
}
