'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Inbox, CheckSquare, FileText, Calendar, Clock,
  Target, BarChart2, Users, Settings, FolderOpen, LayoutGrid, Network,
  UserCheck, Building2, Puzzle, Eye, EyeOff, Folder, Plus, Trash2,
  RotateCcw, Check, Sparkles, FolderPlus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SidebarConfig, SidebarFolder } from '@/components/sidebar'

interface MenuItemMeta {
  id: string
  title: string
  icon: React.ElementType
  defaultSection: string
}

const ALL_MENU_ITEMS: MenuItemMeta[] = [
  { id: 'today',      title: 'Сегодня',        icon: Sun,         defaultSection: 'Рабочее пространство' },
  { id: 'inbox',      title: 'Входящие',       icon: Inbox,        defaultSection: 'Рабочее пространство' },
  { id: 'tasks',      title: 'Задачи',         icon: CheckSquare, defaultSection: 'Рабочее пространство' },
  { id: 'clock',      title: 'Часы и Таймеры', icon: Clock,       defaultSection: 'Рабочее пространство' },
  { id: 'notes',      title: 'Заметки',        icon: FileText,    defaultSection: 'Рабочее пространство' },
  { id: 'graph',      title: 'Граф знаний',    icon: Network,     defaultSection: 'Рабочее пространство' },
  { id: 'calendar',   title: 'Календарь',      icon: Calendar,    defaultSection: 'Планирование' },
  { id: 'goals',      title: 'Цели',           icon: Target,      defaultSection: 'Планирование' },
  { id: 'projects',   title: 'Проекты',        icon: FolderOpen,  defaultSection: 'Планирование' },
  { id: 'extensions', title: 'Расширения',     icon: Puzzle,      defaultSection: 'Планирование' },
  { id: 'stats',      title: 'Аналитика',      icon: BarChart2,   defaultSection: 'Аналитика' },
  { id: 'friends',    title: 'Друзья',         icon: UserCheck,   defaultSection: 'Совместная работа' },
  { id: 'teams',      title: 'Команды',        icon: Building2,   defaultSection: 'Совместная работа' },
  { id: 'settings',   title: 'Настройки',      icon: Settings,    defaultSection: 'Аккаунт' },
]

export function SidebarCustomizerSection() {
  const [config, setConfig] = useState<SidebarConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_sidebar_config')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return { hiddenItems: [], folders: [] }
  })

  const [newFolderName, setNewFolderName] = useState('')
  const [savedBadge, setSavedBadge] = useState(false)

  const saveConfig = (newConfig: SidebarConfig) => {
    setConfig(newConfig)
    try {
      localStorage.setItem('zerf_sidebar_config', JSON.stringify(newConfig))
      window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
      setSavedBadge(true)
      setTimeout(() => setSavedBadge(false), 2000)
    } catch {}
  }

  const toggleItemVisibility = (itemId: string) => {
    const isHidden = config.hiddenItems.includes(itemId)
    const nextHidden = isHidden
      ? config.hiddenItems.filter(id => id !== itemId)
      : [...config.hiddenItems, itemId]

    saveConfig({ ...config, hiddenItems: nextHidden })
  }

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
      folders: [...(config.folders || []), newFolder],
    })
    setNewFolderName('')
  }

  const deleteFolder = (folderId: string) => {
    saveConfig({
      ...config,
      folders: (config.folders || []).filter(f => f.id !== folderId),
    })
  }

  const assignItemToFolder = (itemId: string, targetFolderId: string) => {
    const currentFolders = config.folders || []
    const updatedFolders = currentFolders.map(folder => {
      if (folder.id === targetFolderId) {
        if (!folder.itemIds.includes(itemId)) {
          return { ...folder, itemIds: [...folder.itemIds, itemId] }
        }
        return folder
      } else {
        return { ...folder, itemIds: folder.itemIds.filter(id => id !== itemId) }
      }
    })

    saveConfig({ ...config, folders: updatedFolders })
  }

  const removeItemFromFolder = (itemId: string) => {
    const currentFolders = config.folders || []
    const updatedFolders = currentFolders.map(folder => ({
      ...folder,
      itemIds: folder.itemIds.filter(id => id !== itemId),
    }))

    saveConfig({ ...config, folders: updatedFolders })
  }

  const resetToDefault = () => {
    const defaultConfig = { hiddenItems: [], folders: [] }
    saveConfig(defaultConfig)
  }

  return (
    <div className="space-y-6 text-xs">
      {/* Header Info */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span>Редактор меню и боковой панели</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
            Скрывайте ненужные вкладки, группируйте разделы в собственные папки и настраивайте рабочее пространство под себя.
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
            <span>Сбросить</span>
          </button>
        </div>
      </div>

      {/* Folders Creator Section */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-primary" />
          <span>Пользовательские папки в меню</span>
        </h4>

        <form onSubmit={createFolder} className="flex items-center gap-2 max-w-md">
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Название папки (например: Работа, Обучение, Инструменты)..."
            className="flex-1 h-9 px-3 rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary text-xs"
          />
          <button
            type="submit"
            className="px-3.5 h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Создать папку</span>
          </button>
        </form>

        {config.folders && config.folders.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {config.folders.map(folder => (
              <div
                key={folder.id}
                className="p-3.5 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-bold text-foreground truncate">{folder.title}</span>
                  <span className="text-[10px] text-muted-foreground">({folder.itemIds.length} пунктов)</span>
                </div>

                <button
                  onClick={() => deleteFolder(folder.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Удалить папку"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visual Block Editor: Visibility & Folder Assignment */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <h4 className="font-bold text-foreground flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-400" />
          <span>Настройка видимости и распределения по папкам</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALL_MENU_ITEMS.map(item => {
            const isHidden = config.hiddenItems.includes(item.id)
            const assignedFolder = (config.folders || []).find(f => f.itemIds.includes(item.id))
            const Icon = item.icon

            return (
              <div
                key={item.id}
                className={cn(
                  'p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3',
                  isHidden
                    ? 'bg-muted/20 border-border/40 opacity-60'
                    : 'bg-card border-border shadow-2xs hover:border-primary/30'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                    isHidden ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('font-bold truncate', isHidden ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {item.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {assignedFolder ? `📁 В папке: ${assignedFolder.title}` : item.defaultSection}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Folder Selector */}
                  {config.folders && config.folders.length > 0 && !isHidden && (
                    <select
                      value={assignedFolder?.id || 'none'}
                      onChange={e => {
                        if (e.target.value === 'none') {
                          removeItemFromFolder(item.id)
                        } else {
                          assignItemToFolder(item.id, e.target.value)
                        }
                      }}
                      className="h-7 px-2 rounded-lg bg-muted/60 border border-border text-[11px] text-foreground outline-none cursor-pointer max-w-[110px] truncate"
                    >
                      <option value="none">Без папки</option>
                      {config.folders.map(f => (
                        <option key={f.id} value={f.id}>
                          📁 {f.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Visibility Toggle Button */}
                  <button
                    onClick={() => toggleItemVisibility(item.id)}
                    className={cn(
                      'p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1',
                      isHidden
                        ? 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                    )}
                    title={isHidden ? 'Показать в меню' : 'Скрыть из меню'}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Скрыто</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-[10px]">В меню</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
