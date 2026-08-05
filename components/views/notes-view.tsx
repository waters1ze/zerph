'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, Plus, BookOpen, ChevronDown, Pin, Tag, Edit3, Save, Volume2, Sparkles, Trash2 } from 'lucide-react'
import type { Note } from '@/lib/types'

function NoteCard({ note, onClick, isSelected }: { note: Note; onClick: () => void; isSelected: boolean }) {
  const preview = note.content.replace(/#{1,6}\s/g, '').replace(/\*{1,2}|_{1,2}|`/g, '').slice(0, 100)

  const typeColor = { note: 'text-primary', journal: 'text-[var(--priority-medium)]', meeting: 'text-[var(--status-inprogress)]' }
  const typeLabel = { note: 'Note', journal: 'Journal', meeting: 'Meeting' }

  return (
    <motion.div
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl cursor-pointer border transition-all duration-150',
        isSelected ? 'bg-accent/50 border-primary/30' : 'bg-card border-border hover:border-border/80 hover:bg-accent/20'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-[13px] font-semibold text-foreground leading-snug line-clamp-1">{note.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {note.pinned && <Pin className="w-3 h-3 text-primary" />}
          <span className={cn('text-[10px] font-medium', typeColor[note.type])}>{typeLabel[note.type]}</span>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{preview}…</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground/70">
          {format(parseISO(note.updatedAt), 'MMM d, yyyy')}
        </span>
        {note.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

export function NotesView() {
  const { state, dispatch } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(state.notes[0]?.id ?? null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [showOriginal, setShowOriginal] = useState(false)

  const selected = selectedId ? state.notes.find(n => n.id === selectedId) : null

  const startEdit = () => {
    if (selected) {
      setEditContent(selected.content)
      setIsEditing(true)
    }
  }

  const saveEdit = () => {
    if (selected) {
      dispatch({ type: 'UPDATE_NOTE', id: selected.id, updates: { content: editContent } })
      setIsEditing(false)
    }
  }

  return (
    <div className="flex gap-0 h-full">
      {/* List panel */}
      <div className="w-72 shrink-0 flex flex-col gap-3 pr-4 border-r border-border overflow-y-auto">
        <div className="flex items-center justify-between sticky top-0 bg-background pb-2 pt-1">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
            {state.notes.length} notes
          </span>
          <button className="flex items-center gap-1 text-[12px] text-primary hover:opacity-80 transition-opacity">
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
        {state.notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={() => { setSelectedId(note.id); setIsEditing(false); setShowOriginal(false) }}
            isSelected={selectedId === note.id}
          />
        ))}
      </div>

      {/* Editor panel */}
      <div className="flex-1 min-w-0 pl-5 flex flex-col overflow-y-auto">
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background py-1">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">{format(parseISO(selected.updatedAt), 'MMM d, yyyy · HH:mm')}</span>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                ) : (
                  <>
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this note?')) {
                          dispatch({ type: 'DELETE_NOTE', id: selected.id })
                          fetch(`/api/tasks?id=${selected.id}&type=note`, { method: 'DELETE' })
                          setSelectedId(null)
                        }
                      }}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-red-500/20 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <h1 className="text-xl font-bold text-foreground mb-1">{selected.title}</h1>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selected.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/50">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>

            {isEditing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 w-full font-mono text-[13px] text-foreground bg-transparent outline-none resize-none leading-relaxed min-h-[400px]"
                spellCheck={false}
              />
            ) : (
              <div className="prose-task max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
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
                  <span>Original voice transcript</span>
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
                          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Raw transcript</span>
                        </div>
                        <p className="text-[13px] text-foreground/80 leading-relaxed italic">
                          &ldquo;{selected.originalText}&rdquo;
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                        <Sparkles className="w-3 h-3" />
                        <span>Structured by Groq Whisper + AI</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Select a note to read it</p>
          </div>
        )}
      </div>
    </div>
  )
}
