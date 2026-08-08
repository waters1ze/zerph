'use client'

import { useState, useEffect } from 'react'
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
  ChevronLeft, BookOpen, Users, Sparkles, Loader2, Check, X
} from 'lucide-react'
import type { Note, NoteType } from '@/lib/types'

const CATEGORIES = [
  { id: 'all', label: 'Все заметки', icon: Folder },
  { id: 'dated', label: 'С датой', icon: CalendarIcon },
  { id: 'pinned', label: 'Закрепленные', icon: Pin },
  { id: 'note', label: 'Заметки', icon: FileText },
  { id: 'journal', label: 'Дневник', icon: BookOpen },
  { id: 'meeting', label: 'Встречи', icon: Users },
]

export function NotesView() {
  const { state, dispatch } = useApp()
  const { notes, tasks } = state

  const [selectedFolder, setSelectedFolder] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id || null)
  const [search, setSearch] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showMobileList, setShowMobileList] = useState(true)
  const [isAiProcessing, setIsAiProcessing] = useState(false)

  // Draft state for note editing
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState<NoteType>('note')
  const [editDueDate, setEditDueDate] = useState<string>('')
  const [editTaskIds, setEditTaskIds] = useState<string[]>([])
  const [editTags, setEditTags] = useState<string[]>([])
  const [editVisibility, setEditVisibility] = useState<'private' | 'public'>('private')
  const [newTagInput, setNewTagInput] = useState('')

  const activeNote = notes.find(n => n.id === selectedId) || notes[0] || null

  useEffect(() => {
    if (activeNote) {
      setEditTitle(activeNote.title)
      setEditContent(activeNote.content)
      setEditType(activeNote.type || 'note')
      setEditDueDate(activeNote.dueDate || '')
      setEditTaskIds(activeNote.taskIds || [])
      setEditTags(activeNote.tags || [])
      setEditVisibility(activeNote.visibility || 'private')
    }
  }, [selectedId, activeNote])

  // Filter notes
  const filteredNotes = notes.filter(n => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))

    if (!matchesSearch) return false

    if (selectedFolder === 'pinned') return n.pinned
    if (selectedFolder === 'dated') return !!n.dueDate
    if (selectedFolder === 'note' || selectedFolder === 'journal' || selectedFolder === 'meeting') {
      return n.type === selectedFolder
    }

    return true
  })

  // Create new note
  const handleCreateNote = () => {
    const newNote: Note = {
      id: `n-${Date.now()}`,
      title: 'Новая заметка',
      content: '',
      type: 'note',
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
        dueDate: editDueDate || undefined,
        taskIds: editTaskIds,
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
1. "type": из ["note", "journal", "meeting"]
   - "journal" если это личные мысли, дневник, рефлексия
   - "meeting" если это созвон, встреча, договорённость, протокол
   - "note" если это обычная бытовая или рабочая заметка
2. "dueDate": дата в формате YYYY-MM-DD если в тексте есть привязка к конкретному дню, иначе null
3. "tags": массив из 1-3 тегов на русском языке

Текст заметки:
${editTitle}
${editContent}`
      const tgWindow = window as any
      const ownerChatId = tgWindow?.Telegram?.WebApp?.initDataUnsafe?.user?.id || null

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          apiKey,
          ownerChatId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка запроса к ИИ')
      }

      if (data.content) {
        const jsonMatch = data.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.type) setEditType(parsed.type)
          if (parsed.dueDate) setEditDueDate(parsed.dueDate)
          if (Array.isArray(parsed.tags)) setEditTags(parsed.tags)

          // Instantly sync to cloud DB
          dispatch({
            type: 'UPDATE_NOTE',
            id: activeNote.id,
            updates: {
              type: parsed.type || editType,
              dueDate: parsed.dueDate || editDueDate || undefined,
              tags: parsed.tags || editTags,
              updatedAt: new Date().toISOString(),
            },
          })
        }
      }
    } catch {
      // Fallback: heuristic classification
      const text = (editTitle + ' ' + editContent).toLowerCase()
      let detectedType: NoteType = 'note'
      if (text.includes('встреч') || text.includes('созвон') || text.includes('протокол') || text.includes('обсудили')) {
        detectedType = 'meeting'
      } else if (text.includes('дневник') || text.includes('мысли') || text.includes('сегодня я') || text.includes('настроение')) {
        detectedType = 'journal'
      }
      setEditType(detectedType)
      dispatch({
        type: 'UPDATE_NOTE',
        id: activeNote.id,
        updates: { type: detectedType },
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
  const handleDelete = () => {
    if (!activeNote) return
    dispatch({ type: 'DELETE_NOTE', id: activeNote.id })
    const remaining = notes.filter(n => n.id !== activeNote.id)
    setSelectedId(remaining[0]?.id || null)
  }

  // Add tag
  const handleAddTag = () => {
    const tag = newTagInput.trim().replace(/^#/, '')
    if (tag && !editTags.includes(tag)) {
      const updated = [...editTags, tag]
      setEditTags(updated)
      if (activeNote) {
        dispatch({ type: 'UPDATE_NOTE', id: activeNote.id, updates: { tags: updated } })
      }
    }
    setNewTagInput('')
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    const updated = editTags.filter(t => t !== tagToRemove)
    setEditTags(updated)
    if (activeNote) {
      dispatch({ type: 'UPDATE_NOTE', id: activeNote.id, updates: { tags: updated } })
    }
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden rounded-2xl border border-border shadow-2xl font-sans">
      {/* ── 1. Clean Vector Folder Sidebar ── */}
      <div className="hidden lg:flex flex-col w-52 bg-muted/30 border-r border-border p-3 select-none shrink-0">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Папки
        </p>
        <div className="space-y-1 mt-1">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const count = notes.filter(n => {
              if (cat.id === 'all') return true
              if (cat.id === 'pinned') return n.pinned
              if (cat.id === 'dated') return !!n.dueDate
              return n.type === cat.id
            }).length

            const isActive = selectedFolder === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedFolder(cat.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all',
                  isActive
                    ? 'bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs'
                    : 'text-foreground/80 hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span>{cat.label}</span>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground/60">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 2. Clean Notes List Panel ── */}
      <div
        className={cn(
          'w-full md:w-80 lg:w-72 border-r border-border bg-card flex flex-col shrink-0',
          !showMobileList && 'hidden md:flex'
        )}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-border/60 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Заметки
            </h2>
            <button
              onClick={handleCreateNote}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md"
              title="Создать заметку"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по заметкам…"
              className="w-full h-8 pl-9 pr-3 rounded-xl bg-muted/50 border border-border/60 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-[13px]">
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
                    <span>{format(parseISO(n.updatedAt), 'd MMM HH:mm', { locale: ru })}</span>
                    {n.dueDate && (
                      <span className="flex items-center gap-1 text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-md">
                        <CalendarIcon className="w-2.5 h-2.5" />
                        {n.dueDate}
                      </span>
                    )}
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
                  onClick={() => {
                    if (state.settings.userPlan === 'free') {
                      alert('AI Сортировка доступна только в Premium версии. Пожалуйста, приобретите Premium через бота.')
                      return
                    }
                    handleAiClassify()
                  }}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-[12px] font-medium text-foreground transition-colors"
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
                      value={editType}
                      onChange={e => setEditType(e.target.value as NoteType)}
                      className="h-7 px-2 rounded-lg bg-muted/60 border border-border text-foreground font-semibold outline-none"
                    >
                      <option value="note">Заметки</option>
                      <option value="journal">Дневник</option>
                      <option value="meeting">Встречи</option>
                    </select>
                  ) : (
                    <span className="font-semibold text-primary capitalize">
                      {editType === 'journal' ? 'Дневник' : editType === 'meeting' ? 'Встречи' : 'Заметки'}
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
    </div>
  )
}
