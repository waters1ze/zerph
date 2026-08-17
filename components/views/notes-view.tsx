'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  PanelLeft, PanelLeftClose, ChevronDown, FolderTree, Network, Link as LinkIcon, CornerDownRight, ArrowUpRight
} from 'lucide-react'
import type { Note, NoteType } from '@/lib/types'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { KnowledgeGraphModal } from '@/components/knowledge-graph-modal'
import { extractWikilinks, findBacklinks, findOutgoingLinks, getFolderColor } from '@/lib/wikilinks'

const DEFAULT_FOLDERS = ['Общее', 'Работа', 'Личное', 'Идеи', 'Учеба', 'Проекты']

export interface FolderTreeNode {
  fullPath: string
  name: string
  children: FolderTreeNode[]
  notesCount: number
}

function buildFolderTree(notes: Note[], defaultFolders: string[]): FolderTreeNode[] {
  const allFolderPaths = new Set(defaultFolders)
  notes.forEach(n => {
    if (n.folder && n.folder.trim()) allFolderPaths.add(n.folder.trim())
  })

  // Ensure intermediate paths
  const expandedPaths = new Set<string>()
  allFolderPaths.forEach(path => {
    const parts = path.split('/')
    let current = ''
    parts.forEach(part => {
      current = current ? `${current}/${part}` : part
      expandedPaths.add(current)
    })
  })

  const rootNodes: FolderTreeNode[] = []
  const nodeMap = new Map<string, FolderTreeNode>()

  Array.from(expandedPaths).sort().forEach(fullPath => {
    const parts = fullPath.split('/')
    const name = parts[parts.length - 1]
    const notesCount = notes.filter(n => (n.folder || 'Общее').startsWith(fullPath)).length

    const node: FolderTreeNode = {
      fullPath,
      name,
      children: [],
      notesCount,
    }
    nodeMap.set(fullPath, node)

    if (parts.length === 1) {
      rootNodes.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = nodeMap.get(parentPath)
      if (parent) {
        parent.children.push(node)
      } else {
        rootNodes.push(node)
      }
    }
  })

  return rootNodes
}

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
  
  // Folder Creation / Subfolder state
  const [newFolderName, setNewFolderName] = useState('')
  const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Школа', 'Учеба', 'Работа', 'Проекты']))

  // Graph Modal state
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false)
  const [graphFolderFilter, setGraphFolderFilter] = useState<string | null>(null)

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

  // Wikilink autocomplete state
  const [showWikilinkSuggest, setShowWikilinkSuggest] = useState(false)
  const [wikilinkQuery, setWikilinkQuery] = useState('')
  const [wikilinkCursorPos, setWikilinkCursorPos] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Derive unique flat folders list
  const allFolders = useMemo(() => {
    const set = new Set(DEFAULT_FOLDERS)
    notes.forEach(n => {
      if (n.folder && n.folder.trim()) set.add(n.folder.trim())
    })
    return Array.from(set)
  }, [notes])

  // Derive hierarchical folder tree
  const folderTree = useMemo(() => {
    return buildFolderTree(notes, DEFAULT_FOLDERS)
  }, [notes])

  const toggleFolderExpanded = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

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

  // Filter notes strictly by search & folder (supports hierarchical prefix matching)
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

    // Specific named folder or subfolder
    const noteFolder = n.folder || 'Общее'
    return noteFolder.startsWith(selectedFolder)
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

  // Save current note edits
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

  // Handle Wikilink input changes in textarea
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const pos = e.target.selectionStart
    setEditContent(value)

    // Check if cursor is directly after [[
    const textBeforeCursor = value.slice(0, pos)
    const match = textBeforeCursor.match(/\[\[([^\]]*)$/)
    if (match) {
      setShowWikilinkSuggest(true)
      setWikilinkQuery(match[1])
      setWikilinkCursorPos(pos)
    } else {
      setShowWikilinkSuggest(false)
    }
  }

  const insertWikilink = (targetTitle: string) => {
    if (wikilinkCursorPos === null || !textareaRef.current) return
    const textBefore = editContent.slice(0, wikilinkCursorPos)
    const textAfter = editContent.slice(wikilinkCursorPos)
    const lastBracketIdx = textBefore.lastIndexOf('[[')

    if (lastBracketIdx !== -1) {
      const newText = textBefore.slice(0, lastBracketIdx) + `[[${targetTitle}]]` + textAfter
      setEditContent(newText)
      setShowWikilinkSuggest(false)
    }
  }

  // Navigate to a note by title (or create if not found)
  const handleNavigateWikilink = (targetTitle: string) => {
    const norm = targetTitle.toLowerCase().trim()
    const found = notes.find(n => n.title.toLowerCase().trim() === norm)
    if (found) {
      setSelectedId(found.id)
      setShowMobileList(false)
      setIsEditing(false)
    } else {
      // Create new note with this title
      const newNote: Note = {
        id: `n-${Date.now()}`,
        title: targetTitle,
        content: `# ${targetTitle}\n\nСвязанная заметка`,
        type: 'note',
        folder: activeNote?.folder || 'Общее',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_NOTE', note: newNote })
      setSelectedId(newNote.id)
      setShowMobileList(false)
      setIsEditing(true)
    }
  }

  // AI Auto-classification
  const handleAiClassify = async () => {
    if (!activeNote || isAiProcessing) return
    setIsAiProcessing(true)

    try {
      const apiKey = state.settings.integrations.groqApiKey
      const prompt = `Проанализируй этот текст заметки и верни JSON со свойствами:
1. "folder": определи наиболее подходящую папку из [${allFolders.map(f => `"${f}"`).join(', ')}] или предложи короткое название папки (1 слово)
2. "type": из ["note", "journal", "meeting"]
3. "dueDate": если в тексте есть дата (например «до 25 мая»), верни в формате YYYY-MM-DD, иначе null

Текст заметки:
"${activeNote.title}
${activeNote.content}"

Верни ТОЛЬКО JSON: {"folder": string, "type": string, "dueDate": string | null}`

      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], apiKey }),
      })
      const data = await res.json()
      if (data.content) {
        const cleaned = data.content.replace(/```json/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        if (parsed.folder) setEditFolder(parsed.folder)
        if (parsed.type) setEditType(parsed.type)
        if (parsed.dueDate) setEditDueDate(parsed.dueDate)

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
      // Fallback
    } finally {
      setIsAiProcessing(false)
    }
  }

  const handleTogglePin = () => {
    if (!activeNote) return
    dispatch({
      type: 'UPDATE_NOTE',
      id: activeNote.id,
      updates: { pinned: !activeNote.pinned },
    })
  }

  const handleDelete = async () => {
    if (!activeNote) return
    const ok = await confirm({
      title: 'Удалить заметку?',
      description: `Вы уверены, что хотите удалить «${activeNote.title}»?`,
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (ok) {
      dispatch({ type: 'DELETE_NOTE', id: activeNote.id })
      setSelectedId(null)
      setShowMobileList(true)
    }
  }

  const handleAddTag = () => {
    const t = newTagInput.trim().replace(/^#/, '')
    if (t && !editTags.includes(t)) {
      setEditTags([...editTags, t])
      setNewTagInput('')
    }
  }

  const handleRemoveTag = (t: string) => {
    setEditTags(editTags.filter(x => x !== t))
  }

  // Backlinks & Outgoing links calculation
  const backlinks = useMemo(() => {
    if (!activeNote?.title) return []
    return findBacklinks(activeNote.title, notes)
  }, [activeNote?.title, notes])

  const outgoingLinks = useMemo(() => {
    if (!activeNote) return []
    return findOutgoingLinks(activeNote, notes)
  }, [activeNote, notes])

  // Custom Markdown renderer for [[Wikilinks]]
  const renderMarkdownWithWikilinks = (content: string) => {
    if (!content) return null
    // Replace [[Link]] with special placeholder or custom renderer
    const parts = content.split(/(\[\[[^\]]+\]\])/g)

    return (
      <div className="space-y-2 leading-relaxed">
        {parts.map((part, idx) => {
          const match = part.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/)
          if (match) {
            const targetTitle = match[1].trim()
            const alias = match[2]?.trim() || targetTitle
            const targetExists = notes.some(n => n.title.toLowerCase().trim() === targetTitle.toLowerCase().trim())

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleNavigateWikilink(targetTitle)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-lg text-xs font-bold font-mono transition-all border shadow-xs',
                  targetExists
                    ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 hover:scale-105'
                    : 'bg-muted/70 text-muted-foreground border-dashed border-border hover:text-foreground'
                )}
                title={targetExists ? `Открыть: ${targetTitle}` : `Создать заметку: ${targetTitle}`}
              >
                <LinkIcon className="w-3 h-3" />
                <span>{alias}</span>
                {!targetExists && <span className="text-[10px] opacity-60">+</span>}
              </button>
            )
          }

          return (
            <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
              {part}
            </ReactMarkdown>
          )
        })}
      </div>
    )
  }

  // Recursive tree renderer
  const renderFolderTreeNode = (node: FolderTreeNode, depth = 0) => {
    const isSelected = selectedFolder === node.fullPath
    const isExpanded = expandedFolders.has(node.fullPath)
    const hasChildren = node.children.length > 0
    const folderColor = getFolderColor(node.fullPath)

    return (
      <div key={node.fullPath} className="space-y-0.5">
        <div
          onClick={() => {
            setSelectedFolder(node.fullPath)
            setActiveFolderView(node.fullPath)
          }}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          className={cn(
            'flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs font-medium cursor-pointer transition-all group select-none',
            isSelected
              ? 'bg-primary/15 text-primary font-bold shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleFolderExpanded(node.fullPath, e)}
                className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4 h-4 shrink-0" />
            )}

            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: folderColor }} />
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setParentFolderForNew(node.fullPath)
                setShowNewFolderModal(true)
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted"
              title="Создать подпапку"
            >
              <Plus className="w-3 h-3" />
            </button>
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setGraphFolderFilter(node.fullPath)
                setIsGraphModalOpen(true)
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-amber-400 hover:bg-muted"
              title="Граф этой папки"
            >
              <Network className="w-3 h-3" />
            </button>

            <span className="text-[10px] font-bold text-muted-foreground ml-0.5">
              {node.notesCount}
            </span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children.map(child => renderFolderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-100px)] rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xl font-sans relative">
      
      {/* ── 1. Left Folder Tree Sidebar (Obsidian Style) ── */}
      <AnimatePresence initial={false}>
        {isFoldersOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-border bg-muted/20 flex flex-col shrink-0 overflow-hidden"
          >
            {/* Folder Header */}
            <div className="p-3.5 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Папки & База</span>
              </div>

              <div className="flex items-center gap-1">
                {/* Global Graph View Button */}
                <button
                  onClick={() => {
                    setGraphFolderFilter(null)
                    setIsGraphModalOpen(true)
                  }}
                  className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1 transition-all"
                  title="Открыть интерактивный граф знаний всей базы"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Граф</span>
                </button>

                {/* New Root Folder */}
                <button
                  onClick={() => {
                    setParentFolderForNew(null)
                    setShowNewFolderModal(true)
                  }}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Создать папку"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Views: All, Pinned, Dated */}
            <div className="p-2 space-y-0.5 border-b border-border/40">
              <button
                onClick={() => { setSelectedFolder('all'); setActiveFolderView(null) }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                  selectedFolder === 'all' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Все заметки</span>
                </div>
                <span className="text-[10px] opacity-70">{notes.length}</span>
              </button>

              <button
                onClick={() => { setSelectedFolder('pinned'); setActiveFolderView(null) }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                  selectedFolder === 'pinned' ? 'bg-primary text-primary-foreground font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Закрепленные</span>
                </div>
                <span className="text-[10px] opacity-70">{notes.filter(n => n.pinned).length}</span>
              </button>
            </div>

            {/* Nested Folder Tree */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Дерево папок
              </div>
              {folderTree.map(node => renderFolderTreeNode(node))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. Note List Panel ── */}
      <div
        className={cn(
          'w-full md:w-80 border-r border-border bg-card/60 flex flex-col shrink-0',
          !showMobileList && 'hidden md:flex'
        )}
      >
        {/* Top Search & Actions */}
        <div className="p-3.5 border-b border-border/60 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsFoldersOpen(!isFoldersOpen)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                title={isFoldersOpen ? 'Скрыть папки' : 'Показать папки'}
              >
                {isFoldersOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              </button>

              <span className="text-xs font-bold text-foreground truncate">
                {selectedFolder === 'all' ? 'Все заметки' : selectedFolder}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {filteredNotes.length}
              </span>
            </div>

            <button
              onClick={handleCreateNote}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm shrink-0"
              title="Создать заметку"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по заметкам…"
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-muted/50 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Note List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar">
          {filteredNotes.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
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
                    'p-3 rounded-xl cursor-pointer border transition-all duration-150',
                    isSelected
                      ? 'bg-primary/10 border-primary/40 shadow-xs'
                      : 'bg-card border-border/40 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-xs font-bold text-foreground line-clamp-1 flex-1">
                      {n.title || 'Без названия'}
                    </h3>
                    {n.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                    {preview}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium">
                      {n.folder || 'Общее'}
                    </span>
                    <span>{format(parseISO(n.updatedAt), 'd MMM HH:mm', { locale: ru })}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── 3. Note Viewing & Editing Panel ── */}
      <div
        className={cn(
          'flex-1 flex flex-col h-full bg-background overflow-hidden',
          showMobileList && 'hidden md:flex'
        )}
      >
        {activeNote ? (
          <>
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-card/60 backdrop-blur-md shrink-0">
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
                    'p-2 rounded-xl border transition-all text-xs font-medium flex items-center gap-1.5',
                    activeNote.pinned ? 'bg-primary/15 text-primary border-primary/30 font-bold' : 'hover:bg-muted/60 border-border text-muted-foreground'
                  )}
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{activeNote.pinned ? 'Закреплено' : 'Закрепить'}</span>
                </button>

                <button
                  onClick={handleAiClassify}
                  disabled={isAiProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-all disabled:opacity-50"
                >
                  {isAiProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">AI Сортировка</span>
                </button>
              </div>

              {/* Right Toolbar Actions */}
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Сохранить</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs font-semibold text-foreground transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Править</span>
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

            {/* Note Body Workspace */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5 max-w-4xl mx-auto w-full no-scrollbar relative">
              
              {/* Title Input or View */}
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Заголовок заметки…"
                  className="w-full text-2xl font-bold text-foreground bg-transparent outline-none border-b border-border/40 pb-2 tracking-tight"
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-snug">
                  {activeNote.title}
                </h1>
              )}

              {/* Folder & Metadata Row */}
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-card border border-border/60 text-xs">
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-primary" />
                  <span className="text-muted-foreground font-medium">Папка:</span>
                  {isEditing ? (
                    <select
                      value={editFolder}
                      onChange={e => setEditFolder(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-foreground font-semibold outline-none"
                    >
                      {allFolders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-bold text-foreground px-2 py-0.5 rounded-md bg-muted/50 border border-border/40">
                      {activeNote.folder || 'Общее'}
                    </span>
                  )}
                </div>

                {/* Graph Link to this folder */}
                <button
                  type="button"
                  onClick={() => {
                    setGraphFolderFilter(activeNote.folder || 'Общее')
                    setIsGraphModalOpen(true)
                  }}
                  className="ml-auto text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Network className="w-3 h-3" />
                  <span>Граф этой папки</span>
                </button>
              </div>

              {/* Note Content (with Wikilinks editor / preview) */}
              <div className="relative">
                {isEditing ? (
                  <>
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={handleContentChange}
                      placeholder="Пишите текст... Для логической связи введите [[Название заметки]]"
                      rows={14}
                      className="w-full text-sm leading-relaxed text-foreground bg-transparent outline-none resize-y placeholder:text-muted-foreground/40 font-mono"
                    />

                    {/* Floating Wikilink Suggestion Dropdown */}
                    {showWikilinkSuggest && (
                      <div className="absolute top-12 left-4 z-30 w-72 max-h-48 overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-2 space-y-1">
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <LinkIcon className="w-3 h-3 text-primary" />
                          <span>Связать с заметкой [[...]]</span>
                        </div>
                        {notes
                          .filter(n => n.id !== activeNote.id && n.title.toLowerCase().includes(wikilinkQuery.toLowerCase()))
                          .slice(0, 5)
                          .map(n => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => insertWikilink(n.title)}
                              className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-left hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <span className="font-bold truncate">{n.title}</span>
                              <span className="text-[10px] text-muted-foreground">{n.folder || 'Общее'}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="prose-task text-sm leading-relaxed text-foreground/90 py-2">
                    {renderMarkdownWithWikilinks(activeNote.content)}
                  </div>
                )}
              </div>

              {/* ── Obsidian-Style Backlinks & Connections Panel ── */}
              <div className="pt-6 border-t border-border/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <LinkIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Связи заметки (Граф и ссылки)</span>
                  </h3>
                  <button
                    onClick={() => {
                      setGraphFolderFilter(null)
                      setIsGraphModalOpen(true)
                    }}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>Открыть граф</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Backlinks (Ссылки на эту заметку) */}
                  <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                      <CornerDownRight className="w-3.5 h-3.5 text-emerald-400" />
                      Обратные ссылки (Backlinks): {backlinks.length}
                    </span>
                    {backlinks.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        {backlinks.map(({ note, contextSnippet }) => (
                          <div
                            key={note.id}
                            onClick={() => setSelectedId(note.id)}
                            className="p-2 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors"
                          >
                            <span className="text-xs font-bold text-foreground block truncate">
                              [[{note.title}]]
                            </span>
                            {contextSnippet && (
                              <p className="text-[11px] text-muted-foreground/80 line-clamp-1 italic mt-0.5">
                                «{contextSnippet}»
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60 italic pt-1">
                        Другие заметки пока не ссылаются на эту через [[{activeNote.title}]]
                      </p>
                    )}
                  </div>

                  {/* Outgoing Links (Ссылки из этой заметки) */}
                  <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                      Исходящие ссылки: {outgoingLinks.length}
                    </span>
                    {outgoingLinks.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        {outgoingLinks.map(({ targetTitle, targetNote }) => (
                          <div
                            key={targetTitle}
                            onClick={() => handleNavigateWikilink(targetTitle)}
                            className="p-2 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 cursor-pointer transition-colors flex items-center justify-between"
                          >
                            <span className="text-xs font-bold text-foreground truncate">
                              [[{targetTitle}]]
                            </span>
                            <span className="text-[10px] text-primary font-semibold">
                              {targetNote ? 'Открыть →' : 'Создать +'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60 italic pt-1">
                        В тексте нет ссылок [[...]]. Нажмите «Править», чтобы связать с другими заметками.
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 stroke-[1.2] text-muted-foreground/40 mb-3" />
            <p className="text-base font-semibold text-foreground">Заметок пока нет</p>
            <p className="text-xs text-muted-foreground mt-1">Нажмите «+», чтобы создать первую заметку</p>
          </div>
        )}
      </div>

      {/* Modal for creating a new folder / subfolder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-primary" />
                <span>{parentFolderForNew ? `Подпапка в «${parentFolderForNew}»` : 'Новая папка'}</span>
              </h3>
              <button
                onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); setParentFolderForNew(null) }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Название (например: Физика или 10 класс)..."
              className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setShowNewFolderModal(false); setNewFolderName(''); setParentFolderForNew(null) }}
                className="flex-1 h-9 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  const f = newFolderName.trim()
                  if (f) {
                    const full = parentFolderForNew ? `${parentFolderForNew}/${f}` : f
                    setSelectedFolder(full)
                    setEditFolder(full)
                    setExpandedFolders(prev => new Set(prev).add(full))
                    setShowNewFolderModal(false)
                    setNewFolderName('')
                    setParentFolderForNew(null)
                  }
                }}
                disabled={!newFolderName.trim()}
                className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 shadow-sm"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Obsidian-Style Knowledge Graph Modal */}
      <KnowledgeGraphModal
        isOpen={isGraphModalOpen}
        onClose={() => setIsGraphModalOpen(false)}
        notes={notes}
        tasks={state.tasks}
        initialFolder={graphFolderFilter}
        initialNoteId={activeNote?.id}
        onSelectNote={(noteId) => {
          setSelectedId(noteId)
          setShowMobileList(false)
        }}
        onCreateNoteWithTitle={(title) => {
          handleNavigateWikilink(title)
        }}
        onDeleteNote={(noteId) => {
          dispatch({ type: 'DELETE_NOTE', id: noteId })
          if (selectedId === noteId) setSelectedId(null)
        }}
      />
    </div>
  )
}
