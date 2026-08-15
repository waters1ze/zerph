'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Priority } from '@/lib/types'
import { X, Tag } from 'lucide-react'
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select'
import { DatePicker } from '@/components/ui/date-picker'
import { FolderKanban } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']
const PRIORITY_LABELS: Record<Priority, string> = { urgent: 'Срочный', high: 'Высокий', medium: 'Обычный', low: 'Низкий' }
const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'var(--priority-urgent)',
  high: 'var(--priority-high)',
  medium: 'var(--priority-medium)',
  low: 'var(--priority-low)',
}

export function NewTaskModal({ open, onClose }: Props) {
  const { state, dispatch } = useApp()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState<string | undefined>(undefined)
  const [projectId, setProjectId] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const reset = () => {
    setTitle(''); setDescription(''); setPriority('medium')
    setDueDate(undefined)
    setProjectId(''); setTagInput(''); setTags([])
  }

  const handleClose = () => { reset(); onClose() }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  const submit = () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    dispatch({
      type: 'ADD_TASK',
      task: {
        id: `t-${Date.now()}`,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status: 'todo',
        dueDate: dueDate || undefined,
        projectId: projectId || undefined,
        tags,
        assignees: [],
        isShared: false,
        createdAt: now,
        updatedAt: now,
      },
    })
    handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[95vw] max-h-[85vh] overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <h2 className="text-[15px] font-semibold text-foreground">Новая задача</h2>
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-5 pb-2 space-y-4 flex-1">
              {/* Title */}
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.metaKey) submit()
                  if (e.key === 'Escape') handleClose()
                }}
                placeholder="Что нужно сделать?…"
                className="w-full text-base font-medium bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 border-b border-border/50 pb-2 focus:border-primary/50 transition-colors"
              />

              {/* Description */}
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Добавить описание или заметки (необязательно)…"
                rows={2}
                className="w-full text-[13px] text-foreground/80 bg-muted/40 rounded-lg px-3 py-2.5 border border-border/50 outline-none resize-none placeholder:text-muted-foreground/50 focus:border-primary/40 transition-colors"
              />

              {/* Priority */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Приоритет</p>
                <div className="flex gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all',
                        priority === p
                          ? 'border-transparent text-white'
                          : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                      )}
                      style={priority === p ? { background: PRIORITY_COLORS[p] } : undefined}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: priority === p ? 'white' : PRIORITY_COLORS[p] }}
                      />
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date + Project */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Срок выполнения</p>
                  <DatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="Без даты"
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Привязать к проекту</p>
                  <CustomSelect
                    value={projectId}
                    onChange={setProjectId}
                    icon={<FolderKanban className="w-3.5 h-3.5" />}
                    options={[
                      { value: '', label: 'Без проекта' },
                      ...state.projects.map(p => ({ value: p.id, label: p.title, color: p.color })),
                    ]}
                    placeholder="Без проекта"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Теги</p>
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border border-border/50">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent.isComposing) {
                          e.preventDefault(); addTag()
                        }
                      }}
                      placeholder="+ Добавить тег…"
                      className="bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/50 min-w-[80px]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 pt-3 pb-5 shrink-0 border-t border-border mt-2">
              <p className="text-[11px] text-muted-foreground/60">
                Нажмите <kbd className="font-mono">⌘ / Ctrl + Enter</kbd> для сохранения
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  className="h-8 px-4 rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={submit}
                  disabled={!title.trim()}
                  className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  Создать задачу
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
