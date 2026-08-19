'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Puzzle, Search, ChevronDown, ChevronUp, Trash2,
  Check, Sparkles, Sliders, Play, CheckSquare,
  ExternalLink, Plus, RefreshCw, X, Shield, Crown,
  Code2, Info, Eye, AlertCircle, ArrowRight, CheckCircle2
} from 'lucide-react'
import { useApp, getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { ExtensionIcon } from '@/components/views/extensions-view'
import type { ExtensionItem } from '@/app/api/extensions/route'
import { planAtLeast, type PlanId } from '@/lib/plans'

interface SettingField {
  key: string
  label: string
  description?: string
  type: 'boolean' | 'string' | 'number' | 'select' | 'color' | 'secret'
  defaultValue?: any
  options?: Array<{ label: string; value: string | number }>
}

/**
 * Extracts and normalizes settings schema from author's extension manifest/content
 */
function extractSettingsSchema(ext: ExtensionItem): SettingField[] {
  const content = ext.content || {}
  const schema: SettingField[] = []

  // 1. Explicit settingsSchema provided by author
  if (content.settingsSchema && Array.isArray(content.settingsSchema)) {
    return content.settingsSchema.map((item: any) => ({
      key: String(item.key || item.id || item.name),
      label: String(item.label || item.title || item.name || item.key),
      description: item.description ? String(item.description) : undefined,
      type: item.type === 'boolean' || item.type === 'number' || item.type === 'select' || item.type === 'color' || item.type === 'secret'
        ? item.type
        : 'string',
      defaultValue: item.defaultValue ?? item.default,
      options: Array.isArray(item.options) ? item.options : undefined,
    }))
  }

  // 2. Author defined 'settings' or 'config' or 'options' object/array
  const targetObj = content.settings || content.config || content.options || content.parameters || content.env

  if (targetObj && typeof targetObj === 'object' && !Array.isArray(targetObj)) {
    for (const [key, val] of Object.entries(targetObj)) {
      if (typeof val === 'boolean') {
        schema.push({
          key,
          label: formatFieldLabel(key),
          type: 'boolean',
          defaultValue: val,
        })
      } else if (typeof val === 'number') {
        schema.push({
          key,
          label: formatFieldLabel(key),
          type: 'number',
          defaultValue: val,
        })
      } else if (typeof val === 'string') {
        const isColor = val.startsWith('#') && (val.length === 7 || val.length === 4)
        const isSecret = key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')
        schema.push({
          key,
          label: formatFieldLabel(key),
          type: isColor ? 'color' : isSecret ? 'secret' : 'string',
          defaultValue: val,
        })
      }
    }
  }

  // 3. Fallback: inspect top-level primitive configuration keys in content
  if (schema.length === 0) {
    for (const [key, val] of Object.entries(content)) {
      if (['engine', 'commands', 'features', 'items', 'tasks', 'type', 'id'].includes(key)) continue
      if (typeof val === 'boolean') {
        schema.push({
          key,
          label: formatFieldLabel(key),
          type: 'boolean',
          defaultValue: val,
        })
      } else if (typeof val === 'number') {
        schema.push({
          key,
          label: formatFieldLabel(key),
          type: 'number',
          defaultValue: val,
        })
      } else if (typeof val === 'string' && val.length < 120) {
        const isColor = val.startsWith('#') && (val.length === 7 || val.length === 4)
        schema.push({
          key,
          label: formatFieldLabel(key),
          type: isColor ? 'color' : 'string',
          defaultValue: val,
        })
      }
    }
  }

  return schema
}

function formatFieldLabel(key: string): string {
  // Convert camelCase or snake_case to human readable Russian / English label
  const translations: Record<string, string> = {
    apiKey: 'Секретный API-ключ',
    token: 'Токен авторизации',
    apiUrl: 'Базовый URL сервера',
    endpoint: 'API эндпоинт',
    maxSources: 'Максимальное число источников',
    maxResults: 'Количество результатов',
    autoSearch: 'Автоматический поиск при вводе',
    autoSync: 'Автоматическая синхронизация',
    darkMode: 'Темный режим интерфейса',
    sound: 'Звуковые уведомления',
    notifications: 'Всплывающие уведомления',
    duration: 'Длительность (в минутах)',
    refreshInterval: 'Интервал обновления (сек)',
    theme: 'Тема оформления',
    color: 'Основной цвет акцента',
    accentColor: 'Цвет акцента',
    defaultFolder: 'Папка по умолчанию',
    defaultTag: 'Тег по умолчанию',
    language: 'Язык ответов',
  }
  if (translations[key]) return translations[key]

  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

export function InstalledExtensionsSettingsSection() {
  const { state, dispatch, syncData } = useApp()
  const confirmDialog = useConfirmDialog()

  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<ExtensionItem[]>([])
  const [installedIds, setInstalledIds] = useState<string[]>([])
  const [enabledIds, setEnabledIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [savedToastId, setSavedToastId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  // Local storage persisted configurations per extension: { [extId]: { [key]: value } }
  const [extConfigs, setExtConfigs] = useState<Record<string, Record<string, any>>>({})

  // Load configs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zerf_extension_configs')
      if (saved) {
        setExtConfigs(JSON.parse(saved))
      }
    } catch {}
  }, [])

  // Save configs to localStorage
  const saveConfigValue = (extId: string, fieldKey: string, value: any) => {
    setExtConfigs(prev => {
      const updatedExt = { ...(prev[extId] || {}), [fieldKey]: value }
      const next = { ...prev, [extId]: updatedExt }
      try {
        localStorage.setItem('zerf_extension_configs', JSON.stringify(next))
      } catch {}
      return next
    })

    setSavedToastId(extId)
    setTimeout(() => setSavedToastId(null), 1800)
  }

  // Fetch installed extensions from backend
  const fetchExtensions = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/extensions', {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setCatalog(Array.isArray(data.catalog) ? data.catalog : [])
        setInstalledIds(Array.isArray(data.installedIds) ? data.installedIds : [])
        setEnabledIds(Array.isArray(data.enabledIds) ? data.enabledIds : (Array.isArray(data.installedIds) ? data.installedIds : []))
      }
    } catch (e) {
      console.error('Failed to fetch extensions', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExtensions()
  }, [])

  // Filter installed extensions
  const installedExtensions = useMemo(() => {
    return catalog.filter(ext => installedIds.includes(ext.id))
  }, [catalog, installedIds])

  const filteredExtensions = useMemo(() => {
    if (!searchQuery.trim()) return installedExtensions
    const q = searchQuery.toLowerCase().trim()
    return installedExtensions.filter(ext =>
      ext.title?.toLowerCase().includes(q) ||
      ext.description?.toLowerCase().includes(q) ||
      ext.category?.toLowerCase().includes(q) ||
      ext.authorName?.toLowerCase().includes(q)
    )
  }, [installedExtensions, searchQuery])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleToggleEnable = async (ext: ExtensionItem) => {
    try {
      setActionLoading(`enable_${ext.id}`)
      const isCurrentlyEnabled = enabledIds.includes(ext.id)
      const nextState = !isCurrentlyEnabled

      // Optimistic UI update
      setEnabledIds(prev =>
        nextState ? [...prev, ext.id] : prev.filter(id => id !== ext.id)
      )

      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_enable', extensionId: ext.id, enabled: nextState }),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.enabledIds)) {
        setEnabledIds(data.enabledIds)
      } else if (!data.success) {
        // Revert on error
        setEnabledIds(prev =>
          isCurrentlyEnabled ? [...prev, ext.id] : prev.filter(id => id !== ext.id)
        )
        showToast(data.error || 'Ошибка изменения статуса расширения', 'error')
      }
    } catch {
      showToast('Ошибка сети при изменении статуса расширения', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUninstall = async (ext: ExtensionItem) => {
    const ok = await confirmDialog({
      title: `Удалить «${ext.title}»?`,
      description: 'Расширение будет отключено и удалено из вашего аккаунта. Вы сможете установить его снова в любой момент.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return

    try {
      setActionLoading(ext.id)
      const res = await fetch('/api/extensions', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', extensionId: ext.id }),
      })
      const data = await res.json()
      if (data.success) {
        setInstalledIds(data.installedIds || [])
        if (data.enabledIds) setEnabledIds(data.enabledIds)
        showToast(`✓ Расширение «${ext.title}» успешно удалено`, 'info')
      }
    } catch {
      showToast('Ошибка при удалении расширения', 'error')
    } finally {
      setActionLoading(null)
    }
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
        showToast(`🎉 Шаблон «${ext.title}» применён! Добавлено +${data.createdCount} задач.`, 'success')
      } else {
        showToast(data.error || 'Ошибка применения шаблона', 'error')
      }
    } catch {
      showToast('Ошибка применения шаблона', 'error')
    } finally {
      setActionLoading(null)
    }
  }

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

  return (
    <div className="space-y-4">
      {/* Header bar: Count & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            {installedExtensions.length}
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Установленные расширения и параметры</h4>
            <p className="text-[11px] text-muted-foreground">
              Управление активными плагинами и индивидуальная конфигурация от авторов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или автору..."
              className="w-full h-8 pl-8 pr-7 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/70"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={fetchExtensions}
            disabled={loading}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            title="Обновить список"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── DEVELOPER MODE & SDK DOCS ACCESS ── */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <span>Режим разработчика расширений (Developer Mode)</span>
                <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 text-[9px] font-mono font-bold border border-purple-500/30">SDK</span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Создание манифестов, тестирование AI-эндпоинтов и управление выплатами авторам (80/20)
              </p>
            </div>
          </div>

          <button
            role="switch"
            aria-checked={isDeveloperMode}
            onClick={() => toggleDeveloperMode(!isDeveloperMode)}
            className={cn(
              'relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0',
              isDeveloperMode ? 'bg-primary' : 'bg-muted border border-border'
            )}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
              style={{ left: isDeveloperMode ? 'calc(100% - 18px)' : '2px' }}
            />
          </button>
        </div>

        {isDeveloperMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-2.5 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <p className="font-semibold text-foreground">✦ Портал разработчика активирован</p>
              <p>Манифест-генератор, документация SDK, эмулятор вебхуков и баланс автора.</p>
            </div>

            <a
              href="/developer"
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Открыть Developer Hub</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </motion.div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-primary animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Загрузка установленных расширений...</p>
        </div>
      )}

      {/* Empty state when no extensions installed */}
      {!loading && installedExtensions.length === 0 && (
        <div className="p-8 rounded-2xl bg-card border border-dashed border-border text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto text-2xl">
            🧩
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground">У вас пока нет установленных расширений</h4>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto leading-relaxed">
              Перейдите в Магазин расширений Zerf Note, чтобы подключить ИИ-поиск Entropy, интерактивные виджеты, шаблоны проектов и темы.
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'extensions' })}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs hover:opacity-90"
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span>Перейти в каталог расширений</span>
          </button>
        </div>
      )}

      {/* No search results */}
      {!loading && installedExtensions.length > 0 && filteredExtensions.length === 0 && (
        <div className="p-6 rounded-2xl bg-card border border-border text-center space-y-2">
          <p className="text-xs font-bold text-foreground">Ничего не найдено по запросу «{searchQuery}»</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-primary font-semibold hover:underline"
          >
            Сбросить поиск
          </button>
        </div>
      )}

      {/* Installed Extensions List */}
      {!loading && filteredExtensions.length > 0 && (
        <div className="space-y-3">
          {filteredExtensions.map(ext => {
            const userPlan = (state.settings?.userPlan as PlanId) || 'free'
            const isPlanRestricted = Boolean(
              ext.minPlan &&
              ext.minPlan !== 'free' &&
              !planAtLeast(userPlan, ext.minPlan as PlanId)
            )
            const isExpanded = expandedIds.has(ext.id)
            const settingsSchema = extractSettingsSchema(ext)
            const hasSettings = settingsSchema.length > 0
            const currentConfig = extConfigs[ext.id] || {}
            const isEnabled = enabledIds.includes(ext.id)
            const isRunnable = Boolean(
              ext.isRunnable ||
              ext.content?.isRunnable === true ||
              ext.content?.action === 'run' ||
              ext.id === 'ext_entropy_search' ||
              ext.id === 'ext_zerfic_live' ||
              ext.id === 'zerfic-live' ||
              ext.title?.toLowerCase().includes('zerfic')
            )

            return (
              <div
                key={ext.id}
                className={cn(
                  "rounded-2xl bg-card border shadow-2xs overflow-hidden transition-all",
                  isEnabled && !isPlanRestricted ? "border-border hover:border-border/90" : "border-border/60 opacity-85 hover:opacity-100"
                )}
              >
                {/* Extension Main Header Card */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Icon, Title, Badges */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                      <ExtensionIcon icon={ext.icon} className="w-full h-full text-xl" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-foreground truncate">{ext.title}</h4>
                        {ext.version && (
                          <span className="px-1.5 py-0.2 rounded-md bg-muted text-[9px] font-mono text-muted-foreground shrink-0">
                            v{ext.version}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold border border-primary/20">
                          {ext.type === 'widget' ? 'Виджет' : ext.type === 'template' ? 'Шаблон' : ext.type === 'theme' ? 'Тема' : ext.type === 'integration' ? 'Интеграция' : 'Промпт'}
                        </span>
                        {ext.isPublished === false || (ext as any).isDisabledByOwner === true ? (
                          <span className="px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-400 text-[9px] font-bold border border-rose-500/25 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Отключено автором
                          </span>
                        ) : isPlanRestricted ? (
                          <span className="px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-400 text-[9px] font-bold border border-rose-500/25 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Приостановлено (тариф {ext.minPlan?.toUpperCase() || 'PRO'})
                          </span>
                        ) : isEnabled ? (
                          <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-semibold border border-emerald-500/25 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Активно
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground text-[9px] font-semibold border border-border">
                            Отключено вами
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{ext.category}</span>
                        <span>•</span>
                        {ext.isOfficial || ext.authorChatId === 'system' ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold">
                            <Crown className="w-2.5 h-2.5" /> Официальное
                          </span>
                        ) : (
                          <span>👤 {ext.authorName || 'Автор'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions and Toggle Settings */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Expand/Collapse Custom Settings (if has schema) */}
                    {hasSettings && (
                      <button
                        onClick={() => toggleExpand(ext.id)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                          isExpanded
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                        )}
                      >
                        <Sliders className="w-3 h-3" />
                        <span className="hidden sm:inline">Опции</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}

                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => handleToggleEnable(ext)}
                      disabled={actionLoading === `enable_${ext.id}` || ext.isPublished === false || (ext as any).isDisabledByOwner === true}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5",
                        isEnabled
                          ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground border border-border"
                      )}
                    >
                      {actionLoading === `enable_${ext.id}` ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : isEnabled ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span className="hidden sm:inline">Включено</span>
                        </>
                      ) : (
                        <span>Включить</span>
                      )}
                    </button>

                    {/* Runnable Widget Launch (ONLY if isRunnable AND isEnabled) */}
                    {isRunnable && isEnabled && (
                      <button
                        onClick={() => {
                          if (ext.id === 'ext_entropy_search' || ext.title.toLowerCase().includes('entropy')) {
                            dispatch({ type: 'SET_VIEW', view: 'entropy' })
                            window.dispatchEvent(new CustomEvent('zerf_open_entropy_search'))
                          } else {
                            dispatch({ type: 'SET_VIEW', view: 'extensions' })
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs border border-primary flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        title="Запустить интерактивный виджет"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span className="hidden sm:inline">Запустить</span>
                      </button>
                    )}

                    {/* Template quick apply */}
                    {ext.type === 'template' && (
                      <button
                        onClick={() => handleApplyTemplate(ext)}
                        disabled={actionLoading === `apply_${ext.id}`}
                        className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs border border-primary/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Применить задачи шаблона"
                      >
                        <CheckSquare className="w-3 h-3" />
                        <span className="hidden sm:inline">Применить</span>
                      </button>
                    )}

                    {/* Uninstall button */}
                    <button
                      onClick={() => handleUninstall(ext)}
                      disabled={actionLoading === ext.id}
                      className="p-1.5 rounded-xl bg-muted/60 hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 border border-border transition-colors cursor-pointer"
                      title="Удалить расширение"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Settings Expand/Collapse Button */}
                    <button
                      onClick={() => toggleExpand(ext.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer',
                        isExpanded
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : hasSettings
                          ? 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/20'
                          : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                      )}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Настройки</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Settings Drawer */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border/70 bg-muted/20 p-4 sm:p-5 space-y-4"
                    >
                      {/* Description & Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-primary" />
                            <span>Параметры конфигурации «{ext.title}»</span>
                          </h5>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {ext.description}
                          </p>
                        </div>

                        {savedToastId === ext.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm shrink-0"
                          >
                            <Check className="w-3 h-3" /> Сохранено
                          </motion.div>
                        )}
                      </div>

                      {/* Case 1: Author provided configurable settings */}
                      {hasSettings ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                          {settingsSchema.map(field => {
                            const currentValue = currentConfig[field.key] ?? field.defaultValue

                            return (
                              <div
                                key={field.key}
                                className="p-3.5 rounded-xl bg-card border border-border flex flex-col justify-between gap-2 shadow-2xs"
                              >
                                <div>
                                  <label className="text-[11px] font-bold text-foreground block">
                                    {field.label}
                                  </label>
                                  {field.description && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                      {field.description}
                                    </p>
                                  )}
                                </div>

                                {/* Dynamic Field Controls */}
                                <div className="pt-1">
                                  {/* Boolean Toggle */}
                                  {field.type === 'boolean' && (
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(currentValue)}
                                        onChange={e => saveConfigValue(ext.id, field.key, e.target.checked)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                      <span className="ml-2 text-[11px] font-medium text-foreground">
                                        {currentValue ? 'Включено' : 'Выключено'}
                                      </span>
                                    </label>
                                  )}

                                  {/* String / Secret input */}
                                  {(field.type === 'string' || field.type === 'secret') && (
                                    <input
                                      type={field.type === 'secret' ? 'password' : 'text'}
                                      value={currentValue || ''}
                                      onChange={e => saveConfigValue(ext.id, field.key, e.target.value)}
                                      placeholder={field.defaultValue ? String(field.defaultValue) : 'Введите значение...'}
                                      className="w-full h-8 px-3 rounded-lg bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                                    />
                                  )}

                                  {/* Number input */}
                                  {field.type === 'number' && (
                                    <input
                                      type="number"
                                      value={currentValue ?? ''}
                                      onChange={e => saveConfigValue(ext.id, field.key, Number(e.target.value))}
                                      placeholder={String(field.defaultValue ?? 0)}
                                      className="w-full h-8 px-3 rounded-lg bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary font-mono"
                                    />
                                  )}

                                  {/* Color picker */}
                                  {field.type === 'color' && (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={currentValue || '#6366f1'}
                                        onChange={e => saveConfigValue(ext.id, field.key, e.target.value)}
                                        className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                                      />
                                      <input
                                        type="text"
                                        value={currentValue || '#6366f1'}
                                        onChange={e => saveConfigValue(ext.id, field.key, e.target.value)}
                                        className="flex-1 h-8 px-3 rounded-lg bg-muted/40 border border-border text-xs text-foreground font-mono outline-none focus:border-primary"
                                      />
                                    </div>
                                  )}

                                  {/* Select Dropdown */}
                                  {field.type === 'select' && field.options && (
                                    <select
                                      value={currentValue || ''}
                                      onChange={e => saveConfigValue(ext.id, field.key, e.target.value)}
                                      className="w-full h-8 px-2.5 rounded-lg bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                                    >
                                      {field.options.map(opt => (
                                        <option key={String(opt.value)} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        /* Case 2: Author did not provide custom settings */
                        <div className="p-4 rounded-xl bg-card border border-border/80 text-center space-y-1.5">
                          <p className="text-xs font-semibold text-foreground">
                            У этого расширения нет дополнительных настраиваемых параметров
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Автор расширения настроил автоматическую работу логики. Все функции активны и готовы к использованию.
                          </p>
                        </div>
                      )}

                      {/* GitHub Link & Meta info footer */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1 font-mono">
                          <span>ID: {ext.id}</span>
                          {ext.manifestUrl && (
                            <a
                              href={ext.manifestUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline ml-1"
                            >
                              Манифест
                            </a>
                          )}
                        </div>

                        {ext.githubUrl && (
                          <a
                            href={ext.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                          >
                            <span>Репозиторий на GitHub</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating In-App Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="installed-ext-toast"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 max-w-md pointer-events-auto backdrop-blur-xl',
              toast.type === 'success' && 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
              toast.type === 'error' && 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.3)]',
              toast.type === 'info' && 'bg-card/95 border-border text-foreground shadow-lg'
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
    </div>
  )
}
