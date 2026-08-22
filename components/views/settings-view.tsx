'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings, useApp, getTgChatId, getAuthHeaders } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Bell, BellOff, Link, Key,
  User, Users, Mail, Palette, Save, Check, MessageSquare,
  Zap, Globe, Shield, ChevronRight, ChevronDown, Smartphone, Sparkles,
  Lock, ExternalLink, Download, Upload, Layers, CheckCircle2, ArrowRight,
  Send, Plus, CheckCircle, Search, X, Volume2, Timer, RotateCcw, AlertCircle, Brain, LayoutGrid, Puzzle,
  Mic, Crown, RefreshCw, FileText, Clock, Target, Terminal, Copy, BookOpen,
  Share2, Heart, Calendar, CreditCard, Loader2, Trash2
} from 'lucide-react'
import { SessionsPanel } from '@/components/sessions-panel'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { PLAN_CATALOG, normalizePlan, PLANS, UNLIMITED } from '@/lib/plans'
import { sendTestNotification, requestNotificationPermission } from '@/lib/notifications'
import { GiftSection } from '@/components/settings/gift-section'
import { ImportExportSection } from '@/components/settings/import-export-section'
import { TeamsSection } from '@/components/settings/teams-section'
import { AiModelsSection } from '@/components/settings/ai-models-section'
import { ApiKeysSection } from '@/components/settings/api-keys-section'
import { SidebarCustomizerSection } from '@/components/settings/sidebar-customizer-section'
import { InstalledExtensionsSettingsSection } from '@/components/settings/installed-extensions-section'
import { EmojiPickerModal } from '@/components/ui/emoji-picker-modal'
import { CustomThemesModal } from '@/components/settings/custom-themes-modal'
import { ZerfAvatar } from '@/components/ui/zerf-avatar'
import { ZerfikMascot } from '@/components/views/tikhonya-mascot'
import { GithubIcon } from '@/components/views/extensions-view'
import { ZERF_CUSTOM_EMOJIS } from '@/lib/custom-emojis'
import {
  THEME_PRESETS, accentPaletteFor, DENSITY_MODES, RADIUS_MODES,
  normalizeTheme, type ThemePresetId, type TextScaleStep,
} from '@/lib/theme-presets'

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

function Row({
  label,
  description,
  children,
  vertical,
  className,
}: {
  label: React.ReactNode
  description?: string
  children: React.ReactNode
  vertical?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'px-4 sm:px-5 py-3.5 sm:py-4 transition-colors',
        vertical
          ? 'flex flex-col gap-3.5 items-start'
          : 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4',
        className
      )}
    >
      <div className={cn('min-w-0', vertical ? 'w-full' : 'flex-1')}>
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description && <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className={cn('w-full min-w-0', vertical ? 'w-full flex items-center justify-start' : 'shrink-0 sm:w-auto flex items-center justify-start sm:justify-end')}>
        {children}
      </div>
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
        'relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0',
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

const TEXT_STEPS: { value: TextScaleStep; label: string }[] = [
  { value: -1, label: 'A' },
  { value: 0,  label: 'A' },
  { value: 1,  label: 'A' },
  { value: 2,  label: 'A' },
  { value: 3,  label: 'A' },
]

type SettingsTab = 'account' | 'integrations' | 'subscription' | 'ai' | 'apikeys' | 'teams' | 'notifications' | 'focus' | 'automation' | 'cli' | 'appearance' | 'sidebar' | 'extensions' | 'pwa' | 'data'

const VALID_SETTINGS_TABS: readonly SettingsTab[] = [
  'account', 'subscription', 'ai', 'apikeys', 'teams',
  'integrations', 'notifications', 'focus', 'automation', 'cli',
  'appearance', 'sidebar', 'extensions', 'pwa', 'data'
]

export function SettingsView() {
  const { state, dispatch, syncData } = useApp()
  const { settings, update } = useSettings()
  const { language, setLanguage } = useLanguage()
  const confirm = useConfirmDialog()
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search)
        const tabParam = params.get('tab') || params.get('section')
        if (tabParam && (VALID_SETTINGS_TABS as readonly string[]).includes(tabParam)) {
          return tabParam as SettingsTab
        }
        const saved = localStorage.getItem('zerf_settings_active_tab')
        if (saved && (VALID_SETTINGS_TABS as readonly string[]).includes(saved)) {
          return saved as SettingsTab
        }
      } catch {}
    }
    return 'account'
  })

  const handleSelectTab = (tab: SettingsTab) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zerf_settings_active_tab', tab)
      } catch {}
    }
  }

  // Ensure active tab is continuously preserved in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && activeTab) {
      try {
        localStorage.setItem('zerf_settings_active_tab', activeTab)
      } catch {}
    }
  }, [activeTab])

  const [liveAiModels, setLiveAiModels] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/ai/models')
      .then(r => r.json())
      .then(d => {
        if (d.models && Array.isArray(d.models)) {
          setLiveAiModels(d.models)
        }
      })
      .catch(() => {})

    const handleAiModelsUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setLiveAiModels(e.detail)
      }
    }
    window.addEventListener('zerf_ai_models_updated', handleAiModelsUpdate)
    return () => window.removeEventListener('zerf_ai_models_updated', handleAiModelsUpdate)
  }, [])

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
    githubUsername?: string | null
    username?: string | null
    name?: string
    avatarEmoji?: string | null
    plan?: string
    isAdmin?: boolean
    isPremium?: boolean
    newsDisabled?: boolean
    ttsEnabled?: boolean
    timezone?: string
    city?: string
    siriKey?: string
    reminderIntervalMinutes?: number
    reminderRepeatCount?: number
    subscriptionExpiry?: string | null
    googleCalendarSync?: boolean
    autoDeleteMonths?: number
  }>({})
  const [autoDeleteSaving, setAutoDeleteSaving] = useState(false)
  const handleAutoDeleteChange = async (months: number) => {
    setProfileData(prev => ({ ...prev, autoDeleteMonths: months }))
    update({ autoDeleteMonths: months })
    setAutoDeleteSaving(true)
    try {
      await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoDeleteMonths: months }),
      })
    } catch {}
    finally {
      setTimeout(() => setAutoDeleteSaving(false), 500)
    }
  }
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalSyncing, setGcalSyncing] = useState(false)
  const [gcalStatusMsg, setGcalStatusMsg] = useState<string | null>(null)
  const [newsToggleLoading, setNewsToggleLoading] = useState(false)
  const [showEmailLinkModal, setShowEmailLinkModal] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [showGoogleLinkModal, setShowGoogleLinkModal] = useState(false)
  const [googleInput, setGoogleInput] = useState('')
  const [googleEmailInput, setGoogleEmailInput] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showGithubSetupModal, setShowGithubSetupModal] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      let shouldCleanUrl = false

      if (params.get('github_oauth_setup_needed') === '1') {
        setShowGithubSetupModal(true)
        shouldCleanUrl = true
      }

      if (params.get('github_auth_success') === '1') {
        const gh = params.get('username')
        if (gh) {
          try {
            localStorage.setItem('zerf_github_username', gh)
          } catch {}
          setUserGithub(gh)
          setProfileData(prev => ({ ...prev, githubUsername: gh }))
        }
        setAuthSuccess(gh ? `GitHub аккаунт @${gh} успешно привязан!` : 'GitHub аккаунт успешно привязан!')
        setTimeout(() => setAuthSuccess(null), 4000)
        shouldCleanUrl = true
        fetchProfile()
      }

      if (params.get('vk_auth_success') === '1') {
        const vk = params.get('vk_id')
        if (vk) {
          setProfileData(prev => ({ ...prev, vkId: vk }))
        }
        setAuthSuccess('ВКонтакте успешно привязан!')
        setTimeout(() => setAuthSuccess(null), 4000)
        shouldCleanUrl = true
        fetchProfile()
      }

      if (params.get('google_auth_success') === '1' || params.get('google_calendar_success') === '1') {
        const gEmail = params.get('email')
        if (gEmail) {
          setProfileData(prev => ({ ...prev, googleEmail: gEmail }))
        }
        setAuthSuccess(gEmail ? `Google аккаунт ${gEmail} успешно привязан!` : 'Google аккаунт успешно привязан!')
        setTimeout(() => setAuthSuccess(null), 4000)
        shouldCleanUrl = true
        fetchProfile()
      }

      if (shouldCleanUrl) {
        window.history.replaceState({}, '', window.location.pathname + '#settings')
      }
    }
  }, [])

  const [showPinCodeModal, setShowPinCodeModal] = useState(false)
  const [pinCodeInput, setPinCodeInput] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const cachedGithub = typeof window !== 'undefined' ? localStorage.getItem('zerf_github_username') || '' : ''
  const [userGithub, setUserGithub] = useState(cachedGithub)
  const cachedUsage = typeof window !== 'undefined' ? localStorage.getItem('zerf-usage') : null
  const [usage, setUsage] = useState<any>(cachedUsage ? JSON.parse(cachedUsage) : null)
  const [loadingPay, setLoadingPay] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const [copiedShortcut, setCopiedShortcut] = useState(false)
  const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null
  const [cliOs, setCliOs] = useState<'windows' | 'mac' | 'linux'>('windows')

  const handleSyncByPin = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = pinCodeInput.trim().replace(/\s+/g, '')
    if (!clean) return
    setPinLoading(true)
    setPinError(null)
    try {
      const res = await fetch(`/api/auth/login-token?token=${clean}`)
      const data = await res.json()
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Неверный или устаревший код (действует 10 минут)')
      }
      if (data.chatId) localStorage.setItem('zerf_chat_id', String(data.chatId))
      if (data.sessionToken) localStorage.setItem('zerf_auth_token', data.sessionToken)
      window.location.reload()
    } catch (err: any) {
      setPinError(err.message || 'Ошибка синхронизации')
    } finally {
      setPinLoading(false)
    }
  }

  const cachedBirthday = typeof window !== 'undefined' ? localStorage.getItem('zerf_birthday') || '' : ''
  const [userBirthday, setUserBirthday] = useState(cachedBirthday)
  const [birthdaySavedStatus, setBirthdaySavedStatus] = useState<boolean>(false)
  const cachedTimezone = typeof window !== 'undefined' ? localStorage.getItem('zerf_timezone') || 'Europe/Moscow' : 'Europe/Moscow'
  const [userTimezone, setUserTimezone] = useState(cachedTimezone)
  const cachedCity = typeof window !== 'undefined' ? localStorage.getItem('zerf_city') || 'Москва' : 'Москва'
  const [userCity, setUserCity] = useState(cachedCity)
  const [citySavedStatus, setCitySavedStatus] = useState<boolean>(false)
  const citySaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isAdmin = Boolean(profileData.isAdmin)

  // Avatar / Profile Emoji State (Telegram-style 1000+ emojis)
  const cachedAvatarEmoji = typeof window !== 'undefined' ? localStorage.getItem('zerf_avatar_emoji') || 'zerfik_spirit' : 'zerfik_spirit'
  const [userAvatarEmoji, setUserAvatarEmoji] = useState(profileData.avatarEmoji || cachedAvatarEmoji)
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false)
  const [showThemesModal, setShowThemesModal] = useState<boolean>(false)
  const [showPricingMatrix, setShowPricingMatrix] = useState<boolean>(false)
  const [avatarSavedStatus, setAvatarSavedStatus] = useState<boolean>(false)

  useEffect(() => {
    if (profileData.avatarEmoji) {
      setUserAvatarEmoji(profileData.avatarEmoji)
      try { localStorage.setItem('zerf_avatar_emoji', profileData.avatarEmoji) } catch {}
    }
  }, [profileData.avatarEmoji])

  const handleSelectAvatarEmoji = (emoji: string) => {
    setUserAvatarEmoji(emoji)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zerf_avatar_emoji', emoji)
        window.dispatchEvent(new CustomEvent('zerf_avatar_changed', { detail: emoji }))
      } catch {}
    }
    syncPreferenceToServer({ avatarEmoji: emoji })
    setAvatarSavedStatus(true)
    setTimeout(() => setAvatarSavedStatus(false), 2000)
  }

  // Developer Mode State
  const [isDeveloperMode, setIsDeveloperMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zerf_developer_mode') === 'true'
    }
    return false
  })

  const toggleDeveloperMode = (val: boolean) => {
    setIsDeveloperMode(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('zerf_developer_mode', String(val))
      window.dispatchEvent(new CustomEvent('zerf_dev_mode_changed', { detail: { enabled: val } }))
    }
  }

  // Subscriptions & Promo Code States
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Import JSON states
  const importFileRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://zeprh.vercel.app'
  const effectiveChatId = currentChatId && !currentChatId.startsWith('guest_') ? currentChatId : 'ВАШ_CHAT_ID'
  const siriKeyParam = profileData.siriKey ? `&key=${profileData.siriKey}` : ''
  const personalShortcutUrl = `${originUrl}/api/shortcuts?chatId=${effectiveChatId}${siriKeyParam}&text=`

  const getGithubAuthUrl = () => {
    const cid = currentChatId || ''
    return cid ? `/api/auth/github?chatId=${encodeURIComponent(cid)}` : '/api/auth/github'
  }

  const getVkAuthUrl = () => {
    const cid = currentChatId || ''
    return cid ? `/api/auth/vk?chatId=${encodeURIComponent(cid)}` : '/api/auth/vk'
  }

  const handleDirectGithubAuth = () => {
    window.location.href = getGithubAuthUrl()
  }

  const handleDirectVkAuth = () => {
    window.location.href = getVkAuthUrl()
  }
  const [nameSavedStatus, setNameSavedStatus] = useState<boolean>(false)
  const [settingsSavedBadge, setSettingsSavedBadge] = useState<boolean>(false)
  const nameSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Liked themes state
  const [likedThemeIds, setLikedThemeIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_liked_themes')
        return saved ? new Set(JSON.parse(saved)) : new Set()
      } catch {}
    }
    return new Set()
  })

  const toggleLikeTheme = async (themeId: string) => {
    setLikedThemeIds(prev => {
      const next = new Set(prev)
      if (next.has(themeId)) next.delete(themeId)
      else next.add(themeId)
      try {
        localStorage.setItem('zerf_liked_themes', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
    try {
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', extensionId: themeId }),
      })
    } catch {}
  }

  // User Payment Card & Auto-Renew State
  const [userPaymentCard, setUserPaymentCard] = useState<{
    payoutType: 'card' | 'sbp' | 'yoomoney'
    cardNumber: string
    phone: string
    bankName: string
    recipientName?: string
  } | null>(null)
  const [autoRenew, setAutoRenew] = useState<boolean>(false)
  const [autoRenewLoading, setAutoRenewLoading] = useState<boolean>(false)
  const [showCardForm, setShowCardForm] = useState<boolean>(false)
  const [cardFormType, setCardFormType] = useState<'card' | 'sbp' | 'yoomoney'>('card')
  const [cardFormNumber, setCardFormNumber] = useState<string>('')
  const [cardFormPhone, setCardFormPhone] = useState<string>('')
  const [cardFormBank, setCardFormBank] = useState<string>('')
  const [cardFormName, setCardFormName] = useState<string>('')
  const [showBankDropdown, setShowBankDropdown] = useState<boolean>(false)
  const [showBankDropdown2, setShowBankDropdown2] = useState<boolean>(false)

  const POPULAR_BANKS_LIST = [
    { name: 'ЮMoney', icon: '🟣', badge: 'Кошелёк / Карта' },
    { name: 'Сбербанк', icon: '🟢', badge: 'Сбер' },
    { name: 'Т-Банк', icon: '🟡', badge: 'Тинькофф' },
    { name: 'Альфа-Банк', icon: '🔴', badge: 'Альфа' },
    { name: 'ВТБ', icon: '🔵', badge: 'ВТБ' },
    { name: 'Ozon Банк', icon: '🟣', badge: 'Ozon' },
    { name: 'Райффайзен', icon: '🟠', badge: 'Райф' },
    { name: 'Газпромбанк', icon: '🔵', badge: 'ГПБ' },
    { name: 'Другой банк', icon: '💳', badge: 'Карта РФ' },
  ]

  const fetchAutoRenew = () => {
    fetch('/api/subscription/autorenew', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAutoRenew(Boolean(d.autoRenew))
          if (d.cardData) {
            setUserPaymentCard(d.cardData)
            setCardFormType(d.cardData.payoutType || 'card')
            setCardFormNumber(d.cardData.cardNumber || '')
            setCardFormPhone(d.cardData.phone || '')
            setCardFormBank(d.cardData.bankName || '')
            setCardFormName(d.cardData.recipientName || '')
          }
        }
      })
      .catch(() => {})
  }

  const handleToggleAutoRenew = async () => {
    const nextVal = !autoRenew
    setAutoRenewLoading(true)
    try {
      const res = await fetch('/api/subscription/autorenew', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoRenew: nextVal,
          payoutType: cardFormType,
          cardNumber: cardFormNumber,
          phone: cardFormPhone,
          bankName: cardFormBank,
          recipientName: cardFormName,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAutoRenew(data.autoRenew)
        if (data.cardData) setUserPaymentCard(data.cardData)
        setSettingsSavedBadge(true)
        setTimeout(() => setSettingsSavedBadge(false), 2500)
      }
    } catch {
      alert('Ошибка при сохранении настройки автопродления')
    } finally {
      setAutoRenewLoading(false)
    }
  }

  const handleSavePaymentCard = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanNumber = cardFormNumber.replace(/\s+/g, '')
    
    if (cardFormType === 'yoomoney') {
      if (cleanNumber.length < 14 || cleanNumber.length > 16 || !cleanNumber.startsWith('41001')) {
        alert('Пожалуйста, введите корректный номер счёта ЮMoney (14–16 цифр, начинается с 41001).')
        return
      }
    } else {
      if (cleanNumber.length < 16 || cleanNumber.length > 19) {
        alert('Номер банковской карты должен содержать от 16 до 19 цифр.')
        return
      }
      // Luhn algorithm verification
      let sum = 0
      let isEven = false
      for (let i = cleanNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cleanNumber.charAt(i), 10)
        if (isEven) {
          digit *= 2
          if (digit > 9) digit -= 9
        }
        sum += digit
        isEven = !isEven
      }
      if (sum % 10 !== 0) {
        alert('Недействительный номер банковской карты. Пожалуйста, проверьте правильность введённых цифр.')
        return
      }
      if (!cardFormBank) {
        alert('Пожалуйста, выберите банк вашей карты.')
        return
      }
    }

    setAutoRenewLoading(true)
    try {
      const res = await fetch('/api/subscription/autorenew', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoRenew,
          payoutType: cardFormType,
          cardNumber: cleanNumber,
          phone: cardFormPhone,
          bankName: cardFormBank || (cardFormType === 'yoomoney' ? 'ЮMoney' : 'Карта РФ'),
          recipientName: cardFormName,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setUserPaymentCard(data.cardData)
        setShowCardForm(false)
        setShowBankDropdown2(false)
        setSettingsSavedBadge(true)
        setTimeout(() => setSettingsSavedBadge(false), 2500)
      }
    } catch {
      alert('Ошибка сохранения карты')
    } finally {
      setAutoRenewLoading(false)
    }
  }

  // Generic DB preference updater
  const syncPreferenceToServer = async (payload: Record<string, any>) => {
    if (!currentChatId) return
    try {
      await fetch(`/api/telegram/user?chatId=${currentChatId}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      setSettingsSavedBadge(true)
      setTimeout(() => setSettingsSavedBadge(false), 2000)
    } catch {}
  }

  const saveUserNameToServer = async (newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    update({ name: trimmed })
    dispatch({ type: 'UPDATE_SETTINGS', updates: { name: trimmed } })
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zerf_user_name', trimmed)
        window.dispatchEvent(new CustomEvent('zerf_user_name_changed', { detail: trimmed }))
      } catch {}
    }
    setProfileData(prev => ({ ...prev, name: trimmed }))
    try {
      const url = currentChatId ? `/api/telegram/user?chatId=${currentChatId}` : '/api/telegram/user'
      await fetch(url, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })
      setNameSavedStatus(true)
      setTimeout(() => setNameSavedStatus(false), 2500)
    } catch {}
  }

  const handleNameChange = (val: string) => {
    setName(val)
    if (nameSaveTimerRef.current) clearTimeout(nameSaveTimerRef.current)
    nameSaveTimerRef.current = setTimeout(() => {
      saveUserNameToServer(val)
    }, 700)
  }

  const handleNameBlur = () => {
    if (nameSaveTimerRef.current) clearTimeout(nameSaveTimerRef.current)
    saveUserNameToServer(name)
  }

  const fetchUsage = () => {
    fetch('/api/subscription', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) {
          setUsage(d)
          try {
            localStorage.setItem('zerf-usage', JSON.stringify(d))
          } catch {}
          if (d.plan) {
            setProfileData(prev => ({
              ...prev,
              plan: d.plan,
              isPremium: d.plan !== 'free',
              subscriptionExpiry: d.subscriptionExpiry,
            }))
          }
        }
      })
      .catch(() => {})
  }

  const fetchProfile = () => {
    const url = currentChatId ? `/api/telegram/user?chatId=${currentChatId}` : '/api/telegram/user'
    fetch(url, {
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
            githubUsername: d.githubUsername,
            name: d.name,
            avatarEmoji: d.avatarEmoji,
            plan: d.plan,
            isPremium: d.isPremium,
            newsDisabled: d.newsDisabled,
            ttsEnabled: d.ttsEnabled,
            timezone: d.timezone,
            city: d.city,
            siriKey: d.siriKey,
            reminderIntervalMinutes: d.reminderIntervalMinutes,
            reminderRepeatCount: d.reminderRepeatCount,
            subscriptionExpiry: d.subscriptionExpiry,
            googleCalendarSync: Boolean(d.googleCalendarSync),
            autoDeleteMonths: d.autoDeleteMonths !== undefined ? Number(d.autoDeleteMonths) : 6,
          })
          if (d.githubUsername) {
            setUserGithub(d.githubUsername)
            try { localStorage.setItem('zerf_github_username', d.githubUsername) } catch {}
          }
          if (d.avatarEmoji) {
            setUserAvatarEmoji(d.avatarEmoji)
            try {
              localStorage.setItem('zerf_avatar_emoji', d.avatarEmoji)
              window.dispatchEvent(new CustomEvent('zerf_avatar_changed', { detail: d.avatarEmoji }))
            } catch {}
          }
          if (d.chatId && typeof window !== 'undefined' && !localStorage.getItem('zerf_chat_id')) {
            try { localStorage.setItem('zerf_chat_id', String(d.chatId)) } catch {}
          }
          if (d.name && d.name !== 'Kirill Perekatnov' && d.name !== 'Пользователь Zerf') {
            setName(d.name)
            if (settings.name !== d.name) {
              update({ name: d.name })
              dispatch({ type: 'UPDATE_SETTINGS', updates: { name: d.name } })
              try {
                localStorage.setItem('zerf_user_name', d.name)
                window.dispatchEvent(new CustomEvent('zerf_user_name_changed', { detail: d.name }))
              } catch {}
            }
          }
          if (d.timezone) {
            setUserTimezone(d.timezone)
            try { localStorage.setItem('zerf_timezone', d.timezone) } catch {}
          }
          if (d.city) {
            setUserCity(d.city)
            try { localStorage.setItem('zerf_city', d.city) } catch {}
          }
        }
        if (d.birthday) {
          setUserBirthday(d.birthday)
          try { localStorage.setItem('zerf_birthday', d.birthday) } catch {}
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchProfile()
    fetchUsage()
    fetchAutoRenew()
  }, [currentChatId, activeTab])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      
      // 1. Google OAuth Account Linking / Login
      if (params.get('google_auth_success') === '1') {
        const email = params.get('email')
        if (email) {
          setProfileData(prev => ({ ...prev, googleEmail: email }))
        }
        setAuthSuccess(`✅ Google аккаунт ${email ? `(${email})` : ''} успешно привязан к этому профилю!`)
        setTimeout(() => setAuthSuccess(null), 5000)
        fetchProfile()
        syncData()
        window.history.replaceState({}, '', window.location.pathname)
      } else if (params.get('google_auth_error')) {
        const err = params.get('google_auth_error')
        setAuthError(`Ошибка привязки Google: ${err}`)
        setTimeout(() => setAuthError(null), 5000)
        window.history.replaceState({}, '', window.location.pathname)
      }

      // 2. GitHub OAuth Linking
      if (params.get('github_auth_success') === '1') {
        const username = params.get('username')
        if (username) {
          setProfileData(prev => ({ ...prev, githubUsername: username }))
          try { localStorage.setItem('zerf_github_username', username) } catch {}
          setUserGithub(username)
        }
        setAuthSuccess(`✅ GitHub аккаунт @${username || ''} успешно привязан!`)
        setTimeout(() => setAuthSuccess(null), 5000)
        fetchProfile()
        window.history.replaceState({}, '', window.location.pathname)
      } else if (params.get('github_auth_error')) {
        const err = params.get('github_auth_error')
        setAuthError(`Ошибка привязки GitHub: ${err}`)
        setTimeout(() => setAuthError(null), 5000)
        window.history.replaceState({}, '', window.location.pathname)
      } else if (params.get('open_github_modal') === '1') {
        setShowGithubSetupModal(true)
        window.history.replaceState({}, '', window.location.pathname)
      }

      // 3. VK OAuth Linking
      if (params.get('vk_auth_success') === '1') {
        const vkId = params.get('vk_id')
        if (vkId) {
          setProfileData(prev => ({ ...prev, vkId }))
        }
        setAuthSuccess(`✅ ВКонтакте (ID: ${vkId || ''}) успешно привязан!`)
        setTimeout(() => setAuthSuccess(null), 5000)
        fetchProfile()
        window.history.replaceState({}, '', window.location.pathname)
      } else if (params.get('vk_auth_error')) {
        const err = params.get('vk_auth_error')
        setAuthError(`Ошибка привязки VK: ${err}`)
        setTimeout(() => setAuthError(null), 5000)
        window.history.replaceState({}, '', window.location.pathname)
      }

      // 4. Google Calendar 2-Way Sync
      if (params.get('google_calendar_success') === '1') {
        setGcalStatusMsg('✅ Google Календарь успешно подключен и синхронизирован!')
        setProfileData(prev => ({ ...prev, googleCalendarSync: true }))
        setTimeout(() => setGcalStatusMsg(null), 5000)
        window.history.replaceState({}, '', window.location.pathname)
      } else if (params.get('google_calendar_error')) {
        const err = params.get('google_calendar_error')
        setGcalStatusMsg(`❌ Ошибка подключения календаря: ${err}`)
        setTimeout(() => setGcalStatusMsg(null), 5000)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  const handleConnectGoogleCalendar = async () => {
    const currentPlan = normalizePlan(profileData.plan || usage?.plan || state.settings?.userPlan || 'free')
    const isProOrHigher = ['pro', 'corp', 'creator'].includes(currentPlan) || isAdmin

    if (!isProOrHigher && !profileData.googleCalendarSync) {
      alert('🔒 Интеграция с Google Календарём доступна только на тарифах Zerf Pro (299 ₽) и Corp.\n\nОформите подписку Pro во вкладке «Тариф и подписка» ниже!')
      return
    }

    setGcalLoading(true)
    try {
      const res = await fetch('/api/calendar/auth', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.proRequired) {
        alert('🔒 Интеграция с Google Календарём доступна только на тарифах Zerf Pro (299 ₽) и Corp.\n\nОформите подписку Pro во вкладке «Тариф и подписка» ниже!')
      } else {
        alert(data.error || 'Ошибка при получении ссылки авторизации Google Календаря')
      }
    } catch {
      alert('Ошибка соединения с сервером')
    } finally {
      setGcalLoading(false)
    }
  }

  const handleSyncGoogleCalendarNow = async () => {
    setGcalSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setGcalStatusMsg(`Синхронизировано: получено ${data.pulled}, отправлено ${data.pushed} событий`)
        setTimeout(() => setGcalStatusMsg(null), 4000)
      } else {
        alert('Не удалось синхронизировать календарь. Попробуйте переподключить.')
      }
    } catch {
      alert('Ошибка сети')
    } finally {
      setGcalSyncing(false)
    }
  }

  const handleDisconnectGoogleCalendar = async () => {
    const ok = await confirm({
      title: 'Отключение Google Календаря',
      description: 'Вы уверены, что хотите отключить 2-way синхронизацию с Google Календарем?',
      confirmText: 'Отключить',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setProfileData(prev => ({ ...prev, googleCalendarSync: false }))
        setGcalStatusMsg('Google Календарь отключен')
        setTimeout(() => setGcalStatusMsg(null), 3000)
      }
    } catch {}
  }

  const handleUserBirthdayChange = async (val: string) => {
    setUserBirthday(val)
    try { localStorage.setItem('zerf_birthday', val) } catch {}
    await syncPreferenceToServer({ birthday: val })
    setBirthdaySavedStatus(true)
    setTimeout(() => setBirthdaySavedStatus(false), 2500)
    syncData()
  }

  const handleTimezoneChange = async (tz: string) => {
    setUserTimezone(tz)
    try { localStorage.setItem('zerf_timezone', tz) } catch {}
    syncPreferenceToServer({ timezone: tz })
  }

  const handleActivatePromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoInput.trim()) return
    setPromoLoading(true)
    setPromoMsg(null)
    try {
      const res = await fetch('/api/promocode', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoInput.trim(),
          chatId: currentChatId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPromoMsg({ type: 'error', text: data.error || 'Ошибка активации промокода' })
      } else {
        setPromoMsg({ type: 'success', text: data.message })
        setPromoInput('')
        fetchProfile()
        window.dispatchEvent(new CustomEvent('zerf_subscription_updated'))
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

  const openGoogleModal = () => {
    setGoogleInput(profileData.googleEmail || '')
    setAuthError(null)
    setShowGoogleLinkModal(true)
    setShowEmailLinkModal(false)
  }

  const handleUnlinkVk = async () => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ vkId: '' })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка отвязки VK')
      setProfileData(prev => ({ ...prev, vkId: null }))
      setAuthSuccess('ВКонтакте успешно отвязан!')
      setTimeout(() => setAuthSuccess(null), 3000)
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка отвязки VK')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = googleInput.trim().toLowerCase()
    if (!clean || !clean.includes('@')) {
      setAuthError('Введите корректный Google Email')
      return
    }

    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка входа через Google')

      if (data.token) {
        try {
          localStorage.setItem('zerf_auth_token', data.token)
          if (data.chatId) localStorage.setItem('zerf_chat_id', data.chatId)
        } catch {}
      }

      setProfileData(prev => ({
        ...prev,
        googleEmail: clean,
        name: data.firstName || prev.name,
      }))
      setShowGoogleLinkModal(false)
      setAuthSuccess('Google аккаунт успешно подключен!')
      setTimeout(() => setAuthSuccess(null), 3000)
      syncData()
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка привязки Google')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleUnlinkGoogle = async () => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await fetch('/api/telegram/user', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleEmail: '' })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка отвязки Google')
      setProfileData(prev => ({ ...prev, googleEmail: null }))
      setShowGoogleLinkModal(false)
      setAuthSuccess('Google аккаунт успешно отвязан!')
      setTimeout(() => setAuthSuccess(null), 3000)
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка отвязки Google')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleUnlinkGithub = async () => {
    setAuthError(null)
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('zerf_github_username')
      }
      setUserGithub('')
      setProfileData(prev => ({ ...prev, githubUsername: null }))

      try {
        await fetch('/api/telegram/user', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ githubUsername: '' }),
        })
      } catch {}

      setAuthSuccess('✓ GitHub аккаунт успешно отвязан!')
      setTimeout(() => setAuthSuccess(null), 3000)
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка отвязки GitHub')
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

  // Handle JSON Import
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Файл не содержит корректных данных JSON')
        }

        const tasksCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0
        const notesCount = Array.isArray(parsed.notes) ? parsed.notes.length : 0
        const goalsCount = Array.isArray(parsed.goals) ? parsed.goals.length : 0

        const ok = await confirm({
          title: 'Импортировать данные?',
          description: `Найдено: ${tasksCount} задач, ${notesCount} заметок, ${goalsCount} целей. Они будут добавлены в ваше текущее пространство.`,
          confirmText: 'Импортировать',
        })

        if (ok) {
          const mergedTasks = [...(parsed.tasks || []), ...state.tasks.filter(t => !(parsed.tasks || []).some((pt: any) => pt.id === t.id))]
          const mergedNotes = [...(parsed.notes || []), ...state.notes.filter(n => !(parsed.notes || []).some((pn: any) => pn.id === n.id))]
          const mergedGoals = [...(parsed.goals || []), ...state.goals.filter(g => !(parsed.goals || []).some((pg: any) => pg.id === g.id))]
          const mergedProjects = [...(parsed.projects || []), ...state.projects.filter(p => !(parsed.projects || []).some((pp: any) => pp.id === p.id))]
          
          dispatch({
            type: 'LOAD_STATE',
            state: {
              tasks: mergedTasks,
              notes: mergedNotes,
              goals: mergedGoals,
              projects: mergedProjects,
            }
          })

          setImportStatus({
            type: 'success',
            text: `Успешно импортировано: ${tasksCount} задач, ${notesCount} заметок!`
          })
          setTimeout(() => setImportStatus(null), 4000)
        }
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          text: err.message || 'Ошибка при чтении файла резервной копии'
        })
        setTimeout(() => setImportStatus(null), 4000)
      } finally {
        if (importFileRef.current) importFileRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const [searchFilter, setSearchFilter] = useState('')

  const SECTIONS = [
    {
      group: 'АККАУНТ & КОМАНДЫ',
      items: [
        { id: 'account' as SettingsTab, label: 'Профиль & Вход', icon: User, desc: 'Имя, часовой пояс, Email, Telegram, VK' },
        { id: 'subscription' as SettingsTab, label: 'Тарифные планы & Подарки', icon: Sparkles, desc: 'Подписка Free, Plus, Pro, Corp, подарки' },
        { id: 'ai' as SettingsTab, label: 'ИИ & Нейросети', icon: Brain, desc: 'Выбор моделей для задач, чата, перепланирования' },
        { id: 'apikeys' as SettingsTab, label: 'API Ключи & Провайдеры', icon: Key, desc: 'Groq, OpenAI, Anthropic, Gemini, Siri Token, Zerf CLI' },
        { id: 'teams' as SettingsTab, label: 'Команды & Проекты', icon: Users, desc: 'Совместная работа, роли участников, приглашения' },
      ],
    },
    {
      group: 'СВЯЗЬ & ИНТЕГРАЦИИ',
      items: [
        { id: 'integrations' as SettingsTab, label: 'Google Календарь & Интеграции', icon: Calendar, desc: 'Двусторонняя синхронизация с Google Calendar, экспорт и импорт' },
        { id: 'notifications' as SettingsTab, label: 'Уведомления & Каналы', icon: Bell, desc: 'Telegram, VK, Web Push, звуки, повторы' },
        { id: 'focus' as SettingsTab, label: 'Фокус & Таймеры', icon: Timer, desc: 'Pomodoro, перерывы, автоперенос задач' },
        { id: 'automation' as SettingsTab, label: 'Голос & Siri', icon: Zap, desc: 'iOS Shortcuts, быстрые команды, виджеты' },
        { id: 'cli' as SettingsTab, label: '💻 Zerf CLI (Терминал)', icon: Terminal, desc: 'Терминальный ассистент в стиле Claude Code, TUI, Эллей' },
      ],
    },
    {
      group: 'ИНТЕРФЕЙС',
      items: [
        { id: 'appearance' as SettingsTab, label: 'Оформление & Цвета', icon: Palette, desc: 'Светлая/тёмная тема, палитра акцентов' },
        { id: 'sidebar' as SettingsTab, label: 'Меню & Панели', icon: LayoutGrid, desc: 'Скрытие разделов, папки, кастомизация боковой панели' },
        { id: 'extensions' as SettingsTab, label: 'Расширения & GitHub', icon: Puzzle, desc: 'Управление открытыми плагинами и репозиториями' },
        { id: 'pwa' as SettingsTab, label: 'PWA Приложение', icon: Smartphone, desc: 'Установка на экран телефона и рабочий стол ПК' },
      ],
    },
    {
      group: 'СИСТЕМА',
      items: [
        { id: 'data' as SettingsTab, label: 'Резервные копии & Данные', icon: Shield, desc: 'Экспорт в JSON, импорт, сессии устройств' },
      ],
    },
  ]

  const filteredSections = SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(i => 
      !searchFilter || 
      i.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      i.desc.toLowerCase().includes(searchFilter.toLowerCase())
    )
  })).filter(s => s.items.length > 0)

  const activeItem = SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)

  return (
    <div className="settings-view w-full h-full min-h-full flex-1 bg-background flex flex-col md:flex-row font-sans">
      
      {/* ── Left Sidebar Navigation (Desktop Obsidian Style) ── */}
      <div className="hidden md:flex md:w-64 border-r border-border/70 bg-card/40 p-4 flex-col justify-between shrink-0 overflow-y-auto no-scrollbar">
        <div className="space-y-4">
          
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="mono-emoji">⚙️</span>
              <span>Настройки Zerf</span>
            </h1>
            {currentChatId && !currentChatId.startsWith('guest_') && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono">
                {currentChatId}
              </span>
            )}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Поиск по настройкам..."
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-card border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Nav Categories */}
          <div className="space-y-4 pt-1">
            {filteredSections.map(s => (
              <div key={s.group} className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-wider px-2 uppercase">
                  {s.group}
                </p>
                <div className="space-y-0.5">
                  {s.items.map(item => {
                    const isSel = activeTab === item.id
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none text-left',
                          isSel
                            ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={cn('w-3.5 h-3.5 shrink-0', isSel ? 'text-primary-foreground' : 'text-muted-foreground')} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isSel && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Status Info */}
        <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>Синхронизация с БД</span>
          <span className="font-semibold text-emerald-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Активна</span>
          </span>
        </div>
      </div>

      {/* ── Right Content Pane ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
        
        {/* Mobile Horizontal Tabs Selector */}
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-border/60 bg-card/60 backdrop-blur-md shrink-0 [scrollbar-width:none] sticky top-0 z-20">
          {SECTIONS.flatMap(s => s.items).map(item => {
            const isSel = activeTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer select-none touch-manipulation',
                  isSel
                    ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                    : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isSel ? 'text-primary-foreground' : 'text-primary')} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
        
        {/* Desktop Header of the Active Section */}
        <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-border/60 bg-card/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">
                {activeItem?.label || 'Настройки'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {activeItem?.desc || 'Параметры и конфигурация системы'}
              </p>
            </div>
            {settingsSavedBadge && (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in shrink-0">
                <Check className="w-3 h-3" />
                <span>Сохранено</span>
              </span>
            )}
          </div>

          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'today' })}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Закрыть настройки"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-7 pb-36 space-y-4 sm:space-y-6 w-full max-w-5xl mx-auto">

      {/* ── TAB 1: Account & Profile ────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <Section title="Ваш Профиль">
            {/* Avatar / Emoji Selector Row (Telegram-style 1000+ emojis) */}
            <div className="px-4 sm:px-5 py-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-bold flex-wrap">
                    <span className="mono-emoji text-sm">🎭</span>
                    <span className="text-[13px] font-semibold text-foreground">Аватар / Эмодзи профиля</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-mono text-[9px] font-bold">
                      1000+ эмодзи
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed max-w-2xl">
                    Ваш персональный статус и эмодзи, как в Telegram. Отображается в профиле, друзьях, командах и задачах.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center pt-1 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(true)}
                    className="h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 touch-manipulation min-h-[32px]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Каталог (1000+)</span>
                  </button>

                  {avatarSavedStatus && (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0 animate-in fade-in">
                      <Check className="w-3.5 h-3.5" />
                      <span>Сохранено</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Dedicated Avatar & Quick-pick Emoji Strip */}
              <div className="flex items-center gap-3 w-full min-w-0 p-2.5 rounded-2xl bg-muted/40 border border-border/70 overflow-hidden">
                {/* Main Avatar Bubble */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(true)}
                  className="w-11 h-11 rounded-2xl bg-card hover:bg-muted border-2 border-primary/50 hover:border-primary flex items-center justify-center shadow-xs transition-all cursor-pointer hover:scale-105 relative group select-none touch-manipulation shrink-0"
                  title="Нажмите, чтобы открыть каталог из 1000+ эмодзи и аватаров Зерфика"
                >
                  <ZerfAvatar emoji={userAvatarEmoji} size="lg" />
                  <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-primary text-primary-foreground text-[8px] shadow-xs group-hover:scale-110 transition-transform">
                    <Sparkles className="w-2.5 h-2.5" />
                  </span>
                </button>

                <div className="h-6 w-px bg-border/80 shrink-0" />

                {/* Quick Pick Chips (Horizontal Scrollable) */}
                <div
                  className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1 py-1 [scrollbar-width:none]"
                  style={{ msOverflowStyle: 'none' }}
                >
                  {ZERF_CUSTOM_EMOJIS.slice(0, 18).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectAvatarEmoji(item.id)}
                      className={cn(
                        'w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer select-none touch-manipulation shrink-0',
                        'opacity-85 hover:opacity-100',
                        userAvatarEmoji === item.id
                          ? 'bg-primary/25 border-2 border-primary scale-110 shadow-2xs opacity-100'
                          : 'bg-card hover:bg-muted border border-border/70 hover:scale-105'
                      )}
                      title={`${item.name} · ${item.description}`}
                    >
                      <ZerfAvatar emoji={item.id} size="sm" monochrome={userAvatarEmoji !== item.id} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Row label="Имя пользователя" description="Отображается в команде, совместных проектах, задачах и чате">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={e => e.key === 'Enter' && handleNameBlur()}
                  placeholder="Ваше имя и фамилия"
                  className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors w-56 sm:w-64"
                />
                {nameSavedStatus && (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" />
                    <span>Сохранено</span>
                  </span>
                )}
              </div>
            </Row>

            <Row label={<span className="flex items-center gap-1.5"><span className="mono-emoji">🎂</span> День рождения</span>} description="Отобразится в вашем календаре и у ваших взаимных друзей в Zerf">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={userBirthday}
                  onChange={e => handleUserBirthdayChange(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors w-44 cursor-pointer"
                />
                {birthdaySavedStatus && (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" />
                    <span>Сохранено</span>
                  </span>
                )}
              </div>
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

            <Row
              label={<span className="flex items-center gap-1.5"><span className="mono-emoji">⛅</span> Город для погоды</span>}
              description="Используется для точного прогноза погоды в шапке и утренней сводке (по умолчанию Москва)"
            >
              <div className="flex flex-col gap-2 items-end">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userCity}
                    onChange={e => {
                      const val = e.target.value
                      setUserCity(val)
                      try { localStorage.setItem('zerf_city', val) } catch {}
                      if (citySaveTimerRef.current) clearTimeout(citySaveTimerRef.current)
                      citySaveTimerRef.current = setTimeout(() => {
                        syncPreferenceToServer({ city: val })
                        setCitySavedStatus(true)
                        setTimeout(() => setCitySavedStatus(false), 2000)
                      }, 700)
                    }}
                    placeholder="Москва, СПб, Сочи, Алматы..."
                    className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors w-48"
                  />
                  {citySavedStatus && (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0 animate-in fade-in">
                      <Check className="w-3.5 h-3.5" />
                      <span>Сохранено</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                  {['Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск', 'Казань', 'Сочи', 'Краснодар', 'Минск', 'Алматы'].map(city => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setUserCity(city)
                        try { localStorage.setItem('zerf_city', city) } catch {}
                        syncPreferenceToServer({ city })
                        setCitySavedStatus(true)
                        setTimeout(() => setCitySavedStatus(false), 2000)
                      }}
                      className={cn(
                        'px-2 py-0.5 rounded-lg text-[10px] font-medium border transition-colors cursor-pointer',
                        userCity.toLowerCase() === city.toLowerCase()
                          ? 'bg-primary/15 border-primary/40 text-primary font-bold'
                          : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </Row>

            {/* Developer Mode Toggle */}
            <Row
              label={
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="p-1 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30">
                    <Terminal className="w-3.5 h-3.5" />
                  </span>
                  <span>Режим разработчика (Developer Mode)</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-400 font-mono text-[9px] font-bold">
                    SDK v2
                  </span>
                </span>
              }
              description="Создание и публикация расширений, конструктор манифеста, тестирование AI-эндпоинтов и выплаты авторам (80%)"
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={isDeveloperMode}
                  onChange={val => toggleDeveloperMode(val)}
                />
              </div>
            </Row>

            {isDeveloperMode && (
              <div className="p-4 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Режим разработчика активен</span>
                  </p>
                  <p className="text-[11px]">Изучите документацию SDK и создайте свое первое расширение для Zerf Note.</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="/developer?tab=docs"
                    className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>Документация SDK</span>
                  </a>

                  <a
                    href="/developer"
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Developer Hub</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </Section>

          {/* Multi-Provider Linked Accounts Hub */}
          <Section title="Связанные способы входа в этот аккаунт">
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Вы можете привязать <b>Email</b>, <b>Telegram</b>, <b>ВКонтакте</b>, <b>Google</b> и <b>GitHub</b> к этому единому профилю. Вы сможете входить с любого устройства любым удобным способом и выбирать ваши проекты прямо из репозиториев GitHub.
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
                          {profileData.username ? profileData.username : `@Zerph_bot (ID: ${currentChatId && !currentChatId.startsWith('guest_') ? currentChatId : 'не привязан'})`}
                        </p>
                      </div>
                    </div>
                    {currentChatId && !currentChatId.startsWith('guest_') ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                        Подключен
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                        Не привязан
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowPinCodeModal(true); setPinError(null) }}
                      className="flex-1 py-1.5 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 text-[#229ED9] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3 h-3" />
                      <span>{currentChatId && !currentChatId.startsWith('guest_') ? 'Синхронизация (PIN)' : '⚡ Ввести код из бота'}</span>
                    </button>
                    <a
                      href="https://t.me/Zerph_bot?start=login"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center justify-center gap-1 shrink-0"
                      title="Открыть диалог с ботом"
                    >
                      <span>Бот</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </a>
                  </div>
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
                    className="w-full py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>{profileData.email ? 'Сменить Email / Пароль' : 'Привязать Email и Пароль'}</span>
                  </button>
                </div>

                {/* 3. VK Card */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#0077FF]/15 text-[#0077FF] flex items-center justify-center font-bold text-xs">
                        VK
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">ВКонтакте</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {profileData.vkId ? `id${profileData.vkId}` : 'Официальный вход & Сообщество'}
                        </p>
                      </div>
                    </div>
                    {profileData.vkId ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                        Привязан
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border shrink-0">
                        Доступен
                      </span>
                    )}
                  </div>

                  {profileData.vkId ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleDirectVkAuth}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-[#0077FF]/15 hover:bg-[#0077FF]/25 text-[#0077FF] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                        title="Сменить привязанный аккаунт VK через OAuth"
                      >
                        <span>Сменить ID: {profileData.vkId}</span>
                      </button>

                      <a
                        href={`https://vk.com/id${profileData.vkId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center justify-center"
                        title="Открыть VK профиль"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={handleUnlinkVk}
                        className="py-1.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                        title="Отвязать VK"
                      >
                        Отвязать
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDirectVkAuth}
                        className="w-full py-2 px-3 rounded-xl bg-[#0077FF]/15 hover:bg-[#0077FF]/25 text-[#0077FF] border border-[#0077FF]/30 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <span>⚡ Привязать через VK ID</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Google Card */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                        G
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground">Google Аккаунт</p>
                        </div>
                        <p className="text-[11px] text-emerald-400 font-medium truncate mt-0.5">
                          {profileData.googleEmail ? `✓ ${profileData.googleEmail}` : 'Быстрый вход через Google'}
                        </p>
                      </div>
                    </div>
                    {profileData.googleEmail ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Привязан</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border shrink-0">
                        Доступен
                      </span>
                    )}
                  </div>
                  
                  {profileData.googleEmail ? (
                    <div className="flex items-center gap-2">
                      <a
                        href="/api/auth/google"
                        className="flex-1 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                      >
                        <span>⚡ Сменить через OAuth</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleUnlinkGoogle}
                        disabled={authLoading}
                        className="px-3 py-1.5 rounded-xl bg-muted hover:bg-rose-500/15 hover:text-rose-400 text-muted-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
                        title="Отвязать Google"
                      >
                        Отвязать
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <a
                        href="/api/auth/google"
                        className="flex-1 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>⚡ Привязать через Google OAuth</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowGoogleLinkModal(true)}
                        className="py-2 px-2.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-medium border border-border transition-colors cursor-pointer"
                        title="Ввести Google Email вручную"
                      >
                        Вручную
                      </button>
                    </div>
                  )}
                </div>

                {/* 5. GitHub Card */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-muted/80 text-foreground flex items-center justify-center font-bold text-xs border border-border">
                        <GithubIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">GitHub</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {profileData.githubUsername || userGithub ? `@${profileData.githubUsername || userGithub}` : 'Магазин & Авторство'}
                        </p>
                      </div>
                    </div>
                    {profileData.githubUsername || userGithub ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                        Привязан
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border shrink-0">
                        Доступен
                      </span>
                    )}
                  </div>

                  {profileData.githubUsername || userGithub ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleDirectGithubAuth}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary text-foreground text-xs font-bold border border-border transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                        title="Сменить привязанный GitHub аккаунт через OAuth"
                      >
                        <GithubIcon className="w-3.5 h-3.5" />
                        <span>Сменить @{profileData.githubUsername || userGithub}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ type: 'SET_VIEW', view: 'extensions' })
                          window.dispatchEvent(new CustomEvent('zerf_open_extensions_tab', { detail: { tab: 'my' } }))
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Открыть мои проекты и GitHub плагины"
                      >
                        <span>Мои проекты</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>

                      <a
                        href={`https://github.com/${profileData.githubUsername || userGithub}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center justify-center"
                        title="Открыть GitHub профиль"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={handleUnlinkGithub}
                        className="py-1.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                        title="Отвязать GitHub"
                      >
                        Отвязать
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDirectGithubAuth}
                        className="w-full py-2 px-3 rounded-xl bg-foreground/15 hover:bg-foreground/25 text-foreground border border-border text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <GithubIcon className="w-4 h-4" />
                        <span>⚡ Привязать через GitHub OAuth</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 6. YooMoney Author Payouts Card (80/20) */}
                <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold text-xs border border-purple-500/25">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">ЮMoney / Выплаты автору (80/20)</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {userPaymentCard?.cardNumber || userPaymentCard?.phone
                            ? (userPaymentCard.payoutType === 'yoomoney' ? `ЮMoney: ${userPaymentCard.cardNumber}` : userPaymentCard.payoutType === 'sbp' ? `СБП: ${userPaymentCard.phone}` : `Карта: •••• ${userPaymentCard.cardNumber.slice(-4)}`)
                            : '80% с каждой продажи плагинов'}
                        </p>
                      </div>
                    </div>
                    {userPaymentCard?.cardNumber || userPaymentCard?.phone ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                        Привязан
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border shrink-0">
                        Доступен
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowCardForm(!showCardForm)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{userPaymentCard?.cardNumber || userPaymentCard?.phone ? 'Изменить ЮMoney' : 'Привязать ЮMoney (80%)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/developer?tab=earnings'
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Открыть студию разработчика и доходы"
                    >
                      <span>Доходы</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Modal/Form for Telegram PIN Sync */}
              <AnimatePresence>
                {showPinCodeModal && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSyncByPin}
                    className="p-4 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/30 space-y-3 mt-3 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#229ED9] text-white flex items-center justify-center font-bold text-[10px]">
                          <Send className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs font-bold text-foreground">
                          Синхронизация по коду из Telegram бота (@Zerph_bot)
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      1. Откройте бота <a href="https://t.me/Zerph_bot" target="_blank" rel="noreferrer" className="text-[#229ED9] font-bold underline">@Zerph_bot</a> и отправьте команду <code className="px-1 py-0.5 rounded bg-muted font-mono text-primary font-bold">/login</code>.<br />
                      2. Введите полученный 6-значный код ниже, чтобы мгновенно связать это устройство с вашим аккаунтом:
                    </p>

                    <div>
                      <input
                        type="text"
                        required
                        maxLength={7}
                        value={pinCodeInput}
                        onChange={e => setPinCodeInput(e.target.value)}
                        placeholder="123 456"
                        className="w-full h-11 px-3 rounded-xl bg-card border border-border text-sm text-foreground outline-none focus:border-primary font-mono tracking-widest text-center font-bold"
                      />
                    </div>

                    {pinError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                        {pinError}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={pinLoading || !pinCodeInput.trim()}
                        className="px-4 py-2 rounded-xl bg-[#229ED9] text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {pinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Синхронизировать</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPinCodeModal(false)}
                        className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Modal for GitHub OAuth App Setup Instructions */}
              <AnimatePresence>
                {showGithubSetupModal && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 rounded-2xl bg-card border-2 border-primary/40 space-y-3 mt-3 overflow-hidden shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-xs">
                          <GithubIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Настройка GitHub OAuth App (1 минута)
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Для работы официального входа через GitHub необходимо создать OAuth App
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGithubSetupModal(false)}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-2 text-foreground/90">
                      <p className="font-semibold text-primary">Инструкция по созданию приложения:</p>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground">
                        <li>Перейдите в <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer" className="text-primary font-bold underline inline-flex items-center gap-0.5">GitHub Developer Settings <ExternalLink className="w-2.5 h-2.5" /></a></li>
                        <li>Нажмите кнопку <b>«New OAuth App»</b></li>
                        <li>Укажите <b>Application name:</b> <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Zerf Note</code></li>
                        <li>Укажите <b>Homepage URL:</b> <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">{typeof window !== 'undefined' ? window.location.origin : 'https://zeprh.vercel.app'}</code></li>
                        <li>Укажите <b>Authorization callback URL:</b> <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">{typeof window !== 'undefined' ? `${window.location.origin}/api/auth/github/callback` : 'https://zeprh.vercel.app/api/auth/github/callback'}</code></li>
                        <li>Нажмите <b>«Register application»</b>, скопируйте <b>Client ID</b> и сгенерируйте <b>Client Secret</b></li>
                        <li>Добавьте переменные <b>GITHUB_CLIENT_ID</b> и <b>GITHUB_CLIENT_SECRET</b> в Vercel Settings → Environment Variables</li>
                      </ol>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <a
                        href="https://github.com/settings/developers"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Открыть GitHub Developers</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowGithubSetupModal(false)}
                        className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Закрыть
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>





              {/* Inline Modal/Form for Google Linking */}
              <AnimatePresence>
                {showGoogleLinkModal && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleGoogleSubmit}
                    className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/30 space-y-3 mt-3 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-[10px]">
                          G
                        </div>
                        <p className="text-xs font-bold text-foreground">
                          {profileData.googleEmail ? 'Изменение привязки Google' : 'Привязка аккаунта Google'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-muted-foreground font-semibold block">
                        Ваш Google Email адрес:
                      </label>
                      <input
                        type="email"
                        required
                        value={googleInput}
                        onChange={e => setGoogleInput(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-rose-500"
                      />
                    </div>

                    {authError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                        {authError}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={authLoading || !googleInput.trim()}
                        className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {authLoading ? 'Сохранение...' : 'Привязать Google'}
                      </button>
                      <a
                        href="/api/auth/google"
                        className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>⚡ Войти через Google OAuth</span>
                      </a>
                      {profileData.googleEmail && (
                        <button
                          type="button"
                          onClick={handleUnlinkGoogle}
                          disabled={authLoading}
                          className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Отвязать Google
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowGoogleLinkModal(false)}
                        className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

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
                        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer"
                      >
                        {authLoading ? 'Сохранение...' : 'Сохранить и привязать'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmailLinkModal(false)}
                        className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Inline Modal/Form for YooMoney / Payout Card Linking */}
              <AnimatePresence>
                {showCardForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSavePaymentCard}
                    className="p-4 sm:p-5 rounded-2xl bg-purple-500/5 border border-purple-500/30 space-y-4 mt-3 shadow-xs relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold text-[10px]">
                          <CreditCard className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs font-bold text-foreground">
                          Привязка реквизитов для автоматических выплат (80/20)
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        80% автору
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Укажите карту РФ или кошелёк ЮMoney. <b>80% от каждой продажи ваших плагинов начисляются вам автоматически</b> (20% — комиссия платформы). Никаких ручных запросов делать не нужно.
                    </p>

                    {/* Method Selector */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCardFormType('yoomoney')
                          if (!cardFormBank) setCardFormBank('ЮMoney')
                        }}
                        className={cn(
                          'flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center',
                          cardFormType === 'yoomoney'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-xs'
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                        )}
                      >
                        🟣 ЮMoney кошелёк
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCardFormType('card')
                          if (cardFormBank === 'ЮMoney') setCardFormBank('')
                        }}
                        className={cn(
                          'flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center',
                          cardFormType === 'card'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-xs'
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                        )}
                      >
                        💳 Карта РФ
                      </button>
                    </div>

                    {cardFormType === 'yoomoney' ? (
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground font-semibold block">
                          Номер счёта ЮMoney (14–16 цифр: 41001...):
                        </label>
                        <input
                          type="text"
                          required
                          value={cardFormNumber}
                          onChange={e => {
                            const clean = e.target.value.replace(/\D/g, '').slice(0, 16)
                            setCardFormNumber(clean)
                            setCardFormBank('ЮMoney')
                          }}
                          placeholder="4100119573095433"
                          className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground font-mono outline-none focus:border-purple-500"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-muted-foreground font-semibold block">
                            Номер банковской карты РФ:
                          </label>
                          <input
                            type="text"
                            required
                            value={cardFormNumber}
                            onChange={e => {
                              const raw = e.target.value.replace(/\D/g, '').slice(0, 19)
                              const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
                              setCardFormNumber(formatted)

                              // Automatic bank detection by BIN prefix
                              if (raw.startsWith('4100')) {
                                setCardFormBank('ЮMoney')
                                setCardFormType('yoomoney')
                              } else if (['2200', '2204', '5213', '5489', '4377', '5536'].some(p => raw.startsWith(p))) {
                                setCardFormBank('Т-Банк')
                              } else if (['2202', '4276', '5469', '4279', '6390', '6761', '6762'].some(p => raw.startsWith(p))) {
                                setCardFormBank('Сбербанк')
                              } else if (['5486', '4154', '4790', '5211', '4584'].some(p => raw.startsWith(p))) {
                                setCardFormBank('Альфа-Банк')
                              } else if (['4272', '5337', '4173', '5230'].some(p => raw.startsWith(p))) {
                                setCardFormBank('ВТБ')
                              } else if (['5599', '4084', '22007'].some(p => raw.startsWith(p))) {
                                setCardFormBank('Ozon Банк')
                              } else if (['5106', '4622'].some(p => raw.startsWith(p))) {
                                setCardFormBank('Яндекс Банк')
                              } else if (['5228', '4003', '4627'].some(p => raw.startsWith(p))) {
                                setCardFormBank('Райффайзен')
                              } else if (['5200', '4890', '5487'].some(p => raw.startsWith(p))) {
                                setCardFormBank('Газпромбанк')
                              }
                            }}
                            placeholder="2200 0000 0000 0000"
                            className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground font-mono outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="space-y-1 relative">
                          <label className="text-[11px] text-muted-foreground font-semibold block">
                            Банк карты:
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowBankDropdown2(!showBankDropdown2)}
                              className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground flex items-center justify-between gap-1.5 hover:border-purple-500 transition-colors cursor-pointer"
                            >
                              <span className="truncate font-medium flex items-center gap-1.5">
                                <span>{POPULAR_BANKS_LIST.find(b => b.name === cardFormBank)?.icon || '💳'}</span>
                                <span>{cardFormBank || 'Выбрать банк...'}</span>
                              </span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", showBankDropdown2 && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                              {showBankDropdown2 && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                  className="absolute left-0 right-0 top-full mt-1.5 p-1.5 rounded-2xl bg-card/98 backdrop-blur-2xl border border-border shadow-2xl z-[100] space-y-0.5 max-h-56 overflow-y-auto"
                                >
                                  {POPULAR_BANKS_LIST.map(b => (
                                    <button
                                      key={b.name}
                                      type="button"
                                      onClick={() => {
                                        setCardFormBank(b.name)
                                        setShowBankDropdown2(false)
                                        if (b.name === 'ЮMoney') setCardFormType('yoomoney')
                                      }}
                                      className={cn(
                                        "w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer",
                                        cardFormBank === b.name
                                          ? "bg-purple-500/20 text-purple-300 font-bold"
                                          : "text-foreground hover:bg-muted/70"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">{b.icon}</span>
                                        <span>{b.name}</span>
                                      </div>
                                      <span className="text-[9px] text-muted-foreground font-mono">{b.badge}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={autoRenewLoading}
                        className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {autoRenewLoading
                          ? 'Сохранение...'
                          : cardFormType === 'yoomoney'
                          ? 'Сохранить ЮMoney кошелёк'
                          : 'Привязать карту РФ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCardForm(false)
                          setShowBankDropdown2(false)
                        }}
                        className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors cursor-pointer"
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
                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  Выйти из этого аккаунта
                </button>
              </div>
            </div>
          </Section>

          {/* ── GOOGLE CALENDAR 2-WAY SYNC SECTION ── */}
          <Section title="Google Календарь и Двусторонняя Синхронизация">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg shrink-0">
                  📅
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-foreground">Google Календарь</h4>
                    {profileData.googleCalendarSync ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Подключен (Синхронизация 2-way)
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-bold">
                          Не подключен
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                          Тариф Pro / Corp
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Двусторонний обмен событиями: ваши задачи со сроками экспортируются в Google Календарь, а события из Google автоматически импортируются в Zerf Note с тегом #календарь.
                  </p>
                  {gcalStatusMsg && (
                    <p className="text-xs text-primary font-medium mt-1 animate-pulse">
                      {gcalStatusMsg}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                {profileData.googleCalendarSync ? (
                  <>
                    <button
                      onClick={handleSyncGoogleCalendarNow}
                      disabled={gcalSyncing}
                      className="px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Запустить синхронизацию событий прямо сейчас"
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', gcalSyncing ? 'animate-spin' : '')} />
                      <span>{gcalSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
                    </button>
                    <button
                      onClick={handleDisconnectGoogleCalendar}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/20 transition-all cursor-pointer"
                      title="Отключить Google Календарь"
                    >
                      Отключить
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleConnectGoogleCalendar}
                    disabled={gcalLoading}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{gcalLoading ? 'Подключение...' : 'Подключить Google Календарь'}</span>
                  </button>
                )}
              </div>
            </div>
          </Section>

          {currentChatId && !currentChatId.startsWith('guest_') && (
            <Section title="Безопасность и активные сессии">
              <SessionsPanel />
            </Section>
          )}

          <Section title="Приватность и автоудаление аккаунта">
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-foreground">Удаление аккаунта при неактивности</h4>
                    {autoDeleteSaving ? (
                      <span className="text-[11px] text-primary flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Сохранение...
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        Синхронизировано
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Если вы не заходите в Zerf Note в течение выбранного срока, ваш аккаунт и все связанные с ним данные (задачи, заметки, цели, привычки, файлы) будут автоматически и полностью удалены из облачной базы данных.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {[
                  { value: 1, label: '1 месяц', desc: '30 дней' },
                  { value: 3, label: '3 месяца', desc: '90 дней' },
                  { value: 6, label: '6 месяцев', desc: 'Полгода (Стандарт)' },
                  { value: 12, label: '12 месяцев', desc: '1 год' },
                  { value: 0, label: 'Никогда', desc: 'Бессрочно' },
                ].map(opt => {
                  const isSelected = (profileData.autoDeleteMonths ?? settings.autoDeleteMonths ?? 6) === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAutoDeleteChange(opt.value)}
                      className={cn(
                        'p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
                        isSelected
                          ? 'bg-primary/10 border-primary text-foreground shadow-sm shadow-primary/10'
                          : 'bg-muted/40 hover:bg-muted/70 border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn('text-xs font-bold', isSelected ? 'text-primary' : 'text-foreground')}>
                          {opt.label}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {opt.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB: Google Calendar & Integrations ────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Hero Integration Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/15 via-cyan-500/10 to-primary/5 border border-blue-500/30 p-6 sm:p-8 backdrop-blur-md shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Google Календарь</h2>
                    {profileData.googleCalendarSync ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Синхронизация активна
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium border border-border">
                          Не подключен
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold">
                          Тариф Pro / Corp
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                    Двусторонняя (2-Way) интеграция: задачи с дедлайнами из Zerf Note мгновенно появляются в Google Календаре, а ваши встречи и дела из Google импортируются в виде задач.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {profileData.googleCalendarSync ? (
                  <>
                    <button
                      onClick={handleSyncGoogleCalendarNow}
                      disabled={gcalSyncing}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={cn('w-4 h-4', gcalSyncing && 'animate-spin')} />
                      <span>{gcalSyncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}</span>
                    </button>
                    <button
                      onClick={handleDisconnectGoogleCalendar}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-semibold transition-all cursor-pointer"
                      title="Отключить Google Календарь"
                    >
                      Отключить
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleConnectGoogleCalendar}
                    disabled={gcalLoading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{gcalLoading ? 'Подключение...' : 'Подключить Google Календарь'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status notification toast inside card */}
            {gcalStatusMsg && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{gcalStatusMsg}</span>
              </motion.div>
            )}
          </div>

          {/* 3 Pillars of 2-Way Sync */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-blue-500 font-bold text-xs">
                <span>📤 Экспорт задач</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Каждая задача с датой и временем автоматически создаёт событие в Google Календаре с напоминанием.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-cyan-500 font-bold text-xs">
                <span>📥 Импорт событий</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Встречи и мероприятия из вашего календаря попадают в Zerf Note с тегом <code className="text-[11px] text-primary">#календарь</code>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                <span>⚡ Фоновый обмен</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Сервер автоматически поддерживает актуальность расписания каждые несколько минут без вашего участия.
              </p>
            </div>
          </div>

          {/* Comprehensive Step-by-Step Instructions */}
          <Section title="Подробная инструкция по подключению и настройке">
            <div className="p-5 space-y-6 text-xs text-foreground">
              {/* Section 1: User Guide */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">1</span>
                  Как подключить свой Google Календарь (Пошагово):
                </h4>
                <ol className="space-y-2.5 pl-2 text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-foreground shrink-0">1.</span>
                    <span>Нажмите кнопку <strong className="text-foreground">«Подключить Google Календарь»</strong> в блоке выше.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-foreground shrink-0">2.</span>
                    <span>Откроется стандартное безопасное окно авторизации Google OAuth 2.0. Выберите ваш аккаунт <code className="text-primary font-mono text-[11px]">@gmail.com</code>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-foreground shrink-0">3.</span>
                    <span>Нажмите <strong className="text-foreground">«Продолжить»</strong> и разрешите приложению доступ к календарю (чтение и добавление событий).</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-bold text-foreground shrink-0">4.</span>
                    <span>Браузер вернется обратно в Zerf Note с уведомлением об успешном подключении. Все события немедленно синхронизируются в обе стороны!</span>
                  </li>
                </ol>
              </div>

              {/* Section 2: How 2-Way Sync Works */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center text-xs font-bold">2</span>
                  Правила двустороннего обмена (2-Way Sync):
                </h4>
                <ul className="space-y-2 pl-2 text-muted-foreground list-disc list-inside">
                  <li>События синхронизируются на <strong className="text-foreground">7 дней назад</strong> и на <strong className="text-foreground">60 дней вперёд</strong>.</li>
                  <li>При создании задачи с дедлайном (например, «Встреча с клиентом завтра в 14:00») событие появится в календаре телефона и ПК.</li>
                  <li>При изменении времени в Google Календаре задача в Zerf Note автоматически обновит свой срок.</li>
                  <li>При удалении или отметке «Выполнено» синхронизация сохраняет целостность вашей истории.</li>
                </ul>
              </div>

              {/* Section 3: Developer / Google Cloud setup */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center text-xs font-bold">3</span>
                  Для разработчиков: Настройка Google Cloud Console (OAuth 2.0):
                </h4>
                <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-muted-foreground font-mono text-[11px]">
                  <p className="text-foreground font-sans font-semibold text-xs">
                    Если вы разворачиваете собственный сервер Zerf Note:
                  </p>
                  <p>1. Перейдите в <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a> и создайте проект.</p>
                  <p>2. Включите API: <strong>Google Calendar API</strong>.</p>
                  <p>3. В разделе <strong>Credentials</strong> создайте <strong>OAuth 2.0 Client ID</strong> (Web application).</p>
                  <p>4. В <strong>Authorized redirect URIs</strong> укажите:</p>
                  <div className="p-2 rounded bg-background border border-border text-primary select-all">
                    https://zerph.vercel.app/api/calendar/token
                  </div>
                  <p>5. Добавьте в <code className="text-foreground">.env</code> или переменные Vercel:</p>
                  <pre className="p-2.5 rounded bg-background border border-border text-emerald-500 text-[10px] overflow-x-auto">
GOOGLE_CLIENT_ID=ваш_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=ваш_client_secret
GOOGLE_REDIRECT_URI=https://zerph.vercel.app/api/calendar/token
                  </pre>
                </div>
              </div>
            </div>
          </Section>
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
                    if (nextVal) {
                      await requestNotificationPermission()
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
              description="Всплывающие карточки напоминаний и звуковой сигнал на телефон и ПК"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await sendTestNotification()
                    if (!res.success) {
                      alert(res.message)
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  🔔 Тест пуша на телефон и ПК
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
                    if (v) {
                      await requestNotificationPermission()
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
              label="Голосовые ответы бота в Telegram (TTS)"
              description="Бот будет озвучивать свои ответы и сводки голосовыми сообщениями"
            >
              <Toggle
                checked={settings.voiceSettings?.ttsResponseEnabled ?? profileData.ttsEnabled ?? false}
                onChange={v => {
                  update({
                    voiceSettings: {
                      ...settings.voiceSettings,
                      ttsResponseEnabled: v
                    }
                  })
                  setProfileData(p => ({ ...p, ttsEnabled: v }))
                  syncPreferenceToServer({ ttsEnabled: v })
                }}
              />
            </Row>

            <Row
              label="Интервал повторов напоминаний"
              description="С каким интервалом бот присылает повторные напоминания, если задача не закрыта"
            >
              <select
                value={settings.notifications.reminderIntervalMinutes || profileData.reminderIntervalMinutes || 5}
                onChange={e => {
                  const val = Number(e.target.value)
                  update({
                    notifications: {
                      ...settings.notifications,
                      reminderIntervalMinutes: val
                    }
                  })
                  setProfileData(p => ({ ...p, reminderIntervalMinutes: val }))
                  syncPreferenceToServer({ reminderIntervalMinutes: val })
                }}
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
                value={settings.notifications.reminderRepeatCount || profileData.reminderRepeatCount || 3}
                onChange={e => {
                  const val = Number(e.target.value)
                  update({
                    notifications: {
                      ...settings.notifications,
                      reminderRepeatCount: val
                    }
                  })
                  setProfileData(p => ({ ...p, reminderRepeatCount: val }))
                  syncPreferenceToServer({ reminderRepeatCount: val })
                }}
                className="text-xs bg-muted/50 rounded-xl px-3 py-1.5 border border-border outline-none cursor-pointer text-foreground"
              >
                <option value={1}>1 раз (Только в срок)</option>
                <option value={2}>2 раза (Заранее и в срок)</option>
                <option value={3}>3 раза (Рекомендуется)</option>
                <option value={5}>5 раз (Настойчиво)</option>
              </select>
            </Row>

            <Row
              label="Вечерний отчет и итоги дня"
              description="Присылать список выполненных и оставшихся задач в конце рабочего дня"
            >
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={settings.eveningReview?.time || '21:00'}
                  onChange={e => update({
                    eveningReview: {
                      enabled: settings.eveningReview?.enabled ?? true,
                      time: e.target.value
                    }
                  })}
                  className="h-8 px-2.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground outline-none cursor-pointer"
                />
                <Toggle
                  checked={settings.eveningReview?.enabled ?? true}
                  onChange={v => update({
                    eveningReview: {
                      time: settings.eveningReview?.time || '21:00',
                      enabled: v
                    }
                  })}
                />
              </div>
            </Row>
          </Section>
        </div>
      )}

      {/* ── TAB 3: Focus & Pomodoro ─────────────────────────────────────────── */}
      {activeTab === 'focus' && (
        <div className="space-y-6">
          <Section title="Тайм-менеджмент и Pomodoro">
            <Row
              label="Режим глубокого фокуса"
              description="Включает специальный таймер концентрации внимания в карточках задач и на часах"
            >
              <Toggle
                checked={settings.focusModeEnabled ?? true}
                onChange={v => update({ focusModeEnabled: v })}
              />
            </Row>

            <Row
              label="Длительность рабочего фокуса"
              description="Рекомендуемое время непрерывной работы над одной задачей без отвлечений"
            >
              <select
                value={settings.focusSettings?.defaultDurationMinutes || 25}
                onChange={e => update({
                  focusSettings: {
                    defaultDurationMinutes: Number(e.target.value),
                    breakDurationMinutes: settings.focusSettings?.breakDurationMinutes || 5
                  }
                })}
                className="text-xs bg-muted/50 rounded-xl px-3 py-1.5 border border-border outline-none cursor-pointer text-foreground"
              >
                <option value={15}>15 минут (Быстрый спринт)</option>
                <option value={20}>20 минут</option>
                <option value={25}>25 минут (Классический Pomodoro)</option>
                <option value={30}>30 минут</option>
                <option value={45}>45 минут (Учебная пара / Урок)</option>
                <option value={50}>50 минут (Глубокое погружение)</option>
                <option value={60}>60 минут (1 час)</option>
              </select>
            </Row>

            <Row
              label="Длительность короткого перерыва"
              description="Время отдыха между интервалами концентрации"
            >
              <select
                value={settings.focusSettings?.breakDurationMinutes || 5}
                onChange={e => update({
                  focusSettings: {
                    defaultDurationMinutes: settings.focusSettings?.defaultDurationMinutes || 25,
                    breakDurationMinutes: Number(e.target.value)
                  }
                })}
                className="text-xs bg-muted/50 rounded-xl px-3 py-1.5 border border-border outline-none cursor-pointer text-foreground"
              >
                <option value={3}>3 минуты</option>
                <option value={5}>5 минут (Рекомендуется)</option>
                <option value={10}>10 минут</option>
                <option value={15}>15 минут</option>
              </select>
            </Row>
          </Section>
        </div>
      )}

      {/* ── TAB 4: Voice Automation (iOS & Android) ──────────────────────────── */}
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
              className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border shrink-0 transition-colors cursor-pointer"
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
                  href="https://www.icloud.com/shortcuts/c5edc77388d54ba29a8c09086404fe68"
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

      {/* ── TAB: Zerf CLI (Terminal Assistant) ───────────────────────── */}
      {activeTab === 'cli' && (() => {
        const currentPlan = normalizePlan(profileData.plan || usage?.plan || state.settings?.userPlan || 'free')
        const hasCliAccess = currentPlan === 'plus' || currentPlan === 'pro' || currentPlan === 'corp'

        if (!hasCliAccess) {
          return (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Доступ к Zerf CLI заблокирован</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Терминальный ассистент Zerf CLI с автономным ИИ, интерактивным дашбордом и синхронизацией задач доступен на тарифах <b>Plus</b>, <b>Pro</b> и <b>Corp</b>.
                  </p>
                </div>
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab('subscription')}
                    className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Crown className="w-4 h-4" /> Перейти к тарифам (от 99 ₽/мес)
                  </button>
                </div>
              </div>
            </div>
          )
        }

        return (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-900/90 to-sky-950/40 border border-sky-500/30 shadow-xl relative overflow-hidden space-y-4">
              <div className="absolute -right-12 -top-12 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">Zerf CLI — Терминальный ассистент</h3>
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold uppercase border border-sky-500/30">
                        Claude Code Style
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Интерактивный TUI на React Ink, живой маскот Зерфик, ИИ-генератор расширений и сфера фокуса
                    </p>
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 w-fit">
                  <CheckCircle2 className="w-4 h-4" /> Доступ активен ({currentPlan.toUpperCase()})
                </div>
              </div>
            </div>

            {/* OS Selector Tabs */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/40 border border-border w-fit">
              <button
                type="button"
                onClick={() => setCliOs('windows')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                  cliOs === 'windows' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>🪟</span> Windows (PowerShell)
              </button>
              <button
                type="button"
                onClick={() => setCliOs('mac')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                  cliOs === 'mac' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>🍎</span> macOS (Terminal)
              </button>
              <button
                type="button"
                onClick={() => setCliOs('linux')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                  cliOs === 'linux' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>🐧</span> Linux (Bash / Zsh)
              </button>
            </div>

            {/* Quick Install & Run Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Installation */}
              <div className="p-5 rounded-2xl bg-card border border-border space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>📦</span> Инструкция по установке ({cliOs === 'windows' ? 'Windows' : cliOs === 'mac' ? 'macOS' : 'Linux'})
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">Node.js 18+</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Выполните команду в вашем терминале для глобальной установки:
                  </p>
                  
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-muted/80 border border-border flex items-center justify-between font-mono text-xs text-sky-400">
                      <code>npm install -g zerf</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText('npm install -g zerf')}
                        title="Копировать"
                        className="p-1 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/80 border border-border flex items-center justify-between font-mono text-xs text-indigo-400">
                      <code>npx zerf@latest</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText('npx zerf@latest')}
                        title="Копировать"
                        className="p-1 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {cliOs === 'windows' ? (
                      <div className="p-2.5 rounded-xl bg-muted/80 border border-border flex items-center justify-between font-mono text-xs text-emerald-400">
                        <code>iwr -useb {originUrl}/install.ps1 | iex</code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`iwr -useb ${originUrl}/install.ps1 | iex`)}
                          title="Копировать"
                          className="p-1 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-muted/80 border border-border flex items-center justify-between font-mono text-xs text-emerald-400">
                        <code>curl -fsSL {originUrl}/install.sh | bash</code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`curl -fsSL ${originUrl}/install.sh | bash`)}
                          title="Копировать"
                          className="p-1 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground border-t border-border/60 pt-2.5">
                  💡 Рекомендуем использовать Windows Terminal, iTerm2 или Alacritty для корректного отображения цветов и Unicode-символов.
                </div>
              </div>

              {/* 2. Login & Pairing */}
              <div className="p-5 rounded-2xl bg-card border border-border space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>🔑</span> Обязательная авторизация (/login)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      1-Click Device Flow
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    При первом запуске обязательна авторизация. Без неё доступ к нейросети и базе закрыт:
                  </p>

                  <div className="p-2.5 rounded-xl bg-muted/80 border border-border flex items-center justify-between font-mono text-xs text-emerald-400">
                    <code>zerf login</code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText('zerf login')}
                      title="Копировать"
                      className="p-1 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <ol className="text-[11px] text-muted-foreground space-y-1.5 list-decimal list-inside pl-0.5">
                    <li>Выполните <code>zerf login</code> в консоли.</li>
                    <li>В браузере откроется окно подтверждения устройства.</li>
                    <li>Нажмите <b>«Подтвердить»</b> — токен запишется локально на 365 дней.</li>
                    <li>Запустите <code>zerf</code> для перехода в интерактивный дашборд.</li>
                  </ol>
                </div>

                <div className="text-[11px] text-muted-foreground border-t border-border/60 pt-2.5">
                  Если подписка истекает, доступ к терминалу автоматически блокируется до продления.
                </div>
              </div>
            </div>

            {/* Commands Reference Table */}
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>⚡</span> Шпаргалка по командам Zerf CLI
              </h4>

              <div className="divide-y divide-border text-xs">
                <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <code className="text-sky-400 font-mono font-bold">/menu</code>
                  <span className="text-muted-foreground">Интерактивное меню со всеми разделами (навигация стрелками ↑/↓)</span>
                </div>
                <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <code className="text-sky-400 font-mono font-bold">/today</code>
                  <span className="text-muted-foreground">Задачи и привычки на сегодня с живым таймером и шкалой выполнения</span>
                </div>
                <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <code className="text-sky-400 font-mono font-bold">/cal</code>
                  <span className="text-muted-foreground">Календарь на 7 дней с расписанием задач по каждому дню</span>
                </div>
                <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <code className="text-sky-400 font-mono font-bold">/focus 25</code>
                  <span className="text-muted-foreground">Сфера концентрации Pomodoro (пресеты: 5, 10, 15, 20, 25, 45 мин)</span>
                </div>
                <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <code className="text-sky-400 font-mono font-bold">/chat @username</code>
                  <span className="text-muted-foreground">Командный чат, отправка сообщений и поручений коллегам и друзьям</span>
                </div>
                <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <code className="text-sky-400 font-mono font-bold">/model</code>
                  <span className="text-muted-foreground">Выбор нейросетей (GPT-OSS, Compound, Llama) или локальных CLI (claude, agy)</span>
                </div>
                <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <code className="text-sky-400 font-mono font-bold">/limits</code>
                  <span className="text-muted-foreground">Статус дневных лимитов и квот на текущие сутки</span>
                </div>
              </div>
            </div>

            {/* Allay Mascot Showcase */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-sky-500/10 via-primary/5 to-transparent border border-sky-500/30 flex flex-col sm:flex-row items-center gap-5 backdrop-blur-sm shadow-sm">
              <div className="shrink-0 flex items-center justify-center p-2 rounded-2xl bg-card/70 border border-sky-500/20 shadow-inner">
                <ZerfikMascot size="sm" showSpeechBubble={false} />
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                <h5 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                  <span>Знакомьтесь: Зерфик (Zerf Spirit Mascot)</span>
                </h5>
                <p>
                  Ваш персональный цифровой дух-помощник в терминале и в приложении. Он следит за вашим фокусом, плавно реагирует на движение курсора мыши, потягивается и взмахивает крылышками, помогает держать концентрацию и напоминает о дедлайнах.
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── TAB 5: Appearance & Language ─────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <Section title="Тема оформления">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-[13px] font-medium text-foreground">Цветовая тема оформления</div>
                  <p className="text-[12px] text-muted-foreground">Пресеты и кастомные стили — меняется весь интерфейс целиком</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowThemesModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Библиотека тем (8+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowThemesModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors touch-manipulation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Своя тема</span>
                  </button>
                </div>
              </div>

              {/* 2 Preview Themes initially */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {THEME_PRESETS.slice(0, 2).map(preset => {
                  const active = normalizeTheme(settings.theme) === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        const accentStillValid =
                          settings.accentColor !== 'default' &&
                          accentPaletteFor(preset.id).some(a => a.id === settings.accentColor)
                        update({ theme: preset.id, ...(accentStillValid ? {} : { accentColor: 'default' }) })
                      }}
                      className={cn(
                        'group text-left rounded-2xl border p-3 transition-all cursor-pointer touch-manipulation relative',
                        active
                          ? 'border-primary ring-2 ring-primary/30 bg-card shadow-xs'
                          : 'border-border hover:border-foreground/25 bg-card/50'
                      )}
                    >
                      {/* mini preview */}
                      <div
                        className="h-14 rounded-xl border border-border/40 mb-2.5 relative overflow-hidden flex flex-col justify-center gap-1.5 px-3"
                        style={{ background: preset.preview.bg }}
                      >
                        <div className="h-2 w-4/5 rounded-sm" style={{ background: preset.preview.surface }} />
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: preset.preview.accent }} />
                          <div className="h-2 w-1/2 rounded-sm" style={{ background: preset.preview.surface }} />
                        </div>
                        {active && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md" style={{ background: preset.preview.accent }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn('text-xs font-bold', active ? 'text-primary' : 'text-foreground')}>{preset.label}</span>
                        {active && <span className="text-[10px] font-bold text-primary font-mono">Активна</span>}
                      </div>
                      <div className="text-[11px] leading-snug text-muted-foreground mt-0.5 line-clamp-1">{preset.tagline}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="text-[13px] font-medium text-foreground mb-1">Цветовой акцент</div>
              <p className="text-[12px] text-muted-foreground mb-3">Оттенок кнопок, бейджей и выделений — только проверенные цвета, читаемость гарантирована</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => update({ accentColor: 'default' })}
                  className={cn(
                    'h-8 px-3 rounded-full border-2 flex items-center gap-1.5 text-[11px] font-semibold transition-all cursor-pointer',
                    settings.accentColor === 'default' ? 'border-foreground scale-105' : 'border-border opacity-75 hover:opacity-100'
                  )}
                  title="Собственный акцент темы"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20"
                    style={{ background: THEME_PRESETS.find(t => t.id === normalizeTheme(settings.theme))?.preview.accent }}
                  />
                  Стандартный
                </button>
                {accentPaletteFor(normalizeTheme(settings.theme)).map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => update({ accentColor: acc.id })}
                    className={cn(
                      'w-7 h-7 rounded-full transition-transform cursor-pointer border-2 flex items-center justify-center',
                      settings.accentColor === acc.id ? 'scale-110 border-foreground' : 'border-transparent opacity-80 hover:opacity-100'
                    )}
                    style={{ backgroundColor: acc.color }}
                    title={acc.label}
                  >
                    {settings.accentColor === acc.id && <Check className="w-3.5 h-3.5" style={{ color: acc.fg }} />}
                  </button>
                ))}
              </div>
            </div>

            <Row label="Размер текста" description="От чуть мельче до крупного — шаги ограничены, вёрстка не поедет">
              <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border items-end">
                {TEXT_STEPS.map((s, i) => (
                  <button
                    key={s.value}
                    onClick={() => update({ textScale: s.value })}
                    className={cn(
                      'rounded-lg transition-all cursor-pointer font-bold',
                      (settings.textScale ?? 0) === s.value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                    style={{ fontSize: 11 + i * 1.5, padding: '4px 10px' }}
                    title={['Мелкий', 'Обычный', 'Крупнее', 'Большой', 'Очень большой'][i]}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Плотность интерфейса" description="Насколько просторные отступы между элементами">
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
                {DENSITY_MODES.map(d => (
                  <button
                    key={d.id}
                    onClick={() => update({ density: d.id })}
                    title={d.hint}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      (settings.density ?? 'default') === d.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Скругления" description="Форма карточек, кнопок и полей">
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
                {RADIUS_MODES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => update({ borderRadius: r.id })}
                    title={r.hint}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      (settings.borderRadius ?? 'default') === r.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Круглые элементы" description="Аватары, чипы и переключатели: круг или сглаженный квадрат">
              <Toggle
                checked={settings.roundShapes !== false}
                onChange={v => update({ roundShapes: v })}
              />
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

          {/* Section: Custom Theme Extensions & GitHub Themes */}
          <Section title="Расширения тем оформления и GitHub стили">
            <div className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3.5">
                <div>
                  <div className="text-[13px] font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Темы оформления сообщества и GitHub</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Кастомные CSS стили, анимации свечения, палитры и переопределения интерфейса
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowThemesModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Создать тему</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const extTheme = {
                        name: `zerf-theme-${settings.accentColor || 'custom'}`,
                        title: `Моя тема Zerf (${settings.theme})`,
                        version: '1.0.0',
                        description: 'Пользовательская тема оформления Zerf Note для GitHub',
                        author: name || 'zerf-creator',
                        githubUrl: 'https://github.com/username/zerf-theme-name',
                        type: 'theme',
                        category: 'Темы & Стили',
                        icon: '🌌',
                        preview: {
                          bg: '#09090b',
                          surface: '#18181b',
                          accent: settings.accentColor ? '#10b981' : '#fafafa'
                        },
                        themeConfig: {
                          theme: settings.theme,
                          accentColor: settings.accentColor,
                          density: settings.density,
                          borderRadius: settings.borderRadius,
                          roundShapes: settings.roundShapes !== false,
                          customCss: settings.customCss || '',
                        }
                      }
                      navigator.clipboard.writeText(JSON.stringify(extTheme, null, 2))
                      alert('✓ Манифест zerf-theme.json скопирован в буфер обмена! Вы можете создать репозиторий на GitHub и загрузить его.')
                    }}
                    className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Экспорт в GitHub</span>
                  </button>
                </div>
              </div>

              {/* Grid of Community Themes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  {
                    id: 'ext_theme_cyberpunk',
                    title: 'Cyberpunk Neon Emerald',
                    icon: '🌌',
                    author: 'waters1ze',
                    githubUrl: 'https://github.com/waters1ze/zerf-theme-cyberpunk',
                    description: 'Изумрудный строгий неон для максимальной концентрации в темноте: мягкое свечение и анимация фокуса.',
                    preview: { bg: '#09090b', surface: '#14171f', accent: '#10b981' },
                    theme: 'strict',
                    accentColor: 'emerald',
                    density: 'compact',
                    borderRadius: 'rounded',
                    likesCount: 0,
                    customCss: '@keyframes pulse-emerald-glow { 0%, 100% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.25); } 50% { box-shadow: 0 0 25px rgba(16, 185, 129, 0.45); } } .theme-strict .bg-primary { box-shadow: 0 0 12px rgba(16, 185, 129, 0.35); }',
                  },
                  {
                    id: 'ext_theme_royal_gold',
                    title: 'Royal Gold Luxe',
                    icon: '👑',
                    author: 'waters1ze',
                    githubUrl: 'https://github.com/waters1ze/zerf-theme-royal-gold',
                    description: 'Тёплый бархатный чёрный с элементами шампанского золота, градиентами роскоши и плавными переходами.',
                    preview: { bg: '#12100e', surface: '#1c1917', accent: '#eab308' },
                    theme: 'warm',
                    accentColor: 'gold',
                    density: 'comfortable',
                    borderRadius: 'default',
                    likesCount: 0,
                    customCss: '.theme-warm .bg-primary { background-image: linear-gradient(135deg, #eab308 0%, #fde047 50%, #ca8a04 100%) !important; }',
                  },
                  {
                    id: 'ext_theme_tokyo_night',
                    title: 'Tokyo Nightfall Neon',
                    icon: '🗼',
                    author: 'waters1ze',
                    githubUrl: 'https://github.com/waters1ze/zerf-theme-tokyo-night',
                    description: 'Глубокий ночной Токио: неоновый фиолетовый и индиго с мягким свечением и чистой типографикой.',
                    preview: { bg: '#0b0b14', surface: '#141424', accent: '#a855f7' },
                    theme: 'vivid',
                    accentColor: 'violet',
                    density: 'default',
                    borderRadius: 'rounded',
                    likesCount: 0,
                    customCss: '.theme-vivid .bg-card { backdrop-filter: blur(12px); }',
                  },
                ].map(item => {
                  const isLiked = likedThemeIds.has(item.id)
                  const currentLikes = (item.likesCount || 0) + (isLiked ? 1 : 0)
                  const isActive = settings.theme === item.theme && (settings.accentColor === item.accentColor || !settings.accentColor)

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 bg-card shadow-2xs group',
                        isActive
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/40 hover:shadow-md'
                      )}
                    >
                      <div className="space-y-2.5">
                        {/* Mini Visual Preview Swatch */}
                        <div
                          className="h-14 rounded-xl border border-border/40 p-2.5 relative overflow-hidden flex flex-col justify-center gap-1.5 shadow-inner"
                          style={{ background: item.preview.bg }}
                        >
                          <div className="h-2 w-3/4 rounded-sm" style={{ background: item.preview.surface }} />
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.preview.accent }} />
                            <div className="h-2 w-1/2 rounded-sm" style={{ background: item.preview.surface }} />
                          </div>
                          {isActive && (
                            <span
                              className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-bold text-white shadow-xs flex items-center gap-1"
                              style={{ background: item.preview.accent }}
                            >
                              <Check className="w-2.5 h-2.5" /> Активна
                            </span>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5 truncate">
                            <span className="text-base">{item.icon}</span>
                            <span className="truncate">{item.title}</span>
                          </h4>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 font-mono shrink-0">
                            GitHub
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLikeTheme(item.id)}
                            className={cn(
                              'px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer',
                              isLiked
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border'
                            )}
                            title="Поставить сердечко теме"
                          >
                            <Heart className={cn('w-3 h-3', isLiked ? 'fill-rose-400 text-rose-400' : '')} />
                            <span>{currentLikes}</span>
                          </button>

                          <a
                            href={item.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-muted-foreground hover:text-primary font-mono flex items-center gap-0.5 truncate max-w-[90px]"
                            title="Репозиторий темы на GitHub"
                          >
                            <span>@{item.author}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            update({
                              theme: item.theme as any,
                              accentColor: item.accentColor,
                              density: item.density as any,
                              borderRadius: item.borderRadius as any,
                              customCss: item.customCss,
                              activeThemeExtensionId: item.id,
                              activeThemeGithubUrl: item.githubUrl,
                            })
                            window.dispatchEvent(new CustomEvent('zerf_sync'))
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs',
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          )}
                        >
                          {isActive ? <Check className="w-3.5 h-3.5" /> : null}
                          <span>{isActive ? 'Активна' : 'Применить'}</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Action: Open Marketplace */}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('zerf_open_marketplace'))
                  dispatch({ type: 'SET_VIEW', view: 'extensions' })
                }}
                className="w-full py-3 px-4 rounded-2xl bg-muted/60 hover:bg-muted border border-border hover:border-primary/40 text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs group"
              >
                <Sparkles className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                <span>✨ Открыть каталог тем и расширений в Магазине Сообщества</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB 6: PWA App Installation ─────────────────────────────────────── */}
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

      {/* ── TAB 7: Subscription, Plans & Promo Codes ────────────────────────── */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <Section title="Тарифные планы и лимиты">
            <div className="p-5 space-y-5">
              {/* Live Subscription Status & Daily Limits Dashboard */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0",
                      (profileData.plan === 'plus' || profileData.plan === 'pro' || profileData.plan === 'corp')
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-primary/10 text-primary border border-primary/20"
                    )}>
                      {(profileData.plan === 'plus' || profileData.plan === 'pro' || profileData.plan === 'corp') ? <Crown className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground text-sm">
                          Текущий тариф: <span className="uppercase text-primary">{profileData.plan || 'Бесплатный (Free)'}</span>
                        </h4>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          profileData.isPremium ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"
                        )}>
                          {profileData.isPremium ? 'Активен' : 'Базовый доступ'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {profileData.subscriptionExpiry ? (
                          <>Подписка действует до: <b className="text-foreground">{new Date(profileData.subscriptionExpiry).toLocaleDateString('ru-RU')}</b></>
                        ) : (
                          <>Лимиты использования автоматически сбрасываются каждый день в <b>00:00 МСК</b></>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={fetchUsage}
                    className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
                    title="Обновить данные по лимитам"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Обновить статус</span>
                  </button>
                </div>

                {/* Grid of live limit metrics */}
                {(() => {
                  const currentPlan = normalizePlan(profileData.plan || usage?.plan || state.settings?.userPlan || 'free')
                  const planLimits = PLANS[currentPlan]

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 text-xs">
                      {/* Voice */}
                      {(() => {
                        const maxSec = usage?.voice?.maxSeconds ?? usage?.voice?.max ?? planLimits.voiceSecondsPerDay
                        const isUnl = maxSec === UNLIMITED || Number(maxSec) >= 99999
                        const secUsed = usage?.voice?.secondsUsed ?? usage?.voice?.used ?? 0
                        const usedMin = (secUsed / 60).toFixed(1).replace('.0', '')
                        const maxMin = Math.round(Number(maxSec) / 60)
                        const isExceeded = !isUnl && secUsed >= Number(maxSec)
                        const pct = isUnl ? 100 : Math.min(100, Math.round((secUsed / Number(maxSec)) * 100))
                        const title = isUnl ? `${usedMin} мин / ∞` : `${usedMin} / ${maxMin > 0 ? `${maxMin} мин` : '1.5 мин'}`
                        return (
                          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Голос (сегодня)</span>
                              <Mic className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <p className="font-bold text-foreground text-sm">{title}</p>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isExceeded ? "bg-rose-500" : "bg-primary")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Siri */}
                      {(() => {
                        const maxSiri = usage?.siri?.max ?? planLimits.siriLifetimeRequests
                        const isUnl = maxSiri === UNLIMITED || Number(maxSiri) >= 99999
                        const used = usage?.siri?.used || 0
                        const maxNum = Number(maxSiri)
                        const isExceeded = !isUnl && used >= maxNum
                        const pct = isUnl ? 100 : (maxNum > 0 ? Math.min(100, Math.round((used / maxNum) * 100)) : 0)
                        const title = isUnl ? `${used} / ∞` : `${used} / ${maxNum}`
                        return (
                          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Siri запросы</span>
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <p className="font-bold text-foreground text-sm">{title}</p>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isExceeded ? "bg-rose-500" : "bg-amber-400")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Notes */}
                      {(() => {
                        const maxNotes = usage?.notes?.max ?? planLimits.maxStoredNotes
                        const isUnl = maxNotes === UNLIMITED || Number(maxNotes) >= 99999
                        const used = usage?.notes?.used ?? (state.notes?.length || 0)
                        const maxNum = Number(maxNotes)
                        const isExceeded = !isUnl && used >= maxNum
                        const pct = isUnl ? 100 : (maxNum > 0 ? Math.min(100, Math.round((used / maxNum) * 100)) : 0)
                        const title = isUnl ? `${used} / ∞` : `${used} / ${maxNum}`
                        return (
                          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Заметки</span>
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                            <p className="font-bold text-foreground text-sm">{title}</p>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isExceeded ? "bg-rose-500" : "bg-blue-400")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Reminders */}
                      {(() => {
                        const maxReminders = usage?.reminders?.max ?? planLimits.maxActiveReminders
                        const isUnl = maxReminders === UNLIMITED || Number(maxReminders) >= 99999
                        const used = usage?.reminders?.used ?? (state.tasks?.filter((t: any) => t.status !== 'done')?.length || 0)
                        const maxNum = Number(maxReminders)
                        const isExceeded = !isUnl && used >= maxNum
                        const pct = isUnl ? 100 : (maxNum > 0 ? Math.min(100, Math.round((used / maxNum) * 100)) : 0)
                        const title = isUnl ? `${used} / ∞` : `${used} / ${maxNum}`
                        return (
                          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Напоминания</span>
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <p className="font-bold text-foreground text-sm">{title}</p>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isExceeded ? "bg-rose-500" : "bg-emerald-400")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Goals */}
                      {(() => {
                        const maxGoals = usage?.goals?.max ?? planLimits.goalsPerDay
                        const isUnl = maxGoals === UNLIMITED || Number(maxGoals) >= 99999
                        const used = usage?.goals?.used ?? (state.goals?.length || 0)
                        const maxNum = Number(maxGoals)
                        const isExceeded = !isUnl && used >= maxNum
                        const pct = isUnl ? 100 : (maxNum > 0 ? Math.min(100, Math.round((used / maxNum) * 100)) : 0)
                        const title = isUnl ? `${used} / ∞` : `${used} / ${maxNum}`
                        return (
                          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Цели (день)</span>
                              <Target className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <p className="font-bold text-foreground text-sm">{title}</p>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isExceeded ? "bg-rose-500" : "bg-purple-400")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Photos */}
                      {(() => {
                        const maxPhotos = usage?.photos?.max ?? planLimits.photosPerDay
                        const isUnl = maxPhotos === UNLIMITED || Number(maxPhotos) >= 99999
                        const used = usage?.photos?.used || 0
                        const maxNum = Number(maxPhotos)
                        const isExceeded = !isUnl && maxNum > 0 && used >= maxNum
                        const pct = isUnl ? 100 : (maxNum > 0 ? Math.min(100, Math.round((used / maxNum) * 100)) : 0)
                        const title = isUnl ? `${used} / ∞` : maxNum === 0 ? '0 / 0 (Plus+)' : `${used} / ${maxNum}`
                        return (
                          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Фото / Распозн.</span>
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <p className="font-bold text-foreground text-sm">{title}</p>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isExceeded ? "bg-rose-500" : "bg-cyan-400")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}
              </div>
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
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
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
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer',
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
                          {entry.features.map(f => {
                            let displayFeature = f
                            if (f.includes('ИИ:') || f.includes('Флагманский ИИ')) {
                              if (liveAiModels && liveAiModels.length > 0) {
                                if (entry.id === 'free') {
                                  const freeModels = liveAiModels.filter((m: any) => m.minTier === 'free' || m.paramsBillions <= 20)
                                  const names = freeModels.slice(0, 3).map((m: any) => m.name || m.id).join(', ')
                                  if (names) displayFeature = `🤖 ИИ: ${names}`
                                } else if (entry.id === 'plus') {
                                  const plusModels = liveAiModels.filter((m: any) => m.minTier === 'plus' || (m.paramsBillions > 20 && m.paramsBillions <= 70))
                                  const names = plusModels.slice(0, 3).map((m: any) => m.name || m.id).join(', ')
                                  if (names) displayFeature = `🤖 ИИ: ${names} (продвинутая логика)`
                                } else if (entry.id === 'pro') {
                                  const proModels = liveAiModels.filter((m: any) => m.minTier === 'pro' || m.paramsBillions > 70)
                                  const names = proModels.slice(0, 3).map((m: any) => m.name || m.id).join(', ')
                                  if (names) displayFeature = `🧠 Флагманский ИИ: ${names} + BYOK API`
                                } else if (entry.id === 'corp') {
                                  displayFeature = '🧠 Флагманский ИИ: Все нейросети без ограничений + Local CLI'
                                }
                              }
                            }
                            return (
                              <li key={f} className="flex items-start gap-1.5">✓ {displayFeature}</li>
                            )
                          })}
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
                            'w-full py-2.5 rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md disabled:opacity-60 cursor-pointer',
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

              {/* ── EXTENSIONS & APIS MATRIX BY PLAN (Collapsible details) ── */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowPricingMatrix(prev => !prev)}
                  className="w-full flex items-center justify-between gap-3 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      🧩
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Подробная таблица сравнения лимитов</h4>
                      <p className="text-[10px] text-muted-foreground">
                        {showPricingMatrix ? 'Скрыть детальное сравнение тарифов' : 'Нажмите, чтобы развернуть полную матрицу возможностей'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    {showPricingMatrix ? 'Свернуть ▲' : 'Сравнить все тарифы ▼'}
                  </span>
                </button>

                {showPricingMatrix && (
                  <div className="overflow-x-auto pt-2 border-t border-border/60 animate-in fade-in">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                          <th className="py-2 pr-4 font-bold">Функция / Возможность</th>
                          <th className="py-2 px-2 text-center font-bold">Базовый (Free)</th>
                          <th className="py-2 px-2 text-center font-bold text-sky-400">Plus (99 ₽)</th>
                          <th className="py-2 px-2 text-center font-bold text-amber-400">Pro (299 ₽)</th>
                          <th className="py-2 pl-2 text-center font-bold text-purple-400">Corp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-[11px]">
                        <tr>
                          <td className="py-2.5 pr-4 font-medium text-foreground">
                            🧩 Лимит активных расширений
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-foreground">до 5 шт.</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-400">до 10 шт.</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-400">до 50 шт.</td>
                          <td className="py-2.5 pl-2 text-center font-mono font-bold text-purple-400">Безлимит (∞)</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            📦 Установка из официального каталога Store
                          </td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ Да</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ Да</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ Да</td>
                          <td className="py-2.5 pl-2 text-center text-emerald-400 font-bold">✓ Да</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            📋 Импорт готовых задач и проектов из шаблонов
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/60">Базовые</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ В 1 клик</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ В 1 клик</td>
                          <td className="py-2.5 pl-2 text-center text-emerald-400 font-bold">✓ Командные</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            🎨 Студия создания и публикация расширений
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/40">—</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ В каталоге</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ В каталоге</td>
                          <td className="py-2.5 pl-2 text-center text-emerald-400 font-bold">✓ Приватные</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            💰 Монетизация плагинов (80% доход автора на карту/СБП)
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/40">—</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ 80% автору</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ 80% автору</td>
                          <td className="py-2.5 pl-2 text-center text-emerald-400 font-bold">✓ 80% автору</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            ⚡ Свой сервер (Self-Hosting) для тяжелых вычислений
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/40">—</td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/40">—</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ Доступно</td>
                          <td className="py-2.5 pl-2 text-center text-emerald-400 font-bold">✓ Доступно</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            🔌 Свои API ключи (OpenAI, Claude, Gemini, Ollama)
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/40">—</td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/40">—</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">✓ Все провайдеры</td>
                          <td className="py-2.5 pl-2 text-center text-emerald-400 font-bold">✓ Выделенные</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            💻 Zerf CLI & Terminal SDK
                          </td>
                          <td className="py-2.5 px-2 text-center text-muted-foreground/40">—</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-400">300 req/день</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-400">1 500 req/день</td>
                          <td className="py-2.5 pl-2 text-center font-mono font-bold text-purple-400">8 000 req/день</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            🎙 Скорость голосового распознавания и Siri
                          </td>
                          <td className="py-2.5 px-2 text-center text-foreground">Стандартная</td>
                          <td className="py-2.5 px-2 text-center text-sky-400 font-bold">Быстрая (Qwen)</td>
                          <td className="py-2.5 px-2 text-center text-amber-400 font-bold">⚡ Мгновенная</td>
                          <td className="py-2.5 pl-2 text-center text-purple-400 font-bold">🔥 Наивысший VIP</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
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
                      'relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 cursor-pointer',
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

              {/* ── PAYMENT CARD & AUTO-RENEW SECTION ── */}
              <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Банковская карта и автопродление</h4>
                      <p className="text-[10px] text-muted-foreground">
                        Управление картой для платежей и автоматическим продлением подписки
                      </p>
                    </div>
                  </div>

                  {userPaymentCard && !showCardForm && (
                    <button
                      type="button"
                      onClick={() => setShowCardForm(true)}
                      className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-[11px] font-semibold transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      Изменить карту
                    </button>
                  )}
                </div>

                {/* Card Status / Display */}
                {userPaymentCard && !showCardForm ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-lg shadow-2xs">
                        {userPaymentCard.payoutType === 'yoomoney' ? '🟣' : '💳'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground font-mono">
                            {userPaymentCard.payoutType === 'yoomoney'
                              ? `ЮMoney: ${userPaymentCard.cardNumber ? '•••• ' + userPaymentCard.cardNumber.slice(-4) : 'Кошелёк привязан'}`
                              : `Карта РФ: •••• ${userPaymentCard.cardNumber ? userPaymentCard.cardNumber.slice(-4) : '••••'}`}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-bold">
                            Привязана
                          </span>
                        </div>
                        {userPaymentCard.bankName && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{userPaymentCard.bankName} {userPaymentCard.recipientName ? `• ${userPaymentCard.recipientName}` : ''}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSavePaymentCard} className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {userPaymentCard ? 'Обновить данные карты / ЮMoney' : 'Привязать банковскую карту / ЮMoney'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground block">Номер карты РФ / ЮMoney счёт (41001...)</label>
                        <input
                          type="text"
                          value={cardFormNumber}
                          onChange={e => {
                            const val = e.target.value
                            setCardFormNumber(val)
                            if (val.startsWith('41001')) {
                              setCardFormBank('ЮMoney')
                              setCardFormType('yoomoney')
                            }
                          }}
                          placeholder="2200 0000 0000 0000 / 41001..."
                          className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
                        />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-semibold text-muted-foreground block">Банк / Сервис</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowBankDropdown(!showBankDropdown)}
                            className="w-full h-9 px-3 rounded-xl bg-card border border-border text-xs text-foreground flex items-center justify-between gap-1.5 hover:border-primary transition-colors cursor-pointer"
                          >
                            <span className="truncate font-medium">
                              {cardFormBank
                                ? (POPULAR_BANKS_LIST.find(b => b.name === cardFormBank)?.icon || '💳') + ' ' + cardFormBank
                                : 'Выбрать банк...'}
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showBankDropdown && "rotate-180")} />
                          </button>

                          {/* Bank Dropdown Menu */}
                          <AnimatePresence>
                            {showBankDropdown && (
                              <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                className="absolute right-0 top-full mt-1.5 w-60 p-1.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl z-50 space-y-0.5 max-h-56 overflow-y-auto"
                              >
                                <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Популярные банки РФ
                                </p>
                                {POPULAR_BANKS_LIST.map(b => (
                                  <button
                                    key={b.name}
                                    type="button"
                                    onClick={() => {
                                      setCardFormBank(b.name)
                                      setShowBankDropdown(false)
                                      if (b.name === 'ЮMoney') setCardFormType('yoomoney')
                                    }}
                                    className={cn(
                                      "w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer",
                                      cardFormBank === b.name
                                        ? "bg-primary/20 text-primary font-bold"
                                        : "text-foreground hover:bg-muted/70"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{b.icon}</span>
                                      <span>{b.name}</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground font-mono">{b.badge}</span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Quick Bank Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium">Быстрый выбор:</span>
                      {POPULAR_BANKS_LIST.slice(0, 6).map(b => (
                        <button
                          key={b.name}
                          type="button"
                          onClick={() => {
                            setCardFormBank(b.name)
                            if (b.name === 'ЮMoney') setCardFormType('yoomoney')
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1",
                            cardFormBank === b.name
                              ? "bg-primary/20 text-primary border-primary/40 shadow-xs"
                              : "bg-card text-muted-foreground border-border/80 hover:text-foreground hover:border-border"
                          )}
                        >
                          <span>{b.icon}</span>
                          <span>{b.name}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={autoRenewLoading || !cardFormNumber.trim()}
                        className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      >
                        {autoRenewLoading ? 'Сохранение...' : 'Сохранить реквизиты'}
                      </button>
                      {userPaymentCard && (
                        <button
                          type="button"
                          onClick={() => setShowCardForm(false)}
                          className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                        >
                          Отмена
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* Auto-Renew Toggle */}
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">Автоплатёж (Автопродление)</span>
                      <span className={cn(
                        "px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase",
                        autoRenew ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground"
                      )}>
                        {autoRenew ? 'Включен' : 'Выключен (по умолчанию)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      При включении в день окончания периода будет автоматически продлена ваша текущая подписка <b>{profileData.plan ? profileData.plan.toUpperCase() : 'PLUS'}</b>. Вы можете выключить автопродление в любой момент в 1 клик.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={autoRenewLoading}
                    onClick={handleToggleAutoRenew}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 cursor-pointer',
                      autoRenew ? 'bg-primary' : 'bg-muted border border-border'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                      autoRenew ? 'left-[22px]' : 'left-0.5'
                    )} />
                  </button>
                </div>
              </div>

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
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
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
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span className="mono-emoji">🎁</span>
                  <span>{copiedRef ? 'Ссылка скопирована!' : 'Пригласить друга'}</span>
                </button>
              </div>
            </div>
          </Section>

          {/* Gift Subscription Section */}
          <GiftSection />
        </div>
      )}

      {/* ── TAB: AI & LLM Models Selection ────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <Section title="Настройки ИИ и моделей">
            <div className="p-5">
              <AiModelsSection
                userPlan={normalizePlan(profileData.plan)}
                onUpgradeClick={() => setActiveTab('subscription')}
              />
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB: API Keys & Providers ───────────────────────────────────── */}
      {activeTab === 'apikeys' && (
        <div className="space-y-6">
          <Section title="API Ключи и Провайдеры">
            <div className="p-5">
              <ApiKeysSection
                siriKey={profileData.siriKey}
                chatId={currentChatId || undefined}
                userPlan={normalizePlan(profileData.plan)}
              />
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB 8: Data & Backup ─────────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <ImportExportSection />

          <Section title="Сброс локального кэша">
            <Row label="Очистить локальный кэш браузера" description="Перезагружает актуальные данные из облачной базы данных">
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Очистить кэш?',
                    description: 'Приложение очистит временные файлы браузера и заново загрузит все данные из базы.',
                    confirmText: 'Очистить и перезагрузить',
                  })
                  if (ok) {
                    try {
                      localStorage.removeItem('zerf-settings')
                      localStorage.removeItem('zerf_current_view')
                    } catch {}
                    window.location.reload()
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сбросить кэш</span>
              </button>
            </Row>
          </Section>

          <Section title="Правовая информация & Безопасность">
            <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Google API Compliance & AI Disclaimer</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Соответствие Google API Services User Data Policy, защита персональных данных и отказ от ответственности за генерации ИИ.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Политика конфиденциальности</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Terms</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </Section>
          <Section title="Приватность и автоудаление данных">
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-foreground">Автоматическое удаление аккаунта при неактивности</h4>
                    {autoDeleteSaving ? (
                      <span className="text-[11px] text-primary flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Сохранение...
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        Синхронизировано
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Если аккаунт не используется в течение выбранного времени, он полностью удаляется из облачной базы данных вместе со всеми заметками, задачами и целями.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {[
                  { value: 1, label: '1 месяц', desc: '30 дней' },
                  { value: 3, label: '3 месяца', desc: '90 дней' },
                  { value: 6, label: '6 месяцев', desc: 'Полгода (Стандарт)' },
                  { value: 12, label: '12 месяцев', desc: '1 год' },
                  { value: 0, label: 'Никогда', desc: 'Бессрочно' },
                ].map(opt => {
                  const isSelected = (profileData.autoDeleteMonths ?? settings.autoDeleteMonths ?? 6) === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAutoDeleteChange(opt.value)}
                      className={cn(
                        'p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
                        isSelected
                          ? 'bg-primary/10 border-primary text-foreground shadow-sm shadow-primary/10'
                          : 'bg-muted/40 hover:bg-muted/70 border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn('text-xs font-bold', isSelected ? 'text-primary' : 'text-foreground')}>
                          {opt.label}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {opt.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB 9: Team & Corporate Workspaces ─────────────────────────────────── */}
      {activeTab === 'teams' && (
        <TeamsSection />
      )}

      {/* ── TAB 10: Sidebar & Menu Customizer ─────────────────────────────────── */}
      {activeTab === 'sidebar' && (
        <SidebarCustomizerSection />
      )}

      {/* ── TAB 11: Extensions & GitHub Store Jump ───────────────────────────── */}
      {activeTab === 'extensions' && (
        <div className="space-y-6 text-xs">
          <Section title="Расширения и открытые плагины">
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-card border border-border shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-xl">
                    🧩
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Магазин расширений Zerf Note</h4>
                    <p className="text-[11px] text-muted-foreground">Подключение виджетов, кастомных тем и шаблонов из GitHub</p>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  Zerf Note поддерживает открытые расширения из репозиториев GitHub. Создавайте свои виджеты и манифесты, публикуйте их для сообщества и получайте 80% с каждой продажи.
                </p>
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('zerf_open_marketplace'))}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Puzzle className="w-3.5 h-3.5" />
                    <span>Открыть магазин расширений</span>
                  </button>
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Создать репозиторий на GitHub</span>
                  </a>
                </div>
              </div>

              {/* Downloaded / Installed Extensions with Search & Collapsible Settings */}
              <InstalledExtensionsSettingsSection />
            </div>
          </Section>
        </div>
      )}

        </div>
      </div>

      {/* Telegram-style 1000+ Emoji Picker Modal */}
      <EmojiPickerModal
        isOpen={showEmojiPicker}
        currentEmoji={userAvatarEmoji}
        onSelect={handleSelectAvatarEmoji}
        onClose={() => setShowEmojiPicker(false)}
        title="Выберите аватар / эмодзи профиля"
      />

      {/* Custom Themes Library & Creator Modal */}
      <CustomThemesModal
        isOpen={showThemesModal}
        currentTheme={settings.theme || 'strict'}
        onClose={() => setShowThemesModal(false)}
        onApplyTheme={(themeId: string, customVars?: Record<string, string>, customCss?: string, githubUrl?: string) => {
          update({
            theme: themeId as any,
            customCss: customCss || undefined,
            activeThemeExtensionId: themeId,
            activeThemeGithubUrl: githubUrl,
          })
          if (customVars && typeof window !== 'undefined') {
            try {
              Object.entries(customVars).forEach(([k, v]) => {
                document.documentElement.style.setProperty(k, v)
              })
              localStorage.setItem('zerf_active_theme_vars', JSON.stringify(customVars))
            } catch {}
          }
          setShowThemesModal(false)
        }}
      />
    </div>
  )
}
