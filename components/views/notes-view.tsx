'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileText, Plus, BookOpen, ChevronDown, Pin, Tag, Edit3, Save,
  Volume2, Sparkles, Trash2, Link2, Search, Mic, MicOff, Loader2, X
} from 'lucide-react'
import type { Note } from '@/lib/types'
import { findRelatedNotes, extractWikiLinks } from '@/lib/backend/note-linker'

// ── Note type labels ──────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  note: 'text-primary',
  journal: 'text-[var(--priority-medium)]',
  meeting: 'text-[var(--status-inprogress)]',
}
const TYPE_LABEL: Record<string, string> = {
  note: 'Заметка', journal: 'Дневник', meeting: 'Встреча',
}

// ── Note card in list ─────────────────────────────────────────────────────────
function NoteCard({ note, onClick, isSelected }: { note: Note; onClick: () => void; isSelected: boolean }) {
  const preview = note.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}|_{1,2}|`|\[\[|\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .slice(0, 110)

  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={cn(
        'p-3.5 rounded-xl cursor-pointer border transition-all duration-150',
        isSelected
          ? 'bg-accent/50 border-primary/30 shadow-sm'
          : 'bg-card border-border hover:border-primary/20 hover:bg-accent/20'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[13px] font-semibold text-foreground leading-snug line-clamp-1 flex-1">{note.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {note.pinned && <Pin className="w-3 h-3 text-primary" />}
          <span className={cn('text-[10px] font-medium', TYPE_COLOR[note.type])}>{TYPE_LABEL[note.type]}</span>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">{preview}…</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground/60">
          {format(parseISO(note.updatedAt), 'd MMM yyyy', { locale: ru })}
        </span>
        {note.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-full">
            #{tag}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

// ── Wiki link renderer ────────────────────────────────────────────────────────
function WikiLinkText({
  content,
  notes,
  onNoteClick,
}: {
  content: string
  notes: Note[]
  onNoteClick: (id: string) => void
}) {
  // Split on [[...]] wiki links
  const parts = content.split(/(\[\[[^\]]+\]\])/g)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[\[([^\]]+)\]\]$/)
        if (match) {
          const linkTitle = match[1].trim()
          const linkedNote = notes.find(n =>
            n.title.toLowerCase().includes(linkTitle.toLowerCase()) ||
            linkTitle.toLowerCase().includes(n.title.toLowerCase())
          )
          if (linkedNote) {
            return (
              <span
                key={i}
                className="wiki-link"
                onClick={() => onNoteClick(linkedNote.id)}
                title={`Перейти к: ${linkedNote.title}`}
              >
                <Link2 className="w-3 h-3 inline-block" />
                {linkTitle}
              </span>
            )
          }
          return (
            <span key={i} className="wiki-link-broken" title="Заметка не найдена">
              {linkTitle}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ── Voice recorder for new note ───────────────────────────────────────────────
function VoiceNoteButton({ onRecorded }: { onRecorded: (text: string) => void }) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        setProcessing(true)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, 'note.webm')
        try {
          const res = await fetch('/api/voice', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.transcript) onRecorded(data.transcript)
        } catch { /* ignore */ } finally { setProcessing(false) }
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch { /* microphone denied */ }
  }, [onRecorded])

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop()
  }, [])

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={recording ? stopRecording : startRecording}
      disabled={processing}
      className={cn(
        'flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all',
        recording
          ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
          : processing
            ? 'bg-muted text-muted-foreground border border-border cursor-wait'
            : 'border border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
      )}
    >
      {processing ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Обработка…</>
      ) : recording ? (
        <><MicOff className="w-3.5 h-3.5" /> Стоп</>
      ) : (
        <><Mic className="w-3.5 h-3.5" /> Голосовая</>
      )}
    </motion.button>
  )
}

// ── Main NotesView ────────────────────────────────────────────────────────────
export function NotesView() {
  const { state, dispatch } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(state.notes[0]?.id ?? null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showOriginal, setShowOriginal] = useState(false)
  const [search, setSearch] = useState('')

  const selected = selectedId ? state.notes.find(n => n.id === selectedId) : null
  const relatedNotes = selected ? findRelatedNotes(selected, state.notes) : []

  const filteredNotes = state.notes.filter(n =>
    !search ||
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const startEdit = () => {
    if (selected) { setEditContent(selected.content); setIsEditing(true) }
  }

  const saveEdit = () => {
    if (selected) {
      dispatch({ type: 'UPDATE_NOTE', id: selected.id, updates: { content: editContent } })
      setIsEditing(false)
    }
  }

  const handleVoiceRecorded = async (transcript: string) => {
    // Send transcript as a note via Groq AI
    const res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: transcript }),
    })
    const data = await res.json()
    if (data.note) {
      setSelectedId(data.note.id)
    }
  }

  const wikiLinks = selected ? extractWikiLinks(selected.content) : []

  return (
    <div className="notes-layout flex gap-0 h-full">
      {/* ── List panel ── */}
      <div className="notes-list-panel w-72 shrink-0 flex flex-col gap-2.5 pr-4 border-r border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background pb-2 pt-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
              {filteredNotes.length} заметок
            </span>
            <div className="flex items-center gap-1.5">
              <VoiceNoteButton onRecorded={handleVoiceRecorded} />
              <button className="flex items-center gap-1 text-[12px] text-primary hover:opacity-80 transition-opacity">
                <Plus className="w-3.5 h-3.5" />
                Новая
              </button>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск заметок…"
              className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-muted/40 border border-border/50 rounded-lg outline-none focus:border-primary/40 focus:bg-muted/70 transition-all placeholder:text-muted-foreground/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground/60" />
              </button>
            )}
          </div>
        </div>

        {/* Note list */}
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-[12px] text-muted-foreground">Заметок нет</p>
          </div>
        ) : (
          filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onClick={() => { setSelectedId(note.id); setIsEditing(false); setShowOriginal(false) }}
              isSelected={selectedId === note.id}
            />
          ))
        )}
      </div>

      {/* ── Editor panel ── */}
      <div className="notes-editor-panel flex-1 min-w-0 pl-5 flex flex-col overflow-y-auto">
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background py-1.5 z-10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">
                  {format(parseISO(selected.updatedAt), 'd MMMM yyyy · HH:mm', { locale: ru })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Сохранить
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Редактировать
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Удалить эту заметку?')) {
                          dispatch({ type: 'DELETE_NOTE', id: selected.id })
                          fetch(`/api/tasks?id=${selected.id}&type=note`, { method: 'DELETE' })
                          setSelectedId(null)
                        }
                      }}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-red-500/20 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Удалить заметку"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-foreground mb-2 leading-tight">{selected.title}</h1>

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

            {/* Wiki links found in content */}
            {wikiLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-accent/10 border border-primary/10">
                <Link2 className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                <span className="text-[11px] text-muted-foreground">Ссылки:</span>
                {wikiLinks.map((link, i) => {
                  const linkedNote = state.notes.find(n => n.title.toLowerCase().includes(link.toLowerCase()))
                  return linkedNote ? (
                    <button
                      key={i}
                      onClick={() => setSelectedId(linkedNote.id)}
                      className="text-[11px] text-primary underline underline-offset-2 decoration-dashed hover:opacity-80"
                    >
                      {link}
                    </button>
                  ) : (
                    <span key={i} className="text-[11px] text-muted-foreground/50 line-through">{link}</span>
                  )
                })}
              </div>
            )}

            {/* Content */}
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 w-full font-mono text-[13px] text-foreground bg-muted/20 outline-none resize-none leading-relaxed min-h-[400px] p-4 rounded-xl border border-border/50 focus:border-primary/30 transition-colors"
                spellCheck={false}
                placeholder="Пишите Markdown здесь… Используйте [[Название]] для ссылок на другие заметки"
              />
            ) : (
              <div className="prose-task max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Render paragraphs with wiki link support
                    p: ({ children }) => (
                      <p>
                        {typeof children === 'string' ? (
                          <WikiLinkText
                            content={children}
                            notes={state.notes}
                            onNoteClick={id => { setSelectedId(id); setIsEditing(false) }}
                          />
                        ) : children}
                      </p>
                    ),
                    // External links open in new tab
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {selected.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Original voice text toggle */}
            {selected.originalText && !isEditing && (
              <div className="mt-6 border-t border-border/50 pt-4">
                <button
                  onClick={() => setShowOriginal(v => !v)}
                  className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Исходный голосовой текст</span>
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
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Исходный текст</span>
                        </div>
                        <p className="text-[13px] text-foreground/80 leading-relaxed italic">
                          &ldquo;{selected.originalText}&rdquo;
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                        <Sparkles className="w-3 h-3" />
                        <span>Структурировано Groq Whisper + AI</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Related notes (Obsidian-style backlinks) */}
            {relatedNotes.length > 0 && !isEditing && (
              <div className="mt-6 border-t border-border/50 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                    Связанные заметки
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {relatedNotes.map(rn => (
                    <button
                      key={rn.id}
                      onClick={() => { setSelectedId(rn.id); setIsEditing(false) }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 hover:bg-accent/20 transition-all text-left group"
                    >
                      <FileText className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate group-hover:text-primary transition-colors">{rn.title}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {rn.tags.slice(0, 2).map(t => `#${t}`).join(' ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Выберите заметку для чтения</p>
            <p className="text-[12px] text-muted-foreground/50 mt-1">или создайте новую голосом</p>
          </div>
        )}
      </div>
    </div>
  )
}
