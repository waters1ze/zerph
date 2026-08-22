'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Puzzle, Plus, Check, Star, Download, Trash2,
  DollarSign, Sparkles, Layout, Palette, Zap, Eye,
  Search, Shield, Crown, TrendingUp, AlertCircle, ArrowUpRight,
  BookOpen, HelpCircle, Lightbulb, Code2, ArrowRight,
  RefreshCw, ExternalLink, Copy, CheckCheck, GitBranch, Heart,
  Flame, CheckSquare, Play, Clock, Image as ImageIcon, Upload, ImagePlus,
  Settings, Tag, Globe, FileCode, ToggleLeft, ToggleRight, History, ChevronDown,
  CreditCard, Wallet, Banknote, CheckCircle2, X, Loader2, Key
} from 'lucide-react'
import { useApp, getAuthHeaders, getTgChatId } from '@/lib/store'
import { planAtLeast } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ExtensionItem } from '@/app/api/extensions/route'
import { ZerficLiveModal } from './zerfic-live-modal'

export function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

/**
 * Compresses and downscales an image file to a tiny square avatar (96x96 WebP/JPEG)
 * resulting in minimal storage footprint (< 3 KB) and crisp Retina display.
 */
export async function compressExtensionImage(file: File, maxSize = 96, quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(file.name)
    if (!isImg) {
      reject(new Error('Пожалуйста, выберите файл изображения (PNG, JPG, WebP, GIF)'))
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      if (!src) {
        reject(new Error('Не удалось прочитать файл изображения'))
        return
      }

      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2
          canvas.width = maxSize
          canvas.height = maxSize

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(src)
            return
          }
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize)

          let dataUrl = canvas.toDataURL('image/webp', quality)
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          }
          resolve(dataUrl)
        } catch {
          resolve(src)
        }
      }
      img.onerror = () => {
        // In case of SVG/Canvas issues, resolve with data URL directly
        if (src.startsWith('data:image/svg')) {
          resolve(src)
        } else {
          reject(new Error('Не удалось обработать изображение'))
        }
      }
      img.src = src
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

export function ExtensionIcon({ icon, className = 'w-7 h-7 text-xl' }: { icon?: string; className?: string }) {
  const [hasError, setHasError] = useState(false)

  // Reset error when icon changes
  useEffect(() => {
    setHasError(false)
  }, [icon])

  const isImage = !hasError && Boolean(icon) && (
    icon!.startsWith('http://') ||
    icon!.startsWith('https://') ||
    icon!.startsWith('data:image') ||
    icon!.startsWith('data:') ||
    icon!.startsWith('/') ||
    icon!.startsWith('blob:')
  )

  if (isImage) {
    return (
      <img
        src={icon}
        alt="Extension"
        className={cn(
          'w-full h-full object-cover rounded-xl shrink-0 select-none pointer-events-none grayscale contrast-125 brightness-95',
          className
        )}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    )
  }

  return (
    <span className={cn('flex items-center justify-center shrink-0 select-none font-sans', className)}>
      {icon && !icon.startsWith('data:') && !icon.startsWith('http') ? icon : '🧩'}
    </span>
  )
}

const SAMPLE_MANIFEST = `{
  "name": "Entropy AI Search",
  "version": "1.0.0",
  "description": "Интеллектуальный поисково-аналитический движок инсайтов в стиле Perplexity для Zerf Note",
  "type": "widget",
  "category": "ИИ & Промпты",
  "icon": "🔮",
  "price": 0,
  "author": "ваш_github_логин",
  "config": {
    "engine": "entropy_deep_search",
    "commands": [
      { "cmd": "/search", "description": "Поиск и синтез источников" },
      { "cmd": "/entropy", "description": "Аналитика инсайтов" }
    ],
    "features": ["web_synthesis", "citations", "auto_note_export"]
  }
}`

export const EXTENSION_CATEGORIES = [
  { id: 'Виджеты & Фокус', icon: '⏱️', label: 'Виджеты & Фокус', desc: 'Таймеры, интервалы, трекеры и виджеты' },
  { id: 'Бизнес & Стартапы', icon: '🚀', label: 'Бизнес & Стартапы', desc: 'Запуск проектов, шаблоны задач, аналитика' },
  { id: 'Привычки & Здоровье', icon: '💪', label: 'Привычки & Здоровье', desc: 'Спорт, гидратация, режим сна и баланс' },
  { id: 'Утилиты & Экспорт', icon: '🔌', label: 'Утилиты & Экспорт', desc: 'Вебхуки, интеграции, экспорт заметок и CLI' },
  { id: 'Темы & Стили', icon: '🌌', label: 'Темы & Стили', desc: 'Кастомные CSS стили, цвета и стеклянные темы' },
]

export const EXTENSION_TYPES: {
  id: 'widget' | 'prompt' | 'template' | 'theme' | 'integration'
  icon: string
  label: string
  desc: string
  badge: string
  defaultJson: any
}[] = [
  {
    id: 'prompt',
    icon: '🔮',
    label: 'Поисковый ИИ движок (Perplexity / Search)',
    desc: 'AI поиск, глубокий синтез источников, CLI команды /search и /entropy',
    badge: 'AI Search',
    defaultJson: {
      engine: 'entropy_deep_search',
      commands: [
        { cmd: '/search', description: 'Entropy AI — Глубокий поиск и синтез источников' },
        { cmd: '/entropy', description: 'Entropy AI — Запуск поисковой аналитики инсайтов' },
      ],
      features: ['web_synthesis', 'citations', 'direct_answers', 'auto_note_export'],
      maxSources: 5,
    },
  },
  {
    id: 'widget',
    icon: '⏱️',
    label: 'Интерактивный виджет',
    desc: 'Интервальные таймеры, трекеры и интерактивный запуск ▶ в приложении',
    badge: 'Widget',
    defaultJson: {
      widgetType: 'interval_focus',
      workMinutes: 25,
      breakMinutes: 5,
      autoStartBreaks: true,
      soundNotification: true,
      sessionsBeforeLongBreak: 4,
    },
  },
  {
    id: 'template',
    icon: '🎯',
    label: 'Шаблон задач и чек-лист',
    desc: 'Готовые наборы задач с быстрым добавлением в списки дел Zerf Note',
    badge: 'Template',
    defaultJson: {
      templateType: 'project',
      tasksCount: 6,
      tasks: [
        '1. CustDev интервью с 10 клиентами',
        '2. Формирование ценностного предложения (Lean Canvas)',
        '3. Создание кликабельного прототипа в Figma',
        '4. Разработка MVP функционала за 14 дней',
        '5. Подключение платежного шлюза и оферты',
        '6. Запуск первых 3 рекламных каналов',
      ],
    },
  },
  {
    id: 'theme',
    icon: '🌌',
    label: 'Тема оформления',
    desc: 'Кастомные CSS палитры, неоновые акценты и стеклянные градиенты',
    badge: 'Theme',
    defaultJson: {
      themeName: 'Cyberpunk Neon Glass',
      colors: {
        primary: '#8b5cf6',
        accent: '#06b6d4',
        background: '#09090b',
        card: '#13131a',
      },
      borderRadius: '16px',
      glassBlur: '12px',
    },
  },
  {
    id: 'integration',
    icon: '🔌',
    label: 'Интеграция & Вебхуки',
    desc: 'Синхронизация данных, внешние REST API и вебхуки событий',
    badge: 'Integration',
    defaultJson: {
      integrationType: 'webhook_sync',
      endpoint: 'https://api.example.com/v1/zerf/events',
      events: ['task_created', 'task_completed', 'note_saved'],
      headers: {
        Authorization: 'Bearer YOUR_TOKEN',
      },
      autoSyncIntervalMinutes: 15,
    },
  },
]

export const DEFAULT_EXTENSIONS: ExtensionItem[] = [
  {
    id: 'ext_entropy_search',
    title: 'Entropy AI Search & Deep Research',
    version: '1.0.0',
    description: 'Интеллектуальный поисково-аналитический движок инсайтов в стиле Perplexity: глубокий синтез фактов, цитаты со ссылками на проверенные источники [1][2] и авто-экспорт в заметки.',
    type: 'widget',
    category: 'ИИ & Промпты',
    icon: '🔮',
    githubUrl: 'https://github.com/waters1ze/Entropy',
    authorChatId: 'system',
    authorName: 'Zerf Official',
    authorGithub: 'zerf-official',
    price: 0,
    minPlan: 'free',
    isOfficial: true,
    isPublished: true,
    isRunnable: true,
    rating: 5.0,
    ratingCount: 0,
    likesCount: 0,
    installCount: 0,
    content: {
      engine: 'entropy_deep_search',
      commands: [
        { cmd: '/search', description: 'Entropy AI — Глубокий поиск и синтез источников' },
        { cmd: '/entropy', description: 'Entropy AI — Запуск поисковой аналитики инсайтов' },
      ],
      features: ['web_synthesis', 'citations', 'direct_answers', 'auto_note_export'],
      maxSources: 5,
    },
    createdAt: '2026-08-17T20:00:00Z',
    updatedAt: '2026-08-17T22:00:00Z',
  },
  {
    id: 'ext_gh_1787152496448_e36d8d',
    title: 'zerfic-live',
    version: '1.0.0',
    description: 'Полноценный живой разговорный ИИ-собеседник с мужским голосом Зерфика, эмоциями, анимациями, жестами и интеграцией во всю базу заметок и задач.',
    type: 'widget',
    category: 'ИИ & Голос',
    icon: '🎙️',
    githubUrl: 'https://github.com/waters1ze/zerfic-live',
    authorChatId: '6136950061',
    authorName: 'Создатель',
    isOfficial: true,
    isPublished: true,
    isRunnable: false,
    price: 0,
    minPlan: 'free',
    rating: 5.0,
    ratingCount: 1,
    likesCount: 1,
    installCount: 2,
    content: {
      defaultMode: 'push_to_talk',
      enableHesitations: true
    },
    createdAt: '2026-08-19T15:14:57.397Z',
    updatedAt: '2026-08-19T15:18:31.978Z'
  },
]

const getInitialExtensionsData = () => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('zerf_ext_catalog_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.catalog) && parsed.catalog.length > 0) {
          return {
            catalog: parsed.catalog,
            installedIds: parsed.installedIds || [],
            likedIds: parsed.likedIds || [],
            userPlan: parsed.userPlan || 'free',
            canCreate: Boolean(parsed.canCreate),
            authorStats: parsed.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 },
            hasCache: true
          }
        }
      }
    } catch {}
  }
  return {
    catalog: DEFAULT_EXTENSIONS,
    installedIds: [],
    likedIds: [],
    userPlan: 'free',
    canCreate: false,
    authorStats: { balance: 0, totalEarned: 0, salesCount: 0 },
    hasCache: true
  }
}

export interface ExtensionsViewProps {
  isModal?: boolean
  onClose?: () => void
}

export function ExtensionsView({ isModal, onClose }: ExtensionsViewProps = {}) {
  const { state, dispatch, syncData } = useApp()
  const confirmDialog = useConfirmDialog()
  const initialCache = getInitialExtensionsData()

  // In-app sleek toast notification state (replaces native browser alert popups)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  const [catalog, setCatalog] = useState<ExtensionItem[]>(initialCache.catalog)
  const [installedIds, setInstalledIds] = useState<string[]>(initialCache.installedIds)
  const [enabledIds, setEnabledIds] = useState<string[]>(initialCache.installedIds || [])
  const [likedIds, setLikedIds] = useState<string[]>(initialCache.likedIds)
  const [userPlan, setUserPlan] = useState<string>(initialCache.userPlan)
  const [canCreate, setCanCreate] = useState<boolean>(initialCache.canCreate)
  const [authorStats, setAuthorStats] = useState(initialCache.authorStats)
  const [loading, setLoading] = useState<boolean>(false)

  const [activeTab, setActiveTab] = useState<'store' | 'installed' | 'my' | 'earnings'>('store')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'top_likes' | 'popular' | 'newest'>('top_likes')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals & Interactive preview
  const [selectedExt, setSelectedExt] = useState<ExtensionItem | null>(null)
  const [activeWidgetExt, setActiveWidgetExt] = useState<ExtensionItem | null>(null)
  const [showZerficLiveModal, setShowZerficLiveModal] = useState<boolean>(false)
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false)
  const [showSpecModal, setShowSpecModal] = useState<boolean>(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCardModal, setShowCardModal] = useState<boolean>(false)
  const [boundCard, setBoundCard] = useState<{
    payoutType: 'card' | 'yoomoney'
    cardNumber: string
    phone: string
    bankName: string
    recipientName?: string
    updatedAt?: string
  } | null>(null)
  const [payoutConfig, setPayoutConfig] = useState<{
    platformPercent: number
    authorPercent: number
  }>({ platformPercent: 20, authorPercent: 80 })
  const [cardPayoutType, setCardPayoutType] = useState<'card' | 'yoomoney'>('yoomoney')
  const [cardNumberInput, setCardNumberInput] = useState<string>('')
  const [cardBankInput, setCardBankInput] = useState<string>('')
  const [cardRecipientInput, setCardRecipientInput] = useState<string>('')
  const [showExtBankDropdown, setShowExtBankDropdown] = useState<boolean>(false)
  const [copiedSpec, setCopiedSpec] = useState<boolean>(false)

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
  const [selectedAuthorProfile, setSelectedAuthorProfile] = useState<string | null>(null)
  
  // Reviews & Ratings Modal State
  const [reviewsExt, setReviewsExt] = useState<ExtensionItem | null>(null)
  const [reviewsList, setReviewsList] = useState<any[]>([])
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false)
  const [userRatingInput, setUserRatingInput] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [userCommentInput, setUserCommentInput] = useState<string>('')
  const [submittingReview, setSubmittingReview] = useState<boolean>(false)
  const [hasReadDocs, setHasReadDocs] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zerf_has_read_docs') === 'true'
    }
    return false
  })

  // Custom Extension Editor / Studio Modal
  const [showEditorModal, setShowEditorModal] = useState<boolean>(false)
  const [editingExt, setEditingExt] = useState<ExtensionItem | null>(null)
  const [editorActiveTab, setEditorActiveTab] = useState<'ai' | 'general' | 'version' | 'access' | 'hosting' | 'code' | 'github'>('ai')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIcon, setFormIcon] = useState('🧩')
  const [formCategory, setFormCategory] = useState('ИИ & Промпты')
  const [formType, setFormType] = useState<'widget' | 'template' | 'theme' | 'integration' | 'preset' | 'prompt'>('prompt')
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false)
  const [isTypeOpen, setIsTypeOpen] = useState<boolean>(false)
  const [formMinPlan, setFormMinPlan] = useState<'free' | 'plus' | 'pro' | 'corp'>('free')
  const [formPrice, setFormPrice] = useState<number>(0)
  const [formVersion, setFormVersion] = useState('1.0.0')
  const [formIsPublished, setFormIsPublished] = useState<boolean>(false)
  const [formIsRunnable, setFormIsRunnable] = useState<boolean>(false)
  const [formHostingUrl, setFormHostingUrl] = useState<string>('')
  const [formSelfHosted, setFormSelfHosted] = useState<boolean>(false)
  const [isPingingHost, setIsPingingHost] = useState<boolean>(false)
  const [pingResult, setPingResult] = useState<{ reachable: boolean; status?: number; latencyMs?: number; error?: string } | null>(null)
  const [autoRenewEnabled, setAutoRenewEnabled] = useState<boolean>(true)
  const [maxExtensionsAllowed, setMaxExtensionsAllowed] = useState<number>(5)
  const [formChangelog, setFormChangelog] = useState<string>('')
  const [formGithubUrl, setFormGithubUrl] = useState<string>('')
  const [formAiInstructions, setFormAiInstructions] = useState<string>('')
  const [formTriggers, setFormTriggers] = useState<string>('')
  const [formCode, setFormCode] = useState(JSON.stringify(EXTENSION_TYPES[0].defaultJson, null, 2))
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false)
  const formFileInputRef = useRef<HTMLInputElement | null>(null)

  // GitHub Import state
  const [githubUrl, setGithubUrl] = useState('')
  const [parsedManifest, setParsedManifest] = useState<any | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState<boolean>(false)
  const [userGithubUsername, setUserGithubUsername] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('zerf_github_username') ||
        localStorage.getItem('zerf_user_github') ||
        ''
      ).replace(/^@/, '').trim()
    }
    return ''
  })
  const [userGithubRepos, setUserGithubRepos] = useState<Array<{
    name: string
    fullName: string
    description: string
    htmlUrl: string
    isPrivate: boolean
    stars: number
    forks: number
    language: string
    updatedAt: string
    defaultBranch: string
  }>>([])
  const [loadingGithubRepos, setLoadingGithubRepos] = useState<boolean>(false)
  const [githubRepoSearch, setGithubRepoSearch] = useState<string>('')
  const [githubRepoPrivacyFilter, setGithubRepoPrivacyFilter] = useState<'all' | 'public' | 'private'>('all')
  const [githubModalTab, setGithubModalTab] = useState<'repos' | 'url'>('repos')
  const [customGithubInput, setCustomGithubInput] = useState<string>('')
  const [showPatInput, setShowPatInput] = useState<boolean>(false)
  const [customPatToken, setCustomPatToken] = useState<string>('')
  const [savingPat, setSavingPat] = useState<boolean>(false)

  const handleSavePat = async () => {
    if (!customPatToken.trim()) return
    setSavingPat(true)
    try {
      localStorage.setItem('zerf_github_token', customPatToken.trim())
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_github_token', token: customPatToken.trim() }),
      })
      showToast('✓ Токен GitHub сохранён! Загрузка приватных репозиториев...', 'success')
      setShowPatInput(false)
      fetchUserGithubRepos(undefined, customPatToken.trim())
    } catch {
      showToast('Ошибка сохранения токена', 'error')
    } finally {
      setSavingPat(false)
    }
  }

  const fetchUserGithubRepos = async (usernameOverride?: string, tokenOverride?: string) => {
    const targetUser = (usernameOverride || userGithubUsername || '').trim().replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').trim()
    if (!targetUser) return
    const token = tokenOverride || (typeof window !== 'undefined' ? (localStorage.getItem('zerf_github_token') || '') : '')
    setLoadingGithubRepos(true)
    try {
      const url = `/api/extensions?action=user_repos&username=${encodeURIComponent(targetUser)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.repos)) {
        setUserGithubRepos(data.repos)
        if (data.username) {
          const cleanUname = data.username.replace(/^@/, '').trim()
          setUserGithubUsername(cleanUname)
          try {
            localStorage.setItem('zerf_github_username', cleanUname)
            localStorage.setItem('zerf_user_github', cleanUname)
          } catch {}
        }
      }
    } catch {}
    finally {
      setLoadingGithubRepos(false)
    }
  }

  const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null

  const fetchExtensions = async () => {
    try {
      if (!initialCache.hasCache) setLoading(true)
      const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        const loadedCatalog = (Array.isArray(data.catalog) && data.catalog.length > 0) ? data.catalog : DEFAULT_EXTENSIONS
        setCatalog(loadedCatalog)
        setInstalledIds(data.installedIds || [])
        setEnabledIds(Array.isArray(data.enabledIds) ? data.enabledIds : (Array.isArray(data.installedIds) ? data.installedIds : []))
        setLikedIds(data.likedIds || [])
        setUserPlan(data.userPlan || 'free')
        if (data.maxExtensions !== undefined) setMaxExtensionsAllowed(data.maxExtensions)
        if (data.autoRenewEnabled !== undefined) setAutoRenewEnabled(data.autoRenewEnabled)
        setCanCreate(Boolean(data.canCreateExtensions))
        setAuthorStats(data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 })
        if (data.boundCard) setBoundCard(data.boundCard)
        if (data.payoutConfig) setPayoutConfig(data.payoutConfig)
        if (data.githubUsername) {
          const cleanUname = data.githubUsername.replace(/^@/, '').trim()
          setUserGithubUsername(cleanUname)
          try {
            localStorage.setItem('zerf_github_username', cleanUname)
            localStorage.setItem('zerf_user_github', cleanUname)
          } catch {}
          fetchUserGithubRepos(cleanUname)
        }

        try {
          localStorage.setItem('zerf_ext_catalog_cache', JSON.stringify({
            catalog: loadedCatalog,
            installedIds: data.installedIds || [],
            enabledIds: data.enabledIds || data.installedIds || [],
            likedIds: data.likedIds || [],
            userPlan: data.userPlan || 'free',
            canCreate: Boolean(data.canCreateExtensions),
            authorStats: data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 },
            boundCard: data.boundCard || null,
          }))
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load extensions:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExtensions()

    if (typeof window !== 'undefined') {
      const gh = (
        localStorage.getItem('zerf_github_username') ||
        localStorage.getItem('zerf_user_github') ||
        ''
      ).replace(/^@/, '').trim()
      if (gh) {
        setUserGithubUsername(gh)
        fetchUserGithubRepos(gh)
      }

      const urlParams = new URLSearchParams(window.location.search)
      const purchasedExtId = urlParams.get('ext_purchased')
      if (purchasedExtId) {
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
        setTimeout(() => {
          fetchExtensions()
          showToast('🎉 Оплата прошла успешно! Расширение активировано и установлено в ваш аккаунт.', 'success')
        }, 800)
      }

      const handleOpenTab = (e: any) => {
        if (e.detail?.tab) {
          setActiveTab(e.detail.tab)
        }
      }
      const handleOpenMyPlugins = () => {
        setActiveTab('my')
      }
      window.addEventListener('zerf_open_extensions_tab', handleOpenTab)
      window.addEventListener('zerf_open_my_plugins', handleOpenMyPlugins)
      return () => {
        window.removeEventListener('zerf_open_extensions_tab', handleOpenTab)
        window.removeEventListener('zerf_open_my_plugins', handleOpenMyPlugins)
      }
    }
  }, [])

  const rawPlan = (
    userPlan ||
    state.settings.userPlan ||
    (typeof window !== 'undefined' ? localStorage.getItem('zerf_user_plan') : '') ||
    'free'
  ).toLowerCase().trim()

  const isPlusOrHigher = planAtLeast(rawPlan, 'plus') || ['plus', 'pro', 'premium', 'unlimited', 'corp', 'corporate', 'enterprise', 'admin'].includes(rawPlan) || Boolean((state as any).user?.isAdmin)
  const canCreateFinal = canCreate || isPlusOrHigher

  const promptUpgradeToPlus = async (actionLabel = 'использования расширений') => {
    const ok = await confirmDialog({
      title: '💎 Требуется подписка Zerf Plus',
      description: `Установка и запуск расширений, AI-виджетов и шаблонов доступны на тарифе Zerf Plus (от 99 ₽/мес). Хотите перейти к оформлению подписки?`,
      confirmText: 'Оформить Zerf Plus (99 ₽)',
      cancelText: 'Позже',
      variant: 'primary',
    })
    if (ok) {
      dispatch({ type: 'SET_VIEW', view: 'settings' })
    }
  }

  const handleToggleLike = async (ext: ExtensionItem) => {
    const isLiked = likedIds.includes(ext.id)
    const nextLiked = isLiked ? likedIds.filter(id => id !== ext.id) : [...likedIds, ext.id]
    setLikedIds(nextLiked)

    // Optimistic UI update
    setCatalog(prev => prev.map(item => {
      if (item.id === ext.id) {
        return {
          ...item,
          likesCount: Math.max(0, (item.likesCount || 0) + (isLiked ? -1 : 1))
        }
      }
      return item
    }))

    try {
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', extensionId: ext.id }),
      })
    } catch {}
  }

  const handleApplyTemplate = async (ext: ExtensionItem) => {
    if (!isPlusOrHigher) {
      promptUpgradeToPlus('импорта шаблонов')
      return
    }
    try {
      setActionLoading(`apply_${ext.id}`)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_template', extensionId: ext.id }),
      })
      const data = await res.json()
      if (data.success) {
        await syncData()
        showToast(`🎉 Шаблон «${ext.title}» успешно применён! В ваш список задач добавлено +${data.createdCount} пунктов.`, 'success')
      } else {
        if (data.requiresPlus) {
          promptUpgradeToPlus('импорта шаблонов')
        } else {
          showToast(data.error || 'Ошибка применения шаблона', 'error')
        }
      }
    } catch {
      showToast('Ошибка применения шаблона', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleParseGithub = async (e?: React.FormEvent, directUrl?: string) => {
    if (e) e.preventDefault()
    setParseError(null)
    setParsedManifest(null)
    const targetUrl = (directUrl || githubUrl || '').trim()
    if (!targetUrl) return
    if (directUrl) setGithubUrl(directUrl)

    try {
      setIsParsing(true)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse_github', githubUrl: targetUrl }),
      })
      const data = await res.json()
      if (data.success) {
        setParsedManifest(data.manifest)
      } else {
        setParseError(data.error || 'Не найден файл zerf-extension.json в ветке main/master репозитория')
      }
    } catch {
      setParseError('Ошибка проверки репозитория на GitHub')
    } finally {
      setIsParsing(false)
    }
  }

  const handlePublishFromGithub = async () => {
    if (!parsedManifest) return
    if (!hasReadDocs) {
      showToast('Пожалуйста, ознакомьтесь с документацией разработчика SDK перед публикацией.', 'info')
      return
    }
    try {
      setActionLoading('publish_gh')
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish_github',
          githubUrl: githubUrl.trim(),
          title: parsedManifest.title,
          description: parsedManifest.description,
          type: parsedManifest.type,
          category: parsedManifest.category,
          icon: parsedManifest.icon,
          version: parsedManifest.version || '1.0.0',
          price: parsedManifest.price || 0,
          isPublished: true, // Default to Published in Store upon import
          changelog: parsedManifest.changelog || 'Первичный импорт манифеста из GitHub',
          content: parsedManifest.content,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowGithubModal(false)
        setGithubUrl('')
        setParsedManifest(null)
        fetchExtensions()
        setActiveTab('my')
        showToast(`✓ Репозиторий «${parsedManifest.title}» успешно добавлен в ваши плагины как черновик!`, 'success')
      } else {
        showToast(data.error || 'Ошибка загрузки репозитория', 'error')
      }
    } catch {
      showToast('Ошибка при импорте из GitHub', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSyncGithub = async (extensionId: string) => {
    try {
      setActionLoading(extensionId)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_github', extensionId }),
      })
      const data = await res.json()
      if (data.success) {
        fetchExtensions()
        showToast(`✓ Манифест успешно обновлен из последнего коммита GitHub!`, 'success')
      } else {
        showToast(data.error || 'Ошибка синхронизации', 'error')
      }
    } catch {
      showToast('Ошибка синхронизации', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleTogglePublish = async (ext: ExtensionItem) => {
    const nextState = !(ext.isPublished !== false)
    try {
      setActionLoading(`pub_${ext.id}`)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_publish', extensionId: ext.id, isPublished: nextState }),
      })
      const data = await res.json()
      if (data.success) {
        setCatalog(prev => prev.map(e => e.id === ext.id ? { ...e, isPublished: nextState } : e))
        fetchExtensions()
        showToast(nextState ? `✓ Расширение «${ext.title}» опубликовано в Store!` : `✓ Расширение «${ext.title}» переведено в черновик`, 'success')
      } else {
        showToast(data.error || 'Ошибка изменения статуса публикации', 'error')
      }
    } catch {
      showToast('Ошибка изменения статуса', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const bumpVersion = (type: 'patch' | 'minor' | 'major') => {
    const parts = (formVersion.trim() || '1.0.0').split('.').map(n => parseInt(n) || 0)
    while (parts.length < 3) parts.push(0)
    if (type === 'major') {
      parts[0] += 1
      parts[1] = 0
      parts[2] = 0
    } else if (type === 'minor') {
      parts[1] += 1
      parts[2] = 0
    } else {
      parts[2] += 1
    }
    setFormVersion(parts.join('.'))
  }

  const handleFormImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsCompressingImage(true)
    try {
      const compressedDataUrl = await compressExtensionImage(file, 80, 0.55)
      setFormIcon(compressedDataUrl)
    } catch (err: any) {
      showToast(err.message || 'Ошибка обработки картинки', 'error')
    } finally {
      setIsCompressingImage(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleGithubImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !parsedManifest) return
    setIsCompressingImage(true)
    try {
      const compressedDataUrl = await compressExtensionImage(file, 80, 0.55)
      setParsedManifest({ ...parsedManifest, icon: compressedDataUrl })
    } catch (err: any) {
      showToast(err.message || 'Ошибка обработки картинки', 'error')
    } finally {
      setIsCompressingImage(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSelectType = (typeId: 'widget' | 'template' | 'theme' | 'integration' | 'prompt') => {
    setFormType(typeId)
    const matchingType = EXTENSION_TYPES.find(t => t.id === typeId)
    if (matchingType) {
      setFormCode(JSON.stringify(matchingType.defaultJson, null, 2))
      if (!editingExt) {
        if (typeId === 'prompt') {
          setFormCategory('ИИ & Промпты')
          setFormIcon('🔮')
        } else if (typeId === 'widget') {
          setFormCategory('Виджеты & Фокус')
          setFormIcon('⏱️')
        } else if (typeId === 'template') {
          setFormCategory('Бизнес & Стартапы')
          setFormIcon('🚀')
        } else if (typeId === 'theme') {
          setFormCategory('Темы & Стили')
          setFormIcon('🌌')
        } else if (typeId === 'integration') {
          setFormCategory('Утилиты & Экспорт')
          setFormIcon('🔌')
        }
      }
    }
    setIsTypeOpen(false)
  }

  const handleSelectCategory = (catId: string) => {
    setFormCategory(catId)
    setIsCategoryOpen(false)
  }

  const handleFormatFormJson = () => {
    try {
      const parsed = JSON.parse(formCode)
      setFormCode(JSON.stringify(parsed, null, 2))
      showToast('✓ JSON успешно отформатирован и проверен!', 'success')
    } catch (e: any) {
      showToast(`Ошибка в JSON: ${e.message || 'неверный синтаксис'}`, 'error')
    }
  }

  const handleApplyPresetJson = (typeId: 'widget' | 'template' | 'theme' | 'integration' | 'prompt') => {
    const matchingType = EXTENSION_TYPES.find(t => t.id === typeId)
    if (matchingType) {
      setFormCode(JSON.stringify(matchingType.defaultJson, null, 2))
    }
  }

  const handlePlayWidget = (ext: ExtensionItem) => {
    if (!isPlusOrHigher) {
      promptUpgradeToPlus('запуска интерактивных виджетов')
      return
    }
    if (ext.id === 'ext_entropy_search' || ext.title.toLowerCase().includes('entropy')) {
      dispatch({ type: 'SET_VIEW', view: 'entropy' })
      window.dispatchEvent(new CustomEvent('zerf_open_entropy_search'))
      return
    }
    if (ext.id === 'ext_zerfic_live' || ext.title.toLowerCase().includes('zerfic')) {
      setShowZerficLiveModal(true)
      return
    }
    setActiveWidgetExt(ext)
  }

  const handleOpenCardModal = () => {
    if (boundCard) {
      setCardPayoutType(boundCard.payoutType || 'yoomoney')
      setCardNumberInput(boundCard.cardNumber || '')
      setCardBankInput(boundCard.bankName || '')
      setCardRecipientInput(boundCard.recipientName || '')
    } else {
      setCardPayoutType('yoomoney')
      setCardNumberInput('')
      setCardBankInput('')
      setCardRecipientInput('')
    }
    setShowCardModal(true)
  }

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanNumber = cardNumberInput.replace(/\s+/g, '')

    if (cardPayoutType === 'yoomoney') {
      if (cleanNumber.length < 14 || cleanNumber.length > 16 || !cleanNumber.startsWith('41001')) {
        showToast('Введите корректный номер счёта ЮMoney (14–16 цифр, начинается с 41001)', 'error')
        return
      }
    } else {
      if (cleanNumber.length < 16 || cleanNumber.length > 19) {
        showToast('Номер банковской карты должен содержать от 16 до 19 цифр', 'error')
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
        showToast('Недействительный номер карты. Проверьте правильность введённых цифр.', 'error')
        return
      }
      if (!cardBankInput) {
        showToast('Пожалуйста, выберите банк вашей карты', 'error')
        return
      }
    }

    try {
      setActionLoading('save_card')
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bind_card',
          payoutType: cardPayoutType,
          cardNumber: cleanNumber,
          bankName: cardBankInput || (cardPayoutType === 'yoomoney' ? 'ЮMoney' : 'Карта РФ'),
          recipientName: cardRecipientInput,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBoundCard(data.boundCard)
        setShowCardModal(false)
        setShowExtBankDropdown(false)
        showToast('✓ Реквизиты ЮMoney / карты успешно сохранены!', 'success')
      } else {
        showToast(data.error || 'Ошибка при сохранении реквизитов', 'error')
      }
    } catch {
      showToast('Ошибка при сохранении реквизитов', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnbindCard = async () => {
    const ok = await confirmDialog({
      title: 'Отвязать кошелёк ЮMoney / карту?',
      description: 'Вы сможете привязать новый кошелёк ЮMoney или карту в любой момент.',
      confirmText: 'Да, отвязать',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return

    try {
      setActionLoading('unbind_card')
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unbind_card' }),
      })
      const data = await res.json()
      if (data.success) {
        setBoundCard(null)
        showToast('✓ Реквизиты выплат успешно отвязаны', 'info')
      }
    } catch {
      showToast('Ошибка при отвязке карты', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenCreate = () => {
    setEditingExt(null)
    setFormTitle('')
    setFormDescription('')
    setFormIcon('🔮')
    setFormCategory('ИИ & Промпты')
    setFormType('prompt')
    setFormMinPlan('free')
    setFormPrice(0)
    setFormVersion('1.0.0')
    setFormIsPublished(false) // Default to unpublished draft
    setFormIsRunnable(false)
    setFormHostingUrl('')
    setFormSelfHosted(false)
    setPingResult(null)
    setFormChangelog('')
    setFormGithubUrl('')
    setFormAiInstructions('')
    setFormTriggers('')
    const defaultTemplate = EXTENSION_TYPES.find(t => t.id === 'prompt')?.defaultJson || {}
    setFormCode(JSON.stringify(defaultTemplate, null, 2))
    setEditorActiveTab('ai')
    setIsCategoryOpen(false)
    setIsTypeOpen(false)
    setShowEditorModal(true)
  }

  const handleOpenEdit = (ext: ExtensionItem) => {
    setEditingExt(ext)
    setFormTitle(ext.title || '')
    setFormDescription(ext.description || '')
    setFormIcon(ext.icon || '🧩')
    setFormCategory(ext.category || 'ИИ & Промпты')
    setFormType(ext.type || 'widget')
    setFormMinPlan(ext.minPlan || 'free')
    setFormPrice(ext.price || 0)
    setFormVersion(ext.version || '1.0.0')
    setFormIsPublished(ext.isPublished !== false)
    setFormIsRunnable(Boolean(ext.isRunnable || ext.content?.isRunnable))
    setFormHostingUrl(ext.hostingUrl || (ext.content?.hostingUrl || ''))
    setFormSelfHosted(Boolean(ext.selfHosted || ext.content?.selfHosted))
    setPingResult(null)
    setFormChangelog(ext.changelog || '')
    setFormGithubUrl(ext.githubUrl || '')
    setFormAiInstructions(ext.aiInstructions || ext.content?.aiInstructions || '')
    setFormTriggers(Array.isArray(ext.triggers) ? ext.triggers.join(', ') : (ext.content?.triggers ? (Array.isArray(ext.content.triggers) ? ext.content.triggers.join(', ') : ext.content.triggers) : ''))
    setFormCode(JSON.stringify(ext.content || {}, null, 2))
    setEditorActiveTab('ai')
    setIsCategoryOpen(false)
    setIsTypeOpen(false)
    setShowEditorModal(true)
  }

  const handlePingHost = async () => {
    if (!formHostingUrl.trim()) return
    setIsPingingHost(true)
    setPingResult(null)
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping_host', hostingUrl: formHostingUrl.trim() }),
      })
      const data = await res.json()
      setPingResult(data)
    } catch {
      setPingResult({ reachable: false, error: 'Ошибка сети при проверке сервера' })
    } finally {
      setIsPingingHost(false)
    }
  }

  const handleToggleAutoRenew = async (nextVal: boolean) => {
    setAutoRenewEnabled(nextVal)
    try {
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_autorenew', enabled: nextVal }),
      })
    } catch {}
  }

  const handleSaveCustomExtension = async () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      showToast('Заполните название и описание расширения', 'error')
      return
    }

    let parsedContent: Record<string, any> = {}
    if (formCode.trim()) {
      try {
        parsedContent = JSON.parse(formCode)
      } catch {
        showToast('Ошибка синтаксиса JSON в поле конфигурации/кода', 'error')
        return
      }
    }

    try {
      setActionLoading('save_ext')
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish_github',
          id: editingExt?.id,
          title: formTitle.trim(),
          description: formDescription.trim(),
          type: formType,
          category: formCategory,
          icon: formIcon.trim() || '🧩',
          githubUrl: formGithubUrl.trim(),
          version: formVersion.trim() || '1.0.0',
          isPublished: formIsPublished,
          isDisabledByOwner: !formIsPublished,
          isRunnable: formIsRunnable,
          hostingUrl: formHostingUrl.trim(),
          selfHosted: formSelfHosted || Boolean(formHostingUrl.trim()),
          changelog: formChangelog.trim(),
          price: Number(formPrice) || 0,
          minPlan: formMinPlan,
          aiInstructions: formAiInstructions.trim(),
          triggers: formTriggers.split(',').map(s => s.trim()).filter(Boolean),
          content: parsedContent,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowEditorModal(false)
        setEditingExt(null)
        fetchExtensions()
        showToast(
          editingExt
            ? `✓ Настройки и версия расширения «${formTitle}» успешно сохранены!`
            : `✓ Расширение «${formTitle}» успешно сохранено!`,
          'success'
        )
      } else {
        showToast(data.error || 'Ошибка сохранения', 'error')
      }
    } catch {
      showToast('Ошибка при сохранении', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleEnable = async (extensionId: string) => {
    const isCurrentlyEnabled = enabledIds.includes(extensionId)
    const nextEnabled = isCurrentlyEnabled
      ? enabledIds.filter(id => id !== extensionId)
      : [...enabledIds, extensionId]
    
    // Instant optimistic update
    setEnabledIds(nextEnabled)

    try {
      setActionLoading(`toggle_${extensionId}`)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_enable', extensionId }),
      })
      const data = await res.json()
      if (data.success) {
        setEnabledIds(data.enabledIds || nextEnabled)
        window.dispatchEvent(new CustomEvent('zerf_extensions_updated'))
        window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
        showToast(isCurrentlyEnabled ? '⚪ Расширение отключено' : '🟢 Расширение включено', 'info')
      } else {
        setEnabledIds(enabledIds) // rollback
        showToast(data.error || 'Ошибка изменения статуса', 'error')
      }
    } catch {
      setEnabledIds(enabledIds) // rollback
      showToast('Ошибка изменения статуса', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleInstall = async (extensionId: string) => {
    if (actionLoading) return

    if (maxExtensionsAllowed !== -1 && installedIds.length >= maxExtensionsAllowed && !installedIds.includes(extensionId)) {
      const ok = await confirmDialog({
        title: '🔒 Достигнут лимит расширений',
        description: `На вашем тарифе (${userPlan.toUpperCase()}) доступно максимум ${maxExtensionsAllowed} расширений (у вас установлено: ${installedIds.length}).\n\n• Базовый: до 5 расширений\n• Zerf Plus (99 ₽): до 10 расширений\n• Zerf Pro (299 ₽): до 50 расширений\n• Corp: Безлимитно\n\nХотите улучшить тариф в Настройках?`,
        confirmText: 'Улучшить тариф',
        cancelText: 'Закрыть',
        variant: 'primary',
      })
      if (ok) {
        dispatch({ type: 'SET_VIEW', view: 'settings' })
      }
      return
    }

    setActionLoading(extensionId)

    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', extensionId }),
      })
      const data = await res.json()

      if (data.success) {
        const finalInstalled = Array.from(new Set([...(data.installedIds || installedIds), extensionId]))
        const finalEnabled = Array.from(new Set([...(data.enabledIds || enabledIds), extensionId]))
        setInstalledIds(finalInstalled)
        setEnabledIds(finalEnabled)
        setCatalog(prev => prev.map(item => item.id === extensionId ? { ...item, installCount: (item.installCount || 0) + 1 } : item))
        try {
          localStorage.setItem('zerf_installed_extensions', JSON.stringify(finalInstalled))
          localStorage.setItem('zerf_enabled_extensions', JSON.stringify(finalEnabled))
        } catch {}
        window.dispatchEvent(new CustomEvent('zerf_extensions_updated'))
        window.dispatchEvent(new CustomEvent('zerf_extension_installed', { detail: { extensionId } }))
        window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
        showToast('✓ Расширение успешно установлено в панель!', 'success')
      } else {
        if (data.requiresPlan || data.requiresUpgrade) {
          const ok = await confirmDialog({
            title: '⭐ Требуется тариф Plus / Pro',
            description: data.error || 'Для установки этого расширения требуется тариф Zerf Plus или выше.',
            confirmText: 'Перейти к тарифам',
            cancelText: 'Закрыть',
            variant: 'primary',
          })
          if (ok) dispatch({ type: 'SET_VIEW', view: 'settings' })
        } else {
          showToast(data.error || 'Ошибка при установке расширения', 'error')
        }
      }
    } catch {
      showToast('Ошибка сети при установке расширения', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUninstall = async (extensionId: string) => {
    // Instant optimistic update
    const nextInstalled = installedIds.filter(id => id !== extensionId)
    const nextEnabled = enabledIds.filter(id => id !== extensionId)
    setInstalledIds(nextInstalled)
    setEnabledIds(nextEnabled)
    try {
      localStorage.setItem('zerf_installed_extensions', JSON.stringify(nextInstalled))
      localStorage.setItem('zerf_enabled_extensions', JSON.stringify(nextEnabled))
    } catch {}
    setCatalog(prev => prev.map(item => item.id === extensionId ? { ...item, installCount: Math.max(0, (item.installCount || 1) - 1) } : item))
    window.dispatchEvent(new CustomEvent('zerf_extensions_updated'))
    window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))

    try {
      setActionLoading(extensionId)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', extensionId }),
      })
      const data = await res.json()
      if (data.success) {
        const finalInstalled = data.installedIds || nextInstalled
        const finalEnabled = data.enabledIds || nextEnabled
        setInstalledIds(finalInstalled)
        setEnabledIds(finalEnabled)
        try {
          localStorage.setItem('zerf_installed_extensions', JSON.stringify(finalInstalled))
          localStorage.setItem('zerf_enabled_extensions', JSON.stringify(finalEnabled))
        } catch {}
        window.dispatchEvent(new CustomEvent('zerf_extensions_updated'))
        window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
        showToast('✓ Расширение удалено из вашего списка', 'info')
      } else {
        // Rollback
        setInstalledIds(prev => Array.from(new Set([...prev, extensionId])))
        setEnabledIds(prev => Array.from(new Set([...prev, extensionId])))
        setCatalog(prev => prev.map(item => item.id === extensionId ? { ...item, installCount: (item.installCount || 0) + 1 } : item))
        showToast(data.error || 'Ошибка при удалении', 'error')
      }
    } catch {
      // Rollback
      setInstalledIds(prev => Array.from(new Set([...prev, extensionId])))
      setEnabledIds(prev => Array.from(new Set([...prev, extensionId])))
      setCatalog(prev => prev.map(item => item.id === extensionId ? { ...item, installCount: (item.installCount || 0) + 1 } : item))
      showToast('Ошибка при удалении', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBuy = async (ext: ExtensionItem) => {
    const gatewayFee = Math.round(ext.price * 0.035)
    const netTotal = Math.max(0, ext.price - gatewayFee)
    const authorShare = Math.round(netTotal * 0.80)
    const platformShare = netTotal - authorShare

    const ok = await confirmDialog({
      title: `Приобрести «${ext.title}»?`,
      description: `Стоимость расширения: ${ext.price} ₽.\n\n• Комиссия платёжного шлюза (3.5%): -${gatewayFee} ₽\n• Чистая сумма: ${netTotal} ₽\n• Доход автора (80%): ${authorShare} ₽\n• Доля платформы (20%): ${platformShare} ₽\n\nОплата защищена официальным шлюзом ЮMoney. После оплаты расширение будет сразу установлено в ваш аккаунт.`,
      confirmText: `Перейти к оплате (${ext.price} ₽)`,
      cancelText: 'Отмена',
      variant: 'primary',
    })
    if (!ok) return

    try {
      setActionLoading(ext.id)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buy', extensionId: ext.id }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl
        } else if (data.installedIds) {
          setInstalledIds(data.installedIds)
          showToast(`🎉 Расширение «${ext.title}» успешно установлено!`, 'success')
        }
      } else {
        showToast(data.error || 'Ошибка при покупке', 'error')
      }
    } catch {
      showToast('Ошибка покупки', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteMyExt = async (extensionId: string) => {
    const ext = catalog.find(e => e.id === extensionId)
    const extTitle = ext ? ext.title : 'это расширение'
    const ok = await confirmDialog({
      title: `Удалить «${extTitle}»?`,
      description: 'Расширение будет полностью удалено из каталога магазина и больше не будет доступно для установки пользователями.',
      confirmText: 'Удалить расширение',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return

    try {
      setActionLoading(`del_${extensionId}`)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', extensionId }),
      })
      const data = await res.json()
      if (data.success) {
        setCatalog(prev => prev.filter(e => e.id !== extensionId))
        setInstalledIds(prev => prev.filter(id => id !== extensionId))
        try {
          const cached = localStorage.getItem('zerf_ext_catalog_cache')
          if (cached) {
            const parsed = JSON.parse(cached)
            parsed.catalog = (parsed.catalog || []).filter((e: any) => e.id !== extensionId)
            parsed.installedIds = (parsed.installedIds || []).filter((id: string) => id !== extensionId)
            localStorage.setItem('zerf_ext_catalog_cache', JSON.stringify(parsed))
          }
        } catch {}
        fetchExtensions()
        showToast('✓ Расширение удалено из каталога', 'info')
      } else {
        showToast(data.error || 'Не удалось удалить расширение', 'error')
      }
    } catch {
      showToast('Ошибка при удалении', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const openReviewsModal = async (ext: ExtensionItem) => {
    setReviewsExt(ext)
    setReviewsList([])
    setUserCommentInput('')
    setUserRatingInput(5)
    setLoadingReviews(true)
    try {
      const res = await fetch(`/api/extensions?action=get_reviews&extensionId=${encodeURIComponent(ext.id)}`, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.reviews)) {
        setReviewsList(data.reviews)
        const myChatId = currentChatId
        const myRev = data.reviews.find((r: any) => String(r.chatId) === String(myChatId))
        if (myRev) {
          setUserRatingInput(myRev.rating || 5)
          setUserCommentInput(myRev.comment || '')
        }
      }
    } catch {} finally {
      setLoadingReviews(false)
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewsExt) return
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'rate_extension',
          extensionId: reviewsExt.id,
          rating: userRatingInput,
          comment: userCommentInput,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setReviewsList(data.reviews || [])
        setCatalog(prev => prev.map(item => item.id === reviewsExt.id ? { ...item, rating: data.rating, ratingCount: data.ratingCount } : item))
        setReviewsExt(prev => prev ? { ...prev, rating: data.rating, ratingCount: data.ratingCount } : null)
        showToast('✓ Ваш отзыв и оценка успешно сохранены!', 'success')
      } else {
        showToast(data.error || 'Не удалось сохранить оценку', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка сети', 'error')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!reviewsExt) return
    const ok = await confirmDialog({
      title: 'Удалить отзыв?',
      description: 'Ваш отзыв и оценка будут удалены.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'delete_review',
          extensionId: reviewsExt.id,
          reviewId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setReviewsList(data.reviews || [])
        setCatalog(prev => prev.map(item => item.id === reviewsExt.id ? { ...item, rating: data.rating, ratingCount: data.ratingCount } : item))
        setReviewsExt(prev => prev ? { ...prev, rating: data.rating, ratingCount: data.ratingCount } : null)
        showToast('Отзыв удален', 'info')
      }
    } catch {}
  }

  // Filtered and Sorted catalog
  const filteredCatalog = useMemo(() => {
    const seenGh = new Set<string>()
    const seenIds = new Set<string>()

    const uniqueCatalog: ExtensionItem[] = []
    catalog.forEach(ext => {
      if (seenIds.has(ext.id)) return
      const gh = (ext.githubUrl || '').trim().toLowerCase().replace(/\/$/, '')
      if (gh && seenGh.has(gh)) return
      if (gh) seenGh.add(gh)
      seenIds.add(ext.id)
      uniqueCatalog.push(ext)
    })

    const list = uniqueCatalog.filter(ext => {
      // Strictly exclude themes from extensions catalog (themes belong exclusively in Settings -> Appearance)
      if (ext.type === 'theme' || ext.category === 'Темы & Стили') return false

      const matchesSearch = ext.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ext.githubUrl && ext.githubUrl.toLowerCase().includes(searchQuery.toLowerCase()))
      
      if (selectedCategory === 'core') {
        const isCore = ext.isOfficial || ext.authorChatId === 'system' || ext.id === 'ext_entropy_search' || ext.id.startsWith('ext_starter_') || ext.title.toLowerCase().includes('entropy') || ext.title.toLowerCase().includes('zerfic')
        return matchesSearch && isCore
      }
      if (selectedCategory === 'all') return matchesSearch
      return matchesSearch && (ext.type === selectedCategory || ext.category?.toLowerCase().includes(selectedCategory.toLowerCase()))
    })

    if (sortBy === 'top_likes') {
      return list.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
    }
    if (sortBy === 'popular') {
      return list.sort((a, b) => (b.installCount || 0) - (a.installCount || 0))
    }
    if (sortBy === 'newest') {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return list
  }, [catalog, selectedCategory, searchQuery, sortBy])

  const installedExtensions = useMemo(() => {
    return catalog.filter(ext => installedIds.includes(ext.id))
  }, [catalog, installedIds])

  const myExtensions = useMemo(() => {
    if (!currentChatId) return []
    return catalog.filter(ext => ext.authorChatId === currentChatId)
  }, [catalog, currentChatId])

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6 pb-20">
      {/* Top Banner / Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-card via-card to-primary/10 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-9 h-9 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              🧩
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Магазин расширений & GitHub Plugins · Zerf Note
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Создавайте свои репозитории на GitHub с манифестом <b>`zerf-extension.json`</b>, подключайте интерактивные виджеты и темы в Zerf Note без расхода токенов и получайте <b>80%</b> авторских выплат!
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowSpecModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-all cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>Спецификация GitHub</span>
          </button>

          {canCreateFinal ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSpecModal(true)}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Создать расширение</span>
              </button>
              <button
                onClick={() => setShowGithubModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-all cursor-pointer"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>Из GitHub</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSpecModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[11px] text-amber-400 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Публикация (Тариф Plus)</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground/80 hover:text-foreground border border-border transition-all cursor-pointer ml-1"
              title="Закрыть магазин (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/80 pb-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {[
          { id: 'store', label: 'Каталог (Store)', icon: Puzzle, count: catalog.length },
          { id: 'installed', label: 'Установленные', icon: Check, count: installedExtensions.length },
          { id: 'my', label: 'Мои GitHub плагины', icon: GithubIcon, count: myExtensions.length },
          { id: 'earnings', label: 'Баланс & Выплаты', icon: DollarSign, badge: `${authorStats.balance} ₽` },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 select-none',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: STORE / CATALOG ── */}
      {activeTab === 'store' && (
        <div className="space-y-5">
          {/* Filters, Top sorting and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div 
              className="flex items-center gap-1.5 overflow-x-auto py-1 min-w-0 flex-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {[
                { id: 'all', label: 'Все расширения', icon: Puzzle },
                { id: 'core', label: 'Системные', icon: Sparkles },
                { id: 'widget', label: 'Виджеты', icon: Layout },
                { id: 'template', label: 'Шаблоны', icon: FileCode },
              ].map(cat => {
                const Icon = cat.icon
                const isSelected = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0 cursor-pointer select-none flex items-center gap-1.5',
                      isSelected
                        ? 'bg-card border-foreground/30 text-foreground font-bold shadow-xs ring-1 ring-foreground/20'
                        : 'bg-card/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5', isSelected ? 'text-foreground' : 'text-muted-foreground')} />
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Sorting Pills */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border shrink-0 text-xs">
                <button
                  onClick={() => setSortBy('top_likes')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium select-none',
                    sortBy === 'top_likes' ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Топ по лайкам и сердечкам"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  <span>Топ ❤️</span>
                </button>
                <button
                  onClick={() => setSortBy('popular')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium select-none',
                    sortBy === 'popular' ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Популярные
                </button>
                <button
                  onClick={() => setSortBy('newest')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium select-none',
                    sortBy === 'newest' ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Новинки
                </button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск плагинов..."
                  className="w-full h-8 pl-8 pr-3 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Plus Promo / Requirements Banner for Free tier */}
          {!isPlusOrHigher && (
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">Экосистема расширений Zerf Note</h4>
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold border border-primary/25">
                      Доступно с Zerf Plus
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Подключите тариф Zerf Plus (99 ₽), чтобы устанавливать плагины, ИИ-поиск Entropy, интерактивные виджеты, шаблоны проектов и темы.
                  </p>
                </div>
              </div>

              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <span>Оформить Zerf Plus (99 ₽)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map(ext => {
              const isInstalled = installedIds.includes(ext.id)
              const isLiked = likedIds.includes(ext.id)
              const isFree = ext.price === 0

              return (
                <div
                  key={ext.id}
                  className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between gap-4 relative group overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-xl shrink-0 overflow-hidden">
                          <ExtensionIcon icon={ext.icon} className="w-full h-full text-xl" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-bold text-foreground leading-tight truncate">
                              {ext.title}
                            </h3>
                            {ext.version && (
                              <span className="px-1.5 py-0.2 rounded-md bg-muted text-[9px] font-mono text-muted-foreground shrink-0">
                                v{ext.version}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {ext.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Min Plan Badge */}
                        {ext.minPlan && ext.minPlan !== 'free' && (
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            ext.minPlan === 'corp' && 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                            ext.minPlan === 'pro' && 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                            ext.minPlan === 'plus' && 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                          )}>
                            {ext.minPlan === 'corp' ? '✦ Corp' : ext.minPlan === 'pro' ? '★ Pro' : '◈ Plus'}
                          </span>
                        )}

                        {/* Heart / Like Button */}
                        <button
                          onClick={() => handleToggleLike(ext)}
                          className={cn(
                            'p-1.5 rounded-xl border transition-all flex items-center gap-1 cursor-pointer',
                            isLiked
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-500 font-bold scale-105'
                              : 'bg-muted/40 border-border text-muted-foreground hover:text-rose-400'
                          )}
                          title={isLiked ? 'Убрать лайк' : 'Поставить лайк ❤️'}
                        >
                          <Heart className={cn('w-3.5 h-3.5', isLiked && 'fill-rose-500')} />
                          <span className="text-[10px]">{ext.likesCount || 0}</span>
                        </button>

                        {/* Price Badge */}
                        <span className={cn(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border tracking-tight',
                          isFree
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-primary/10 text-primary border border-primary/25'
                        )}>
                          {isFree ? 'FREE' : `${ext.price} ₽`}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                      {ext.description}
                    </p>

                    {ext.githubUrl && (
                      <a
                        href={ext.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-mono"
                      >
                        <GithubIcon className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{ext.githubUrl.replace('https://github.com/', '')}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openReviewsModal(ext)
                        }}
                        className="flex items-center gap-1 hover:text-amber-400 cursor-pointer transition-colors p-1 -m-1 rounded-lg hover:bg-amber-500/10"
                        title="Посмотреть отзывы и поставить оценку"
                      >
                        <Star className={cn('w-3 h-3', (ext.ratingCount || 0) > 0 ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/60')} />
                        <b className="text-foreground">{ext.rating ? ext.rating.toFixed(1) : '5.0'}</b>
                        <span className="text-[10px] text-muted-foreground">({ext.ratingCount || 0})</span>
                      </button>
                      <span>{ext.installCount || 0} {(ext.installCount || 0) === 1 ? 'установка' : (ext.installCount || 0) > 1 && (ext.installCount || 0) < 5 ? 'установки' : 'установок'}</span>
                      {ext.authorGithub || (ext.authorName && !ext.authorName.toLowerCase().includes('создатель') && !ext.authorName.includes(' ')) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAuthorProfile((ext.authorGithub || ext.authorName).replace(/^@/, ''))
                          }}
                          className="inline-flex items-center gap-1 font-medium text-foreground/90 hover:text-primary transition-colors truncate max-w-[120px] cursor-pointer"
                          title={`Посмотреть все проекты автора @${ext.authorGithub || ext.authorName}`}
                        >
                          <GithubIcon className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                          <span>@{ext.authorGithub || ext.authorName.replace(/^@/, '')}</span>
                        </button>
                      ) : ext.isOfficial || ext.authorChatId === 'system' || ext.authorName?.toLowerCase().includes('создатель') ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                          <Crown className="w-2.5 h-2.5" />
                          Официальное
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/90 truncate max-w-[110px]" title={ext.authorName}>
                          👤 {ext.authorName || 'Автор'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 w-full pt-1">
                      <button
                        onClick={() => setSelectedExt(ext)}
                        className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer shrink-0"
                        title="Манифест"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Author Edit & Delete buttons */}
                      {(ext.authorChatId === currentChatId || (canCreate && ext.authorChatId === 'system')) && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(ext)}
                            className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs transition-colors cursor-pointer shrink-0"
                            title="Редактировать параметры и код"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMyExt(ext.id)}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors cursor-pointer shrink-0"
                            title="Удалить из магазина"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Template Quick Apply button */}
                      {ext.type === 'template' && (
                        <button
                          onClick={() => handleApplyTemplate(ext)}
                          disabled={actionLoading === `apply_${ext.id}`}
                          className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs border border-primary/20 transition-all flex items-center justify-center cursor-pointer shrink-0"
                          title="Создать задачи по этому шаблону в Zerf Note"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Check if extension is runnable (explicitly runnable with interactive UI) */}
                      {(() => {
                        const isRunnable = Boolean(
                          ext.isRunnable ||
                          ext.content?.isRunnable === true ||
                          ext.content?.action === 'run' ||
                          ext.id === 'ext_entropy_search'
                        )
                        const isEnabled = enabledIds.includes(ext.id)

                        return (
                          <>
                            {/* Runnable Widget Play (ONLY if isRunnable AND isInstalled AND isEnabled) */}
                            {isRunnable && isInstalled && isEnabled && (
                              <button
                                onClick={() => handlePlayWidget(ext)}
                                className="p-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs border border-primary transition-all flex items-center justify-center cursor-pointer shrink-0 shadow-xs"
                                title="Запустить интерактивный виджет"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}

                            {isInstalled ? (
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <button
                                  onClick={() => handleToggleEnable(ext.id)}
                                  disabled={actionLoading === `enable_${ext.id}`}
                                  className={cn(
                                    "flex-1 min-w-0 h-8 px-2.5 rounded-xl font-semibold text-xs transition-all border flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs",
                                    isEnabled
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                      : "bg-muted/80 text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                                  )}
                                  title={isEnabled ? "Расширение активно. Нажмите, чтобы отключить" : "Расширение отключено. Нажмите, чтобы включить"}
                                >
                                  {isEnabled ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                                      <span className="truncate">Включено</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                      <span className="truncate">Включить</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleUninstall(ext.id)}
                                  disabled={actionLoading === ext.id}
                                  className="p-2 h-8 rounded-xl bg-muted/60 hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 border border-border transition-all flex items-center justify-center cursor-pointer shrink-0"
                                  title="Удалить расширение с аккаунта"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : isFree ? (
                              <button
                                onClick={() => handleInstall(ext.id)}
                                disabled={actionLoading === ext.id}
                                className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-80 active:scale-95"
                              >
                                {actionLoading === ext.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                    <span className="truncate">Установка...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">Установить</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBuy(ext)}
                                disabled={actionLoading === ext.id}
                                className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary-foreground/90" />
                                <span className="truncate">Купить за {ext.price} ₽</span>
                              </button>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: INSTALLED EXTENSIONS ── */}
      {activeTab === 'installed' && (
        <div className="space-y-4">
          {!isPlusOrHigher && (
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">Установка расширений доступна с Zerf Plus</h4>
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold border border-primary/25">
                      от 99 ₽
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Подключите тариф Zerf Plus, чтобы устанавливать любые виджеты, AI-поиск, интеграции и шаблоны без ограничений.
                  </p>
                </div>
              </div>

              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <span>Оформить Zerf Plus (99 ₽)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {installedExtensions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-2">
              <p className="text-sm font-bold text-foreground">Нет установленных расширений</p>
              <p className="text-xs text-muted-foreground">
                {!isPlusOrHigher
                  ? 'Оформите Zerf Plus для подключения и запуска расширений в вашей рабочей среде.'
                  : 'Перейдите во вкладку «Каталог» и подключите любые виджеты или плагины с GitHub.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {installedExtensions.map(ext => (
                <div
                  key={ext.id}
                  className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                      <ExtensionIcon icon={ext.icon} className="w-full h-full text-xl" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{ext.title}</h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{ext.description}</p>
                    </div>
                  </div>

                  {(() => {
                    const isRunnable = Boolean(
                      ext.isRunnable ||
                      ext.content?.isRunnable === true ||
                      ext.content?.action === 'run' ||
                      ext.id === 'ext_entropy_search'
                    )
                    const isEnabled = enabledIds.includes(ext.id)

                    return (
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle Enable/Disable Button */}
                        <button
                          onClick={() => handleToggleEnable(ext.id)}
                          disabled={actionLoading === `enable_${ext.id}`}
                          className={cn(
                            "px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs",
                            isEnabled
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-muted/80 text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                          )}
                          title={isEnabled ? "Расширение активно. Нажмите, чтобы отключить" : "Расширение отключено. Нажмите, чтобы включить"}
                        >
                          {isEnabled ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                              <span>Включено</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                              <span>Включить</span>
                            </>
                          )}
                        </button>

                        {/* Run Button (ONLY IF isRunnable AND isEnabled) */}
                        {isRunnable && isEnabled && (
                          <button
                            onClick={() => handlePlayWidget(ext)}
                            className="px-2.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs border border-primary transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title="Запустить интерактивный виджет"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Запустить</span>
                          </button>
                        )}

                        {ext.type === 'template' && (
                          <button
                            onClick={() => handleApplyTemplate(ext)}
                            className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors cursor-pointer"
                            title="Создать задачи в Zerf Note"
                          >
                            Применить
                          </button>
                        )}
                        {ext.githubUrl && (
                          <button
                            onClick={() => handleSyncGithub(ext.id)}
                            disabled={actionLoading === ext.id}
                            className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                            title="Подтянуть обновления из GitHub"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", actionLoading === ext.id && "animate-spin text-primary")} />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedExt(ext)}
                          className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium cursor-pointer"
                        >
                          Манифест
                        </button>
                        <button
                          onClick={() => handleUninstall(ext.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: MY GITHUB EXTENSIONS / CREATOR STUDIO ── */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {!canCreate ? (
            <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-4 max-w-xl mx-auto shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Публикация расширений доступна на тарифе Plus</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Создавайте репозитории на GitHub, парсите манифесты и публикуйте плагины для сообщества с получением <b>80% авторских выплат</b>!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setShowSpecModal(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <GithubIcon className="w-4 h-4" />
                  <span>Спецификация манифеста</span>
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Оформить Zerf Plus (99 ₽)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Ваши GitHub репозитории и расширения</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Новые расширения создаются как <b>черновики</b>. Настройте версию, описание и опубликуйте их в Store!
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer border border-border"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Создать на GitHub</span>
                  </a>
                  <button
                    onClick={() => setShowGithubModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <GithubIcon className="w-3.5 h-3.5" />
                    <span>+ Импорт репозитория</span>
                  </button>
                  <button
                    onClick={handleOpenCreate}
                    className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Создать расширение</span>
                  </button>
                </div>
              </div>

              {myExtensions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto text-xl">
                    <GithubIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-foreground">Вы пока не создали и не подключили ни одного расширения</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    Создайте репозиторий с файлом `zerf-extension.json` или сконфигурируйте расширение во встроенной Студии.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => setShowSpecModal(true)}
                      className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold cursor-pointer"
                    >
                      Инструкция и манифест
                    </button>
                    <button
                      onClick={() => setShowGithubModal(true)}
                      className="px-4 py-2 rounded-xl bg-muted border border-border text-foreground text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <GithubIcon className="w-3.5 h-3.5" />
                      <span>Импорт с GitHub</span>
                    </button>
                    <button
                      onClick={handleOpenCreate}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Создать в Студии</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myExtensions.map(ext => {
                    const isLive = ext.isPublished !== false
                    return (
                      <div
                        key={ext.id}
                        className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between gap-3 shadow-xs hover:border-primary/30 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                              <ExtensionIcon icon={ext.icon} className="w-full h-full text-2xl" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-foreground truncate">{ext.title}</h4>
                                <span className="px-1.5 py-0.2 rounded-md bg-muted text-[9px] font-mono text-muted-foreground shrink-0">
                                  v{ext.version || '1.0.0'}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {ext.category} • {ext.price === 0 ? 'FREE' : `${ext.price} ₽`} • {ext.installCount} уст. • ❤️ {ext.likesCount || 0}
                              </p>
                            </div>
                          </div>

                          {/* Live Publication Status Badge */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {ext.selfHosted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30" title={`Хостинг: ${ext.hostingUrl || 'Свой сервер'}`}>
                                ⚡ Self-Hosted
                              </span>
                            )}
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                🟢 Опубликован
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                🔴 Отключено
                              </span>
                            )}
                          </div>
                        </div>

                        {ext.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {ext.description}
                          </p>
                        )}

                        {ext.changelog && (
                          <div className="p-2 rounded-xl bg-muted/40 border border-border/60 text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <History className="w-3 h-3 text-primary shrink-0" />
                            <span className="truncate"><b>Релиз:</b> {ext.changelog}</span>
                          </div>
                        )}

                        {/* Action buttons row */}
                        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-border/60">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Settings & Version Control Button */}
                            <button
                              onClick={() => handleOpenEdit(ext)}
                              className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                              title="Настройки, контроль версий и редактирование"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>Настройки</span>
                            </button>

                            {/* Direct Publish / Unpublish Toggle */}
                            <button
                              onClick={() => handleTogglePublish(ext)}
                              disabled={actionLoading === `pub_${ext.id}`}
                              className={cn(
                                'px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                                isLive
                                  ? 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                              )}
                              title={isLive ? 'Снять расширение с публикации в каталоге' : 'Опубликовать в общем каталоге Store'}
                            >
                              {actionLoading === `pub_${ext.id}` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : isLive ? (
                                <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <ToggleLeft className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>{isLive ? 'В Store (Вкл)' : 'Опубликовать'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {ext.githubUrl && (
                              <button
                                onClick={() => handleSyncGithub(ext.id)}
                                disabled={actionLoading === ext.id}
                                className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                                title="Синхронизировать с GitHub (Pull latest commit)"
                              >
                                <RefreshCw className={cn("w-3.5 h-3.5", actionLoading === ext.id && "animate-spin text-primary")} />
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedExt(ext)}
                              className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs transition-colors cursor-pointer"
                              title="Просмотр манифеста"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMyExt(ext.id)}
                              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Удалить из каталога и базы"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: EARNINGS & REVENUE SHARE (80/20) ── */}
      {activeTab === 'earnings' && (
        <div className="space-y-5">
          {/* Top Stats Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Доступно к выводу (80%)</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </p>
              <p className="text-2xl font-bold text-emerald-400">{authorStats.balance} ₽</p>
              <p className="text-[10px] text-muted-foreground">ваш чистый авторский доход</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Всего заработано</span>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </p>
              <p className="text-2xl font-bold text-blue-400">{authorStats.totalEarned} ₽</p>
              <p className="text-[10px] text-muted-foreground">за всё время продаж</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Продаж плагинов</span>
                <Sparkles className="w-4 h-4 text-primary" />
              </p>
              <p className="text-2xl font-bold text-foreground">{authorStats.salesCount}</p>
              <p className="text-[10px] text-muted-foreground">успешных покупок клиентами</p>
            </div>
          </div>

          {/* Bound Payout Card / SBP Section */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xl shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Привязанные реквизиты для выплат</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Куда переводятся средства с продаж ваших плагинов
                  </p>
                </div>
              </div>

              {boundCard ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenCardModal}
                    className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-border"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Изменить реквизиты</span>
                  </button>
                  <button
                    onClick={handleUnbindCard}
                    disabled={actionLoading === 'unbind_card'}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer border border-rose-500/20"
                    title="Отвязать карту"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenCardModal}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Привязать ЮMoney (80%)</span>
                </button>
              )}
            </div>

            {boundCard ? (
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center font-bold text-sm text-foreground shrink-0 shadow-2xs">
                    {boundCard.payoutType === 'yoomoney' ? '🟣' : '💳'}
                  </div>
                  <div>
                    <div className="font-bold text-foreground flex items-center gap-2">
                      <span>
                        {boundCard.payoutType === 'yoomoney'
                          ? `ЮMoney: ${boundCard.cardNumber}`
                          : `Карта РФ: •••• ${boundCard.cardNumber ? boundCard.cardNumber.slice(-4) : '••••'}`}
                      </span>
                      {boundCard.bankName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-card border border-border text-muted-foreground font-medium">
                          {boundCard.bankName}
                        </span>
                      )}
                    </div>
                    {boundCard.recipientName && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Получатель: {boundCard.recipientName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 w-fit">
                  <Check className="w-3.5 h-3.5" />
                  <span>Автовыплаты активны (80%)</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-muted/20 border border-dashed border-border/80 text-center space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Реквизиты пока не привязаны. Привяжите кошелёк ЮMoney (41001...) или карту РФ для автоматических выплат 80%.
                </p>
              </div>
            )}
          </div>

          {/* Subscription Auto-Renewal Card Setting */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-foreground">Автопродление подписки</h4>
                  <span className={cn(
                    'text-[9px] font-bold px-1.5 py-0.2 rounded-md',
                    autoRenewEnabled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {autoRenewEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {autoRenewEnabled
                    ? 'Автоматическое продление тарифа с привязанной карты в дату окончания периода.'
                    : 'Автоматические списания отключены. Доступ завершится по окончании оплаченного периода.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggleAutoRenew(!autoRenewEnabled)}
              className={cn(
                'px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all border shrink-0',
                autoRenewEnabled
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30 shadow-xs'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border-border'
              )}
            >
              {autoRenewEnabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
              <span>{autoRenewEnabled ? 'Включено' : 'Выключено'}</span>
            </button>
          </div>

          {/* Revenue Transparency & Protected Payout CTA */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Прозрачные условия монетизации и выплат (80/20)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>💰 Доход автора:</span>
                  <span className="text-emerald-400 font-bold">80% с каждой продажи</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  При покупке вашего плагина 80% суммы начисляются на баланс автора и зачисляются на привязанный ЮMoney автоматически.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>⚡ Комиссия платформы (20%):</span>
                  <span className="text-primary font-bold">Всё включено</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  20% покрывают эквайринг ЮMoney, серверную инфраструктуру и ИИ-трафик. Никаких скрытых списаний с автора.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
                    <Check className="w-4 h-4" />
                    <span>Автоматические выплаты на ЮMoney активны</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    80% от каждой продажи вашего расширения зачисляются вам на привязанный ЮMoney кошелёк автоматически. Ручные запросы не требуются.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs shrink-0 border border-emerald-500/30">
                  80/20 сплит
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GITHUB IMPORT & PARSE */}
      <AnimatePresence>
        {showGithubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <GithubIcon className="w-4 h-4" />
                  <span>Импорт и публикация манифеста из GitHub</span>
                </h3>
                <button
                  onClick={() => setShowGithubModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              {/* Mandatory Documentation & Universal Template Onboarding Banner */}
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-foreground text-xs">Документация и требования к расширениям</h4>
                      <p className="text-[10px] text-muted-foreground">Перед созданием и публикацией ознакомьтесь со спецификацией SDK и правилами безопасности</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <a
                    href="/developer?tab=docs"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold text-xs flex items-center gap-1.5 border border-purple-500/40 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Документация SDK</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <a
                    href="/zerf-extension.universal.json"
                    download="zerf-extension.universal.json"
                    className="px-3 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    <span>Универсальный JSON-шаблон</span>
                  </a>
                </div>

                <label className="flex items-center gap-2 pt-1 text-[11px] text-foreground font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasReadDocs}
                    onChange={e => {
                      setHasReadDocs(e.target.checked)
                      try { localStorage.setItem('zerf_has_read_docs', String(e.target.checked)) } catch {}
                    }}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                  <span>Я ознакомился с документацией разработчика и проверил свой манифест</span>
                </label>
              </div>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Tab Selector: My Repos vs Manual URL */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setGithubModalTab('repos')
                    if (userGithubUsername && userGithubRepos.length === 0) fetchUserGithubRepos()
                  }}
                  className={cn(
                    'flex-1 py-1.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                    githubModalTab === 'repos'
                      ? 'bg-card text-foreground font-bold shadow-xs border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <GithubIcon className="w-3.5 h-3.5" />
                  <span>Мои репозитории {userGithubRepos.length > 0 && `(${userGithubRepos.length})`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGithubModalTab('url')}
                  className={cn(
                    'flex-1 py-1.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                    githubModalTab === 'url'
                      ? 'bg-card text-foreground font-bold shadow-xs border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Вставить ссылку вручную</span>
                </button>
              </div>

              {githubModalTab === 'repos' ? (
                <div className="space-y-3">
                  {!userGithubUsername ? (
                    <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                          <GithubIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-xs">Привязка профиля GitHub</h4>
                          <p className="text-[10px] text-muted-foreground">Укажите ваш логин на GitHub для выбора проектов в 1 клик</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customGithubInput}
                          onChange={e => setCustomGithubInput(e.target.value)}
                          placeholder="например, waters1ze или octocat"
                          className="flex-1 h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground text-xs outline-none focus:border-primary font-mono"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customGithubInput.trim()) {
                              fetchUserGithubRepos(customGithubInput)
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customGithubInput.trim()) {
                              fetchUserGithubRepos(customGithubInput)
                            }
                          }}
                          disabled={loadingGithubRepos || !customGithubInput.trim()}
                          className="px-3.5 h-9 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {loadingGithubRepos ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                          <span>Загрузить</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* GitHub Profile Banner */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-[10px] shrink-0">
                            <GithubIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-bold text-foreground truncate">@{userGithubUsername}</span>
                          <span className="px-1.5 py-0.2 rounded-md bg-primary/10 text-primary text-[10px] font-mono font-bold">
                            {userGithubRepos.length} репо
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowPatInput(!showPatInput)}
                            className="px-2 py-1 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Указать GitHub Token для приватных репозиториев"
                          >
                            <Key className="w-3 h-3 text-amber-400" />
                            <span>Приватные</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fetchUserGithubRepos(userGithubUsername)}
                            disabled={loadingGithubRepos}
                            className="px-2 py-1 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Обновить репозитории"
                          >
                            <RefreshCw className={cn('w-3 h-3', loadingGithubRepos && 'animate-spin')} />
                            <span>Обновить</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUserGithubUsername('')
                              setUserGithubRepos([])
                            }}
                            className="px-2 py-1 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground text-[11px] font-semibold cursor-pointer transition-colors"
                            title="Сменить GitHub аккаунт"
                          >
                            Сменить
                          </button>
                        </div>
                      </div>

                      {/* PAT Token / OAuth Banner for Private Repositories */}
                      {showPatInput && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-amber-300 flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5" />
                              <span>Доступ к приватным репозиториям GitHub</span>
                            </p>
                            <a
                              href="/api/auth/github"
                              className="text-[10px] text-primary hover:underline font-semibold"
                            >
                              Войти через OAuth (repo) →
                            </a>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Для отображения приватных репозиториев вставьте Personal Access Token (PAT) или войдите через GitHub OAuth выше:
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              value={customPatToken}
                              onChange={e => setCustomPatToken(e.target.value)}
                              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                              className="flex-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground font-mono outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={handleSavePat}
                              disabled={savingPat || !customPatToken.trim()}
                              className="px-3 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {savingPat ? 'Сохранение...' : 'Сохранить'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Repositories Filter Pills & Search */}
                      {userGithubRepos.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setGithubRepoPrivacyFilter('all')}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                                githubRepoPrivacyFilter === 'all'
                                  ? 'bg-card text-foreground border border-border shadow-xs font-bold'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              Все ({userGithubRepos.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setGithubRepoPrivacyFilter('public')}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                                githubRepoPrivacyFilter === 'public'
                                  ? 'bg-card text-foreground border border-border shadow-xs font-bold'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              🌐 Публичные ({userGithubRepos.filter(r => !r.isPrivate).length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setGithubRepoPrivacyFilter('private')}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                                githubRepoPrivacyFilter === 'private'
                                  ? 'bg-card text-foreground border border-border shadow-xs font-bold'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              🔒 Приватные ({userGithubRepos.filter(r => r.isPrivate).length})
                            </button>
                          </div>

                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={githubRepoSearch}
                              onChange={e => setGithubRepoSearch(e.target.value)}
                              placeholder="Поиск по вашим репозиториям..."
                              className="w-full h-8 pl-8 pr-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/70"
                            />
                          </div>
                        </div>
                      )}

                      {/* Repositories List */}
                      {loadingGithubRepos ? (
                        <div className="p-8 rounded-2xl bg-muted/30 border border-border text-center space-y-2">
                          <RefreshCw className="w-5 h-5 text-primary animate-spin mx-auto" />
                          <p className="text-xs text-muted-foreground">Загрузка репозиториев с GitHub...</p>
                        </div>
                      ) : userGithubRepos.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-muted/30 border border-border text-center space-y-2">
                          <p className="text-xs font-bold text-foreground">Репозитории не найдены</p>
                          <p className="text-[11px] text-muted-foreground">
                            Создайте новый репозиторий на GitHub или вставьте ссылку на репозиторий вручную.
                          </p>
                          <button
                            type="button"
                            onClick={() => fetchUserGithubRepos(userGithubUsername)}
                            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer mt-1"
                          >
                            Повторить поиск
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {userGithubRepos
                            .filter(r => {
                              if (githubRepoPrivacyFilter === 'public' && r.isPrivate) return false
                              if (githubRepoPrivacyFilter === 'private' && !r.isPrivate) return false
                              if (!githubRepoSearch) return true
                              return (
                                r.name.toLowerCase().includes(githubRepoSearch.toLowerCase()) ||
                                r.description.toLowerCase().includes(githubRepoSearch.toLowerCase()) ||
                                r.language.toLowerCase().includes(githubRepoSearch.toLowerCase())
                              )
                            })
                            .map(repo => {
                              const isThisParsing = isParsing && githubUrl === repo.htmlUrl
                              return (
                                <div
                                  key={repo.fullName}
                                  className="p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-all flex items-center justify-between gap-3 group"
                                >
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-bold text-foreground text-xs truncate group-hover:text-primary transition-colors">
                                        {repo.name}
                                      </h5>
                                      <span className={cn(
                                        'px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0',
                                        repo.isPrivate
                                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                      )}>
                                        {repo.isPrivate ? '🔒 Private' : '🌐 Public'}
                                      </span>
                                      {repo.language && (
                                        <span className="px-1.5 py-0.2 rounded bg-muted text-muted-foreground text-[9px] font-mono shrink-0">
                                          {repo.language}
                                        </span>
                                      )}
                                      {repo.stars > 0 && (
                                        <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5 shrink-0">
                                          ★ {repo.stars}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {repo.description || 'Репозиторий проекта'}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleParseGithub(undefined, repo.htmlUrl)}
                                    disabled={isParsing}
                                    className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                  >
                                    {isThisParsing ? (
                                      <>
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        <span>Проверка...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>Импортировать</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </>
                                    )}
                                  </button>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleParseGithub} className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Ссылка на открытый репозиторий GitHub:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={githubUrl}
                        onChange={e => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/username/zerf-pomodoro-widget"
                        className="flex-1 h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary font-mono text-[11px]"
                        required
                      />
                      <button
                        type="submit"
                        disabled={isParsing}
                        className="px-3.5 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs disabled:opacity-50"
                      >
                        {isParsing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>Проверить</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      В корне репозитория (ветка `main` или `master`) должен лежать файл <b>`zerf-extension.json`</b>
                    </p>
                  </div>
                </form>
              )}

              {parsedManifest && (
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                        <ExtensionIcon icon={parsedManifest.icon} className="w-full h-full text-2xl" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{parsedManifest.title}</h4>
                        <span className="text-[10px] text-muted-foreground font-mono">v{parsedManifest.version} • {parsedManifest.type}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                      {parsedManifest.price === 0 ? 'Бесплатный' : `${parsedManifest.price} ₽`}
                    </span>
                  </div>

                  {/* Custom Avatar / Icon selector with tiny WebP compression */}
                  <div className="p-3 rounded-xl bg-card border border-border/70 space-y-2">
                    <label className="font-semibold text-foreground flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        <span>Обложка / Картинка расширения:</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">Авто-сжатие до 80x80 WebP (&lt; 3 KB)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={parsedManifest.icon || ''}
                        onChange={e => setParsedManifest({ ...parsedManifest, icon: e.target.value })}
                        placeholder="Вставьте ссылку на картинку или эмодзи"
                        className="flex-1 h-8 px-2.5 rounded-xl bg-muted/40 border border-border text-[11px] outline-none focus:border-primary font-mono"
                      />
                      <label className="h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
                        {isCompressingImage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span>{isCompressingImage ? 'Сжатие...' : 'Загрузить фото'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleGithubImageUpload}
                        />
                      </label>
                    </div>
                    {parsedManifest.icon?.startsWith('data:') && (
                      <span className="text-[9px] font-mono text-emerald-400">
                        ✓ Сжато: {(parsedManifest.icon.length * 0.75 / 1024).toFixed(1)} KB (WebP 80x80)
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {parsedManifest.description}
                  </p>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-foreground">Конфигурация из GitHub:</span>
                    <pre className="p-2.5 rounded-xl bg-card border border-border font-mono text-[10px] text-muted-foreground overflow-x-auto max-h-32">
                      {JSON.stringify(parsedManifest.content, null, 2)}
                    </pre>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={handlePublishFromGithub}
                      disabled={actionLoading === 'publish_gh'}
                      className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Опубликовать в каталоге Zerf Note</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SPECIFICATION GUIDE FOR GITHUB DEVS */}
      <AnimatePresence>
        {showSpecModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <GithubIcon className="w-4 h-4" />
                  <span>Спецификация `zerf-extension.json` для Zerf Note</span>
                </h3>
                <button
                  onClick={() => setShowSpecModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 leading-relaxed text-muted-foreground">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                      <span>1.</span> Создайте репозиторий на GitHub
                    </h4>
                    <a
                      href="https://github.com/new"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>Открыть github.com/new</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px]">
                    Создайте открытый репозиторий. Сервер Zerf Note напрямую считывает манифест без расхода токенов.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                      <span>2.</span> Добавьте файл `zerf-extension.json` в корень
                    </h4>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(SAMPLE_MANIFEST)
                        setCopiedSpec(true)
                        setTimeout(() => setCopiedSpec(false), 2000)
                      }}
                      className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSpec ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSpec ? 'Скопировано!' : 'Скопировать образец'}</span>
                    </button>
                  </div>

                  <pre className="p-3 rounded-xl bg-card border border-border font-mono text-[10px] text-foreground overflow-x-auto">
                    {SAMPLE_MANIFEST}
                  </pre>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1.5">
                  <h4 className="font-bold flex items-center gap-1.5 text-xs text-foreground">
                    <span>3.</span> Монетизация 80/20 и авто-обновления
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Укажите <b>`"price": 99`</b> в манифесте для платного расширения (80% с каждой покупки поступит на ваш баланс). При каждом `git push` в репозиторий, пользователи могут нажать кнопку «Синхронизировать» и получить свежую версию!
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setShowSpecModal(false)
                    setShowGithubModal(true)
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer hover:bg-primary/90"
                >
                  <GithubIcon className="w-3.5 h-3.5" />
                  <span>Выбрать мой репозиторий GitHub</span>
                </button>
                <a
                  href="/developer?tab=publish"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 border border-border cursor-pointer hover:bg-muted/80"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Студия разработки</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: INTERACTIVE WIDGET RUNNER */}
      <AnimatePresence>
        {activeWidgetExt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeWidgetExt.icon}</span>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{activeWidgetExt.title}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono">Виджет активен в Zerf Note</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveWidgetExt(null)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              {/* Dynamic widget interface demo */}
              <div className="p-6 rounded-2xl bg-muted/30 border border-border text-center space-y-4">
                <div className="w-20 h-20 rounded-full border-4 border-primary/40 border-t-primary flex items-center justify-center mx-auto animate-spin">
                  <Clock className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">
                    {activeWidgetExt.content?.workDuration || activeWidgetExt.content?.workMinutes || 25}:00
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Режим глубокой фокусировки</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => showToast('⏱️ Интервальный таймер запущен!', 'success')}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold cursor-pointer"
                  >
                    Старт интервала
                  </button>
                  <button
                    onClick={() => setActiveWidgetExt(null)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground font-semibold cursor-pointer"
                  >
                    Свернуть
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: PREVIEW EXTENSION */}
      <AnimatePresence>
        {selectedExt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-xl shrink-0 overflow-hidden">
                    <ExtensionIcon icon={selectedExt.icon} className="w-full h-full text-xl" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{selectedExt.title}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                      <span>{selectedExt.category}</span>
                      <span>•</span>
                      <span>Автор:</span>
                      {selectedExt.authorGithub || (selectedExt.authorName && !selectedExt.authorName.toLowerCase().includes('создатель') && !selectedExt.authorName.includes(' ')) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExt(null)
                            setSelectedAuthorProfile((selectedExt.authorGithub || selectedExt.authorName).replace(/^@/, ''))
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline font-mono cursor-pointer"
                          title={`Посмотреть все проекты автора @${selectedExt.authorGithub || selectedExt.authorName}`}
                        >
                          <GithubIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>@{selectedExt.authorGithub || selectedExt.authorName.replace(/^@/, '')}</span>
                        </button>
                      ) : selectedExt.isOfficial || selectedExt.authorChatId === 'system' || selectedExt.authorName?.toLowerCase().includes('создатель') ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-amber-400">
                          <Crown className="w-2.5 h-2.5" /> Официальное
                        </span>
                      ) : (
                        <span className="font-semibold text-foreground">{selectedExt.authorName || 'Автор расширения'}</span>
                      )}
                      {selectedExt.version && <span>(v{selectedExt.version})</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedExt(null)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 text-xs text-foreground leading-relaxed">
                {selectedExt.description}
              </div>

              {selectedExt.githubUrl && (
                <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-foreground truncate">
                    <GithubIcon className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{selectedExt.githubUrl}</span>
                  </div>
                  <a
                    href={selectedExt.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg hover:bg-muted text-primary"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {selectedExt.content && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Манифест и параметры конфигурации:</p>
                  <pre className="p-3 rounded-xl bg-card border border-border font-mono text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedExt.content, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    const ext = selectedExt
                    setSelectedExt(null)
                    openReviewsModal(ext)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{selectedExt.rating ? selectedExt.rating.toFixed(1) : '5.0'} ({selectedExt.ratingCount || 0}) • Отзывы</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {selectedExt.price === 0 ? 'FREE' : `${selectedExt.price} ₽`}
                  </span>
                  <button
                    onClick={() => setSelectedExt(null)}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs cursor-pointer shadow-xs"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: REVIEWS & RATINGS */}
      <AnimatePresence>
        {reviewsExt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                    <ExtensionIcon icon={reviewsExt.icon} className="w-full h-full text-xl" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{reviewsExt.title}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1 text-amber-400 font-bold">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {reviewsExt.rating ? reviewsExt.rating.toFixed(1) : '5.0'}
                      </span>
                      <span>•</span>
                      <span>{reviewsList.length} {reviewsList.length === 1 ? 'отзыв' : reviewsList.length > 1 && reviewsList.length < 5 ? 'отзыва' : 'отзывов'}</span>
                      <span>•</span>
                      <span>{reviewsExt.installCount || 0} установок</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setReviewsExt(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                {/* Submit / Edit My Review Form */}
                <form onSubmit={handleSubmitReview} className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Ваша оценка и отзыв:</span>
                    {/* Interactive 5 stars */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setUserRatingInput(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 text-base transition-transform hover:scale-125 cursor-pointer"
                          title={`Поставить ${star} ${star === 1 ? 'звезду' : star < 5 ? 'звезды' : 'звезд'}`}
                        >
                          <Star
                            className={cn(
                              'w-5 h-5 transition-colors',
                              (hoverRating || userRatingInput) >= star
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-muted-foreground/40'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={userCommentInput}
                    onChange={(e) => setUserCommentInput(e.target.value)}
                    placeholder="Напишите, что вам понравилось или что можно улучшить в этом расширении..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border text-foreground text-xs placeholder:text-muted-foreground/60 outline-none focus:border-primary resize-none"
                  />

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submittingReview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Опубликовать отзыв</span>
                    </button>
                  </div>
                </form>

                {/* Community Reviews List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Отзывы сообщества:</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {reviewsList.length} {reviewsList.length === 1 ? 'запись' : 'записей'}
                    </span>
                  </h4>

                  {loadingReviews ? (
                    <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>Загрузка отзывов...</span>
                    </div>
                  ) : reviewsList.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                      Пока нет отзывов к этому расширению. Будьте первым, кто поставит оценку!
                    </div>
                  ) : (
                    reviewsList.map((rev) => {
                      const isMyReview = String(rev.chatId) === String(currentChatId)
                      return (
                        <div
                          key={rev.id}
                          className="p-3 rounded-2xl bg-card border border-border/80 space-y-1.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                {(rev.authorName || 'П')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0 flex items-center gap-1.5">
                                <span className="font-bold text-xs text-foreground truncate">
                                  {rev.authorName || 'Пользователь Zerf'}
                                </span>
                                {rev.authorUsername && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    @{rev.authorUsername}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Stars */}
                              <div className="flex items-center gap-0.5 text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={cn(
                                      'w-3 h-3',
                                      i < (rev.rating || 5)
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-muted-foreground/30'
                                    )}
                                  />
                                ))}
                              </div>

                              {isMyReview && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReview(rev.id)}
                                  className="p-1 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer rounded-lg"
                                  title="Удалить мой отзыв"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {rev.comment && (
                            <p className="text-xs text-foreground/90 leading-relaxed pt-0.5">
                              {rev.comment}
                            </p>
                          )}

                          <p className="text-[9px] text-muted-foreground font-mono pt-0.5">
                            {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Недавно'}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Close Footer */}
              <div className="pt-2 border-t border-border/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setReviewsExt(null)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs cursor-pointer transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: BIND PAYOUT CARD / SBP DETAILS */}
      <AnimatePresence>
        {showCardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {boundCard ? 'Изменить реквизиты для выплат' : 'Привязать карту для выплат'}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      Для безопасного получения выплат за продажу плагинов
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCardModal(false)}
                  className="p-1 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveCard} className="space-y-3.5">
                {/* Method selector */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground text-[11px] block">Способ получения выплат:</label>
                  <div className="grid grid-cols-2 gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border">
                    {[
                      { id: 'yoomoney', icon: '🟣', label: 'ЮMoney' },
                      { id: 'card', icon: '💳', label: 'Карта РФ' },
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCardPayoutType(m.id as any)}
                        className={cn(
                          'p-2 rounded-xl text-center font-semibold text-xs transition-all cursor-pointer flex flex-col items-center gap-1',
                          cardPayoutType === m.id
                            ? 'bg-card text-foreground font-bold shadow-xs border border-border'
                            : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                        )}
                      >
                        <span className="text-sm">{m.icon}</span>
                        <span className="text-[11px] leading-none">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields based on selected method */}
                {cardPayoutType === 'yoomoney' ? (
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground text-[11px] block">Номер счёта ЮMoney (14–16 цифр: 41001...):</label>
                    <input
                      type="text"
                      value={cardNumberInput}
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '').slice(0, 16)
                        setCardNumberInput(clean)
                        setCardBankInput('ЮMoney')
                      }}
                      placeholder="4100119573095433"
                      className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-purple-500 font-mono text-xs"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground text-[11px] block">Номер банковской карты РФ:</label>
                      <input
                        type="text"
                        value={cardNumberInput}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 19)
                          const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
                          setCardNumberInput(formatted)

                          // Auto BIN bank detection
                          if (raw.startsWith('4100')) {
                            setCardBankInput('ЮMoney')
                            setCardPayoutType('yoomoney')
                          } else if (['2200', '2204', '5213', '5489', '4377', '5536'].some(p => raw.startsWith(p))) {
                            setCardBankInput('Т-Банк')
                          } else if (['2202', '4276', '5469', '4279', '6390', '6761', '6762'].some(p => raw.startsWith(p))) {
                            setCardBankInput('Сбербанк')
                          } else if (['5486', '4154', '4790', '5211', '4584'].some(p => raw.startsWith(p))) {
                            setCardBankInput('Альфа-Банк')
                          } else if (['4272', '5337', '4173', '5230'].some(p => raw.startsWith(p))) {
                            setCardBankInput('ВТБ')
                          } else if (['5599', '4084', '22007'].some(p => raw.startsWith(p))) {
                            setCardBankInput('Ozon Банк')
                          } else if (['5106', '4622'].some(p => raw.startsWith(p))) {
                            setCardBankInput('Яндекс Банк')
                          } else if (['5228', '4003', '4627'].some(p => raw.startsWith(p))) {
                            setCardBankInput('Райффайзен')
                          } else if (['5200', '4890', '5487'].some(p => raw.startsWith(p))) {
                            setCardBankInput('Газпромбанк')
                          }
                        }}
                        placeholder="2202 2000 0000 0000"
                        className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1 relative">
                        <label className="font-semibold text-foreground text-[11px] block">Банк карты:</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowExtBankDropdown(!showExtBankDropdown)}
                            className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground flex items-center justify-between gap-1.5 hover:border-primary transition-colors cursor-pointer"
                          >
                            <span className="truncate font-medium flex items-center gap-1.5">
                              <span>{POPULAR_BANKS_LIST.find(b => b.name === cardBankInput)?.icon || '💳'}</span>
                              <span>{cardBankInput || 'Выбрать банк...'}</span>
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", showExtBankDropdown && "rotate-180")} />
                          </button>

                          <AnimatePresence>
                            {showExtBankDropdown && (
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
                                      setCardBankInput(b.name)
                                      setShowExtBankDropdown(false)
                                      if (b.name === 'ЮMoney') setCardPayoutType('yoomoney')
                                    }}
                                    className={cn(
                                      "w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer",
                                      cardBankInput === b.name
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

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground text-[11px] block">ФИО получателя (опционально):</label>
                        <input
                          type="text"
                          value={cardRecipientInput}
                          onChange={e => setCardRecipientInput(e.target.value)}
                          placeholder="Иван Иванов"
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 leading-relaxed">
                  🟣 <b>80% с каждой продажи</b> вашего расширения зачисляются вам на баланс и выплачиваются автоматически на привязанные реквизиты.
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setShowCardModal(false)}
                    className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'save_card'}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {actionLoading === 'save_card' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Сохранить реквизиты</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* MODAL: ADVANCED EXTENSION STUDIO & VERSION CONTROL */}
      <AnimatePresence>
        {showEditorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center text-lg font-bold">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">
                        {editingExt ? `Студия: ${formTitle || editingExt.title}` : 'Создание нового расширения'}
                      </h3>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                        formIsPublished
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      )}>
                        {formIsPublished ? '🟢 Опубликовано в Store' : '🟡 Черновик (Не опубликован)'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Управление манифестом, семантическими версиями, описанием и монетизацией
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditorModal(false)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Sub Tabs Navigation */}
              <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border overflow-x-auto">
                {[
                  { id: 'ai', label: '🤖 ИИ & Навыки' },
                  { id: 'general', label: '📝 Основное' },
                  { id: 'version', label: `🏷️ Версии (v${formVersion || '1.0.0'})` },
                  { id: 'access', label: '💎 Статус и Монетизация' },
                  { id: 'hosting', label: '⚡ Свой сервер (Self-Host)' },
                  { id: 'code', label: '💻 JSON Код и Команды' },
                  { id: 'github', label: '🐙 GitHub Sync' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditorActiveTab(tab.id as any)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shrink-0 cursor-pointer',
                      editorActiveTab === tab.id
                        ? 'bg-card text-foreground font-bold shadow-xs border border-border'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 0: AI & SKILLS + CAPABILITY LEARNING CARDS */}
              {editorActiveTab === 'ai' && (
                <div className="space-y-4 pt-1">
                  {/* Capability Cards / Education */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Возможности и обучение для авторов расширений</span>
                      </h4>
                      <span className="text-[10px] text-muted-foreground">Telegram Бот · Siri · Web AI · CLI</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Card 1: AI Prompting & Siri */}
                      <div className="p-3 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                          <span className="text-base">🤖</span>
                          <span>Инструкции для ИИ (TG / Siri / Web)</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Задайте ролевую инструкцию для Zerf AI: как бот в Telegram и Siri должны обрабатывать задачи, форматировать факты, добавлять цитаты или теги.
                        </p>
                      </div>

                      {/* Card 2: Interactive Settings & UI */}
                      <div className="p-3 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                          <span className="text-base">🎛</span>
                          <span>Кастомные настройки и виджеты</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Определите в JSON схему настроек (<code className="text-primary font-mono text-[9px]">settingsSchema</code>): переключатели, текстовые поля, API-ключи, слайдеры, которые пользователи смогут настраивать.
                        </p>
                      </div>

                      {/* Card 3: Local Neural Networks & CLI */}
                      <div className="p-3 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                          <span className="text-base">💻</span>
                          <span>CLI и Локальные нейросети (Ollama)</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Позволяет пользователям подключать локальные модели (Ollama/LM Studio) или вызывать CLI команды (<code className="text-primary font-mono text-[9px]">/search</code>, <code className="text-primary font-mono text-[9px]">/entropy</code>).
                        </p>
                      </div>

                      {/* Card 4: Webhooks & Integrations */}
                      <div className="p-3 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                          <span className="text-base">🌐</span>
                          <span>Внешние API & Экспорт заметок</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Интегрируйте экспорт в заметки Zerf, отправку вебхуков в Notion, Linear, GitHub Issues или ваши микросервисы.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Template Inserts */}
                  <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Быстрая вставка готовых шаблонов ИИ:</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">В один клик</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormAiInstructions('Когда пользователь просит провести глубокий поиск, найти факты или исследовать тему — синтезируй данные с обязательными числовыми цитатами первоисточников [1][2], формируй структурированный отчет и предлагай экспорт в заметки Zerf.')
                          setFormTriggers('/search, /entropy, глубокий поиск, исследуй, факты')
                        }}
                        className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-left transition-all cursor-pointer space-y-1"
                      >
                        <div className="font-bold text-foreground text-xs flex items-center gap-1">
                          <span>🔮</span>
                          <span>ИИ-исследователь & Deep Search</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Синтез фактов, цитаты [1][2] и экспорт в заметки</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormAiInstructions('Ты — строгий персональный ассистент тайм-менеджмента и продуктивности. При планировании задач пользователя всегда выделяй 25-минутные интервалы Pomodoro, определяй приоритет (urgent/high/medium) и рекомендуй короткие перерывы.')
                          setFormTriggers('/pomodoro, таймер, фокус, интервал, спринт')
                        }}
                        className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-left transition-all cursor-pointer space-y-1"
                      >
                        <div className="font-bold text-foreground text-xs flex items-center gap-1">
                          <span>⚡</span>
                          <span>Pomodoro & Фокус-коуч</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Авто-интервалы фокуса и приоритеты задач</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormAiInstructions('Превращай длинные тексты и идеи пользователя в структурированные конспекты: главная суть (TL;DR), 3 ключевых вывода и список дальнейших действий (action items).')
                          setFormTriggers('/summarize, саммари, кратко, конспект, выжимка')
                        }}
                        className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-left transition-all cursor-pointer space-y-1"
                      >
                        <div className="font-bold text-foreground text-xs flex items-center gap-1">
                          <span>📝</span>
                          <span>Авто-суммаризатор заметок</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Выделение TL;DR, ключевых тезисов и action items</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormAiInstructions('Интеграция с локальной нейросетью Ollama/LM Studio по API: при вызове команд перенаправляй запросы на локальный эндпоинт http://localhost:11434 и форматируй ответ в стиле терминала.')
                          setFormTriggers('/ollama, /local, локальная сеть, cli ai')
                        }}
                        className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-left transition-all cursor-pointer space-y-1"
                      >
                        <div className="font-bold text-foreground text-xs flex items-center gap-1">
                          <span>💻</span>
                          <span>Локальная нейросеть (Ollama/CLI)</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Подключение локальных моделей через API</p>
                      </button>
                    </div>
                  </div>

                  {/* Form Inputs: AI Instructions & Triggers */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground text-[11px] flex items-center justify-between">
                      <span>Инструкция для Zerf AI (Telegram Бот, Siri, Web AI, CLI):</span>
                      <span className="text-[10px] text-muted-foreground">Промпт автора расширения</span>
                    </label>
                    <textarea
                      rows={4}
                      value={formAiInstructions}
                      onChange={e => setFormAiInstructions(e.target.value)}
                      placeholder="Опишите, как Zerf AI должен реагировать на запросы пользователя, какие поля генерировать, как форматировать ответ и какие действия выполнять..."
                      className="w-full p-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground text-[11px] flex items-center justify-between">
                      <span>Ключевые фразы и триггеры активации (через запятую):</span>
                      <span className="text-[10px] text-muted-foreground">Например: /search, /entropy, глубокий поиск</span>
                    </label>
                    <input
                      type="text"
                      value={formTriggers}
                      onChange={e => setFormTriggers(e.target.value)}
                      placeholder="/search, /entropy, глубокий поиск, исследуй, найди инсайты"
                      className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* TAB 1: GENERAL INFO */}
              {editorActiveTab === 'general' && (
                <div className="space-y-4 pt-1">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground text-[11px] block">Название расширения:</label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="Например: Entropy AI Deep Search"
                      className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs font-medium"
                    />
                  </div>

                  {/* Image / Icon Uploader (Auto-compressed to 80x80 WebP < 3KB) */}
                  <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        <span>Иконка или Картинка модуля:</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Авто-сжатие до 80x80 WebP (&lt; 3 KB)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Live Preview Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center text-2xl shrink-0 overflow-hidden shadow-2xs">
                        <ExtensionIcon icon={formIcon} className="w-full h-full text-2xl" />
                      </div>

                      {/* Controls & Upload Button */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            ref={formFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFormImageUpload}
                          />

                          <button
                            type="button"
                            onClick={() => formFileInputRef.current?.click()}
                            disabled={isCompressingImage}
                            className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                          >
                            {isCompressingImage ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ImagePlus className="w-3.5 h-3.5" />
                            )}
                            <span>{isCompressingImage ? 'Сжатие...' : 'Загрузить картинку / фото'}</span>
                          </button>

                          {(formIcon.startsWith('data:') || formIcon.startsWith('http')) && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                ✓ {formIcon.startsWith('data:') ? `${(formIcon.length * 0.75 / 1024).toFixed(1)} KB` : 'URL'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFormIcon('🧩')}
                                className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                              >
                                Сбросить к эмодзи
                              </button>
                            </div>
                          )}
                        </div>

                        {/* URL or Emoji fallback */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={formIcon}
                            onChange={e => setFormIcon(e.target.value)}
                            placeholder="Или вставьте URL картинки / эмодзи"
                            className="flex-1 h-7 px-2 rounded-lg bg-card border border-border text-[11px] outline-none focus:border-primary font-mono text-muted-foreground focus:text-foreground"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            {['🔮', '⏱️', '🚀', '🤖', '📊', '⚡', '🎨', '🛡️'].map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setFormIcon(emoji)}
                                className="w-6 h-6 rounded-md hover:bg-muted/80 flex items-center justify-center text-xs cursor-pointer transition-all"
                                title={`Выбрать ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground text-[11px] block">Описание функционала:</label>
                    <textarea
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      placeholder="Кратко опишите, что делает расширение, какие команды поддерживает и как помогает..."
                      rows={3}
                      className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs resize-none leading-relaxed"
                    />
                  </div>

                  {/* Category & Type Custom Dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Custom Category Dropdown */}
                    <div className="relative space-y-1">
                      <label className="font-semibold text-foreground text-[11px] block">Категория:</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCategoryOpen(!isCategoryOpen)
                          setIsTypeOpen(false)
                        }}
                        className="w-full h-10 px-3 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border text-foreground flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-medium truncate">
                          <span>{EXTENSION_CATEGORIES.find(c => c.id === formCategory)?.icon || '📁'}</span>
                          <span className="truncate">{formCategory}</span>
                        </div>
                        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0", isCategoryOpen && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {isCategoryOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsCategoryOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-2xl z-50 space-y-1 max-h-60 overflow-y-auto"
                            >
                              {EXTENSION_CATEGORIES.map(cat => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => handleSelectCategory(cat.id)}
                                  className={cn(
                                    "w-full p-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer",
                                    formCategory === cat.id
                                      ? "bg-primary/15 text-primary border border-primary/25"
                                      : "hover:bg-muted/80 text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-base shrink-0">{cat.icon}</span>
                                    <div className="truncate">
                                      <div className="font-semibold text-xs leading-tight truncate">{cat.label}</div>
                                      <div className="text-[10px] text-muted-foreground truncate">{cat.desc}</div>
                                    </div>
                                  </div>
                                  {formCategory === cat.id && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 2. Custom Module Type Dropdown */}
                    <div className="relative space-y-1">
                      <label className="font-semibold text-foreground text-[11px] block">Тип модуля:</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTypeOpen(!isTypeOpen)
                          setIsCategoryOpen(false)
                        }}
                        className="w-full h-10 px-3 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border text-foreground flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-medium truncate">
                          <span>{EXTENSION_TYPES.find(t => t.id === formType)?.icon || '🧩'}</span>
                          <span className="truncate">{EXTENSION_TYPES.find(t => t.id === formType)?.label || formType}</span>
                        </div>
                        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0", isTypeOpen && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {isTypeOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsTypeOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-2xl z-50 space-y-1 max-h-72 overflow-y-auto"
                            >
                              {EXTENSION_TYPES.map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleSelectType(t.id)}
                                  className={cn(
                                    "w-full p-2.5 rounded-xl text-left flex items-start justify-between transition-colors cursor-pointer",
                                    formType === t.id
                                      ? "bg-primary/15 text-primary border border-primary/25"
                                      : "hover:bg-muted/80 text-foreground"
                                  )}
                                >
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <span className="text-base shrink-0 mt-0.5">{t.icon}</span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-xs leading-tight">{t.label}</span>
                                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground font-mono">
                                          {t.badge}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{t.desc}</div>
                                    </div>
                                  </div>
                                  {formType === t.id && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2 mt-1" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Runnable toggle */}
                  <div className="p-3 rounded-2xl bg-muted/30 border border-border flex items-center justify-between gap-3">
                    <div>
                      <label className="font-semibold text-foreground text-xs block">Интерактивный запуск (Кнопка «Запустить» в интерфейсе)</label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Включите, если у расширения есть отдельное открываемое окно или интерактивный виджет (например, как у Entropy AI Search). В остальных случаях пользователи просто включают расширение на аккаунте.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormIsRunnable(!formIsRunnable)}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0",
                        formIsRunnable ? "bg-primary" : "bg-muted border border-border"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-xs",
                          formIsRunnable && "translate-x-4"
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: VERSION CONTROL & CHANGELOG */}
              {editorActiveTab === 'version' && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="font-bold text-foreground text-xs flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-primary" />
                          <span>Семантическая версия (SemVer):</span>
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Формат: <code>MAJOR.MINOR.PATCH</code> (например <code>1.0.0</code>)
                        </p>
                      </div>
                      <input
                        type="text"
                        value={formVersion}
                        onChange={e => setFormVersion(e.target.value)}
                        placeholder="1.0.0"
                        className="w-32 h-9 px-3 rounded-xl bg-card border border-border text-foreground outline-none focus:border-primary text-xs font-mono font-bold text-center"
                      />
                    </div>

                    {/* Quick Bump Buttons */}
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold">Быстрое повышение версии:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => bumpVersion('patch')}
                          className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-left transition-all cursor-pointer"
                        >
                          <div className="font-bold text-foreground text-[11px]">+ Patch (Фикс)</div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">Мелкие баги и правки</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => bumpVersion('minor')}
                          className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-left transition-all cursor-pointer"
                        >
                          <div className="font-bold text-primary text-[11px]">+ Minor (Фича)</div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">Новые функции</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => bumpVersion('major')}
                          className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-left transition-all cursor-pointer"
                        >
                          <div className="font-bold text-amber-400 text-[11px]">+ Major (Релиз)</div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">Крупное обновление</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Release Notes / Changelog */}
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground text-[11px] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-primary" />
                        <span>История изменений / Changelog этого релиза:</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">Будет видно пользователям в магазине</span>
                    </label>
                    <textarea
                      value={formChangelog}
                      onChange={e => setFormChangelog(e.target.value)}
                      placeholder="Например: Добавлена поддержка CLI команд /search, ускорен парсинг сайтов, обновлены стили карточек..."
                      rows={3}
                      className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs resize-none leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: PUBLICATION STATUS & MONETIZATION */}
              {editorActiveTab === 'access' && (
                <div className="space-y-4 pt-1">
                  {/* Publication Switch */}
                  <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span>Публикация в общем каталоге (Store)</span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formIsPublished
                          ? 'Расширение доступно для всех пользователей в витрине Zerf Note.'
                          : 'Расширение находится в режиме черновика и видно только вам.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormIsPublished(!formIsPublished)}
                      className={cn(
                        'px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all border shrink-0',
                        formIsPublished
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-xs'
                          : 'bg-muted text-muted-foreground hover:text-foreground border-border'
                      )}
                    >
                      {formIsPublished ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-amber-400" />}
                      <span>{formIsPublished ? 'Опубликовано' : 'Черновик'}</span>
                    </button>
                  </div>

                  {/* Pricing and Revenue calculation */}
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="font-bold text-foreground text-xs flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Стоимость расширения (0 = Бесплатно):</span>
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          80% чистой суммы после вычета эквайринга зачисляется сразу автору
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={5000}
                          value={formPrice}
                          onChange={e => setFormPrice(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          className="w-28 h-9 px-3 rounded-xl bg-card border border-border text-foreground outline-none focus:border-primary text-xs font-mono font-bold text-right"
                        />
                        <span className="font-bold text-foreground text-xs">₽</span>
                      </div>
                    </div>

                    {formPrice > 0 && (() => {
                      const gatewayFee = Math.round(formPrice * 0.035)
                      const netDist = Math.max(0, formPrice - gatewayFee)
                      const authorNet = Math.round(netDist * 0.80)
                      const platformNet = netDist - authorNet
                      return (
                        <div className="p-3.5 rounded-2xl bg-card border border-border/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                            <span>Цена для покупателя:</span>
                            <span className="font-bold text-foreground font-mono">{formPrice} ₽</span>
                          </div>
                          <div className="flex items-center justify-between text-amber-400/90 text-[11px]">
                            <span>Комиссия платёжного эквайринга (3.5%):</span>
                            <span className="font-mono">-{gatewayFee} ₽</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                            <span>Чистая сумма к распределению:</span>
                            <span className="font-mono text-foreground font-bold">{netDist} ₽</span>
                          </div>
                          <div className="pt-2 border-t border-border flex items-center justify-between font-bold text-emerald-400">
                            <span className="flex items-center gap-1">
                              <span>💰 Ваш чистый доход (80%):</span>
                            </span>
                            <span className="text-sm font-mono font-bold">
                              {authorNet} ₽
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Доля платформы Zerf Note (20%):</span>
                            <span className="font-mono">{platformNet} ₽</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/80 leading-tight pt-1">
                            ℹ️ Комиссия шлюза (3.5%) вычитается из суммы покупки перед начислением. Доход поступает на ваш баланс автора и выводится на привязанную карту или СБП.
                          </p>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Subscription Limit / Min Plan Selector */}
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2.5">
                    <label className="font-bold text-foreground text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        <span>Минимальный тариф для установки:</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">Требование подписки</span>
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'free', label: 'Доступно всем', sub: 'Free / Base', badge: 'bg-muted text-foreground' },
                        { id: 'plus', label: 'Zerf Plus+', sub: 'от 99 ₽/мес', badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/30' },
                        { id: 'pro', label: 'Zerf Pro', sub: 'от 299 ₽/мес', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
                        { id: 'corp', label: 'Zerf Corp', sub: 'Команды', badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormMinPlan(p.id as any)}
                          className={cn(
                            'p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between',
                            formMinPlan === p.id
                              ? 'bg-card border-primary ring-1 ring-primary shadow-xs'
                              : 'bg-card/50 border-border text-muted-foreground hover:bg-card'
                          )}
                        >
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit mb-1', p.badge)}>
                            {p.label}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{p.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SELF-HOSTING & CUSTOM SERVER ENDPOINT */}
              {editorActiveTab === 'hosting' && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-primary" />
                          <span>Хостинг крупномасштабного расширения на своём сервере</span>
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Если ваше расширение требует тяжелых вычислений, локальных моделей или собственной базы данных — вы можете захостить его на личном VPS/сервере. Zerf Note будет отправлять запросы напрямую к вашему микросервису.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormSelfHosted(!formSelfHosted)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all border shrink-0',
                          formSelfHosted
                            ? 'bg-primary/15 text-primary border-primary/30 shadow-xs'
                            : 'bg-muted text-muted-foreground hover:text-foreground border-border'
                        )}
                      >
                        {formSelfHosted ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                        <span>{formSelfHosted ? 'Self-Hosted Вкл' : 'Выкл'}</span>
                      </button>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <label className="font-semibold text-foreground text-[11px] block">
                        URL эндпоинта вашего сервера (HTTPS):
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="url"
                          value={formHostingUrl}
                          onChange={e => {
                            setFormHostingUrl(e.target.value)
                            if (e.target.value.trim()) setFormSelfHosted(true)
                          }}
                          placeholder="https://api.yourdomain.com/v1/zerf-extension"
                          className="flex-1 h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={handlePingHost}
                          disabled={isPingingHost || !formHostingUrl.trim()}
                          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0 disabled:opacity-50"
                        >
                          {isPingingHost ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Проверить пинг (Health Check)</span>
                        </button>
                      </div>

                      {pingResult && (
                        <div className={cn(
                          'p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all',
                          pingResult.reachable
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        )}>
                          <div className="flex items-center gap-2">
                            <span>{pingResult.reachable ? '🟢' : '🔴'}</span>
                            <span>
                              {pingResult.reachable
                                ? `Сервер доступен (HTTP ${pingResult.status || 200})`
                                : `Сервер недоступен: ${pingResult.error || 'Ошибка соединения'}`}
                            </span>
                          </div>
                          {pingResult.latencyMs !== undefined && (
                            <span className="font-mono text-[10px] opacity-80">{pingResult.latencyMs} ms</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: JSON CODE & MANIFEST */}
              {editorActiveTab === 'code' && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-primary" />
                        <span>Параметры конфигурации / content JSON:</span>
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        Настройте параметры, CLI команды (/search, /entropy), интервалы и правила
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleFormatFormJson}
                      className="px-3 py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
                    >
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span>Форматировать JSON</span>
                    </button>
                  </div>

                  {/* Quick Presets for Templates */}
                  <div className="p-2.5 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground block">
                      Быстро вставить готовый шаблон схемы:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {EXTENSION_TYPES.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPresetJson(preset.id)}
                          className="px-2.5 py-1 rounded-xl bg-card hover:bg-muted border border-border text-foreground text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <span>{preset.icon}</span>
                          <span>{preset.badge}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    rows={11}
                    className="w-full p-3 rounded-2xl bg-muted/40 border border-border font-mono text-[11px] text-foreground outline-none focus:border-primary resize-none leading-relaxed"
                  />
                </div>
              )}

              {/* TAB 5: GITHUB SYNC */}
              {editorActiveTab === 'github' && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                    <label className="font-bold text-foreground text-xs flex items-center gap-1.5">
                      <GithubIcon className="w-4 h-4 text-primary" />
                      <span>Привязанный GitHub репозиторий:</span>
                    </label>
                    <input
                      type="text"
                      value={formGithubUrl}
                      onChange={e => setFormGithubUrl(e.target.value)}
                      placeholder="https://github.com/username/repo-name"
                      className="w-full h-9 px-3 rounded-xl bg-card border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      При указании ссылки, платформа Zerf Note считывает файл <code>zerf-extension.json</code> прямо из корня ветки <code>main</code> без расхода токенов.
                    </p>

                    {formGithubUrl && (
                      <div className="pt-2 flex items-center gap-2">
                        <a
                          href={formGithubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1 border border-border"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Открыть репозиторий</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Save & Cancel Actions */}
              <div className="pt-3 flex items-center justify-between gap-2 border-t border-border/60">
                <div className="text-[11px] text-muted-foreground">
                  Статус: <b>{formIsPublished ? '🟢 Публичный' : '🟡 Черновик'}</b>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditorModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomExtension}
                    disabled={actionLoading === 'save_ext'}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    {actionLoading === 'save_ext' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {formIsPublished
                        ? (editingExt ? 'Сохранить и обновить в Store' : 'Опубликовать в Store')
                        : 'Сохранить черновик'}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating In-App Toast Notification (Replaces native browser alert popups) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="zerf-toast"
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 max-w-md pointer-events-auto backdrop-blur-xl transition-all',
              toast.type === 'success' && 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.35)]',
              toast.type === 'error' && 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)]',
              toast.type === 'info' && 'bg-card/95 border-border text-foreground shadow-xl'
            )}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Sparkles className="w-4 h-4 text-primary shrink-0" />}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL: AUTHOR PROFILE & PROJECTS SHOWCASE ── */}
      <AnimatePresence>
        {selectedAuthorProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto text-foreground font-sans"
            >
              {/* Author Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl font-bold">
                    👨‍💻
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        @{selectedAuthorProfile}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        Разработчик Zerf
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Все проекты и плагины, созданные данным автором
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAuthorProfile(null)}
                  className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Author Projects Grid */}
              {(() => {
                const authorProjects = catalog.filter(e => {
                  const author = (e.authorGithub || e.authorName || '').replace(/^@/, '').toLowerCase()
                  return author === selectedAuthorProfile.toLowerCase()
                })

                if (authorProjects.length === 0) {
                  return (
                    <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                      <p>У данного автора пока нет опубликованных проектов.</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>Найдено проектов: <b>{authorProjects.length}</b></span>
                      <span>Всего установок: <b>{authorProjects.reduce((acc, p) => acc + (p.installCount || 0), 0)}</b></span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {authorProjects.map(ext => {
                        const isInstalled = installedIds.includes(ext.id)
                        return (
                          <div
                            key={ext.id}
                            className="p-4 rounded-2xl bg-muted/30 border border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between gap-3 space-y-2"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-base">
                                    <ExtensionIcon icon={ext.icon} className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{ext.title}</h4>
                                    <span className="text-[10px] text-muted-foreground">{ext.category}</span>
                                  </div>
                                </div>
                                {ext.price > 0 ? (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                    {ext.price} ₽
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {ext.description}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                              <span className="text-[10px] text-muted-foreground">
                                📥 {ext.installCount || 0} установок
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  if (isInstalled) {
                                    handleUninstall(ext.id)
                                  } else {
                                    handleInstall(ext.id)
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                  isInstalled
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "bg-primary text-primary-foreground hover:brightness-110"
                                )}
                              >
                                {isInstalled ? 'Установлено' : 'Установить'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zerfic Live Voice Companion Modal */}
      <ZerficLiveModal
        isOpen={showZerficLiveModal}
        onClose={() => setShowZerficLiveModal(false)}
      />
    </div>
  )
}
