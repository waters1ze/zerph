'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileText, Plus, Folder, Pin, Tag, Edit3, Save,
  Trash2, Search, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, BookOpen, Users, Sparkles, Loader2, Check, X, FolderPlus,
  Briefcase, User, Zap, Lightbulb, GraduationCap, Activity, Flame,
  PanelLeft, PanelLeftClose, ChevronDown, FolderTree
} from 'lucide-react'
import type { Note, NoteType } from '@/lib/types'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'

const DEFAULT_FOLDERS = ['Общее', 'Работа', 'Личное', 'Идеи', 'Учеба', 'Проекты']

export function NotesView() {
  const { state, dispatch } = useApp()
  const confirm = useConfirmDialog()
  const { notes, tasks, habits } = state

  const [selectedFolder, setSelectedFolder] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id || null)
  const [activeFolderView, setActiveFolderView] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showMobileList, setShowMobileList] = useState(true)
  const [isFoldersOpen, setIsFoldersOpen] = useState(true)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)

  // Draft state for note editing
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState<NoteType>('note')
  const [editFolder, setEditFolder] = useState<string>('Общее')
  const [editDueDate, setEditDueDate] = useState<string>('')
  const [editTaskIds, setEditTaskIds] = useState<string[]>([])
  const [editHabitId, setEditHabitId] = useState<string>('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editVisibility, setEditVisibility] = useState<'private' | 'public'>('private')
  const [newTagInput, setNewTagInput] = useState('')

  // Derive unique folders list
  const allFolders = useMemo(() => {
    const set = new Set(DEFAULT_FOLDERS)
    notes.forEach(n => {
      if (n.folder && n.folder.trim()) set.add(n.folder.trim())
    })
    return Array.from(set)
  }, [notes])

  // Folder label helper
  const currentFolderLabel = useMemo(() => {
    if (selectedFolder === 'all') return 'Все заметки'
    if (selectedFolder === 'pinned') return 'Закрепленные'
    if (selectedFolder === 'dated') return 'С датой'
    return selectedFolder
  }, [selectedFolder])

  const activeNote = notes.find(n => n.id === selectedId) || notes[0] || null

  useEffect(() => {
    if (activeNote) {
      setEditTitle(activeNote.title)
      setEditContent(activeNote.content)
      setEditType(activeNote.type || 'note')
      setEditFolder(activeNote.folder || 'Общее')
      setEditDueDate(activeNote.dueDate || '')
      setEditTaskIds(activeNote.taskIds || [])
      setEditHabitId(activeNote.habitId || '')
      setEditTags(activeNote.tags || [])
      setEditVisibility(activeNote.visibility || 'private')
    }
  }, [selectedId, activeNote])

  // Filter notes strictly by search & folder
  const filteredNotes = notes.filter(n => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))

    if (!matchesSearch) return false

    // Folder / Category filter
    if (selectedFolder === 'all') return true
    if (selectedFolder === 'pinned') return n.pinned
    if (selectedFolder === 'dated') return !!n.dueDate
    if (selectedFolder === 'journal' || selectedFolder === 'meeting') {
      return n.type === selectedFolder
    }

    // Specific named folder
    const noteFolder = n.folder || 'Общее'
    return noteFolder.toLowerCase() === selectedFolder.toLowerCase()
  })

  // Create new note
  const handleCreateNote = () => {
    const targetFolder = (selectedFolder !== 'all' && selectedFolder !== 'pinned' && selectedFolder !== 'dated')
      ? selectedFolder
      : 'Общее'

    const newNote: Note = {
      id: `n-${Date.now()}`,
      title: 'Новая заметка',
      content: '',
      type: 'note',
      folder: targetFolder,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_NOTE', note: newNote })
    setSelectedId(newNote.id)
    setIsEditing(true)
    setShowMobileList(false)
  }

  // Save current note edits to cloud DB
  const handleSave = () => {
    if (!activeNote) return
    dispatch({
      type: 'UPDATE_NOTE',
      id: activeNote.id,
      updates: {
        title: editTitle.trim() || 'Без названия',
        content: editContent,
        type: editType,
        folder: editFolder || 'Общее',
        dueDate: editDueDate || undefined,
        taskIds: editTaskIds,
        habitId: editHabitId || undefined,
        tags: editTags,
        visibility: editVisibility,
        updatedAt: new Date().toISOString(),
      },
    })
    setIsEditing(false)
  }

  // AI Auto-classification of notes into folders
  const handleAiClassify = async () => {
    if (!activeNote || isAiProcessing) return
    setIsAiProcessing(true)

    try {
      const apiKey = state.settings.integrations.groqApiKey
      const prompt = `Проанализируй этот текст заметки и верни JSON со свойствами:
1. "folder": определи наиболее подходящую папку из [${allFolders.map(f => `"${f}"`).join(', ')}] или предложи короткое название папки (1 слово)
2. "type": из ["note", "journal", "meeting"]
   - "journal" если это личные мысли, дневник, рефлексия
   - "meeting" если это созвон, встреча, договорённость, протокол
   - "note" для всего остального
3. "dueDate": если в тексте есть дата (например «до 25 мая», «на четверг»), верни в формате YYYY-MM-DD, иначе null

Текст заметки:
"${activeNote.title}
${activeNote.content}"

Верни ТОЛЬКО JSON без markdown разметки: {"folder": string, "type": string, "dueDate": string | null}`

      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          apiKey,
        }),
      })

      const data = await res.json()
      if (data.content) {
        const cleaned = data.content.replace(/```json/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleaned)

        if (parsed.folder) {
          setEditFolder(parsed.folder)
        }
        if (parsed.type) {
          setEditType(parsed.type)
        }
        if (parsed.dueDate) {
          setEditDueDate(parsed.dueDate)
        }

        dispatch({
          type: 'UPDATE_NOTE',
          id: activeNote.id,
          updates: {
            folder: parsed.folder || activeNote.folder || 'Общее',
            type: parsed.type || activeNote.type || 'note',
            dueDate: parsed.dueDate || activeNote.dueDate,
          },
        })
      }
    } catch {
      // Simple fallback keyword classification
      const lower = (activeNote.title + ' ' + activeNote.content).toLowerCase()
      let detectedFolder = 'Общее'
      let detectedType: NoteType = 'note'

      if (lower.includes('работа') || lower.includes('проект') || lower.includes('клиент') || lower.includes('договор')) {
        detectedFolder = 'Работа'
      } else if (lower.includes('учеба') || lower.includes('лекция') || lower.includes('экзамен') || lower.includes('книга')) {
        detectedFolder = 'Учеба'
      } else if (lower.includes('идея') || lower.includes('стартап') || lower.includes('придумал') || lower.includes('мысль')) {
        detectedFolder = 'Идеи'
      } else if (lower.includes('купить') || lower.includes('дом') || lower.includes('семья') || lower.includes('личное')) {
        detectedFolder = 'Личное'
      }

      if (lower.includes('созвон') || lower.includes('митинг') || lower.includes('встреча') || lower.includes('обсудили')) {
        detectedType = 'meeting'
      } else if (lower.includes('дневник') || lower.includes('чувствую') || lower.includes('сегодня я')) {
        detectedType = 'journal'
      }

      setEditFolder(detectedFolder)
      setEditType(detectedType)
      dispatch({
        type: 'UPDATE_NOTE',
        id: activeNote.id,
        updates: { folder: detectedFolder, type: detectedType },
      })
    } finally {
      setIsAiProcessing(false)
    }
  }

  // Toggle pin
  const handleTogglePin = () => {
    if (!activeNote) return
    dispatch({
      type: 'UPDATE_NOTE',
      id: activeNote.id,
      updates: { pinned: !activeNote.pinned },
    })
  }

  // Delete note
  const handleDelete = async () => {
    if (!activeNote) return
    const ok = await confirm({
      title: `Удалить заметку «${activeNote.title}»?`,
      description: 'Это действие нельзя будет отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (ok) {
      dispatch({ type: 'DELETE_NOTE', id: activeNote.id })
      setSelectedId(notes.find(n => n.id !== activeNote.id)?.id || null)
      setIsEditing(false)
      setShowMobileList(true)
    }
  }

  // Add tag
  const handleAddTag = () => {
    const t = newTagInput.trim().replace(/^#/, '')
    if (t && !editTags.includes(t)) {
      const updated = [...editTags, t]
      setEditTags(updated)
      setNewTagInput('')
      if (activeNote) {
        dispatch({ type: 'UPDATE_NOTE', id: activeNote.id, updates: { tags: updated } })
      }
    }
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    const updated = editTags.filter(t => t !== tagToRemove)
    setEditTags(updated)
    if (activeNote) {
      dispatch({ type: 'UPDATE_NOTE', id: activeNote.id, updates: { tags: updated } })
    }
  }

  if (activeFolderView === null) {
    return (
      <div className="flex flex-col h-full w-full bg-background overflow-y-auto rounded-2xl border border-border shadow-2xl font-sans p-5 sm:p-7 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-primary" />
              <span>Папки заметок</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Выберите папку, чтобы открыть и редактировать относящиеся к ней заметки
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold border border-border transition-all"
            >
              <FolderPlus className="w-4 h-4 text-primary" />
              <span>Новая папка</span>
            </button>
            <button
              onClick={() => {
                handleCreateNote()
                setActiveFolderView('Общее')
                setSelectedFolder('Общее')
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Быстрая заметка</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по всем заметкам и папкам…"
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Quick Collections Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. All Notes */}
          <div
            onClick={() => {
              setSelectedFolder('all')
              setActiveFolderView('all')
            }}
            className="p-4 rounded-2xl bg-card hover:bg-muted/40 border border-border/80 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  Все заметки
                </h3>
                <p className="text-[11px] text-muted-foreground">{notes.length} заметок</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* 2. Pinned */}
          <div
            onClick={() => {
              setSelectedFolder('pinned')
              setActiveFolderView('pinned')
            }}
            className="p-4 rounded-2xl bg-card hover:bg-muted/40 border border-border/80 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Pin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground group-hover:text-amber-500 transition-colors">
                  Закрепленные
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {notes.filter(n => n.pinned).length} заметок
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* 3. Group / Team Shared Notes */}
          <div
            onClick={() => {
              setSelectedFolder('Группа')
              setActiveFolderView('Группа')
            }}
            className="p-4 rounded-2xl bg-card hover:bg-muted/40 border border-border/80 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground group-hover:text-sky-400 transition-colors">
                  Общие (Группа)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {notes.filter(n => n.folder === 'Группа' || n.visibility === 'public' || n.tags?.includes('группа') || n.tags?.includes('команда')).length} заметок
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Categories Grid */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Категории и папки ({allFolders.length})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allFolders.map(folder => {
              const folderNotes = notes.filter(n => (n.folder || 'Общее').toLowerCase() === folder.toLowerCase())
              const recentNote = folderNotes[0]

              return (
                <div
                  key={folder}
                  onClick={() => {
                    setSelectedFolder(folder)
                    setActiveFolderView(folder)
                    if (folderNotes.length > 0) {
                      setSelectedId(folderNotes[0].id)
                    }
                  }}
                  className="p-5 rounded-2xl bg-card hover:bg-muted/30 border border-border/80 hover:border-primary/50 cursor-pointer transition-all flex flex-col justify-between gap-4 group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Folder className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          {folder}
                        </h3>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {folderNotes.length} {folderNotes.length === 1 ? 'заметка' : folderNotes.length >= 2 && folderNotes.length <= 4 ? 'заметки' : 'заметок'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
                      Открыть →
                    </span>
                  </div>

                  {/* Recent Preview Snippet */}
                  <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                    {recentNote ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground truncate">{recentNote.title}</p>
                        <p className="line-clamp-1 opacity-70">
                          {recentNote.content ? recentNote.content.slice(0, 60) : 'Без содержимого'}
                        </p>
                      </div>
                    ) : (
                      <p className="italic text-muted-foreground/60">Папка пуста</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* New Folder Modal */}
        <AnimatePresence>
          {showNewFolderModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border p-5 rounded-2xl shadow-2xl max-w-sm w-full space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Новая папка</h3>
                  <button onClick={() => setShowNewFolderModal(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="Название папки (напр. 'Документы', 'Финансы')..."
                  className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs text-foreground outline-none focus:border-primary"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (newFolderName.trim()) {
                        setSelectedFolder(newFolderName.trim())
                        setActiveFolderView(newFolderName.trim())
                        setNewFolderName('')
                        setShowNewFolderModal(false)
                      }
                    }
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowNewFolderModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-muted-foreground"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      if (newFolderName.trim()) {
                        setSelectedFolder(newFolderName.trim())
                        setActiveFolderView(newFolderName.trim())
                        setNewFolderName('')
                        setShowNewFolderModal(false)
                      }
                    }}
                    className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                  >
                    Создать
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden rounded-2xl border border-border shadow-2xl font-sans">
      {/* ── 1. iOS Style Collapsible Folders Sidebar ── */}
      <AnimatePresence initial={false}>
        {isFoldersOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 224, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="hidden lg:flex flex-col bg-card/90 border-r border-border p-3 select-none shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-2 py-2">
              <button
                onClick={() => setActiveFolderView(null)}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                title="Вернуться к списку папок"
              >
                <span>← Папки</span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-muted/60"
                  title="Создать папку"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsFoldersOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/60"
                  title="Скрыть панель папок"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-0.5 mt-1 overflow-y-auto flex-1 pr-1">
              {/* Quick Filters */}
              <button
                onClick={() => setSelectedFolder('all')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all',
                  selectedFolder === 'all'
                    ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                    : 'text-foreground/80 hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Folder className={cn('w-4 h-4 shrink-0', selectedFolder === 'all' ? 'text-primary' : 'text-muted-foreground')} />
                  <span>Все заметки</span>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground/60">{notes.length}</span>
              </button>

              <button
                onClick={() => setSelectedFolder('pinned')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all',
                  selectedFolder === 'pinned'
                    ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                    : 'text-foreground/80 hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Pin className={cn('w-4 h-4 shrink-0', selectedFolder === 'pinned' ? 'text-primary' : 'text-muted-foreground')} />
                  <span>Закрепленные</span>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground/60">
                  {notes.filter(n => n.pinned).length}
                </span>
              </button>

              <button
                onClick={() => setSelectedFolder('dated')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all',
                  selectedFolder === 'dated'
                    ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                    : 'text-foreground/80 hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <CalendarIcon className={cn('w-4 h-4 shrink-0', selectedFolder === 'dated' ? 'text-primary' : 'text-muted-foreground')} />
                  <span>С датой</span>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground/60">
                  {notes.filter(n => !!n.dueDate).length}
                </span>
              </button>

              <div className="my-2 border-t border-border/50" />
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Категории
              </p>

              {allFolders.map(folder => {
                const count = notes.filter(n => (n.folder || 'Общее').toLowerCase() === folder.toLowerCase()).length
                const isActive = selectedFolder.toLowerCase() === folder.toLowerCase()

                return (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all',
                      isActive
                        ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                        : 'text-foreground/80 hover:bg-muted/60'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Folder className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="truncate">{folder}</span>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground/60 shrink-0 ml-1.5">{count}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. iOS Notes List Panel ── */}
      <div
        className={cn(
          'w-full md:w-84 lg:w-80 border-r border-border bg-card/60 flex flex-col shrink-0',
          !showMobileList && 'hidden md:flex'
        )}
      >
        {/* Top Header with iOS Folder Switcher & Controls */}
        <div className="p-3.5 border-b border-border/60 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setActiveFolderView(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-semibold text-foreground border border-border shrink-0 transition-colors"
                title="Все папки"
              >
                <span>← Папки</span>
              </button>

              {/* Folder Selector / Title */}
              <div className="flex items-center gap-1.5 truncate">
                <select
                  value={selectedFolder}
                  onChange={e => setSelectedFolder(e.target.value)}
                  className="bg-transparent text-sm font-bold tracking-tight text-foreground font-sans outline-none cursor-pointer truncate max-w-[120px]"
                >
                  <option value="all" className="bg-card text-foreground">Все заметки</option>
                  <option value="pinned" className="bg-card text-foreground">Закрепленные</option>
                  <option value="dated" className="bg-card text-foreground">С датой</option>
                  <optgroup label="Папки" className="bg-card text-foreground">
                    {allFolders.map(f => (
                      <option key={f} value={f} className="bg-card text-foreground">{f}</option>
                    ))}
                  </optgroup>
                </select>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {filteredNotes.length}
                </span>
              </div>
            </div>

            <button
              onClick={handleCreateNote}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md shrink-0"
              title="Создать заметку"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по заметкам…"
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-muted/50 border border-border/60 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredNotes.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-[13px]">
              Заметок не найдено
            </div>
          ) : (
            filteredNotes.map(n => {
              const isSelected = n.id === selectedId
              const preview = n.content.replace(/#{1,6}\s/g, '').replace(/[*_`#]/g, '').slice(0, 75) || 'Пустая заметка'

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    setSelectedId(n.id)
                    setShowMobileList(false)
                    setIsEditing(false)
                  }}
                  className={cn(
                    'p-3 rounded-xl cursor-pointer border transition-all duration-150 relative',
                    isSelected
                      ? 'bg-primary/10 border-primary/40 shadow-xs'
                      : 'bg-card border-border/40 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-[13px] font-bold text-foreground line-clamp-1 flex-1 font-sans">
                      {n.title || 'Без названия'}
                    </h3>
                    {n.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                  </div>

                  <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mb-2 font-sans">
                    {preview}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium">
                      {n.folder || 'Общее'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>{format(parseISO(n.updatedAt), 'd MMM HH:mm', { locale: ru })}</span>
                      {n.dueDate && (
                        <span className="flex items-center gap-0.5 text-primary font-semibold bg-primary/10 px-1 py-0.5 rounded">
                          <CalendarIcon className="w-2.5 h-2.5" />
                          {n.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── 3. Editor / Viewing Panel ── */}
      <div
        className={cn(
          'flex-1 flex flex-col h-full bg-background overflow-hidden',
          showMobileList && 'hidden md:flex'
        )}
      >
        {activeNote ? (
          <>
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/60 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileList(true)}
                  className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 text-muted-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handleTogglePin}
                  className={cn(
                    'p-2 rounded-xl border transition-all text-[12px] font-medium flex items-center gap-1.5',
                    activeNote.pinned
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'hover:bg-muted/60 border-border text-muted-foreground'
                  )}
                  title="Закрепить вверху"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{activeNote.pinned ? 'Закреплено' : 'Закрепить'}</span>
                </button>

                <button
                  onClick={handleAiClassify}
                  disabled={isAiProcessing}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[12px] font-medium hover:bg-primary/20 transition-all disabled:opacity-50"
                  title="Определить папку и привязать дату с помощью AI"
                >
                  {isAiProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">AI Сортировка</span>
                </button>
              </div>

              {/* Toolbar right actions */}
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold shadow-md hover:opacity-90 transition-opacity"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Сохранить
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-[12px] font-medium text-foreground transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Править
                  </button>
                )}

                <button
                  onClick={handleDelete}
                  className="p-2 rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                  title="Удалить заметку"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full">
              {/* Title & Metadata */}
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Заголовок заметки…"
                  className="w-full text-2xl font-bold text-foreground bg-transparent outline-none border-b border-border/40 pb-2 font-sans tracking-tight"
                />
              ) : (
                <h1 className="text-2xl font-bold text-foreground font-sans tracking-tight leading-snug">
                  {activeNote.title}
                </h1>
              )}

              {/* Folder Selector & Linked Date Picker Bar */}
              <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-card border border-border/60 text-[12px] flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">Папка:</span>
                  {isEditing ? (
                    <select
                      value={editFolder}
                      onChange={e => setEditFolder(e.target.value)}
                      className="h-7 px-2 rounded-lg bg-muted/60 border border-border text-foreground font-semibold outline-none"
                    >
                      {allFolders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-semibold text-primary">
                      {activeNote.folder || 'Общее'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 border-l border-border/60 pl-3 ml-1">
                  <div className="flex items-center gap-1.5 text-amber-500 font-medium shrink-0">
                    <Check className="w-4 h-4" />
                    <span>Задачи:</span>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {editTaskIds.map(tId => (
                        <span key={tId} className="px-1.5 py-0.5 rounded bg-muted text-[10px] flex items-center gap-1">
                          {tasks.find(t => t.id === tId)?.title?.slice(0, 15) || 'Задача'}
                          <span className="cursor-pointer text-destructive font-bold ml-1 hover:text-red-500" onClick={() => setEditTaskIds(p => p.filter(id => id !== tId))}>×</span>
                        </span>
                      ))}
                      <select
                        className="h-7 px-2 w-28 rounded-lg bg-muted/60 border border-border text-[11px] text-foreground outline-none focus:border-primary/50"
                        onChange={e => {
                          if (e.target.value && !editTaskIds.includes(e.target.value)) {
                            setEditTaskIds(p => [...p, e.target.value])
                          }
                          e.target.value = ''
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>+ Добавить</option>
                        {tasks.filter(t => !editTaskIds.includes(t.id)).map(t => (
                          <option key={t.id} value={t.id}>{t.title.slice(0,30)}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {activeNote.taskIds?.length ? (
                        activeNote.taskIds.map(tId => (
                          <span key={tId} className="px-1.5 py-0.5 rounded bg-muted/50 text-[11px] border border-border/50">
                            {tasks.find(t => t.id === tId)?.title || 'Задача'}
                          </span>
                        ))
                      ) : (
                        <span className="font-semibold text-muted-foreground/60">Нет задач</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 border-l border-border/60 pl-3 ml-1">
                  <div className="flex items-center gap-1.5 text-orange-500 font-medium shrink-0">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Привычка:</span>
                  </div>
                  {isEditing ? (
                    <select
                      value={editHabitId}
                      onChange={e => setEditHabitId(e.target.value)}
                      className="h-7 px-2 rounded-lg bg-muted/60 border border-border text-foreground font-semibold outline-none text-[11px]"
                    >
                      <option value="">Без привычки</option>
                      {habits.map(h => (
                        <option key={h.id} value={h.id}>{h.icon || '🔥'} {h.title}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {habits.find(h => h.id === activeNote.habitId)?.title
                        ? `${habits.find(h => h.id === activeNote.habitId)?.icon || '🔥'} ${habits.find(h => h.id === activeNote.habitId)?.title}`
                        : 'Нет'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 border-l border-border/60 pl-3 ml-1">
                  <span className="text-muted-foreground font-medium">Видимость:</span>
                  {isEditing ? (
                    <select
                      value={editVisibility}
                      onChange={e => setEditVisibility(e.target.value as 'private' | 'public')}
                      className="h-7 px-2 rounded-lg bg-muted/60 border border-border text-foreground font-semibold outline-none"
                    >
                      <option value="private">Приватная</option>
                      <option value="public">Видна всем</option>
                    </select>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {activeNote.visibility === 'public' ? 'Видна всем' : 'Приватная'}
                    </span>
                  )}
                </div>
              </div>

              {/* Note Content */}
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="Начните писать здесь…"
                  rows={14}
                  className="w-full text-[14px] leading-relaxed text-foreground bg-transparent outline-none resize-y placeholder:text-muted-foreground/40 font-sans"
                />
              ) : (
                <div className="prose-task text-[14px] leading-relaxed text-foreground/90 py-2 font-sans">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeNote.content || '_Пустая заметка. Нажмите «Править», чтобы добавить текст._'}
                  </ReactMarkdown>
                </div>
              )}

              {/* Tags Section */}
              <div className="pt-4 border-t border-border/40 space-y-2">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Теги</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(isEditing ? editTags : activeNote.tags).map(tag => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20 flex items-center gap-1"
                    >
                      #{tag}
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive transition-colors ml-0.5"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}

                  {isEditing && (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        placeholder="+ тег"
                        className="h-6 w-20 px-2 text-[11px] rounded-full bg-muted/60 border border-border text-foreground outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 stroke-[1.2] text-muted-foreground/40 mb-3" />
            <p className="text-base font-semibold text-foreground font-sans">Заметок пока нет</p>
            <p className="text-[13px] text-muted-foreground mt-1 font-sans">Нажмите «+», чтобы создать первую заметку</p>
          </div>
        )}
      </div>

      {/* Modal for creating a new folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-primary" />
                Новая папка
              </h3>
              <button
                onClick={() => { setShowNewFolderModal(false); setNewFolderName('') }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Название папки (например: Учеба, Работа)..."
              className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary text-foreground"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNewFolderModal(false); setNewFolderName('') }}
                className="flex-1 h-9 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  const f = newFolderName.trim()
                  if (f) {
                    setSelectedFolder(f)
                    setEditFolder(f)
                    setShowNewFolderModal(false)
                    setNewFolderName('')
                  }
                }}
                disabled={!newFolderName.trim()}
                className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
