'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Plus, ChevronLeft, Users, CheckCircle2,
  Circle, Clock, X, Edit3, Trash2, ArrowRight, GitBranch,
  Loader2, AlertCircle, Check, Mic, MicOff, LayoutGrid,
  List, Network, ArrowDownRight, Sparkles, UserPlus, Link2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'

interface ProjectMember { chatId: string; name: string }
interface ProjectTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  dueTime?: string
  authorChatId?: string
  parentTaskId?: string
  assignees?: string[]
  subtasks?: Array<{ id: string; title: string; done: boolean }>
}

interface Project {
  id: string
  title: string
  description?: string
  color: string
  status: string
  ownerChatId: string
  memberIds: string[]
  members: ProjectMember[]
  tasks: ProjectTask[]
  createdAt: string
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']

const STATUS_COLUMNS = [
  { id: 'todo', label: 'Сделать', icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border/60' },
  { id: 'inprogress', label: 'В работе', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
  { id: 'done', label: 'Готово', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
]

function MemberAvatar({ member, size = 7 }: { member: ProjectMember; size?: number }) {
  return (
    <div
      title={member.name}
      className={cn(
        'rounded-full bg-muted border-2 border-background flex items-center justify-center shrink-0 text-[10px] font-bold text-foreground/70 shadow-xs',
        `w-${size} h-${size}`
      )}
    >
      {member.name[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ── Tree Canvas Component (Google Stitch Style) ────────────────────────────────

interface TreeCanvasProps {
  project: Project
  tasks: ProjectTask[]
  onOpenCreateTask: (parentTaskId?: string, defaultStatus?: string) => void
  onUpdateTaskStatus: (taskId: string, newStatus: string) => void
  onDeleteTask: (taskId: string) => void
}

function ProjectTreeCanvas({
  project,
  tasks,
  onOpenCreateTask,
  onUpdateTaskStatus,
  onDeleteTask
}: TreeCanvasProps) {
  // Build parent-child relationships
  const rootTasks = useMemo(() => tasks.filter(t => !t.parentTaskId), [tasks])
  const getChildTasks = useCallback((parentId: string) => tasks.filter(t => t.parentTaskId === parentId), [tasks])

  return (
    <div className="w-full rounded-2xl border border-border/80 bg-[#090d14] relative overflow-x-auto min-h-[480px] p-6 sm:p-10 shadow-inner">
      {/* Dot grid background (matching screenshot) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      <div className="relative z-10 flex items-start gap-12 sm:gap-16 min-w-[760px]">
        {/* Root Project Node */}
        <div className="flex flex-col items-center shrink-0 w-64">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full rounded-2xl bg-card/90 backdrop-blur-md border-2 p-4 shadow-xl flex flex-col gap-2.5"
            style={{ borderColor: project.color }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: project.color + '25' }}>
                <FolderOpen className="w-4 h-4" style={{ color: project.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Проект</span>
                <h3 className="text-[14px] font-bold text-foreground truncate">{project.title}</h3>
              </div>
            </div>

            {project.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">{project.description}</p>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span>{tasks.filter(t => t.status === 'done').length}/{tasks.length} выполнено</span>
              <span>{tasks.length ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%</span>
            </div>

            <button
              onClick={() => onOpenCreateTask()}
              className="mt-1 w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать задачу</span>
            </button>
          </motion.div>
        </div>

        {/* Tree Branches & Connected Tasks */}
        <div className="flex-1 flex flex-col gap-6">
          {rootTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground/60">
              <Network className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm font-medium">Дерево задач пусто</p>
              <p className="text-xs mt-1">Нажмите «Создать задачу», чтобы добавить первый узел дерева</p>
            </div>
          ) : (
            rootTasks.map(rootTask => {
              const children = getChildTasks(rootTask.id)

              return (
                <div key={rootTask.id} className="relative flex items-start gap-8">
                  {/* Connector Line from Root to Task */}
                  <div className="absolute -left-8 top-8 w-8 h-[2px] bg-border/80" />

                  {/* Root Task Node Card */}
                  <TaskNodeCard
                    task={rootTask}
                    projectColor={project.color}
                    onOpenAddChild={() => onOpenCreateTask(rootTask.id)}
                    onStatusChange={(s) => onUpdateTaskStatus(rootTask.id, s)}
                    onDelete={() => onDeleteTask(rootTask.id)}
                  />

                  {/* Child Tasks Column */}
                  {children.length > 0 && (
                    <div className="relative flex flex-col gap-4 pl-4 border-l-2 border-border/80">
                      {children.map(child => (
                        <div key={child.id} className="relative flex items-center gap-4">
                          <div className="absolute -left-4 top-1/2 w-4 h-[2px] bg-border/80" />
                          <TaskNodeCard
                            task={child}
                            projectColor={project.color}
                            isChild
                            onOpenAddChild={() => onOpenCreateTask(child.id)}
                            onStatusChange={(s) => onUpdateTaskStatus(child.id, s)}
                            onDelete={() => onDeleteTask(child.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function TaskNodeCard({
  task,
  projectColor,
  isChild = false,
  onOpenAddChild,
  onStatusChange,
  onDelete
}: {
  task: ProjectTask
  projectColor: string
  isChild?: boolean
  onOpenAddChild: () => void
  onStatusChange: (status: string) => void
  onDelete: () => void
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const statusObj = STATUS_COLUMNS.find(c => c.id === task.status) || STATUS_COLUMNS[0]
  const isDone = task.status === 'done'

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'w-64 rounded-2xl bg-card/95 backdrop-blur-md border border-border p-3.5 shadow-lg hover:border-primary/40 transition-all flex flex-col gap-2 relative group',
        isDone && 'opacity-70 bg-card/60'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Status Dropdown Pill */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={cn(
              'px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border transition-colors',
              task.status === 'done' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              task.status === 'inprogress' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
              'bg-muted/60 border-border text-muted-foreground'
            )}
          >
            <statusObj.icon className="w-3 h-3" />
            <span>{statusObj.label}</span>
          </button>

          {showStatusMenu && (
            <div className="absolute left-0 top-full mt-1.5 w-32 rounded-xl bg-popover border border-border p-1 shadow-xl z-30 flex flex-col gap-0.5">
              {STATUS_COLUMNS.map(col => (
                <button
                  key={col.id}
                  onClick={() => { onStatusChange(col.id); setShowStatusMenu(false) }}
                  className={cn(
                    'px-2 py-1.5 rounded-lg text-left text-xs flex items-center gap-2 hover:bg-muted transition-colors',
                    task.status === col.id ? 'font-bold text-foreground bg-muted/50' : 'text-muted-foreground'
                  )}
                >
                  <col.icon className={cn('w-3 h-3', col.color)} />
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority Badge */}
        <span className={cn(
          'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
          task.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' :
          task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
          'bg-muted/40 text-muted-foreground'
        )}>
          {task.priority === 'urgent' ? 'Срочно' : task.priority === 'high' ? 'Высокий' : 'Средний'}
        </span>
      </div>

      <div>
        <h4 className={cn('text-xs font-semibold text-foreground leading-snug', isDone && 'line-through text-muted-foreground')}>
          {task.title}
        </h4>
        {task.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
      </div>

      {/* Footer Details & Quick Action Buttons */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
        <span>{task.dueDate || 'Без срока'}</span>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenAddChild}
            title="Привязать подзадачу"
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowDownRight className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            title="Удалить задачу"
            className="p-1 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Modal: Create Task in Project (with Voice Support) ──────────────────────────

interface CreateProjectTaskModalProps {
  projectId: string
  projectTitle: string
  tasks: ProjectTask[]
  defaultParentId?: string
  defaultStatus?: string
  members: ProjectMember[]
  onClose: () => void
  onCreated: () => void
}

function CreateProjectTaskModal({
  projectId,
  projectTitle,
  tasks,
  defaultParentId = '',
  defaultStatus = 'todo',
  members,
  onClose,
  onCreated
}: CreateProjectTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueTime, setDueTime] = useState('')
  const [parentTaskId, setParentTaskId] = useState(defaultParentId)
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState('')

  const recognitionRef = useRef<any>(null)

  // Voice recording support
  const toggleVoice = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop()
      setIsRecording(false)
      return
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      alert('Голосовой ввод не поддерживается данным браузером')
      return
    }

    const rec = new SpeechRec()
    rec.lang = 'ru-RU'
    rec.continuous = false
    rec.interimResults = false

    rec.onstart = () => {
      setIsRecording(true)
      setVoiceNotice('🎙️ Слушаю... Скажите задачу и статус')
    }

    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setTitle(transcript)
      setVoiceNotice(`Распознано: «${transcript}»`)
      // Auto-detect status from speech
      const lower = transcript.toLowerCase()
      if (lower.includes('в работе') || lower.includes('делаю')) setStatus('inprogress')
      if (lower.includes('готово') || lower.includes('сделано')) setStatus('done')
      if (lower.includes('срочно')) setPriority('urgent')
    }

    rec.onerror = () => {
      setIsRecording(false)
      setVoiceNotice('Ошибка микрофона')
    }

    rec.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = rec
    rec.start()
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''

      await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          ...headers,
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          dueDate,
          dueTime: dueTime || undefined,
          projectId,
          parentTaskId: parentTaskId || null,
        })
      })

      onCreated()
    } catch {
      alert('Ошибка при создании задачи')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl flex flex-col gap-4 font-sans"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Новая задача в проекте</h3>
              <p className="text-[11px] text-muted-foreground truncate">{projectTitle}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Voice Input Action Button */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
          <div className="text-xs text-muted-foreground">
            {voiceNotice || 'Надиктуйте задачу голосом с микрофона:'}
          </div>
          <button
            onClick={toggleVoice}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs',
              isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-primary text-primary-foreground hover:brightness-110'
            )}
          >
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isRecording ? 'Стоп' : 'Голос'}</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Название задачи *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Что нужно сделать..."
              className="w-full h-10 px-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Описание (опционально)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Детали, ссылки, требования..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Статус
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              >
                <option value="todo">Сделать</option>
                <option value="inprogress">В работе</option>
                <option value="done">Готово</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Приоритет
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              >
                <option value="urgent">Срочно</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </div>
          </div>

          {/* Parent Task Binding */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Привязать к родительской задаче (Связь дерева)
            </label>
            <select
              value={parentTaskId}
              onChange={e => setParentTaskId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
            >
              <option value="">Без привязки (Корневая задача дерева)</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  ↳ {t.title} ({t.status === 'done' ? 'Готово' : t.status === 'inprogress' ? 'В работе' : 'Сделать'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Дата выполнения
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Время
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-border/50">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || loading}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Создать задачу</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Project Modal (Create / Edit Project) ───────────────────────────────────────

function ProjectModal({
  project, onClose, onSave
}: {
  project?: Project | null
  onClose: () => void
  onSave: () => void
}) {
  const { state } = useApp()
  const [title, setTitle] = useState(project?.title || '')
  const [description, setDescription] = useState(project?.description || '')
  const [color, setColor] = useState(project?.color || COLORS[0])
  const [memberInput, setMemberInput] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const handleAddMember = () => {
    const clean = memberInput.trim().replace('@', '')
    if (clean && !members.includes(clean)) {
      setMembers([...members, clean])
      setMemberInput('')
    }
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
    try {
      if (project) {
        await fetch('/api/projects', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: project.id, title, description, color, memberUsernames: members }),
        })
      } else {
        await fetch('/api/projects', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title, description, color, memberUsernames: members }),
        })
      }
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h2 className="text-sm font-bold text-foreground">{project ? 'Редактировать проект' : 'Новый проект'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Название проекта *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Запуск нового сайта..."
              className="w-full h-10 px-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Цели и задачи проекта..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Цветовая метка
            </label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform',
                    color === c && 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card'
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Add Members by Username or from Friends */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Участники (Telegram username)
            </label>
            <div className="flex gap-2">
              <input
                value={memberInput}
                onChange={e => setMemberInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddMember())}
                placeholder="@username..."
                className="flex-1 h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              />
              <button
                type="button"
                onClick={handleAddMember}
                className="px-3 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold border border-border text-foreground transition-colors"
              >
                Добавить
              </button>
            </div>

            {members.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {members.map(u => (
                  <span key={u} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary flex items-center gap-1">
                    @{u}
                    <button onClick={() => setMembers(members.filter(m => m !== u))} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-border/50">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{project ? 'Сохранить' : 'Создать'}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Project Detail View ────────────────────────────────────────────────────────

function ProjectDetail({
  project, onBack, onEdit, onRefresh, onDelete
}: {
  project: Project
  onBack: () => void
  onEdit: () => void
  onRefresh: () => void
  onDelete: () => void
}) {
  const [viewMode, setViewMode] = useState<'tree' | 'kanban' | 'list'>('tree')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [modalParentId, setModalParentId] = useState<string | undefined>(undefined)
  const [modalStatus, setModalStatus] = useState<string>('todo')

  const done = project.tasks.filter(t => t.status === 'done').length
  const total = project.tasks.length

  const handleOpenCreate = (parentId?: string, status = 'todo') => {
    setModalParentId(parentId)
    setModalStatus(status)
    setShowCreateModal(true)
  }

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ id: taskId, status: newStatus })
      })
      onRefresh()
    } catch {}
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Удалить эту задачу?')) return
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      await fetch(`/api/tasks?id=${taskId}&type=task`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        }
      })
      onRefresh()
    } catch {}
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 w-full font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: project.color + '25', borderColor: project.color }}>
            <FolderOpen className="w-5 h-5" style={{ color: project.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">{project.title}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold" style={{ background: project.color + '18', color: project.color }}>
                {total ? `${Math.round((done / total) * 100)}%` : '0%'}
              </span>
            </div>
            {project.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* View Switcher Pills */}
          <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/80">
            <button
              onClick={() => setViewMode('tree')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                viewMode === 'tree' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Дерево (Stitch)</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                viewMode === 'kanban' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Канбан</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                viewMode === 'list' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Список</span>
            </button>
          </div>

          {/* Create Task Button */}
          <button
            onClick={() => handleOpenCreate()}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Создать задачу</span>
          </button>

          <button onClick={onEdit} className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border" title="Настройки проекта">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors" title="Удалить проект">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Members Bar */}
      {project.members.length > 0 && (
        <div className="px-5 py-3 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Команда:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {project.members.map(m => (
                <div key={m.chatId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 text-xs text-foreground">
                  <MemberAvatar member={m} size={5} />
                  <span>{m.name}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onEdit} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Пригласить</span>
          </button>
        </div>
      )}

      {/* Main View Area */}
      {viewMode === 'tree' ? (
        <ProjectTreeCanvas
          project={project}
          tasks={project.tasks}
          onOpenCreateTask={handleOpenCreate}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onDeleteTask={handleDeleteTask}
        />
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUS_COLUMNS.map(col => {
            const colTasks = project.tasks.filter(t => t.status === col.id)
            return (
              <div key={col.id} className={cn('rounded-2xl border p-4 flex flex-col gap-3', col.bg, col.border)}>
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <col.icon className={cn('w-4 h-4', col.color)} />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">{col.label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <button
                    onClick={() => handleOpenCreate(undefined, col.id)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 min-h-[140px]">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground/40 italic">
                      Нет задач
                    </div>
                  ) : (
                    colTasks.map(t => (
                      <TaskNodeCard
                        key={t.id}
                        task={t}
                        projectColor={project.color}
                        onOpenAddChild={() => handleOpenCreate(t.id)}
                        onStatusChange={(s) => handleUpdateTaskStatus(t.id, s)}
                        onDelete={() => handleDeleteTask(t.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
          {project.tasks.length === 0 ? (
            <p className="text-center py-6 text-xs text-muted-foreground">Нет задач</p>
          ) : (
            project.tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUpdateTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t.status === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <span className={cn('text-xs font-semibold text-foreground', t.status === 'done' && 'line-through text-muted-foreground')}>
                    {t.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{t.dueDate}</span>
                  <button onClick={() => handleDeleteTask(t.id)} className="p-1 rounded-md text-muted-foreground hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Task Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateProjectTaskModal
            projectId={project.id}
            projectTitle={project.title}
            tasks={project.tasks}
            defaultParentId={modalParentId}
            defaultStatus={modalStatus}
            members={project.members}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); onRefresh() }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main ProjectsView Component ────────────────────────────────────────────────

export function ProjectsView() {
  const { state } = useApp()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [error, setError] = useState('')

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects', { headers: getAuthHeaders() })
      const data = await res.json()
      const list: Project[] = data.projects || []
      setProjects(list)

      // If viewing a project, keep updated
      if (selected) {
        const fresh = list.find(p => p.id === selected.id)
        if (fresh) setSelected(fresh)
      }
    } catch {
      setError('Ошибка загрузки проектов')
    } finally {
      setLoading(false)
    }
  }, [selected?.id])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleModalSave = async () => {
    setShowModal(false)
    setEditProject(null)
    await loadProjects()
  }

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Точно удалить проект?')) return
    try {
      await fetch('/api/projects?id=' + id, { method: 'DELETE', headers: getAuthHeaders() })
      setSelected(null)
      loadProjects()
    } catch {}
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full font-sans pb-16">
      {/* Top Header */}
      {!selected && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Проекты и Дерево задач</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Совместная работа, древовидные связи (Google Stitch style) и канбан-доски
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (state.settings.userPlan === 'free' && projects.length >= 5) {
                alert('В бесплатной версии доступно 5 проектов. Оформите Premium в Настройках для безлимита!')
                return
              }
              setShowModal(true)
            }}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Создать проект</span>
          </button>
        </div>
      )}

      {loading && !selected ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground text-center">
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <p className="text-xs">{error}</p>
          <button onClick={loadProjects} className="px-4 py-2 rounded-xl bg-muted text-xs font-semibold hover:bg-muted/80 transition-colors">
            Повторить
          </button>
        </div>
      ) : selected ? (
        <ProjectDetail
          project={selected}
          onBack={() => setSelected(null)}
          onEdit={() => { setEditProject(selected); setShowModal(true) }}
          onRefresh={loadProjects}
          onDelete={() => handleDeleteProject(selected.id)}
        />
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => {
            const done = p.tasks.filter(t => t.status === 'done').length
            const total = p.tasks.length
            const pct = total ? Math.round((done / total) * 100) : 0

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(p)}
                className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: p.color + '22' }}>
                    <FolderOpen className="w-5 h-5" style={{ color: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{p.title}</h3>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{done}/{total} задач</span>
                    <span className="font-semibold text-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                  {p.members.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="flex -space-x-1.5">
                        {p.members.slice(0, 4).map(m => (
                          <MemberAvatar key={m.chatId} member={m} size={6} />
                        ))}
                      </div>
                      {p.members.length > 4 && (
                        <span className="text-[10px] text-muted-foreground font-semibold">+{p.members.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}

          {/* New Project Dashed Card */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowModal(true)}
            className="flex flex-col items-center justify-center gap-2.5 h-44 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-semibold">Создать новый проект</span>
          </motion.button>
        </div>
      )}

      {/* Project Modal */}
      <AnimatePresence>
        {showModal && (
          <ProjectModal
            project={editProject}
            onClose={() => { setShowModal(false); setEditProject(null) }}
            onSave={handleModalSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
