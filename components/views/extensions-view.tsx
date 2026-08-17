'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Puzzle, Plus, Check, Star, Download, Trash2,
  DollarSign, Sparkles, Layout, Palette, Zap, Eye,
  Search, Shield, Crown, TrendingUp, AlertCircle, ArrowUpRight,
  BookOpen, HelpCircle, Lightbulb, Code2, ArrowRight,
  RefreshCw, ExternalLink, Copy, CheckCheck, GitBranch, Heart,
  Flame, CheckSquare, Play, Clock
} from 'lucide-react'
import { useApp, getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ExtensionItem } from '@/app/api/extensions/route'

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

export function ExtensionIcon({ icon, className = 'w-7 h-7 text-xl' }: { icon?: string; className?: string }) {
  const isImage = icon && (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:') || icon.startsWith('/') || icon.startsWith('blob:'))
  if (isImage) {
    return (
      <img
        src={icon}
        alt="Avatar"
        className={cn('rounded-xl object-cover shrink-0', className)}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none'
        }}
      />
    )
  }
  return (
    <span className={cn('flex items-center justify-center shrink-0 select-none', className)}>
      {icon || '🧩'}
    </span>
  )
}

const SAMPLE_MANIFEST = `{
  "name": "Pomodoro Focus Master",
  "version": "1.0.0",
  "description": "Интерактивный таймер фокуса с настраиваемыми звуками и интервалами для Zerf Note",
  "type": "widget",
  "category": "Виджеты & Фокус",
  "icon": "⏱️",
  "price": 0,
  "author": "ваш_github_логин",
  "config": {
    "workMinutes": 25,
    "breakMinutes": 5,
    "soundAlert": true
  }
}`

const getInitialExtensionsData = () => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('zerf_ext_catalog_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        return {
          catalog: parsed.catalog || [],
          installedIds: parsed.installedIds || [],
          likedIds: parsed.likedIds || [],
          userPlan: parsed.userPlan || 'free',
          canCreate: Boolean(parsed.canCreate),
          authorStats: parsed.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 },
          hasCache: Array.isArray(parsed.catalog) && parsed.catalog.length > 0
        }
      }
    } catch {}
  }
  return {
    catalog: [],
    installedIds: [],
    likedIds: [],
    userPlan: 'free',
    canCreate: false,
    authorStats: { balance: 0, totalEarned: 0, salesCount: 0 },
    hasCache: false
  }
}

export function ExtensionsView() {
  const { dispatch, syncData } = useApp()
  const initialCache = getInitialExtensionsData()

  const [catalog, setCatalog] = useState<ExtensionItem[]>(initialCache.catalog)
  const [installedIds, setInstalledIds] = useState<string[]>(initialCache.installedIds)
  const [likedIds, setLikedIds] = useState<string[]>(initialCache.likedIds)
  const [userPlan, setUserPlan] = useState<string>(initialCache.userPlan)
  const [canCreate, setCanCreate] = useState<boolean>(initialCache.canCreate)
  const [authorStats, setAuthorStats] = useState(initialCache.authorStats)
  const [loading, setLoading] = useState<boolean>(!initialCache.hasCache)

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
  const [payoutCard, setPayoutCard] = useState<string>('')
  const [payoutSuccess, setPayoutSuccess] = useState<boolean>(false)
  const [copiedSpec, setCopiedSpec] = useState<boolean>(false)

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
        setCatalog(data.catalog || [])
        setInstalledIds(data.installedIds || [])
        setLikedIds(data.likedIds || [])
        setUserPlan(data.userPlan || 'free')
        setCanCreate(Boolean(data.canCreateExtensions))
        setAuthorStats(data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 })

        try {
          localStorage.setItem('zerf_ext_catalog_cache', JSON.stringify({
            catalog: data.catalog || [],
            installedIds: data.installedIds || [],
            likedIds: data.likedIds || [],
            userPlan: data.userPlan || 'free',
            canCreate: Boolean(data.canCreateExtensions),
            authorStats: data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 },
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
        alert(data.error || 'Ошибка применения шаблона')
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
          version: parsedManifest.version,
          price: parsedManifest.price,
          content: parsedManifest.content,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowGithubModal(false)
        setGithubUrl('')
        setParsedManifest(null)
        fetchExtensions()
        alert(`🎉 Расширение «${parsedManifest.title}» успешно загружено из GitHub и опубликовано в каталоге Zerf Note!`)
      } else {
        alert(data.error || 'Ошибка публикации')
      }
    } catch {
      alert('Ошибка при публикации')
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

  const handleInstall = async (extensionId: string) => {
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
      }
    } catch {
      alert('Ошибка при удалении')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBuy = async (ext: ExtensionItem) => {
    if (!confirm(`Приобрести расширение «${ext.title}» за ${ext.price} ₽?\n\n80% (${Math.round(ext.price * 0.8)} ₽) поступит автору на баланс, 20% — комиссия платформы.`)) {
      return
    }
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
        alert(data.error || 'Ошибка при покупке')
      }
    } catch {
      alert('Ошибка покупки')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteMyExt = async (extensionId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это расширение из каталога?')) return
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', extensionId }),
      })
      const data = await res.json()
      if (data.success) {
        fetchExtensions()
      }
    } catch {}
  }

  // Filtered and Sorted catalog
  const filteredCatalog = useMemo(() => {
    const list = catalog.filter(ext => {
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSpecModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-all cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>Спецификация GitHub</span>
          </button>

          {canCreate ? (
            <button
              onClick={() => setShowGithubModal(true)}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Загрузить из GitHub</span>
            </button>
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

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map(ext => {
              const isInstalled = installedIds.includes(ext.id)
              const isLiked = likedIds.includes(ext.id)
              const isFree = ext.price === 0

              return (
                <div
                  key={ext.id}
                  className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between gap-4 relative group"
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
                          'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          isFree
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
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

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedExt(ext)}
                        className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                        title="Манифест"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Template Quick Apply button */}
                      {ext.type === 'template' && (
                        <button
                          onClick={() => handleApplyTemplate(ext)}
                          disabled={actionLoading === `apply_${ext.id}`}
                          className="px-2.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs border border-primary/20 transition-all flex items-center gap-1 cursor-pointer"
                          title="Создать задачи по этому шаблону в Zerf Note"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">В список</span>
                        </button>
                      )}

                      {/* Widget interactive play */}
                      {ext.type === 'widget' && (
                        <button
                          onClick={() => setActiveWidgetExt(ext)}
                          className="px-2.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border transition-all flex items-center gap-1 cursor-pointer"
                          title="Интерактивный запуск виджета"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                          <span className="hidden sm:inline">Запуск</span>
                        </button>
                      )}

                      {isInstalled ? (
                        <button
                          onClick={() => handleUninstall(ext.id)}
                          disabled={actionLoading === ext.id}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-rose-500/20 text-emerald-400 hover:text-rose-400 font-semibold text-xs transition-all border border-emerald-500/30 hover:border-rose-500/40 flex items-center justify-center gap-1.5 cursor-pointer group/btn"
                        >
                          <Check className="w-3.5 h-3.5 group-hover/btn:hidden" />
                          <Trash2 className="w-3.5 h-3.5 hidden group-hover/btn:block" />
                          <span className="group-hover/btn:hidden">Установлено</span>
                          <span className="hidden group-hover/btn:inline">Удалить</span>
                        </button>
                      ) : isFree ? (
                        <button
                          onClick={() => handleInstall(ext.id)}
                          disabled={actionLoading === ext.id}
                          className="flex-1 py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Установить</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuy(ext)}
                          disabled={actionLoading === ext.id}
                          className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Купить ({ext.price} ₽)</span>
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
          {installedExtensions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-2">
              <p className="text-sm font-bold text-foreground">Нет установленных расширений</p>
              <p className="text-xs text-muted-foreground">
                Перейдите во вкладку «Каталог» и подключите любые виджеты или плагины с GitHub.
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Ваши опубликованные GitHub репозитории</h3>
                  <p className="text-[11px] text-muted-foreground">Парсинг в реальном времени без расхода токенов</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer border border-border"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Открыть GitHub</span>
                  </a>
                  <button
                    onClick={() => setShowGithubModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Загрузить репозиторий</span>
                  </button>
                </div>
              </div>

              {myExtensions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto text-xl">
                    <GithubIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-foreground">Вы пока не подключили ни одного репозитория GitHub</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    Создайте репозиторий с файлом `zerf-extension.json` и вставьте ссылку сюда.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => setShowSpecModal(true)}
                      className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold cursor-pointer"
                    >
                      Инструкция и манифест
                    </button>
                    <button
                      onClick={() => setShowGithubModal(true)}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Подключить GitHub репозиторий</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myExtensions.map(ext => (
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
                          <p className="text-[10px] text-muted-foreground">
                            {ext.price === 0 ? 'Бесплатный' : `${ext.price} ₽`} • {ext.installCount} установок • ❤️ {ext.likesCount || 0} • v{ext.version || '1.0.0'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {ext.githubUrl && (
                          <button
                            onClick={() => handleSyncGithub(ext.id)}
                            disabled={actionLoading === ext.id}
                            className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                            title="Синхронизировать с GitHub (Pull latest commit)"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", actionLoading === ext.id && "animate-spin text-primary")} />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedExt(ext)}
                          className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs transition-colors cursor-pointer"
                          title="Просмотр"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMyExt(ext.id)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                          title="Удалить из магазина"
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
        </div>
      )}

      {/* ── TAB 4: EARNINGS & REVENUE SHARE (80/20) ── */}
      {activeTab === 'earnings' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Доступно к выводу (80%)</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </p>
              <p className="text-2xl font-bold text-emerald-400">{authorStats.balance} ₽</p>
              <p className="text-[10px] text-muted-foreground">ваш чистый доход</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Всего заработано</span>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </p>
              <p className="text-2xl font-bold text-blue-400">{authorStats.totalEarned} ₽</p>
              <p className="text-[10px] text-muted-foreground">за все время</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Продаж плагинов</span>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </p>
              <p className="text-2xl font-bold text-purple-400">{authorStats.salesCount}</p>
              <p className="text-[10px] text-muted-foreground">покупок клиентами</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Прозрачные условия монетизации GitHub расширений в Zerf Note</span>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Вы получаете <b>80%</b> от стоимости каждой продажи вашего плагина или шаблона. <b>20%</b> составляет комиссия платформы за эквайринг, серверные мощности и поддержание шлюзов.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setShowPayoutModal(true)}
                disabled={authorStats.balance <= 0}
                className={cn(
                  'px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer',
                  authorStats.balance > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                )}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Вывести средства на ЮMoney / Карту</span>
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

                  {/* Custom Avatar / Icon selector */}
                  <div className="p-3 rounded-xl bg-card border border-border/70 space-y-2">
                    <label className="font-semibold text-foreground flex items-center justify-between text-[11px]">
                      <span>Аватарка / Картинка расширения:</span>
                      <span className="text-[10px] text-muted-foreground">Любое фото или URL</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={parsedManifest.icon || ''}
                        onChange={e => setParsedManifest({ ...parsedManifest, icon: e.target.value })}
                        placeholder="Вставьте ссылку на картинку или эмодзи"
                        className="flex-1 h-8 px-2.5 rounded-xl bg-muted/40 border border-border text-[11px] outline-none focus:border-primary font-mono"
                      />
                      <label className="h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-[11px] flex items-center gap-1 cursor-pointer shrink-0 transition-colors">
                        <span>📁 Загрузить фото</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = (ev) => {
                                if (ev.target?.result) {
                                  setParsedManifest({ ...parsedManifest, icon: String(ev.target.result) })
                                }
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                        />
                      </label>
                    </div>
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

      {/* MODAL: PAYOUT REQUEST */}
      <AnimatePresence>
        {showPayoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Вывод заработанных средств</span>
                </h3>
                <button onClick={() => setShowPayoutModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>

              {payoutSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center space-y-2">
                  <p className="font-bold">✓ Заявка на вывод принята!</p>
                  <p className="text-[11px] text-muted-foreground">
                    Средства в размере {authorStats.balance} ₽ будут отправлены на ваши реквизиты в течение 24 часов.
                  </p>
                  <button
                    onClick={() => { setShowPayoutModal(false); setPayoutSuccess(false) }}
                    className="mt-2 px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold"
                  >
                    Готово
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    setPayoutSuccess(true)
                  }}
                  className="space-y-3"
                >
                  <p className="text-muted-foreground">
                    Сумма к выводу: <b className="text-foreground font-bold">{authorStats.balance} ₽</b>
                  </p>
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Номер карты / ЮMoney / СБП телефон:</label>
                    <input
                      type="text"
                      value={payoutCard}
                      onChange={e => setPayoutCard(e.target.value)}
                      placeholder="4100... или 2202... или +79..."
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-xs"
                  >
                    Подтвердить вывод {authorStats.balance} ₽
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
