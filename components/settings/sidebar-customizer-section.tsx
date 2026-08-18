'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Inbox, CheckSquare, FileText, Calendar, Clock,
  Target, BarChart2, Users, Settings, FolderOpen, LayoutGrid, Network,
  UserCheck, Building2, Puzzle, Eye, EyeOff, Folder, Plus, Trash2,
  RotateCcw, Check, Sparkles, FolderPlus, ArrowUp, ArrowDown, Move,
  ChevronDown, ChevronRight, Edit2, Save, X, ExternalLink,
  Share2, Download, Upload, Copy, CheckCheck, Heart, Crown, Search, ArrowRight,
  GripVertical, Lock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { planAtLeast, normalizePlan } from '@/lib/plans'
import type { ExtensionItem } from '@/app/api/extensions/route'
import { ExtensionIcon, GithubIcon } from '@/components/views/extensions-view'

export interface SidebarFolder {
  id: string
  title: string
  hidden?: boolean
  itemIds: string[]
}

export interface SidebarConfig {
  hiddenItems: string[]
  folders: SidebarFolder[]
  showMarketplace?: boolean
}

export interface MenuItemMeta {
  id: string
  title: string
  icon: string | React.ElementType
  isExtension?: boolean
}

export const DEFAULT_MENU_ITEMS: Record<string, { title: string; icon: any; isExt?: boolean }> = {
  today:              { title: 'Сегодня',              icon: Sun },
  inbox:              { title: 'Входящие',             icon: Inbox },
  tasks:              { title: 'Задачи',               icon: CheckSquare },
  clock:              { title: 'Часы и Таймеры',       icon: Clock },
  notes:              { title: 'Заметки',              icon: FileText },
  graph:              { title: 'Граф знаний',          icon: Network },
  calendar:           { title: 'Календарь',            icon: Calendar },
  goals:              { title: 'Цели',                 icon: Target },
  projects:           { title: 'Проекты',              icon: FolderOpen },
  ext_entropy_search: { title: 'Entropy AI Search',    icon: '🔮', isExt: true },
  stats:              { title: 'Аналитика',            icon: BarChart2 },
  friends:            { title: 'Друзья',               icon: UserCheck },
  teams:              { title: 'Команды',              icon: Building2 },
  settings:           { title: 'Настройки',            icon: Settings },
}

export const DEFAULT_SIDEBAR_FOLDERS: SidebarFolder[] = [
  {
    id: 'workspace',
    title: 'Рабочее пространство',
    itemIds: ['today', 'inbox', 'tasks', 'clock', 'notes', 'graph', 'ext_entropy_search'],
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
  authorGithub?: string
  minPlan: 'free' | 'plus' | 'pro' | 'corp'
  likesCount: number
  config: SidebarConfig
  recommendedExts?: string[]
  isCustom?: boolean
}

export const DEFAULT_OFFICIAL_PRESETS: LayoutPreset[] = [
  {
    id: 'preset_default_workspace',
    title: 'Основной',
    description: 'Базовая сбалансированная раскладка по умолчанию: задачи, заметки, календарь, граф и таймер фокуса.',
    icon: '✨',
    author: 'Zerf Official',
    minPlan: 'free',
    likesCount: 0,
    config: {
      hiddenItems: [],
      folders: DEFAULT_SIDEBAR_FOLDERS,
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
  const { state, dispatch } = useApp()
  const confirmDialog = useConfirmDialog()
  const [config, setConfig] = useState<SidebarConfig>(getInitialSidebarConfig)
  const [installedExts, setInstalledExts] = useState<ExtensionItem[]>([])
  const [userPlan, setUserPlan] = useState<string>('free')
  const [newFolderName, setNewFolderName] = useState('')
  const [savedBadge, setSavedBadge] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderTitle, setEditingFolderTitle] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJsonText, setImportJsonText] = useState('')
  const [copiedPreset, setCopiedPreset] = useState(false)

  // Custom User Presets State
  const [customPresets, setCustomPresets] = useState<LayoutPreset[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_custom_presets')
        return saved ? JSON.parse(saved) : []
      } catch {}
    }
    return []
  })

  // Presets Showcase Filters & Modals
  const [selectedPresetForModal, setSelectedPresetForModal] = useState<LayoutPreset | null>(null)
  const [showCreatePresetModal, setShowCreatePresetModal] = useState(false)
  const [showAllPresetsModal, setShowAllPresetsModal] = useState(false)
  const [presetSearch, setPresetSearch] = useState('')
  const [presetFilter, setPresetFilter] = useState<'all' | 'free' | 'paid' | 'my'>('all')
  const [storePresets, setStorePresets] = useState<LayoutPreset[]>([])

  // Create preset form states
  const [formPresetTitle, setFormPresetTitle] = useState('')
  const [formPresetDesc, setFormPresetDesc] = useState('')
  const [formPresetIcon, setFormPresetIcon] = useState('✨')
  const [formPresetMinPlan, setFormPresetMinPlan] = useState<'free' | 'plus' | 'pro'>('free')

  // Load user subscription plan for preset gating
  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await fetch('/api/subscription', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.plan) setUserPlan(normalizePlan(data.plan))
      } catch {}
    }
    fetchPlan()
  }, [])

  // Liked presets state persisted in localStorage
  const [likedPresetIds, setLikedPresetIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_liked_presets')
        return saved ? new Set(JSON.parse(saved)) : new Set()
      } catch {}
    }
    return new Set()
  })

  const toggleLikePreset = (presetId: string) => {
    setLikedPresetIds(prev => {
      const next = new Set(prev)
      if (next.has(presetId)) {
        next.delete(presetId)
      } else {
        next.add(presetId)
      }
      try {
        localStorage.setItem('zerf_liked_presets', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  // Sanitize config on mount to remove any legacy 'extensions' itemId
  useEffect(() => {
    setConfig(prev => {
      let changed = false
      const cleanedFolders = prev.folders.map(f => {
        if (f.itemIds.includes('extensions')) {
          changed = true
          return { ...f, itemIds: f.itemIds.filter(id => id !== 'extensions') }
        }
        return f
      })
      if (changed) {
        const next = { ...prev, folders: cleanedFolders }
        try {
          localStorage.setItem('zerf_sidebar_config_v2', JSON.stringify(next))
          localStorage.setItem('zerf_sidebar_config', JSON.stringify(next))
          window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
        } catch {}
        return next
      }
      return prev
    })
  }, [])

  // Load installed/enabled extensions from backend
  useEffect(() => {
    const fetchInstalled = async () => {
      try {
        const res = await fetch('/api/extensions', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.success && Array.isArray(data.catalog)) {
          const installedIds = Array.isArray(data.installedIds) ? data.installedIds : []
          const enabledIds = Array.isArray(data.enabledIds) ? data.enabledIds : installedIds
          const activeExts = data.catalog.filter((e: ExtensionItem) =>
            enabledIds.includes(e.id) || installedIds.includes(e.id) || e.id === 'ext_entropy_search'
          )
          setInstalledExts(activeExts)

          // Extract public/published layout presets & templates from store catalog dynamically
          const extractedStorePresets: LayoutPreset[] = data.catalog
            .filter((ext: ExtensionItem) => {
              if (ext.id === 'preset_default_workspace') return false
              return ext.type === 'template' || (ext.content && (Array.isArray(ext.content.folders) || ext.content.sidebarConfig))
            })
            .map((ext: ExtensionItem) => ({
              id: ext.id,
              title: ext.title,
              description: ext.description,
              icon: ext.icon || '✨',
              author: ext.authorGithub || ext.authorName || 'waters1ze',
              authorGithub: ext.authorGithub || (ext.githubUrl ? ext.githubUrl.split('/').filter(Boolean).slice(-2, -1)[0] : undefined),
              minPlan: (ext.minPlan as any) || 'free',
              likesCount: (ext.ratingCount || 0) * 3 + (ext.installCount || 0),
              config: ext.content?.sidebarConfig || {
                hiddenItems: ext.content?.hiddenItems || [],
                folders: Array.isArray(ext.content?.folders) ? ext.content.folders : DEFAULT_SIDEBAR_FOLDERS,
              },
              recommendedExts: ext.content?.recommendedExts || [],
              isCustom: false,
            }))
          setStorePresets(extractedStorePresets)
        }
      } catch {}
    }
    fetchInstalled()
  }, [])

  const saveConfig = (newConfig: SidebarConfig) => {
    // 🔒 PERMANENT PROTECTION: 'settings' MUST NEVER be hidden and MUST ALWAYS exist in folders!
    const cleanHidden = (newConfig.hiddenItems || []).filter(id => id !== 'settings' && id !== 'extensions')
    let folders = (newConfig.folders || []).map(f => ({
      ...f,
      itemIds: (f.itemIds || []).filter(id => id !== 'extensions'),
    }))

    const hasSettings = folders.some(f => f.itemIds.includes('settings'))
    if (!hasSettings) {
      if (folders.length > 0) {
        folders[folders.length - 1].itemIds.push('settings')
      } else {
        folders = [{ id: 'account', title: 'Аккаунт', itemIds: ['settings'] }]
      }
    }

    const sanitized: SidebarConfig = {
      hiddenItems: cleanHidden,
      folders,
    }

    setConfig(sanitized)
    try {
      localStorage.setItem('zerf_sidebar_config_v2', JSON.stringify(sanitized))
      localStorage.setItem('zerf_sidebar_config', JSON.stringify(sanitized))
      window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
      setSavedBadge(true)
      setTimeout(() => setSavedBadge(false), 2000)

      // Sync to cloud database for mobile & cross-device consistency
      fetch('/api/telegram/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ sidebarConfig: sanitized }),
      }).catch(() => {})
    } catch {}
  }

  // Drag-and-drop state for folders & items
  const [draggedFolderIdx, setDraggedFolderIdx] = useState<number | null>(null)
  const [draggedItem, setDraggedItem] = useState<{ folderId: string; itemIdx: number; itemId: string } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  const handleFolderDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', `folder_${idx}`)
    setDraggedFolderIdx(idx)
  }

  const handleFolderDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedFolderIdx === null || draggedFolderIdx === targetIdx) return
    const newFolders = [...config.folders]
    const [moved] = newFolders.splice(draggedFolderIdx, 1)
    newFolders.splice(targetIdx, 0, moved)
    setDraggedFolderIdx(targetIdx)
    saveConfig({ ...config, folders: newFolders })
  }

  const handleFolderDragEnd = () => {
    setDraggedFolderIdx(null)
  }

  const handleItemDragStart = (e: React.DragEvent, folderId: string, itemIdx: number, itemId: string) => {
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', `item_${folderId}_${itemId}`)
    setDraggedItem({ folderId, itemIdx, itemId })
  }

  const handleItemDragOver = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedItem) return
    if (dragOverFolderId !== targetFolderId) {
      setDragOverFolderId(targetFolderId)
    }
  }

  const handleItemDrop = (e: React.DragEvent, targetFolderId: string, targetIdx?: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
    if (!draggedItem) return

    const { folderId: sourceFolderId, itemId } = draggedItem
    if (sourceFolderId === targetFolderId && typeof targetIdx === 'number') {
      const nextFolders = config.folders.map(f => {
        if (f.id !== targetFolderId) return f
        const items = [...f.itemIds].filter(id => id !== itemId)
        items.splice(targetIdx, 0, itemId)
        return { ...f, itemIds: items }
      })
      saveConfig({ ...config, folders: nextFolders })
    } else if (sourceFolderId !== targetFolderId) {
      const nextFolders = config.folders.map(f => {
        if (f.id === sourceFolderId) {
          return { ...f, itemIds: f.itemIds.filter(id => id !== itemId) }
        }
        if (f.id === targetFolderId) {
          const items = [...f.itemIds].filter(id => id !== itemId)
          if (typeof targetIdx === 'number') {
            items.splice(targetIdx, 0, itemId)
          } else {
            items.push(itemId)
          }
          return { ...f, itemIds: items }
        }
        return f
      })
      saveConfig({ ...config, folders: nextFolders })
    }
    setDraggedItem(null)
  }

  const applyLayoutPreset = async (preset: LayoutPreset) => {
    const isPaidRequired = preset.minPlan && preset.minPlan !== 'free'
    const hasPlan = planAtLeast(userPlan, preset.minPlan || 'free')

    if (isPaidRequired && !hasPlan) {
      const planName = preset.minPlan === 'plus' ? 'Zerf Plus (99 ₽)' : 'Zerf Pro (299 ₽)'
      const ok = await confirmDialog({
        title: `Пресет «${preset.title}»`,
        description: `Для полного функционирования этого пресета (включая виджеты и ИИ-поиск) требуется подписка ${planName}. Хотите применить эту раскладку папок?`,
        confirmText: 'Применить раскладку',
        cancelText: 'Отмена',
        variant: 'primary',
      })
      if (!ok) return
    } else {
      const ok = await confirmDialog({
        title: `Применить пресет «${preset.title}»?`,
        description: 'Текущее расположение папок и пунктов меню будет заменено выбранным шаблоном.',
        confirmText: 'Применить пресет',
        cancelText: 'Отмена',
        variant: 'primary',
      })
      if (!ok) return
    }

    // Auto-install recommended extensions in background if user has access
    if (preset.recommendedExts && preset.recommendedExts.length > 0) {
      for (const extId of preset.recommendedExts) {
        try {
          await fetch('/api/extensions', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'install', extensionId: extId }),
          })
        } catch {}
      }
    }

    saveConfig(preset.config)
    window.dispatchEvent(new CustomEvent('zerf_sync'))
    window.dispatchEvent(new CustomEvent('zerf_sidebar_config_changed'))
    if (selectedPresetForModal) {
      setSelectedPresetForModal(null)
    }
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

  // Create custom preset handler
  const handleOpenCreatePreset = () => {
    setFormPresetTitle('')
    setFormPresetDesc('')
    setFormPresetIcon('✨')
    setFormPresetMinPlan('free')
    setShowCreatePresetModal(true)
  }

  const handleSaveNewPreset = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formPresetTitle.trim()) {
      alert('Введите название пресета')
      return
    }

    const currentUserName = state.settings.name && state.settings.name !== 'Мой профиль'
      ? state.settings.name
      : 'Автор'

    const newPreset: LayoutPreset = {
      id: `preset_custom_${Date.now()}`,
      title: formPresetTitle.trim(),
      description: formPresetDesc.trim() || 'Пользовательский пресет раскладки папок и расширений',
      icon: formPresetIcon.trim() || '✨',
      author: currentUserName,
      minPlan: formPresetMinPlan,
      likesCount: 0,
      config: JSON.parse(JSON.stringify(config)),
      isCustom: true,
    }

    setCustomPresets(prev => {
      const next = [newPreset, ...prev]
      try {
        localStorage.setItem('zerf_custom_presets', JSON.stringify(next))
      } catch {}
      return next
    })

    setShowCreatePresetModal(false)
    alert(`✓ Пресет «${newPreset.title}» успешно создан и сохранен в вашей витрине!`)
  }

  const handleDeleteCustomPreset = async (presetId: string) => {
    const ok = await confirmDialog({
      title: 'Удалить пользовательский пресет?',
      description: 'Этот пресет будет удален из списка ваших созданных пресетов.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger',
    })
    if (!ok) return

    setCustomPresets(prev => {
      const next = prev.filter(p => p.id !== presetId)
      try {
        localStorage.setItem('zerf_custom_presets', JSON.stringify(next))
      } catch {}
      return next
    })
    if (selectedPresetForModal?.id === presetId) {
      setSelectedPresetForModal(null)
    }
  }

  // All presets combined and filtered (dynamic from store + custom + default official)
  const allPresets = useMemo(() => {
    const combined = [...customPresets, ...storePresets, ...DEFAULT_OFFICIAL_PRESETS]
    const seen = new Set<string>()
    return combined.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }, [customPresets, storePresets])

  const topPopularPresets = useMemo(() => {
    return [...allPresets].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)).slice(0, 3)
  }, [allPresets])

  const filteredPresets = useMemo(() => {
    let list = allPresets
    if (presetFilter === 'free') {
      list = list.filter(p => p.minPlan === 'free')
    } else if (presetFilter === 'paid') {
      list = list.filter(p => p.minPlan !== 'free')
    } else if (presetFilter === 'my') {
      list = list.filter(p => p.isCustom || customPresets.some(cp => cp.id === p.id))
    }

    if (presetSearch.trim()) {
      const q = presetSearch.toLowerCase().trim()
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q)
      )
    }
    return list
  }, [allPresets, presetFilter, presetSearch, customPresets])

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

  // Toggle single item visibility (settings is permanently locked from hiding)
  const toggleItemVisibility = (itemId: string) => {
    if (itemId === 'settings') return
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
            Все разделы меню и установленные расширения теперь представлены в виде <b>полностью настраиваемых папок</b>. Переименовывайте, перемещайте пункты между блоками, меняйте порядок и скрывайте ненужное.
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

      {/* ── ВИТРИНА ПРЕСЕТОВ РАСКЛАДКИ И РАСШИРЕНИЙ ── */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        {/* Showcase Header with Title & Global Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
          <div>
            <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>🔥 Популярные пресеты раскладки</span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Лучшие готовые шаблоны расположения папок и расширений
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOpenCreatePreset}
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать пресет</span>
            </button>
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
              <span>{copiedPreset ? 'Скопировано!' : 'Поделиться'}</span>
            </button>
          </div>
        </div>

        {/* Top Popular Presets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {topPopularPresets.map(preset => {
            const isLiked = likedPresetIds.has(preset.id)
            const currentLikes = (preset.likesCount || 0) + (isLiked ? 1 : 0)

            return (
              <div
                key={preset.id}
                className="group rounded-3xl bg-card border border-border hover:border-primary/40 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Visual Folder Preview Bar */}
                <div className="h-16 bg-gradient-to-br from-muted/80 via-muted/40 to-transparent p-3 flex flex-col justify-center gap-1.5 border-b border-border/40">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {preset.config.folders.slice(0, 3).map((f, fIdx) => (
                      <div
                        key={f.id}
                        className={cn(
                          'h-5 px-2 rounded-full text-[9px] font-medium flex items-center gap-1 truncate shrink-0',
                          fIdx === 0
                            ? 'bg-primary/15 text-primary border border-primary/20'
                            : fIdx === 1
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        )}
                      >
                        <span className="truncate max-w-[80px]">{f.title}</span>
                        <span className="opacity-60 text-[8px]">({f.itemIds.length})</span>
                      </div>
                    ))}
                    {preset.config.folders.length > 3 && (
                      <span className="text-[9px] text-muted-foreground font-semibold shrink-0">
                        +{preset.config.folders.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-2.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground text-xs flex items-center gap-1.5 truncate">
                      <span className="text-base">{preset.icon}</span>
                      <span className="truncate">{preset.title}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {preset.isCustom && (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[9px] font-bold border border-purple-500/30">
                          Кастомный
                        </span>
                      )}
                      {preset.minPlan === 'free' ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                          FREE
                        </span>
                      ) : preset.minPlan === 'plus' ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[9px] font-bold border border-amber-500/30 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" /> Plus
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[9px] font-bold border border-purple-500/30 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Pro
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>
                </div>

                <div className="px-4 py-3 bg-muted/20 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleLikePreset(preset.id)}
                      className={cn(
                        'px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer',
                        isLiked
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border'
                      )}
                      title="Поставить лайк пресету"
                    >
                      <Heart className={cn('w-3 h-3', isLiked ? 'fill-rose-400 text-rose-400' : '')} />
                      <span>{currentLikes}</span>
                    </button>
                    {preset.authorGithub || (preset.author && preset.author !== 'Zerf Official' && !preset.author.includes(' ')) ? (
                      <a
                        href={`https://github.com/${preset.authorGithub || preset.author.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors font-mono truncate max-w-[130px]"
                        title={`@${preset.authorGithub || preset.author} на GitHub`}
                      >
                        <GithubIcon className="w-2.5 h-2.5 shrink-0" />
                        <span>@{preset.authorGithub || preset.author.replace(/^@/, '')}</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[130px]">@{preset.author}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedPresetForModal(preset)}
                      className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center cursor-pointer transition-colors"
                      title="Открыть детали"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => applyLayoutPreset(preset)}
                      className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Применить</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Catalog & Marketplace Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={() => setShowAllPresetsModal(true)}
            className="w-full py-3 px-4 rounded-2xl bg-muted/60 hover:bg-muted border border-border/80 hover:border-primary/40 text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs group"
          >
            <LayoutGrid className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            <span>📂 Все пресеты ({allPresets.length})</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('zerf_open_marketplace'))
              dispatch({ type: 'SET_VIEW', view: 'extensions' })
            }}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-primary/15 via-purple-500/15 to-primary/10 hover:from-primary/25 hover:via-purple-500/25 hover:to-primary/20 border border-primary/30 text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group"
          >
            <Puzzle className="w-4 h-4 text-primary group-hover:rotate-12 transition-transform" />
            <span>✨ Магазин расширений и тем</span>
            <ArrowRight className="w-3.5 h-3.5 text-primary group-hover:translate-x-1 transition-transform" />
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
          const isDragOverThisFolder = dragOverFolderId === folder.id

          return (
            <div
              key={folder.id}
              onDragOver={(e) => {
                handleFolderDragOver(e, folderIdx)
                handleItemDragOver(e, folder.id)
              }}
              onDrop={(e) => handleItemDrop(e, folder.id)}
              className={cn(
                'p-4 rounded-2xl border transition-all space-y-3',
                isDragOverThisFolder ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : '',
                isFolderHidden
                  ? 'bg-muted/15 border-border/40 opacity-70'
                  : 'bg-card border-border shadow-xs'
              )}
            >
              {/* Folder Header Row */}
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Folder Drag Handle */}
                  <div
                    draggable
                    onDragStart={(e) => handleFolderDragStart(e, folderIdx)}
                    onDragEnd={handleFolderDragEnd}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors shrink-0"
                    title="Перетащите для изменения порядка папок"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

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
                    {isFolderHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                <div
                  onDragOver={(e) => handleItemDragOver(e, folder.id)}
                  onDrop={(e) => handleItemDrop(e, folder.id)}
                  className="p-4 rounded-xl bg-muted/20 border border-dashed border-border text-center text-muted-foreground text-[11px]"
                >
                  Папка пуста. Перетащите сюда пункты меню.
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
                        draggable
                        onDragStart={(e) => handleItemDragStart(e, folder.id, itemIdx, itemId)}
                        onDragOver={(e) => handleItemDragOver(e, folder.id)}
                        onDrop={(e) => handleItemDrop(e, folder.id, itemIdx)}
                        className={cn(
                          'p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-grab active:cursor-grabbing',
                          isHidden
                            ? 'bg-muted/30 border-border/40 opacity-60'
                            : 'bg-muted/20 border-border/80 hover:border-primary/40'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-sm shrink-0 overflow-hidden">
                            {IconComp ? <IconComp className="w-3.5 h-3.5 text-primary" /> : <ExtensionIcon icon={meta.icon} className="w-full h-full text-xs" />}
                          </div>
                          <div className="min-w-0">
                            <p className={cn('font-bold truncate text-[11px]', isHidden ? 'line-through text-muted-foreground' : 'text-foreground')}>
                              {meta.title}
                            </p>
                            {meta.isExt && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-400 font-mono">
                                Расширение
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

                          {/* Toggle Item Visibility / Settings Lock */}
                          {itemId === 'settings' ? (
                            <span
                              className="p-1.5 text-muted-foreground/60 cursor-not-allowed flex items-center justify-center"
                              title="🔒 Раздел «Настройки» обязателен и не может быть скрыт"
                            >
                              <Lock className="w-3.5 h-3.5 text-muted-foreground/70" />
                            </span>
                          ) : (
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
                          )}
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

      {/* ── MODAL 1: PRESET DETAILS / PREVIEW («ОТКРЫТЬ ПРЕСЕТ») ── */}
      <AnimatePresence>
        {selectedPresetForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl shrink-0">
                    {selectedPresetForModal.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">
                        {selectedPresetForModal.title}
                      </h3>
                      {selectedPresetForModal.minPlan === 'free' ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                          FREE
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[9px] font-bold border border-amber-500/30">
                          Zerf Plus
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Автор: <span className="font-semibold text-foreground">@{selectedPresetForModal.author}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPresetForModal(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Description */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-muted-foreground text-xs leading-relaxed">
                {selectedPresetForModal.description}
              </div>

              {/* Folders Structure Breakdown */}
              <div className="space-y-2">
                <h5 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-primary" />
                  <span>Структура папок и элементов меню:</span>
                </h5>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedPresetForModal.config.folders.map(folder => (
                    <div key={folder.id} className="p-3 rounded-xl bg-muted/20 border border-border/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>📁 {folder.title}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {folder.itemIds.length} пунктов
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {folder.itemIds.map(itemId => {
                          const meta = allItemMetas[itemId] || { title: itemId, icon: Puzzle }
                          const IconC = typeof meta.icon === 'string' ? null : meta.icon
                          return (
                            <span
                              key={itemId}
                              className="px-2 py-0.5 rounded-md bg-card border border-border text-[10px] text-foreground flex items-center gap-1 font-medium shadow-2xs"
                            >
                              {IconC ? <IconC className="w-3 h-3 text-primary" /> : <span>{meta.icon}</span>}
                              <span>{meta.title}</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hidden Items in Preset if any */}
              {selectedPresetForModal.config.hiddenItems && selectedPresetForModal.config.hiddenItems.length > 0 && (
                <div className="p-2.5 rounded-xl bg-muted/20 border border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>Скрытые по умолчанию разделы: {selectedPresetForModal.config.hiddenItems.join(', ')}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedPresetForModal, null, 2))
                    alert('✓ Конфигурация пресета скопирована в буфер обмена!')
                  }}
                  className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать JSON</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPresetForModal(null)}
                    className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs"
                  >
                    Закрыть
                  </button>
                  <button
                    onClick={() => applyLayoutPreset(selectedPresetForModal)}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Применить пресет</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: CREATE CUSTOM PRESET («СОЗДАТЬ ПРЕСЕТ») ── */}
      <AnimatePresence>
        {showCreatePresetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg">
                    ✨
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Создать свой пресет раскладки</h3>
                    <p className="text-[10px] text-muted-foreground">Сохраните текущую конфигурацию папок в виде готового пресета</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreatePresetModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveNewPreset} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Название пресета:</label>
                  <input
                    type="text"
                    value={formPresetTitle}
                    onChange={e => setFormPresetTitle(e.target.value)}
                    placeholder="Например: Моя супер-раскладка для учебы"
                    className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">Описание пресета:</label>
                  <textarea
                    value={formPresetDesc}
                    onChange={e => setFormPresetDesc(e.target.value)}
                    placeholder="Для чего предназначен этот пресет, какие папки и виджеты в фокусе..."
                    rows={3}
                    className="w-full p-2.5 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Иконка / Эмодзи:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={formPresetIcon}
                        onChange={e => setFormPresetIcon(e.target.value)}
                        className="w-14 h-9 px-2 text-center rounded-xl bg-muted/40 border border-border text-sm outline-none focus:border-primary"
                      />
                      <div className="flex items-center gap-1 flex-wrap">
                        {['✨', '🚀', '🔮', '🧘', '👥', '⚡', '🎯', '📚'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setFormPresetIcon(emoji)}
                            className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-xs cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Тарифный план:</label>
                    <select
                      value={formPresetMinPlan}
                      onChange={e => setFormPresetMinPlan(e.target.value as any)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/40 border border-border text-foreground outline-none focus:border-primary text-xs cursor-pointer"
                    >
                      <option value="free">FREE (Бесплатный для всех)</option>
                      <option value="plus">Zerf Plus (99 ₽)</option>
                      <option value="pro">Zerf Pro (299 ₽)</option>
                    </select>
                  </div>
                </div>

                {/* Preview Current Structure Being Saved */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1.5">
                  <p className="text-[11px] font-bold text-foreground">В пресет будет включена текущая структура ({config.folders.length} папок):</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {config.folders.map(f => (
                      <span key={f.id} className="text-[10px] px-2 py-0.5 rounded-md bg-card border border-border text-foreground">
                        📁 {f.title} ({f.itemIds.length})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setShowCreatePresetModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Сохранить пресет</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: IMPORT PRESET ── */}
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
      {/* ── MODAL 4: FULL PRESETS CATALOG (All hundreds of presets) ── */}
      <AnimatePresence>
        {showAllPresetsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-bold text-foreground">
                      Каталог всех пресетов раскладки ({allPresets.length})
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Ищите, примеряйте и применяйте любые раскладки сообщества
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowAllPresetsModal(false)
                      handleOpenCreatePreset()
                    }}
                    className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Создать пресет</span>
                  </button>
                  <button
                    onClick={() => setShowAllPresetsModal(false)}
                    className="w-8 h-8 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Filter Pills & Search in Showcase */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    { id: 'all', label: `🌟 Все (${allPresets.length})` },
                    { id: 'free', label: '🆓 Бесплатные' },
                    { id: 'paid', label: '💎 Zerf Plus / Pro' },
                    { id: 'my', label: `👤 Мои (${customPresets.length})` },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setPresetFilter(f.id as any)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors shrink-0 cursor-pointer',
                        presetFilter === f.id
                          ? 'bg-card border-primary text-primary font-bold shadow-xs'
                          : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={presetSearch}
                    onChange={e => setPresetSearch(e.target.value)}
                    placeholder="Поиск по названию, автору..."
                    className="w-full h-8 pl-8 pr-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Presets Cards Grid */}
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[320px]">
                {filteredPresets.map(preset => {
                  const isLiked = likedPresetIds.has(preset.id)
                  const currentLikes = (preset.likesCount || 0) + (isLiked ? 1 : 0)

                  return (
                    <div
                      key={preset.id}
                      className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 shadow-2xs transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground text-xs flex items-center gap-1.5 truncate">
                            <span>{preset.icon}</span>
                            <span className="truncate">{preset.title}</span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {preset.isCustom && (
                              <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[9px] font-bold border border-purple-500/30">
                                Кастомный
                              </span>
                            )}
                            {preset.minPlan === 'free' ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                                FREE
                              </span>
                            ) : preset.minPlan === 'plus' ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[9px] font-bold border border-amber-500/30 flex items-center gap-1">
                                <Crown className="w-2.5 h-2.5" /> Zerf Plus
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[9px] font-bold border border-purple-500/30 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Zerf Pro
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {preset.description}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {preset.config.folders.map(f => (
                            <span key={f.id} className="text-[9px] px-2 py-0.5 rounded-md bg-muted/60 border border-border text-foreground/80 font-medium">
                              📁 {f.title} ({f.itemIds.length})
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleLikePreset(preset.id)}
                            className={cn(
                              'px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer',
                              isLiked
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border'
                            )}
                            title="Поставить лайк пресету"
                          >
                            <Heart className={cn('w-3 h-3', isLiked ? 'fill-rose-400 text-rose-400' : '')} />
                            <span>{currentLikes}</span>
                          </button>
                          {preset.authorGithub || (preset.author && preset.author !== 'Zerf Official' && !preset.author.includes(' ')) ? (
                            <a
                              href={`https://github.com/${preset.authorGithub || preset.author.replace(/^@/, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors font-mono truncate max-w-[130px]"
                              title={`@${preset.authorGithub || preset.author} на GitHub`}
                            >
                              <GithubIcon className="w-2.5 h-2.5 shrink-0" />
                              <span>@{preset.authorGithub || preset.author.replace(/^@/, '')}</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">@{preset.author}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Open Details Button */}
                          <button
                            onClick={() => setSelectedPresetForModal(preset)}
                            className="px-2.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-xs border border-border flex items-center gap-1 cursor-pointer transition-colors"
                            title="Открыть детали и структуру пресета"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Открыть</span>
                          </button>

                          {/* Apply Preset Button */}
                          <button
                            onClick={() => {
                              applyLayoutPreset(preset)
                              setShowAllPresetsModal(false)
                            }}
                            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Применить</span>
                          </button>

                          {/* Delete Custom Preset */}
                          {preset.isCustom && (
                            <button
                              onClick={() => handleDeleteCustomPreset(preset.id)}
                              className="p-1.5 rounded-xl bg-muted/60 hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 border border-border transition-colors cursor-pointer"
                              title="Удалить пользовательский пресет"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
