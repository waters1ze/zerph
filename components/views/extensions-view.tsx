'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Puzzle, Plus, Check, Star, Download, Trash2,
  DollarSign, Sparkles, Layout, Palette, Zap, Eye,
  Search, Shield, Crown, TrendingUp, AlertCircle, ArrowUpRight,
  BookOpen, HelpCircle, Lightbulb, Code2, ArrowRight
} from 'lucide-react'
import { useApp, getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ExtensionItem } from '@/app/api/extensions/route'

export function ExtensionsView() {
  const { dispatch } = useApp()
  const [catalog, setCatalog] = useState<ExtensionItem[]>([])
  const [installedIds, setInstalledIds] = useState<string[]>([])
  const [userPlan, setUserPlan] = useState<string>('free')
  const [canCreate, setCanCreate] = useState<boolean>(false)
  const [authorStats, setAuthorStats] = useState({ balance: 0, totalEarned: 0, salesCount: 0 })
  const [loading, setLoading] = useState<boolean>(true)

  const [activeTab, setActiveTab] = useState<'store' | 'installed' | 'my' | 'earnings'>('store')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals
  const [selectedExt, setSelectedExt] = useState<ExtensionItem | null>(null)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false)
  const [payoutCard, setPayoutCard] = useState<string>('')
  const [payoutSuccess, setPayoutSuccess] = useState<boolean>(false)

  // Create/Edit form states
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState<'prompt' | 'template' | 'theme' | 'widget'>('prompt')
  const [formCategory, setFormCategory] = useState('AI & Продуктивность')
  const [formIcon, setFormIcon] = useState('✨')
  const [formPrice, setFormPrice] = useState<number>(0)
  const [formPrompt, setFormPrompt] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null

  const fetchExtensions = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.success) {
        setCatalog(data.catalog || [])
        setInstalledIds(data.installedIds || [])
        setUserPlan(data.userPlan || 'free')
        setCanCreate(Boolean(data.canCreateExtensions))
        setAuthorStats(data.authorStats || { balance: 0, totalEarned: 0, salesCount: 0 })
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

  const handleInstall = async (extensionId: string) => {
    try {
      setActionLoading(extensionId)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', extensionId })
      })
      const data = await res.json()
      if (data.success) {
        setInstalledIds(data.installedIds)
      }
    } catch (e) {
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
        body: JSON.stringify({ action: 'uninstall', extensionId })
      })
      const data = await res.json()
      if (data.success) {
        setInstalledIds(data.installedIds)
      }
    } catch (e) {
      alert('Ошибка при удалении')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBuy = async (ext: ExtensionItem) => {
    if (!confirm(`Приобрести расширение «${ext.title}» за ${ext.price} ₽?\n\n80% (${Math.round(ext.price * 0.8)} ₽) поступит автору, 20% — комиссия платформы.`)) {
      return
    }
    try {
      setActionLoading(ext.id)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buy', extensionId: ext.id })
      })
      const data = await res.json()
      if (data.success) {
        setInstalledIds(data.installedIds)
        alert(`🎉 Расширение «${ext.title}» успешно приобретено и установлено!`)
      } else {
        alert(data.error || 'Ошибка при покупке')
      }
    } catch (e) {
      alert('Ошибка покупки')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formTitle.trim() || !formDesc.trim()) {
      setFormError('Заполните название и описание')
      return
    }

    try {
      setActionLoading('publish')
      const content: any = {}
      if (formType === 'prompt') content.systemPrompt = formPrompt
      if (formType === 'template') content.templateText = formPrompt

      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          title: formTitle,
          description: formDesc,
          type: formType,
          category: formCategory,
          icon: formIcon || '🧩',
          price: formPrice,
          content
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowCreateModal(false)
        setFormTitle('')
        setFormDesc('')
        setFormPrompt('')
        setFormPrice(0)
        fetchExtensions()
      } else {
        setFormError(data.error || 'Ошибка публикации')
      }
    } catch (err) {
      setFormError('Ошибка при сохранении')
    } finally {
      setActionLoading(null)
    }
  }

  const handleInsertPreset = () => {
    if (formType === 'prompt') {
      setFormTitle('AI Коуч по тайм-менеджменту & OKR')
      setFormDesc('Умный ассистент для декомпозиции сложных проектов на спринты и выявления скрытых блокеров.')
      setFormCategory('AI & Продуктивность')
      setFormIcon('🧠')
      setFormPrompt('Ты — ведущий эксперт по продуктивности и методологии Getting Things Done (GTD). Твоя цель — структурировать входящие задачи пользователя, расставлять приоритеты по матрице Эйзенхауэра и формулировать четкие следующие шаги.')
      setFormPrice(49)
    } else if (formType === 'template') {
      setFormTitle('Шаблон: Запуск Telegram-канала с нуля')
      setFormDesc('Пошаговый план из 25 задач: позиционирование, контент-план, оформление и первые 1000 подписчиков.')
      setFormCategory('Маркетинг & Контент')
      setFormIcon('🚀')
      setFormPrompt('1. Анализ ЦА и конкурентов\n2. Оформление аватара и описания\n3. Составление контент-плана на 14 дней\n4. Публикация первых 5 постов\n5. Взаимный пиар и посевы')
      setFormPrice(39)
    }
  }

  const handleDeleteMyExt = async (extensionId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это расширение из каталога?')) return
    try {
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', extensionId })
      })
      const data = await res.json()
      if (data.success) {
        fetchExtensions()
      }
    } catch {}
  }

  // Filtered lists
  const filteredCatalog = useMemo(() => {
    return catalog.filter(ext => {
      const matchesSearch = ext.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.category.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (selectedCategory === 'all') return matchesSearch
      return matchesSearch && ext.type === selectedCategory
    })
  }, [catalog, selectedCategory, searchQuery])

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
              Магазин расширений & Плагинов
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Кастомизируйте Zerf AI под любые задачи: умные ИИ-промпты, готовые шаблоны проектов, темы оформления и виджеты. Создавайте платные расширения и получайте <b>80%</b> с каждой продажи!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuideModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span>Инструкция</span>
          </button>

          {canCreate ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Создать расширение</span>
            </button>
          ) : (
            <button
              onClick={() => setShowGuideModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[11px] text-amber-400 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Создание (Тариф Plus)</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/80 pb-2 overflow-x-auto">
        {[
          { id: 'store', label: 'Каталог (Store)', icon: Puzzle, count: catalog.length },
          { id: 'installed', label: 'Установленные', icon: Check, count: installedExtensions.length },
          { id: 'my', label: 'Мои расширения', icon: Sparkles, count: myExtensions.length },
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
          {/* Filters and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'Все категории' },
                { id: 'prompt', label: '🤖 AI Промпты' },
                { id: 'template', label: '🎯 Шаблоны' },
                { id: 'theme', label: '🌌 Темы' },
                { id: 'widget', label: '💧 Виджеты' },
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

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск расширений..."
                className="w-full h-8 pl-8 pr-3 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map(ext => {
              const isInstalled = installedIds.includes(ext.id)
              const isFree = ext.price === 0
              return (
                <div
                  key={ext.id}
                  className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-xl shrink-0">
                          {ext.icon}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-foreground leading-tight line-clamp-1">
                            {ext.title}
                          </h3>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {ext.category}
                          </span>
                        </div>
                      </div>

                      {/* Price Badge */}
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border',
                        isFree
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      )}>
                        {isFree ? 'FREE' : `${ext.price} ₽`}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                      {ext.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <b className="text-foreground">{ext.rating.toFixed(1)}</b> ({ext.ratingCount})
                      </span>
                      <span>{ext.installCount} установок</span>
                      <span className="font-semibold text-foreground truncate max-w-[90px]">
                        {ext.authorName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedExt(ext)}
                        className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
                        title="Предпросмотр"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {isInstalled ? (
                        <button
                          onClick={() => handleUninstall(ext.id)}
                          disabled={actionLoading === ext.id}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-rose-500/20 text-emerald-400 hover:text-rose-400 font-semibold text-xs transition-all border border-emerald-500/30 hover:border-rose-500/40 flex items-center justify-center gap-1.5 cursor-pointer group"
                        >
                          <Check className="w-3.5 h-3.5 group-hover:hidden" />
                          <Trash2 className="w-3.5 h-3.5 hidden group-hover:block" />
                          <span className="group-hover:hidden">Установлено</span>
                          <span className="hidden group-hover:inline">Удалить</span>
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
                Перейдите во вкладку «Каталог» и установите нужные шаблоны, промпты или темы в один клик.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {installedExtensions.map(ext => (
                <div
                  key={ext.id}
                  className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                      {ext.icon}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{ext.title}</h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{ext.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedExt(ext)}
                      className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium cursor-pointer"
                    >
                      Открыть
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

      {/* ── TAB 3: MY EXTENSIONS / CREATOR STUDIO ── */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {!canCreate ? (
            <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-4 max-w-xl mx-auto shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Создание расширений доступно на тарифе Plus</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Создавайте кастомные AI-промпты, готовые чек-листы и темы оформления. Делитесь ими бесплатно или продавайте с комиссией <b>80% автору</b>!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setShowGuideModal(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer"
                >
                  📖 Читать инструкцию
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
                  <h3 className="text-sm font-bold text-foreground">Ваши опубликованные плагины</h3>
                  <p className="text-[11px] text-muted-foreground">Управляйте своими расширениями и отслеживайте статистику установок</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Создать плагин</span>
                </button>
              </div>

              {myExtensions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto text-xl">
                    ✨
                  </div>
                  <p className="text-xs font-bold text-foreground">Вы пока не опубликовали ни одного расширения</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    Нажмите «+ Создать плагин», чтобы добавить свой первый AI-промпт, шаблон задач или тему оформления.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Создать первое расширение</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myExtensions.map(ext => (
                    <div
                      key={ext.id}
                      className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                          {ext.icon}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">{ext.title}</h4>
                          <p className="text-[10px] text-muted-foreground">
                            {ext.price === 0 ? 'Бесплатный' : `${ext.price} ₽`} • {ext.installCount} установок • ⭐ {ext.rating.toFixed(1)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
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
              <p className="text-[10px] text-muted-foreground">покупок вашими клиентами</p>
            </div>
          </div>

          {/* Revenue split explanation */}
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Прозрачные условия монетизации Zerf Extensions</span>
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

      {/* MODAL: STEP-BY-STEP GUIDE */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Как создавать и продавать расширения в Zerf AI</span>
                </h3>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 leading-relaxed text-muted-foreground">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1.5">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <span>1.</span> Выберите тип расширения
                  </h4>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                    <li><b>🤖 AI Промпты:</b> персональные системные промпты для роли коуча, ревьюера или маркетолога.</li>
                    <li><b>🎯 Шаблоны:</b> готовые списки задач, OKR-цели и чек-листы для мгновенного импорта.</li>
                    <li><b>🌌 Темы & Виджеты:</b> кастомная цветовая палитра и интерактивные трекеры.</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1.5">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <span>2.</span> Настройка и публикация
                  </h4>
                  <p className="text-[11px]">
                    Заполните понятное название, выберите иконку (Emoji), опишите пользу для пользователя и укажите системный промпт или шаблон.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-2xl space-y-1.5">
                  <h4 className="font-bold flex items-center gap-1.5 text-xs text-foreground">
                    <span>3.</span> Монетизация и вывод средств (80/20)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Вы можете сделать расширение бесплатным (0 ₽) либо платным (от 10 до 5000 ₽). <b>80% от каждой продажи</b> сразу поступает на ваш авторский баланс. Вывод доступен на любую карту РФ или кошелек ЮMoney.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                {!canCreate ? (
                  <button
                    onClick={() => {
                      setShowGuideModal(false)
                      dispatch({ type: 'SET_VIEW', view: 'settings' })
                    }}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Оформить Plus для создания расширений</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowGuideModal(false)
                      setShowCreateModal(true)
                    }}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Перейти к созданию расширения</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE EXTENSION */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>🧩</span> Студия создания расширения
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handlePublish} className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] text-muted-foreground">Заполните данные для каталога:</span>
                  <button
                    type="button"
                    onClick={handleInsertPreset}
                    className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Вставить готовый пример</span>
                  </button>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">Название плагина:</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Например: Senior Code Reviewer AI"
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Тип расширения:</label>
                    <select
                      value={formType}
                      onChange={e => setFormType(e.target.value as any)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="prompt">🤖 AI Промпт / Ассистент</option>
                      <option value="template">🎯 Шаблон задач / OKR</option>
                      <option value="theme">🌌 Тема оформления</option>
                      <option value="widget">💧 Виджет / Трекер</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Иконка (Emoji):</label>
                    <input
                      type="text"
                      value={formIcon}
                      onChange={e => setFormIcon(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">Описание для каталога:</label>
                  <textarea
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Для чего предназначено это расширение и какую проблему решает..."
                    rows={3}
                    className="w-full p-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary leading-relaxed"
                    required
                  />
                </div>

                {formType === 'prompt' && (
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Системный промпт для ИИ:</label>
                    <textarea
                      value={formPrompt}
                      onChange={e => setFormPrompt(e.target.value)}
                      placeholder="Ты — эксперт по... Твоя роль анализировать..."
                      rows={4}
                      className="w-full p-3 rounded-xl bg-muted/50 border border-border text-foreground font-mono text-[11px] outline-none focus:border-primary"
                      required
                    />
                  </div>
                )}

                {formType === 'template' && (
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Шаблон задач (по одной на строку):</label>
                    <textarea
                      value={formPrompt}
                      onChange={e => setFormPrompt(e.target.value)}
                      placeholder="1. Анализ требований\n2. Настройка окружения\n3. Запуск тестирования"
                      rows={4}
                      className="w-full p-3 rounded-xl bg-muted/50 border border-border text-foreground font-mono text-[11px] outline-none focus:border-primary"
                      required
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-foreground">Стоимость в каталоге (₽):</label>
                    <span className="text-[11px] text-muted-foreground">0 = Бесплатно</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={formPrice}
                    onChange={e => setFormPrice(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary"
                  />
                  {formPrice > 0 && (
                    <p className="text-[11px] text-emerald-400 mt-1">
                      Вы будете получать: <b>{Math.round(formPrice * 0.8)} ₽</b> (80%) с каждой покупки!
                    </p>
                  )}
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'publish'}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer shadow-xs"
                  >
                    Опубликовать в Store
                  </button>
                </div>
              </form>
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
                  <div className="w-10 h-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-xl shrink-0">
                    {selectedExt.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{selectedExt.title}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono">{selectedExt.category} • Автор: {selectedExt.authorName}</p>
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

              {selectedExt.content && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Содержимое расширения:</p>
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
