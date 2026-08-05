'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileText, Plus, BookOpen, Pin, Tag, Edit3, Save,
  Volume2, ChevronDown, Search, Mic, X, Trash2, Folder, Calendar
} from 'lucide-react'
import type { Note, NoteType } from '@/lib/types'
import { VoiceRecorder } from '@/components/voice-recorder'

type FolderFilter = 'all' | NoteType

const FOLDERS: { id: FolderFilter; label: string; icon: React.ElementType }[] = [
  { id: 'all',     label: 'Все заметки', icon: Folder },
  { id: 'note',    label: 'Заметки',     icon: FileText },
  { id: 'journal', label: 'Журнал',      icon: BookOpen },
  { id: 'meeting', label: 'Встречи',     icon: Calendar },
]

const TYPE_COLOR: Record<NoteType, string> = {
  note:    'text-primary',
  journal: 'text-[var(--priority-medium)]',
  meeting: 'text-[var(--status-inprogress)]',
}
const TYPE_LABEL: Record<NoteType, string> = {
  note: 'Заметка', journal: 'Журнал', meeting: 'Встреча',
}

function NoteCard({ note, onClick, isSelected, onDelete }: {
  note: Note; onClick: () => void; isSelected: boolean; onDelete: () => void
}) {
  const preview = note.content.replace(/#{1,6}\s/g, '').replace(/\*{1,2}|_{1,2}|`/g, '').slice(0, 100)
  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl cursor-pointer border transition-all duration-150 group relative',
        isSelected ? 'bg-accent/50 border-primary/30' : 'bg-card border-border hover:border-border/80 hover:bg-accent/20'
      )}
    >
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
      <div className="flex items-start justify-between gap-2 mb-1.5 pr-4">
        <h3 className="text-[13px] font-semibold text-foreground leading-snug line-clamp-1">{note.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {note.pinned && <Pin className="w-3 h-3 text-primary" />}
          <span className={cn('text-[10px] font-medium', TYPE_COLOR[note.type])}>{TYPE_LABEL[note.type]}</span>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{preview}…</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground/70">
          {format(parseISO(note.updatedAt), 'd MMM yyyy')}
        </span>
        {note.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-full">
            #{tag}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

export function NotesView() {
  const { state, dispatch } = useApp()
  const [folder, setFolder] = useState<FolderFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(state.notes[0]?.id ?? null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [showOriginal, setShowOriginal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<NoteType>('note')
  const [voiceOpen, setVoiceOpen] = useState(false)

  const filtered = state.notes.filter(n => {
    if (folder !== 'all' && n.type !== folder) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.content.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selected = selectedId ? state.notes.find(n => n.id === selectedId) : null

  const startEdit = () => {
    if (selected) {
      setEditTitle(selected.title)
      setEditContent(selected.content)
      setIsEditing(true)
    }
  }

  const saveEdit = () => {
    if (selected) {
      dispatch({ type: 'UPDATE_NOTE', id: selected.id, updates: { title: editTitle, content: editContent, updatedAt: new Date().toISOString() } })
      setIsEditing(false)
    }
  }

  const createNote = () => {
    if (!newTitle.trim()) return
    const now = new Date().toISOString()
    const note: Note = {
      id: `note_${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim() || `# ${newTitle.trim()}\n\nНачните писать здесь…`,
      type: newType,
      tags: [],
      taskIds: [],
      createdAt: now,
      updatedAt: now,
      pinned: false,
    }
    dispatch({ type: 'ADD_NOTE', note })
    setSelectedId(note.id)
    setIsCreating(false)
    setNewTitle('')
    setNewContent('')
    setNewType('note')
  }

  const deleteNote = (id: string) => {
    dispatch({ type: 'DELETE_NOTE', id })
    if (selectedId === id) setSelectedId(filtered.find(n => n.id !== id)?.id ?? null)
  }

  return (
    <div className="flex gap-0 h-full">
      {/* ─── Left panel: folder sidebar + list ─── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border overflow-hidden">

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск заметок…"
              className="w-full h-8 pl-7 pr-3 rounded-lg text-[12px] bg-muted/50 border border-border/60 focus:border-primary/40 outline-none transition-all placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Folders */}
        <div className="px-3 pb-2 space-y-0.5">
          {FOLDERS.map(f => {
            const Icon = f.icon
            const count = f.id === 'all' ? state.notes.length : state.notes.filter(n => n.type === f.id).length
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                  folder === f.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 text-left">{f.label}</span>
                <span className="text-[10px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* New note button */}
        <div className="px-3 pb-2">
          <div className="flex gap-1">
            <button
              onClick={() => setIsCreating(true)}
              className="flex-1 flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Новая заметка
            </button>
            <button
              onClick={() => setVoiceOpen(true)}
              title="Создать заметку голосом"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          <AnimatePresence>
            {isCreating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2"
              >
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createNote()}
                  placeholder="Название заметки…"
                  className="w-full text-[12px] font-semibold bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
                />
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as NoteType)}
                  className="w-full text-[11px] bg-muted/30 border border-border/50 rounded-md px-2 py-1 outline-none text-muted-foreground"
                >
                  <option value="note">📝 Заметка</option>
                  <option value="journal">📔 Журнал</option>
                  <option value="meeting">🤝 Встреча</option>
                </select>
                <div className="flex gap-1.5">
                  <button onClick={createNote} className="flex-1 h-6 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity">
                    Создать
                  </button>
                  <button onClick={() => setIsCreating(false)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-[12px] text-muted-foreground">Нет заметок</p>
            </div>
          ) : (
            filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => { setSelectedId(note.id); setIsEditing(false); setShowOriginal(false) }}
                isSelected={selectedId === note.id}
                onDelete={() => deleteNote(note.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ─── Right panel: editor ─── */}
      <div className="flex-1 min-w-0 pl-5 flex flex-col overflow-y-auto">
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background py-1 z-10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">
                  {format(parseISO(selected.updatedAt), 'd MMM yyyy · HH:mm')}
                </span>
                {selected.pinned && <Pin className="w-3 h-3 text-primary" />}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dispatch({ type: 'UPDATE_NOTE', id: selected.id, updates: { pinned: !selected.pinned } })}
                  className={cn(
                    'h-7 px-2.5 rounded-lg border text-[12px] transition-colors',
                    selected.pinned ? 'border-primary/40 text-primary bg-primary/5' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  )}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                {isEditing ? (
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Сохранить
                  </button>
                ) : (
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Редактировать
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="text-xl font-bold text-foreground bg-transparent outline-none mb-3 w-full border-b border-border/40 pb-2 focus:border-primary/40 transition-colors"
                  placeholder="Название…"
                />
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="flex-1 w-full font-mono text-[13px] text-foreground bg-transparent outline-none resize-none leading-relaxed min-h-[400px]"
                  spellCheck={false}
                  placeholder="Пишите в Markdown…"
                />
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-foreground mb-2">{selected.title}</h1>

                {/* Tags */}
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {selected.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/50">
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="prose-task max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
                </div>

                {/* Voice transcript */}
                {selected.originalText && (
                  <div className="mt-6 border-t border-border/50 pt-4">
                    <button
                      onClick={() => setShowOriginal(v => !v)}
                      className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Оригинальный голосовой текст</span>
                      <motion.div animate={{ rotate: showOriginal ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {showOriginal && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-4 rounded-xl bg-muted/30 border border-border/60">
                            <p className="text-[13px] text-foreground/80 leading-relaxed italic">
                              &ldquo;{selected.originalText}&rdquo;
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Выберите заметку или создайте новую</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-3 flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary/10 text-primary text-[13px] font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Новая заметка
            </button>
          </div>
        )}
      </div>

      <VoiceRecorder open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  )
}
