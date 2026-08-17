'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Inbox, CheckSquare, FileText, Calendar, Clock,
  Target, BarChart2, Users, Settings, FolderOpen, LayoutGrid, Network,
  UserCheck, Building2, Puzzle, Eye, EyeOff, Folder, Plus, Trash2,
  RotateCcw, Check, Sparkles, FolderPlus, ArrowUp, ArrowDown, Move,
  ChevronDown, ChevronRight, Edit2, Save, X, ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'
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
    itemIds: ['calendar', 'goals', 'projects', 'extensions'],
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

export function getInitialSidebarConfig(): SidebarConfig {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('zerf_sidebar_config_v2')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && Array.isArray(parsed.folders) && parsed.folders.length > 0) {
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
  const [config, setConfig] = useState<SidebarConfig>(getInitialSidebarConfig)
  const [installedExts, setInstalledExts] = useState<ExtensionItem[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [savedBadge, setSavedBadge] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderTitle, setEditingFolderTitle] = useState('')

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
  const deleteFolder = (folderId: string) => {
    if (!confirm('Удалить эту папку? Пункты из неё будут перенесены в первую доступную папку.')) return
    const folderToDelete = config.folders.find(f => f.id === folderId)
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

  const resetToDefault = () => {
    if (!confirm('Сбросить структуру бокового меню к изначальным настройкам?')) return
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
    </div>
  )
}
