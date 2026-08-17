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
  CreditCard, Wallet, Banknote
} from 'lucide-react'
import { useApp, getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ExtensionItem } from '@/app/api/extensions/route'

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

/**
 * Compresses and downscales an image file to a tiny square avatar (80x80 WebP/JPEG)
 * resulting in minimal storage footprint (< 3 KB).
 */
export async function compressExtensionImage(file: File, maxSize = 80, quality = 0.55): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Пожалуйста, выберите файл изображения (PNG, JPG, WebP)'))
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
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
      img.onerror = () => reject(new Error('Не удалось обработать изображение'))
      img.src = src
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

export function ExtensionIcon({ icon, className = 'w-7 h-7 text-xl' }: { icon?: string; className?: string }) {
  const isImage = icon && (
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('data:image') ||
    icon.startsWith('/') ||
    icon.startsWith('blob:')
  )

  if (isImage) {
    return (
      <img
        src={icon}
        alt="Extension"
        className={cn('w-full h-full object-cover rounded-xl shrink-0 select-none pointer-events-none', className)}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none'
        }}
        loading="lazy"
      />
    )
  }

  return (
    <span className={cn('flex items-center justify-center shrink-0 select-none font-sans', className)}>
      {icon || '🧩'}
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
  { id: 'ИИ & Промпты', icon: '🔮', label: 'ИИ & Промпты', desc: 'Поисковые движки, AI синтез, Perplexity, CLI' },
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
    authorChatId: '6136950061',
    authorName: 'waters1ze',
    authorGithub: 'waters1ze',
    price: 0,
    minPlan: 'free',
    isOfficial: true,
    rating: 5.0,
    ratingCount: 12,
    likesCount: 28,
    installCount: 54,
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

export function ExtensionsView() {
  const { dispatch, syncData } = useApp()
  const confirmDialog = useConfirmDialog()
  const initialCache = getInitialExtensionsData()

  const [catalog, setCatalog] = useState<ExtensionItem[]>(initialCache.catalog)
  const [installedIds, setInstalledIds] = useState<string[]>(initialCache.installedIds)
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
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false)
  const [showSpecModal, setShowSpecModal] = useState<boolean>(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false)
  const [showCardModal, setShowCardModal] = useState<boolean>(false)
  const [boundCard, setBoundCard] = useState<{
    payoutType: 'card' | 'sbp' | 'yoomoney'
    cardNumber: string
    phone: string
    bankName: string
    recipientName?: string
    updatedAt?: string
  } | null>(null)
  const [payoutConfig, setPayoutConfig] = useState<{
    platformPercent: number
    authorPercent: number
    gatewayFeePercent: number
    minPayoutRub: number
  }>({ platformPercent: 20, authorPercent: 80, gatewayFeePercent: 3.5, minPayoutRub: 100 })
  const [cardPayoutType, setCardPayoutType] = useState<'card' | 'sbp' | 'yoomoney'>('card')
  const [cardNumberInput, setCardNumberInput] = useState<string>('')
  const [cardPhoneInput, setCardPhoneInput] = useState<string>('')
  const [cardBankInput, setCardBankInput] = useState<string>('')
  const [cardRecipientInput, setCardRecipientInput] = useState<string>('')
  const [payoutAmountInput, setPayoutAmountInput] = useState<string>('')
  const [payoutResult, setPayoutResult] = useState<{
    requestedAmount: number
    gatewayFeeRub: number
    netPayoutRub: number
  } | null>(null)
  const [payoutSuccess, setPayoutSuccess] = useState<boolean>(false)
  const [copiedSpec, setCopiedSpec] = useState<boolean>(false)

  // Custom Extension Editor / Studio Modal
  const [showEditorModal, setShowEditorModal] = useState<boolean>(false)
  const [editingExt, setEditingExt] = useState<ExtensionItem | null>(null)
  const [editorActiveTab, setEditorActiveTab] = useState<'general' | 'version' | 'access' | 'code' | 'github'>('general')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIcon, setFormIcon] = useState('🧩')
  const [formCategory, setFormCategory] = useState('ИИ & Промпты')
  const [formType, setFormType] = useState<'widget' | 'template' | 'theme' | 'integration' | 'prompt'>('prompt')
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false)
  const [isTypeOpen, setIsTypeOpen] = useState<boolean>(false)
  const [formMinPlan, setFormMinPlan] = useState<'free' | 'plus' | 'pro' | 'corp'>('free')
  const [formPrice, setFormPrice] = useState<number>(0)
  const [formVersion, setFormVersion] = useState('1.0.0')
  const [formIsPublished, setFormIsPublished] = useState<boolean>(false)
  const [formChangelog, setFormChangelog] = useState<string>('')
  const [formGithubUrl, setFormGithubUrl] = useState<string>('')
  const [formCode, setFormCode] = useState(JSON.stringify(EXTENSION_TYPES[0].defaultJson, null, 2))
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false)
  const formFileInputRef = useRef<HTMLInputElement | null>(null)

  // GitHub Import state
  const [githubUrl, setGithubUrl] = useState('')
  const [parsedManifest, setParsedManifest] = useState<any | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState<boolean>(false)

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
        setLikedIds(data.likedIds || [])
        setUserPlan(data.userPlan || 'free')
        setCanCreate(Boolean(data.canCreateExtensions))
        setAuthorStats(data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 })
        if (data.boundCard) setBoundCard(data.boundCard)
        if (data.payoutConfig) setPayoutConfig(data.payoutConfig)

        try {
          localStorage.setItem('zerf_ext_catalog_cache', JSON.stringify({
            catalog: loadedCatalog,
            installedIds: data.installedIds || [],
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
  }, [])

  const isPlusOrHigher = userPlan === 'plus' || userPlan === 'pro' || userPlan === 'corp'

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
        alert(`🎉 Шаблон «${ext.title}» успешно применён! В ваш список задач добавлено +${data.createdCount} пунктов.`)
      } else {
        if (data.requiresPlus) {
          promptUpgradeToPlus('импорта шаблонов')
        } else {
          alert(data.error || 'Ошибка применения шаблона')
        }
      }
    } catch {
      alert('Ошибка применения шаблона')
    } finally {
      setActionLoading(null)
    }
  }

  const handleParseGithub = async (e: React.FormEvent) => {
    e.preventDefault()
    setParseError(null)
    setParsedManifest(null)
    if (!githubUrl.trim()) return

    try {
      setIsParsing(true)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse_github', githubUrl: githubUrl.trim() }),
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
          isPublished: false, // Default to Draft / Unpublished
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
        alert(`✓ Репозиторий «${parsedManifest.title}» успешно добавлен в ваши плагины как черновик! Откройте настройки расширения для управления версиями и публикации в Store.`)
      } else {
        alert(data.error || 'Ошибка загрузки репозитория')
      }
    } catch {
      alert('Ошибка при импорте из GitHub')
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
        alert(`✓ Манифест успешно обновлен из последнего коммита GitHub!`)
      } else {
        alert(data.error || 'Ошибка синхронизации')
      }
    } catch {
      alert('Ошибка синхронизации')
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
      } else {
        alert(data.error || 'Ошибка изменения статуса публикации')
      }
    } catch {
      alert('Ошибка изменения статуса')
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
      alert(err.message || 'Ошибка обработки картинки')
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
      alert(err.message || 'Ошибка обработки картинки')
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
      alert('✓ JSON успешно отформатирован и проверен!')
    } catch (e: any) {
      alert(`Ошибка в JSON: ${e.message || 'неверный синтаксис'}`)
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
    setActiveWidgetExt(ext)
  }

  const handleOpenCardModal = () => {
    if (boundCard) {
      setCardPayoutType(boundCard.payoutType || 'card')
      setCardNumberInput(boundCard.cardNumber || '')
      setCardPhoneInput(boundCard.phone || '')
      setCardBankInput(boundCard.bankName || '')
      setCardRecipientInput(boundCard.recipientName || '')
    } else {
      setCardPayoutType('card')
      setCardNumberInput('')
      setCardPhoneInput('')
      setCardBankInput('')
      setCardRecipientInput('')
    }
    setShowCardModal(true)
  }

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setActionLoading('save_card')
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bind_card',
          payoutType: cardPayoutType,
          cardNumber: cardNumberInput,
          phone: cardPhoneInput,
          bankName: cardBankInput,
          recipientName: cardRecipientInput,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBoundCard(data.boundCard)
        setShowCardModal(false)
      } else {
        alert(data.error || 'Ошибка при сохранении реквизитов')
      }
    } catch {
      alert('Ошибка при сохранении реквизитов')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnbindCard = async () => {
    const ok = await confirmDialog({
      title: 'Отвязать карту / реквизиты выплат?',
      description: 'Вы сможете привязать новую карту или СБП в любой момент.',
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
      }
    } catch {
      alert('Ошибка при отвязке карты')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenPayout = () => {
    setPayoutAmountInput(String(authorStats.balance))
    setPayoutSuccess(false)
    setPayoutResult(null)
    setShowPayoutModal(true)
  }

  const handleExecutePayout = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(payoutAmountInput) || authorStats.balance
    if (amount < payoutConfig.minPayoutRub) {
      alert(`Минимальная сумма для вывода: ${payoutConfig.minPayoutRub} ₽`)
      return
    }
    if (amount > authorStats.balance) {
      alert('Запрошенная сумма превышает ваш доступный баланс')
      return
    }

    if (!boundCard) {
      alert('Сначала привяжите банковскую карту или телефон СБП для выплат')
      setShowPayoutModal(false)
      setShowCardModal(true)
      return
    }

    try {
      setActionLoading('request_payout')
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_payout',
          amount,
          payoutDetails: boundCard,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAuthorStats(data.authorStats)
        setPayoutResult(data.payout)
        setPayoutSuccess(true)
        fetchExtensions()
      } else {
        alert(data.error || 'Ошибка при оформлении заявки на вывод')
      }
    } catch {
      alert('Ошибка при оформлении заявки на вывод')
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
    setFormChangelog('')
    setFormGithubUrl('')
    const defaultTemplate = EXTENSION_TYPES.find(t => t.id === 'prompt')?.defaultJson || {}
    setFormCode(JSON.stringify(defaultTemplate, null, 2))
    setEditorActiveTab('general')
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
    setFormChangelog(ext.changelog || '')
    setFormGithubUrl(ext.githubUrl || '')
    setFormCode(JSON.stringify(ext.content || {}, null, 2))
    setEditorActiveTab('general')
    setIsCategoryOpen(false)
    setIsTypeOpen(false)
    setShowEditorModal(true)
  }

  const handleSaveCustomExtension = async () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      alert('Заполните название и описание расширения')
      return
    }

    let parsedContent = {}
    if (formCode.trim()) {
      try {
        parsedContent = JSON.parse(formCode)
      } catch {
        alert('Ошибка синтаксиса JSON в поле конфигурации/кода')
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
          changelog: formChangelog.trim(),
          price: Number(formPrice) || 0,
          minPlan: formMinPlan,
          content: parsedContent,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowEditorModal(false)
        setEditingExt(null)
        fetchExtensions()
        alert(editingExt ? `✓ Настройки и версия расширения «${formTitle}» успешно сохранены!` : `✓ Расширение «${formTitle}» успешно сохранено!`)
      } else {
        alert(data.error || 'Ошибка сохранения')
      }
    } catch {
      alert('Ошибка при сохранении')
    } finally {
      setActionLoading(null)
    }
  }

  const handleInstall = async (extensionId: string) => {
    if (!isPlusOrHigher) {
      promptUpgradeToPlus('установки расширений')
      return
    }
    try {
      setActionLoading(extensionId)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', extensionId }),
      })
      const data = await res.json()
      if (data.success) {
        setInstalledIds(data.installedIds)
      } else {
        if (data.requiresPlan === 'plus') {
          promptUpgradeToPlus('установки расширений')
        } else {
          alert(data.error || 'Ошибка при установке расширения')
        }
      }
    } catch {
      alert('Ошибка при установке')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUninstall = async (extensionId: string) => {
    try {
      setActionLoading(extensionId)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', extensionId }),
      })
      const data = await res.json()
      if (data.success) {
        setInstalledIds(data.installedIds)
      } else {
        alert(data.error || 'Ошибка при удалении')
      }
    } catch {
      alert('Ошибка при удалении')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBuy = async (ext: ExtensionItem) => {
    if (!isPlusOrHigher) {
      promptUpgradeToPlus('покупки и установки расширений')
      return
    }
    const ok = await confirmDialog({
      title: `Приобрести «${ext.title}»?`,
      description: `Стоимость расширения: ${ext.price} ₽.\n80% (${Math.round(ext.price * 0.8)} ₽) поступит автору на баланс, 20% — комиссия платформы Zerf.`,
      confirmText: `Купить за ${ext.price} ₽`,
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
        setInstalledIds(data.installedIds)
        alert(`🎉 Расширение «${ext.title}» успешно приобретено и установлено!`)
      } else {
        if (data.requiresPlan === 'plus') {
          promptUpgradeToPlus('покупки расширений')
        } else {
          alert(data.error || 'Ошибка при покупке')
        }
      }
    } catch {
      alert('Ошибка покупки')
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
      } else {
        alert(data.error || 'Не удалось удалить расширение')
      }
    } catch {
      alert('Ошибка при удалении')
    } finally {
      setActionLoading(null)
    }
  }

  // Filtered and Sorted catalog
  const filteredCatalog = useMemo(() => {
    const list = catalog.filter(ext => {
      // Hide unpublished drafts from public store
      if (ext.isPublished === false) return false

      const matchesSearch = ext.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ext.githubUrl && ext.githubUrl.toLowerCase().includes(searchQuery.toLowerCase()))
      
      if (selectedCategory === 'all') return matchesSearch
      return matchesSearch && ext.type === selectedCategory
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
    const isCreator = currentChatId === '6136950061' || currentChatId === '5078516086'
    return catalog.filter(ext => ext.authorChatId === currentChatId || (isCreator && ext.isOfficial))
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSpecModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-all cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>Спецификация GitHub</span>
          </button>

          {canCreate ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreate}
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
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/80 pb-2 overflow-x-auto">
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
                'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0',
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
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'Все категории' },
                { id: 'widget', label: '⏱️ Виджеты' },
                { id: 'template', label: '🎯 Шаблоны' },
                { id: 'theme', label: '🌌 Темы' },
                { id: 'integration', label: '🔌 Интеграции' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors shrink-0 cursor-pointer',
                    selectedCategory === cat.id
                      ? 'bg-card border-primary text-primary font-bold shadow-xs'
                      : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Sorting Pills */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border shrink-0 text-xs">
                <button
                  onClick={() => setSortBy('top_likes')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium',
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
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium',
                    sortBy === 'popular' ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Популярные
                </button>
                <button
                  onClick={() => setSortBy('newest')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium',
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
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <b className="text-foreground">{ext.rating.toFixed(1)}</b> ({ext.ratingCount})
                      </span>
                      <span>{ext.installCount} {ext.installCount === 1 ? 'установка' : 'установок'}</span>
                      {ext.isOfficial || ext.authorChatId === 'system' || ext.authorChatId === '6136950061' || ext.authorName?.toLowerCase().includes('создатель') ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                          <Crown className="w-2.5 h-2.5" />
                          Создатель
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

                      {/* Author or Admin Edit & Delete buttons */}
                      {(ext.authorChatId === currentChatId || currentChatId === '6136950061' || currentChatId === '5078516086') && (
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

                      {/* Widget interactive play */}
                      {ext.type === 'widget' && (
                        <button
                          onClick={() => handlePlayWidget(ext)}
                          className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs border border-border transition-all flex items-center justify-center cursor-pointer shrink-0"
                          title="Интерактивный запуск виджета"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        </button>
                      )}

                      {isInstalled ? (
                        <button
                          onClick={() => handleUninstall(ext.id)}
                          disabled={actionLoading === ext.id}
                          className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-rose-500/20 text-emerald-400 hover:text-rose-400 font-semibold text-xs transition-all border border-emerald-500/30 hover:border-rose-500/40 flex items-center justify-center gap-1.5 cursor-pointer group/btn"
                        >
                          <Check className="w-3.5 h-3.5 shrink-0 group-hover/btn:hidden" />
                          <Trash2 className="w-3.5 h-3.5 shrink-0 hidden group-hover/btn:block" />
                          <span className="truncate group-hover/btn:hidden">Установлено</span>
                          <span className="truncate hidden group-hover/btn:inline">Удалить</span>
                        </button>
                      ) : isFree ? (
                        <button
                          onClick={() => handleInstall(ext.id)}
                          disabled={actionLoading === ext.id}
                          className="flex-1 min-w-0 h-8 px-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Установить</span>
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

                  <div className="flex items-center gap-2 shrink-0">
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
                          <div className="shrink-0">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                🟢 Опубликован
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                🟡 Черновик
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
                  className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Привязать карту или СБП</span>
                </button>
              )}
            </div>

            {boundCard ? (
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center font-bold text-sm text-foreground shrink-0 shadow-2xs">
                    {boundCard.payoutType === 'sbp' ? '⚡' : boundCard.payoutType === 'yoomoney' ? '🟣' : '💳'}
                  </div>
                  <div>
                    <div className="font-bold text-foreground flex items-center gap-2">
                      <span>
                        {boundCard.payoutType === 'sbp'
                          ? `СБП: ${boundCard.phone}`
                          : boundCard.payoutType === 'yoomoney'
                          ? `ЮMoney: ${boundCard.cardNumber}`
                          : `Карта: •••• ${boundCard.cardNumber ? boundCard.cardNumber.slice(-4) : '••••'}`}
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
                  <span>Активно для выплат</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-muted/20 border border-dashed border-border/80 text-center space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Реквизиты пока не привязаны. Привяжите карту МИР, Visa, Mastercard или телефон СБП.
                </p>
              </div>
            )}
          </div>

          {/* Revenue Transparency & Protected Payout CTA */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Прозрачные условия монетизации и выплат</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>💰 Доход автора:</span>
                  <span className="text-emerald-400 font-bold">80% с каждой продажи</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  При продаже плагина 80% суммы моментально поступает на ваш баланс. Доля платформы (20%) удерживается автоматически.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>⚡ Комиссия шлюза выплат:</span>
                  <span className="text-amber-400 font-bold">3.5% при выводе</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Банковские издержки шлюза за перевод (3.5%) удерживаются с суммы вывода. Доля платформы остаётся нетронутой.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
              <div className="text-xs text-muted-foreground">
                Минимальная сумма вывода: <b className="text-foreground">100 ₽</b>
              </div>

              <button
                onClick={handleOpenPayout}
                disabled={authorStats.balance < 100}
                className={cn(
                  'px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs',
                  authorStats.balance >= 100
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                )}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Запросить вывод средств ({authorStats.balance} ₽)</span>
              </button>
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
                  <span>Импорт манифеста из GitHub</span>
                </h3>
                <button
                  onClick={() => setShowGithubModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

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
                      className="px-3.5 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
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

              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowSpecModal(false)
                    if (canCreate) setShowGithubModal(true)
                  }}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>{canCreate ? 'Перейти к импорту репозитория' : 'Закрыть'}</span>
                </button>
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
                    onClick={() => alert('Интервальный таймер запущен!')}
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
                      {selectedExt.isOfficial || selectedExt.authorChatId === 'system' || selectedExt.authorChatId === '6136950061' || selectedExt.authorName?.toLowerCase().includes('создатель') ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-amber-400">
                          <Crown className="w-2.5 h-2.5" /> Создатель
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

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-foreground">
                  {selectedExt.price === 0 ? 'Бесплатное расширение' : `Цена: ${selectedExt.price} ₽`}
                </span>
                <button
                  onClick={() => setSelectedExt(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs cursor-pointer shadow-xs"
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
                  <div className="grid grid-cols-3 gap-1.5 bg-muted/40 p-1 rounded-2xl border border-border">
                    {[
                      { id: 'card', icon: '💳', label: 'Карта РФ' },
                      { id: 'sbp', icon: '⚡', label: 'СБП (Телефон)' },
                      { id: 'yoomoney', icon: '🟣', label: 'ЮMoney' },
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
                {cardPayoutType === 'card' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground text-[11px] block">Номер банковской карты (МИР, Visa, Mastercard):</label>
                      <input
                        type="text"
                        value={cardNumberInput}
                        onChange={e => setCardNumberInput(e.target.value)}
                        placeholder="2202 2000 0000 0000"
                        maxLength={23}
                        className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-semibold text-foreground text-[11px] block">Банк получателя:</label>
                        <input
                          type="text"
                          value={cardBankInput}
                          onChange={e => setCardBankInput(e.target.value)}
                          placeholder="Сбербанк, Т-Банк..."
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground text-[11px] block">ФИО получателя:</label>
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

                {cardPayoutType === 'sbp' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground text-[11px] block">Номер телефона СБП:</label>
                      <input
                        type="tel"
                        value={cardPhoneInput}
                        onChange={e => setCardPhoneInput(e.target.value)}
                        placeholder="+7 (999) 000-00-00"
                        className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-semibold text-foreground text-[11px] block">Банк в СБП:</label>
                        <input
                          type="text"
                          value={cardBankInput}
                          onChange={e => setCardBankInput(e.target.value)}
                          placeholder="Т-Банк, Сбербанк..."
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-foreground text-[11px] block">Имя получателя:</label>
                        <input
                          type="text"
                          value={cardRecipientInput}
                          onChange={e => setCardRecipientInput(e.target.value)}
                          placeholder="Иван И."
                          className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {cardPayoutType === 'yoomoney' && (
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground text-[11px] block">Номер кошелька ЮMoney:</label>
                    <input
                      type="text"
                      value={cardNumberInput}
                      onChange={e => setCardNumberInput(e.target.value)}
                      placeholder="410010000000000"
                      className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs"
                      required
                    />
                  </div>
                )}

                <div className="p-3 rounded-2xl bg-muted/30 border border-border text-[10px] text-muted-foreground leading-relaxed">
                  🔒 Ваши платёжные данные сохраняются в зашифрованном виде и используются исключительно для выплаты вознаграждения.
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
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
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

      {/* MODAL: PAYOUT REQUEST WITH TRANSPARENT FEE BREAKDOWN */}
      <AnimatePresence>
        {showPayoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Вывод заработанных средств</h3>
                    <p className="text-[10px] text-muted-foreground">
                      Выплата автору с прозрачным расчётом комиссий
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="p-1 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>

              {payoutSuccess && payoutResult ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Check className="w-4 h-4" />
                    <span>Заявка на выплату успешно создана!</span>
                  </div>

                  <div className="p-3 rounded-xl bg-card/80 border border-emerald-500/20 text-xs space-y-1.5 font-medium text-foreground">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Списано с баланса:</span>
                      <b>{payoutResult.requestedAmount} ₽</b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Комиссия перевода (3.5%):</span>
                      <span className="text-rose-400">-{payoutResult.gatewayFeeRub} ₽</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/60 pt-1.5 text-emerald-400 font-bold">
                      <span>Итого к получению на карту:</span>
                      <span className="text-sm font-bold">{payoutResult.netPayoutRub} ₽</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Перевод поступит на ваши реквизиты в течение 1–24 часов. Уведомление отправлено администратору.
                  </p>

                  <button
                    onClick={() => { setShowPayoutModal(false); setPayoutSuccess(false) }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Готово
                  </button>
                </div>
              ) : (
                <form onSubmit={handleExecutePayout} className="space-y-4">
                  {/* Bound Card Status */}
                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-[11px]">Реквизиты для зачисления:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPayoutModal(false)
                          handleOpenCardModal()
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                      >
                        {boundCard ? 'Изменить' : '+ Привязать'}
                      </button>
                    </div>

                    {boundCard ? (
                      <div className="flex items-center gap-2.5 text-xs font-bold text-foreground">
                        <span>{boundCard.payoutType === 'sbp' ? '⚡' : boundCard.payoutType === 'yoomoney' ? '🟣' : '💳'}</span>
                        <span>
                          {boundCard.payoutType === 'sbp'
                            ? `СБП: ${boundCard.phone} (${boundCard.bankName || ''})`
                            : boundCard.payoutType === 'yoomoney'
                            ? `ЮMoney: ${boundCard.cardNumber}`
                            : `Карта: •••• ${boundCard.cardNumber ? boundCard.cardNumber.slice(-4) : '••••'} (${boundCard.bankName || ''})`}
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] flex items-center justify-between">
                        <span>Сначала привяжите карту для выплат</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPayoutModal(false)
                            handleOpenCardModal()
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] cursor-pointer"
                        >
                          Привязать
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Amount input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-foreground text-[11px]">Сумма к выводу в рублях:</label>
                      <span className="text-[10px] text-muted-foreground">
                        Доступно: <b className="text-foreground">{authorStats.balance} ₽</b>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={payoutConfig.minPayoutRub}
                        max={authorStats.balance}
                        value={payoutAmountInput}
                        onChange={e => setPayoutAmountInput(e.target.value)}
                        placeholder="100"
                        className="flex-1 h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary font-mono text-xs font-bold"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPayoutAmountInput(String(authorStats.balance))}
                        className="px-3 h-9 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border cursor-pointer shrink-0"
                      >
                        Вся сумма
                      </button>
                    </div>
                  </div>

                  {/* Transparent Fee Breakdown */}
                  {(() => {
                    const inputNum = Number(payoutAmountInput) || 0
                    const feeNum = Math.round(inputNum * (payoutConfig.gatewayFeePercent / 100))
                    const netNum = Math.max(0, inputNum - feeNum)

                    return (
                      <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2 text-xs">
                        <span className="font-bold text-foreground text-[11px] block">Прозрачный расчёт перевода:</span>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Запрошенная сумма:</span>
                            <span className="text-foreground font-bold font-mono">{inputNum} ₽</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Комиссия платформы (20%):</span>
                            <span className="text-emerald-400 font-medium">Удержана при продаже (0 ₽)</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Комиссия шлюза выплат ({payoutConfig.gatewayFeePercent}%):</span>
                            <span className="text-rose-400 font-mono">-{feeNum} ₽</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-border/60 pt-2 font-bold text-foreground">
                            <span>К зачислению на карту:</span>
                            <span className="text-sm font-bold text-emerald-400 font-mono">{netNum} ₽</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => setShowPayoutModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === 'request_payout' || !boundCard || (Number(payoutAmountInput) || 0) < payoutConfig.minPayoutRub}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === 'request_payout' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                      <span>Подтвердить вывод</span>
                    </button>
                  </div>
                </form>
              )}
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
                  { id: 'general', label: '📝 Основное' },
                  { id: 'version', label: `🏷️ Версии (v${formVersion || '1.0.0'})` },
                  { id: 'access', label: '💎 Статус и Монетизация' },
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
                          80% с каждой покупки зачисляется прямо на ваш баланс
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

                    {formPrice > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs font-medium">
                        <span>Ваш доход за 1 продажу (80%):</span>
                        <b className="text-sm font-bold">{Math.round(formPrice * 0.8)} ₽</b>
                      </div>
                    )}
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
    </div>
  )
}
