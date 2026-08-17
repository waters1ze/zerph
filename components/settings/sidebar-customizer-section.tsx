'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Inbox, CheckSquare, FileText, Calendar, Clock,
  Target, BarChart2, Users, Settings, FolderOpen, LayoutGrid, Network,
  UserCheck, Building2, Puzzle, Eye, EyeOff, Folder, Plus, Trash2,
  RotateCcw, Check, Sparkles, FolderPlus, ArrowUp, ArrowDown, Move,
  ChevronDown, ChevronRight, Edit2, Save, X, ExternalLink,
  Share2, Download, Upload, Copy, CheckCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ExtensionItem } from '@/app/api/extensions/route'
import { ExtensionIcon } from '@/components/views/extensions-view'

export interface SidebarFolder {
  id: string
  title: string
  hidden?: boolean
  itemIds: string[]
}

export interface SidebarConfig {
  hiddenItems: string[]
  folders: SidebarFolder[]
}

export interface MenuItemMeta {
  id: string
  title: string
  icon: string | React.ElementType
  isExtension?: boolean
}

export const DEFAULT_MENU_ITEMS: Record<string, { title: string; icon: any }> = {
  today:      { title: 'Сегодня',        icon: Sun },
  inbox:      { title: 'Входящие',       icon: Inbox },
  tasks:      { title: 'Задачи',         icon: CheckSquare },
  clock:      { title: 'Часы и Таймеры', icon: Clock },
  notes:      { title: 'Заметки',        icon: FileText },
  graph:      { title: 'Граф знаний',    icon: Network },
  calendar:   { title: 'Календарь',      icon: Calendar },
  goals:      { title: 'Цели',           icon: Target },
  projects:   { title: 'Проекты',        icon: FolderOpen },
  extensions: { title: 'Расширения',     icon: Puzzle },
  stats:      { title: 'Аналитика',      icon: BarChart2 },
  friends:    { title: 'Друзья',         icon: UserCheck },
  teams:      { title: 'Команды',        icon: Building2 },
  settings:   { title: 'Настройки',      icon: Settings },
}

export const DEFAULT_SIDEBAR_FOLDERS: SidebarFolder[] = [
  {
    id: 'workspace',
    title: 'Рабочее пространство',
    itemIds: ['today', 'inbox', 'tasks', 'clock', 'notes', 'graph'],
  },
  {
    id: 'planning',
    title: 'Планирование',
    itemIds: ['calendar', 'goals', 'projects'],
  },
  {
    id: 'analytics',
    title: 'Аналитика',
    itemIds: ['stats'],
  },
  {
    id: 'collaboration',
    title: 'Совместная работа',
    itemIds: ['friends', 'teams'],
  },
  {
    id: 'account',
    title: 'Аккаунт',
    itemIds: ['settings'],
  },
]

export interface LayoutPreset {
  id: string
  title: string
  description: string
  icon: string
  author: string
  config: SidebarConfig
  recommendedExts?: string[]
}

export const COMMUNITY_LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'preset_founder',
    title: 'Startup Founder & Product Lead',
    description: 'Оптимизировано для создания продуктов: Проекты, Задачи, Таймер фокуса и Расширения на первом плане.',
    icon: '🚀',
    author: 'Zerf Official',
    config: {
      hiddenItems: ['friends', 'teams'],
      folders: [
        { id: 'focus', title: '⚡ Быстрый фокус', itemIds: ['today', 'tasks', 'clock'] },
        { id: 'dev', title: '🚀 Продукт & SaaS', itemIds: ['projects', 'goals', 'notes', 'extensions'] },
        { id: 'insights', title: '📊 Метрики', itemIds: ['stats', 'graph', 'calendar'] },
        { id: 'sys', title: '⚙️ Настройки', itemIds: ['settings'] },
      ],
    },
    recommendedExts: ['ext_pomodoro_widget', 'ext_startup_checklist'],
  },
  {
    id: 'preset_ai_researcher',
    title: 'AI Power User & Entropy Search',
    description: 'Интеллектуальная раскладка: ИИ-поиск Entropy, Граф связей, Заметки и Планирование.',
    icon: '🔮',
    author: 'waters1ze',
    config: {
      hiddenItems: ['friends', 'teams'],
      folders: [
        { id: 'ai_hub', title: '🔮 AI & Исследования', itemIds: ['ext_entropy_search', 'graph', 'notes'] },
        { id: 'workflow', title: '📋 Поток работы', itemIds: ['today', 'tasks', 'calendar'] },
        { id: 'strategy', title: '🎯 Стратегия', itemIds: ['goals', 'projects', 'stats'] },
        { id: 'system', title: '⚙️ Система', itemIds: ['extensions', 'settings'] },
      ],
    },
    recommendedExts: ['ext_entropy_search', 'ext_nexus_search'],
  },
  {
    id: 'preset_minimal_zen',
    title: 'Minimal Zen Workspace',
    description: 'Абсолютный минимализм: только самое важное на день, всё лишнее аккуратно скрыто.',
    icon: '🧘',
    author: 'Zen Master',
    config: {
      hiddenItems: ['graph', 'friends', 'teams', 'stats', 'projects', 'goals'],
      folders: [
        { id: 'today_focus', title: '✨ Сегодня', itemIds: ['today', 'inbox', 'clock'] },
        { id: 'thoughts', title: '📝 Мысли', itemIds: ['notes', 'calendar', 'tasks'] },
        { id: 'settings_min', title: '⚙️ Опции', itemIds: ['extensions', 'settings'] },
      ],
    },
  },
  {
    id: 'preset_team_collab',
    title: 'Team Collaboration & Agile',
    description: 'Для командной работы: Команды, Друзья, Проекты и Задачи выведены в топ.',
    icon: '👥',
    author: 'Agile Team',
    config: {
      hiddenItems: [],
      folders: [
        { id: 'collab', title: '👥 Команда & Спринты', itemIds: ['teams', 'tasks', 'projects', 'friends'] },
        { id: 'schedule', title: '📅 Расписание', itemIds: ['calendar', 'today', 'inbox'] },
        { id: 'knowledge', title: '📚 База знаний', itemIds: ['notes', 'graph', 'goals'] },
        { id: 'sys_team', title: '⚙️ Настройки', itemIds: ['stats', 'extensions', 'settings'] },
      ],
    },
  },
]

export function getInitialSidebarConfig(): SidebarConfig {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('zerf_sidebar_config_v2')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && Array.isArray(parsed.folders) && parsed.folders.length > 0) {
          parsed.folders = parsed.folders.map((f: SidebarFolder) => ({
            ...f,
            itemIds: (f.itemIds || []).filter((id: string) => id !== 'extensions'),
          }))
          return parsed
        }
      }
    } catch {}
  }
  return {
    hiddenItems: [],
    folders: DEFAULT_SIDEBAR_FOLDERS,
  }
}

export function SidebarCustomizerSection() {
  const confirmDialog = useConfirmDialog()
  const [config, setConfig] = useState<SidebarConfig>(getInitialSidebarConfig)
  const [installedExts, setInstalledExts] = useState<ExtensionItem[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [savedBadge, setSavedBadge] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderTitle, setEditingFolderTitle] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJsonText, setImportJsonText] = useState('')
  const [copiedPreset, setCopiedPreset] = useState(false)

  // Load installed extensions from GitHub catalog to allow dragging them
  useEffect(() => {
    const fetchInstalled = async () => {
      try {
        const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.success && Array.isArray(data.catalog) && Array.isArray(data.installedIds)) {
          const installed = data.catalog.filter((e: ExtensionItem) => data.installedIds.includes(e.id))
          setInstalledExts(installed)
        }
      } catch {}
    }
    fetchInstalled()
  }, [])

  const saveConfig = (newConfig: SidebarConfig) => {
    setConfig(newConfig)
    try {
      localStorage.setItem('zerf_sidebar_config_v2', JSON.stringify(newConfig))
      localStorage.setItem('zerf_sidebar_config', JSON.stringify(newConfig))
      window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
      setSavedBadge(true)
      setTimeout(() => setSavedBadge(false), 2000)
    } catch {}
  }

  const applyLayoutPreset = async (preset: LayoutPreset) => {
    const ok = await confirmDialog({
      title: `Применить пресет «${preset.title}»?`,
      description: 'Текущее расположение папок и пунктов меню будет заменено выбранным шаблоном.',
      confirmText: 'Применить пресет',
      cancelText: 'Отмена',
      variant: 'primary',
    })
    if (!ok) return
    saveConfig(preset.config)
  }

  const handleExportMyPreset = () => {
    const payload = {
      title: 'Моя раскладка Zerf Note',
      createdAt: new Date().toISOString(),
      config,
    }
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopiedPreset(true)
    setTimeout(() => setCopiedPreset(false), 2500)
  }

  const handleImportPresetSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const parsed = JSON.parse(importJsonText.trim())
      const targetConfig = parsed.config || parsed
      if (Array.isArray(targetConfig.folders) && targetConfig.folders.length > 0) {
        saveConfig({
          hiddenItems: Array.isArray(targetConfig.hiddenItems) ? targetConfig.hiddenItems : [],
          folders: targetConfig.folders,
        })
        setShowImportModal(false)
        setImportJsonText('')
        alert('🎉 Пресет раскладки успешно загружен и применен!')
      } else {
        alert('Некорректная структура пресета. Убедитесь, что JSON содержит массив folders.')
      }
    } catch {
      alert('Ошибка синтаксиса JSON. Проверьте правильность вставленного кода пресета.')
    }
  }

  // All known item metadata (built-in + installed extensions)
  const allItemMetas = useMemo<Record<string, { title: string; icon: any; isExt?: boolean }>>(() => {
    const map: Record<string, { title: string; icon: any; isExt?: boolean }> = { ...DEFAULT_MENU_ITEMS }
    installedExts.forEach(ext => {
      map[ext.id] = {
        title: ext.title,
        icon: ext.icon || '🧩',
        isExt: true,
      }
    })
    return map
  }, [installedExts])

  // Toggle single item visibility
  const toggleItemVisibility = (itemId: string) => {
    const isHidden = config.hiddenItems.includes(itemId)
    const nextHidden = isHidden
      ? config.hiddenItems.filter(id => id !== itemId)
      : [...config.hiddenItems, itemId]

    saveConfig({ ...config, hiddenItems: nextHidden })
  }

  // Toggle whole folder visibility
  const toggleFolderVisibility = (folderId: string) => {
    const updatedFolders = config.folders.map(f => {
      if (f.id === folderId) {
        return { ...f, hidden: !f.hidden }
      }
      return f
    })
    saveConfig({ ...config, folders: updatedFolders })
  }

  // Create custom folder
  const createFolder = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    const newFolder: SidebarFolder = {
      id: `folder_${Date.now()}`,
      title: trimmed,
      itemIds: [],
    }

    saveConfig({
      ...config,
      folders: [...config.folders, newFolder],
    })
    setNewFolderName('')
  }

  // Delete folder
  const deleteFolder = async (folderId: string) => {
    const folderToDelete = config.folders.find(f => f.id === folderId)
    const ok = await confirmDialog({
      title: `Удалить папку «${folderToDelete?.title || 'Папка'}»?`,
      description: 'Пункты меню из неё будут автоматически перенесены в первую доступную папку.',
      confirmText: 'Удалить папку',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return

    const remainingFolders = config.folders.filter(f => f.id !== folderId)

    if (folderToDelete && folderToDelete.itemIds.length > 0 && remainingFolders.length > 0) {
      remainingFolders[0].itemIds = [...remainingFolders[0].itemIds, ...folderToDelete.itemIds]
    }

    saveConfig({
      ...config,
      folders: remainingFolders,
    })
  }

  // Rename folder
  const saveRenameFolder = (folderId: string) => {
    if (!editingFolderTitle.trim()) return
    const updated = config.folders.map(f => {
      if (f.id === folderId) {
        return { ...f, title: editingFolderTitle.trim() }
      }
      return f
    })
    saveConfig({ ...config, folders: updated })
    setEditingFolderId(null)
    setEditingFolderTitle('')
  }

  // Move folder Up / Down
  const moveFolderOrder = (index: number, direction: 'up' | 'down') => {
    const nextFolders = [...config.folders]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= nextFolders.length) return
    const temp = nextFolders[index]
    nextFolders[index] = nextFolders[targetIdx]
    nextFolders[targetIdx] = temp
    saveConfig({ ...config, folders: nextFolders })
  }

  // Move item Up / Down inside its folder
  const moveItemOrder = (folderId: string, itemIdx: number, direction: 'up' | 'down') => {
    const updatedFolders = config.folders.map(f => {
      if (f.id === folderId) {
        const nextItems = [...f.itemIds]
        const targetIdx = direction === 'up' ? itemIdx - 1 : itemIdx + 1
        if (targetIdx < 0 || targetIdx >= nextItems.length) return f
        const temp = nextItems[itemIdx]
        nextItems[itemIdx] = nextItems[targetIdx]
        nextItems[targetIdx] = temp
        return { ...f, itemIds: nextItems }
      }
      return f
    })
    saveConfig({ ...config, folders: updatedFolders })
  }

  // Move item to a different folder
  const moveItemToFolder = (itemId: string, targetFolderId: string) => {
    const updatedFolders = config.folders.map(f => {
      if (f.id === targetFolderId) {
        if (!f.itemIds.includes(itemId)) {
          return { ...f, itemIds: [...f.itemIds, itemId] }
        }
        return f
      } else {
        return { ...f, itemIds: f.itemIds.filter(id => id !== itemId) }
      }
    })
    saveConfig({ ...config, folders: updatedFolders })
  }

  const resetToDefault = async () => {
    const ok = await confirmDialog({
      title: 'Сбросить структуру бокового меню?',
      description: 'Все папки и порядок пунктов меню будут возвращены к стандартным заводским настройкам.',
      confirmText: 'Сбросить по умолчанию',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return
    saveConfig({
      hiddenItems: [],
      folders: DEFAULT_SIDEBAR_FOLDERS,
    })
  }

  return (
    <div className="space-y-6 text-xs pb-10">
      {/* Header Info */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span>Кастомизатор бокового меню и структуры папок</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
            Все разделы меню и установленные GitHub расширения теперь представлены в виде <b>полностью настраиваемых папок</b>. Переименовывайте, перемещайте пункты между блоками, меняйте порядок и скрывайте ненужное.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {savedBadge && (
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Сохранено</span>
            </span>
          )}
          <button
            onClick={resetToDefault}
            className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить по умолчанию</span>
          </button>
        </div>
      </div>

      {/* Community Layout Presets & Share/Import */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div>
            <h4 className="font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Пресеты раскладки и расширений</span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Готовые шаблоны расположения папок и расширений или обмен кастомными пресетами
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Импорт пресета</span>
            </button>
            <button
              onClick={handleExportMyPreset}
              className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedPreset ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedPreset ? 'Скопировано в буфер!' : 'Поделиться моей раскладкой'}</span>
            </button>
          </div>
        </div>

        {/* Presets Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {COMMUNITY_LAYOUT_PRESETS.map(preset => (
            <div
              key={preset.id}
              className="p-3.5 rounded-xl bg-muted/20 border border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <span>{preset.icon}</span>
                    <span>{preset.title}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">@{preset.author}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {preset.description}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {preset.config.folders.map(f => (
                    <span key={f.id} className="text-[9px] px-2 py-0.5 rounded-md bg-card border border-border text-foreground/80 font-medium">
                      📁 {f.title} ({f.itemIds.length})
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {preset.config.folders.length} папок • {preset.config.hiddenItems.length} скрыто
                </span>
                <button
                  onClick={() => applyLayoutPreset(preset)}
                  className="px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Check className="w-3 h-3" />
                  <span>Применить пресет</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Folders Creator Form */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-primary" />
          <span>Создать новую пользовательскую папку в меню</span>
        </h4>

        <form onSubmit={createFolder} className="flex items-center gap-2 max-w-md">
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Например: 🚀 Стартап, 📚 Обучение, 🛠 Инструменты..."
            className="flex-1 h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary text-xs"
          />
          <button
            type="submit"
            className="px-3.5 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить папку</span>
          </button>
        </form>
      </div>

      {/* Folders & Items Visual Manager */}
      <div className="space-y-4">
        {config.folders.map((folder, folderIdx) => {
          const isEditing = editingFolderId === folder.id
          const isFolderHidden = folder.hidden === true

          return (
            <div
              key={folder.id}
              className={cn(
                'p-4 rounded-2xl border transition-all space-y-3',
                isFolderHidden
                  ? 'bg-muted/15 border-border/40 opacity-70'
                  : 'bg-card border-border shadow-xs'
              )}
            >
              {/* Folder Header Row */}
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingFolderTitle}
                        onChange={e => setEditingFolderTitle(e.target.value)}
                        className="h-7 px-2 rounded-lg bg-muted border border-border text-foreground text-xs font-bold outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={() => saveRenameFolder(folder.id)}
                        className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingFolderId(null)}
                        className="p-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className={cn(
                        'font-bold text-xs truncate',
                        isFolderHidden ? 'line-through text-muted-foreground' : 'text-foreground'
                      )}>
                        {folder.title}
                      </h4>
                      <span className="text-[10px] text-muted-foreground">({folder.itemIds.length} пунктов)</span>
                      <button
                        onClick={() => {
                          setEditingFolderId(folder.id)
                          setEditingFolderTitle(folder.title)
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                        title="Переименовать папку"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Folder Control Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Move Folder Up/Down */}
                  <button
                    onClick={() => moveFolderOrder(folderIdx, 'up')}
                    disabled={folderIdx === 0}
                    className="p-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                    title="Переместить папку выше"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveFolderOrder(folderIdx, 'down')}
                    disabled={folderIdx === config.folders.length - 1}
                    className="p-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                    title="Переместить папку ниже"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Toggle Folder Hide */}
                  <button
                    onClick={() => toggleFolderVisibility(folder.id)}
                    className={cn(
                      'px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer',
                      isFolderHidden
                        ? 'bg-muted/40 border-border text-muted-foreground'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    )}
                    title={isFolderHidden ? 'Показать всю папку' : 'Скрыть всю папку из меню'}
                  >
                    {isFolderHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span className="hidden sm:inline">{isFolderHidden ? 'Скрыта' : 'Активна'}</span>
                  </button>

                  {/* Delete Folder */}
                  <button
                    onClick={() => deleteFolder(folder.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Удалить папку"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Items List Inside This Folder */}
              {folder.itemIds.length === 0 ? (
                <div className="p-3 rounded-xl bg-muted/20 border border-dashed border-border text-center text-muted-foreground text-[11px]">
                  Папка пуста. Перенесите сюда пункты меню из других разделов ниже.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {folder.itemIds.map((itemId, itemIdx) => {
                    const meta = allItemMetas[itemId] || { title: itemId, icon: Puzzle }
                    const isHidden = config.hiddenItems.includes(itemId)
                    const IconComp = typeof meta.icon === 'string' ? null : meta.icon

                    return (
                      <div
                        key={itemId}
                        className={cn(
                          'p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all',
                          isHidden
                            ? 'bg-muted/30 border-border/40 opacity-60'
                            : 'bg-muted/20 border-border/80 hover:border-primary/40'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-sm shrink-0 overflow-hidden">
                            {IconComp ? <IconComp className="w-3.5 h-3.5 text-primary" /> : <ExtensionIcon icon={meta.icon} className="w-full h-full text-xs" />}
                          </div>
                          <div className="min-w-0">
                            <p className={cn('font-bold truncate text-[11px]', isHidden ? 'line-through text-muted-foreground' : 'text-foreground')}>
                              {meta.title}
                            </p>
                            {meta.isExt && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-400 font-mono">
                                GitHub Plugin
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Reorder inside folder */}
                          <button
                            onClick={() => moveItemOrder(folder.id, itemIdx, 'up')}
                            disabled={itemIdx === 0}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                            title="Вверх"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveItemOrder(folder.id, itemIdx, 'down')}
                            disabled={itemIdx === folder.itemIds.length - 1}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                            title="Вниз"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>

                          {/* Move to another folder select */}
                          <select
                            value={folder.id}
                            onChange={e => moveItemToFolder(itemId, e.target.value)}
                            className="h-6 px-1.5 rounded-lg bg-card border border-border text-[10px] text-foreground outline-none cursor-pointer max-w-[90px] truncate"
                            title="Перенести в другую папку"
                          >
                            {config.folders.map(f => (
                              <option key={f.id} value={f.id}>
                                📁 {f.title}
                              </option>
                            ))}
                          </select>

                          {/* Toggle Item Visibility */}
                          <button
                            onClick={() => toggleItemVisibility(itemId)}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors cursor-pointer',
                              isHidden
                                ? 'text-muted-foreground hover:text-foreground'
                                : 'text-emerald-400 hover:bg-emerald-500/10'
                            )}
                            title={isHidden ? 'Показать' : 'Скрыть'}
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Import Preset Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" />
                  <span>Импорт раскладки и пресета папок</span>
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleImportPresetSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Вставьте конфигурацию пресета (JSON):
                  </label>
                  <textarea
                    value={importJsonText}
                    onChange={e => setImportJsonText(e.target.value)}
                    placeholder='{"title": "...", "config": { "folders": [...] }}'
                    rows={8}
                    className="w-full p-3 rounded-2xl bg-muted/40 border border-border text-foreground font-mono text-[11px] outline-none focus:border-primary resize-none"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Вы можете вставить код пресета, которым с вами поделился другой пользователь Zerf Note.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Применить пресет</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
