'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Plus, ChevronLeft, MoreHorizontal, Users, CheckCircle2,
  Circle, Clock, X, Edit3, Trash2, ArrowRight, GitBranch, Loader2, AlertCircle, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'

interface ProjectMember { chatId: string; name: string }
interface ProjectTask {
  id: string; title: string; status: string; priority: string
  dueDate?: string; authorChatId?: string; parentTaskId?: string
  assignees?: string[]
}
interface Project {
  id: string; title: string; description?: string; color: string
  status: string; ownerChatId: string; memberIds: string[]
  members: ProjectMember[]; tasks: ProjectTask[]; createdAt: string
}

const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444']

function StatusIcon({ status, className }: { status: string; className?: string }) {
  if (status === 'done') return <CheckCircle2 className={cn('text-emerald-400', className)} />
  if (status === 'inprogress') return <Clock className={cn('text-amber-400', className)} />
  return <Circle className={cn('text-muted-foreground/50', className)} />
}

function MemberAvatar({ member, size = 7 }: { member: ProjectMember; size?: number }) {
  return (
    <div
      title={member.name}
      className={cn(
        'rounded-full bg-muted border-2 border-background flex items-center justify-center shrink-0 text-[10px] font-bold text-foreground/70',
        `w-${size} h-${size}`
      )}
    >
      {member.name[0]?.toUpperCase() || '?'}
    </div>
  )
}

function SubtaskNode({ task, allTasks, depth = 0 }: { task: ProjectTask; allTasks: ProjectTask[]; depth?: number }) {
  const children = allTasks.filter(t => t.parentTaskId === task.id)
  const authorTag = task.authorChatId ? `Автор: #${String(task.authorChatId).slice(-4)}` : null

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/40 group transition-colors',
          depth > 0 && 'border-l-2 border-primary/30 pl-3 ml-3'
        )}
      >
        <StatusIcon status={task.status} className="w-4 h-4 shrink-0" />
        <span className={cn('text-[13px] flex-1 font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>
          {task.title}
        </span>
        {authorTag && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground font-mono">
            {authorTag}
          </span>
        )}
        {task.dueDate && (
          <span className="text-[11px] text-muted-foreground">{task.dueDate}</span>
        )}
      </div>

      {children.length > 0 && (
        <div className="space-y-1">
          {children.map(child => (
            <SubtaskNode key={child.id} task={child} allTasks={allTasks} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskTree({ tasks, projectId }: { tasks: ProjectTask[]; projectId: string }) {
  const rootTasks = tasks.filter(t => !t.parentTaskId)

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/50">
        <GitBranch className="w-8 h-8" />
        <p className="text-[13px]">Нет задач. Добавьте первую!</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {rootTasks.map(task => (
        <SubtaskNode key={task.id} task={task} allTasks={tasks} depth={0} />
      ))}
    </div>
  )
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const done = project.tasks.filter(t => t.status === 'done').length
  const total = project.tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left rounded-2xl bg-card border border-border p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: project.color + '22' }}>
          <FolderOpen className="w-4.5 h-4.5" style={{ color: project.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground truncate">{project.title}</h3>
          {project.description && (
            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{done}/{total} задач</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: project.color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        {project.members.length > 0 && (
          <div className="flex items-center gap-1 pt-1">
            <div className="flex -space-x-1.5">
              {project.members.slice(0, 4).map(m => (
                <MemberAvatar key={m.chatId} member={m} size={6} />
              ))}
            </div>
            {project.members.length > 4 && (
              <span className="text-[10px] text-muted-foreground ml-1">+{project.members.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  )
}

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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold">{project ? 'Редактировать проект' : 'Новый проект'}</h2>
          <div className="flex gap-2">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Название *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Название проекта..."
              className="w-full h-10 px-3.5 rounded-xl bg-muted/60 border border-border text-[14px] focus:outline-none focus:border-primary/50 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Описание проекта..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-[13px] focus:outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Цвет</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn('w-8 h-8 rounded-full transition-transform', color === c && 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-card')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">Участники из вашей команды</label>
            {state.friends.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/60 italic">У вас пока нет людей в команде. Добавьте их в разделе «Команда».</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {state.friends.map((friend: any) => {
                  const identifier = friend.username ? `@${friend.username.replace('@','')}` : friend.name
                  const isSelected = members.includes(identifier) || members.includes(friend.name)
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setMembers(prev => prev.filter(m => m !== identifier && m !== friend.name))
                        } else {
                          setMembers(prev => [...prev, identifier])
                        }
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-all',
                        isSelected
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-muted/50 border-border/60 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Users className="w-3 h-3" />
                      {friend.name}
                      {isSelected && <Check className="w-3 h-3 ml-0.5 text-primary" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border text-[13px] hover:bg-muted transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {project ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ProjectDetail({ project, onBack, onEdit, onRefresh, onDelete }: {
  project: Project; onBack: () => void; onEdit: () => void; onRefresh: () => void; onDelete: () => void
}) {
  const done = project.tasks.filter(t => t.status === 'done').length
  const total = project.tasks.length
  const todo = project.tasks.filter(t => t.status === 'todo' || t.status === 'inprogress')
  const completed = project.tasks.filter(t => t.status === 'done')

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: project.color + '25' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: project.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground truncate">{project.title}</h2>
          {project.description && <p className="text-[12px] text-muted-foreground">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-[12px] text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Удалить</span>
          </button>
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-[12px] text-muted-foreground transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
            <span>Изменить</span>
          </button>
        </div>
      </div>

      {/* Members */}
      {project.members.length > 0 && (
        <div className="px-4 py-3 rounded-2xl bg-card border border-border">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Участники</p>
          <div className="flex items-center gap-2 flex-wrap">
            {project.members.map(m => (
              <div key={m.chatId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50">
                <MemberAvatar member={m} size={6} />
                <span className="text-[12px]">{m.name}</span>
              </div>
            ))}
            <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/40 text-[12px] text-muted-foreground transition-colors">
              <Plus className="w-3 h-3" />
              Добавить
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="px-4 py-3 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-2">
          <span>{done} из {total} задач выполнено</span>
          <span className="font-semibold text-foreground">{total ? Math.round((done/total)*100) : 0}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: project.color }}
            initial={{ width: 0 }}
            animate={{ width: total ? `${Math.round((done/total)*100)}%` : '0%' }}
            transition={{ duration: 0.7 }}
          />
        </div>
      </div>

      {/* Task columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Сделать', tasks: project.tasks.filter(t => t.status === 'todo'), icon: Circle, color: 'text-muted-foreground' },
          { label: 'В работе', tasks: project.tasks.filter(t => t.status === 'inprogress'), icon: Clock, color: 'text-amber-400' },
          { label: 'Готово', tasks: project.tasks.filter(t => t.status === 'done'), icon: CheckCircle2, color: 'text-emerald-400' },
        ].map(col => (
          <div key={col.label} className="rounded-2xl bg-card border border-border p-3">
            <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-border">
              <col.icon className={cn('w-3.5 h-3.5', col.color)} />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{col.label}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{col.tasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.tasks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/40 text-center py-2">—</p>
              ) : col.tasks.map(task => (
                <div key={task.id} className="px-2.5 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <p className="text-[12px] leading-tight">{task.title}</p>
                  {task.dueDate && <p className="text-[10px] text-muted-foreground mt-0.5">{task.dueDate}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

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
      setProjects(data.projects || [])
    } catch (e) {
      setError('Ошибка загрузки проектов')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleModalSave = async () => {
    setShowModal(false)
    setEditProject(null)
    await loadProjects()
    if (selected && !projects.find(p => p.id === selected.id)) {
      setSelected(null)
    }
  }

  const handleEditCurrent = () => {
    setEditProject(selected)
    setShowModal(true)
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
    <div className="flex flex-col gap-5">
      {/* Header */}
      {!selected && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-foreground">Проекты</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{projects.length} активных проектов</p>
          </div>
          <button
            onClick={() => {
              if (state.settings.userPlan === 'free' && projects.length >= 3) {
                alert('В бесплатной версии доступно максимум 3 проекта. Пожалуйста, приобретите Premium через бота.')
                return
              }
              setShowModal(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[12px] font-medium hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Создать проект</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <AlertCircle className="w-8 h-8" />
          <p className="text-[13px]">{error}</p>
          <button onClick={loadProjects} className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-[13px] transition-colors">
            Повторить
          </button>
        </div>
      ) : selected ? (
        <ProjectDetail
          project={selected}
          onBack={() => setSelected(null)}
          onEdit={handleEditCurrent}
          onRefresh={loadProjects}
          onDelete={() => handleDeleteProject(selected.id)}
        />
      ) : (
        <>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-primary/60" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">Нет проектов</p>
                <p className="text-[13px] text-muted-foreground mt-1">Создайте первый проект для совместной работы</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:brightness-110 transition-all"
              >
                <Plus className="w-4 h-4" />
                Создать проект
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {projects.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <ProjectCard project={p} onClick={() => setSelected(p)} />
                </motion.div>
              ))}
              {/* Big + button */}
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: projects.length * 0.06 }}
                onClick={() => setShowModal(true)}
                className="flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-200"
              >
                <Plus className="w-6 h-6" />
                <span className="text-[13px] font-medium">Новый проект</span>
              </motion.button>
            </div>
          )}
        </>
      )}

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
