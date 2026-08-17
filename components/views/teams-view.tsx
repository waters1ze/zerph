'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Users, Plus, Copy, Check, Trash2, LogOut,
  ExternalLink, RefreshCw, Loader2, AlertCircle, CheckCircle2,
  Share2, Shield, Crown, User, FolderOpen, CheckSquare, Clock,
  Calendar, Sparkles, Filter, ChevronRight, X, UserPlus, Key
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders, useApp } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { PriorityBadge } from '@/components/priority-badge'

interface TeamSummary {
  id: string
  name: string
  ownerChatId: string
  memberCount: number
  adminCount: number
  plan: string
  inviteCode: string
  inviteUrl: string
  myRole: 'owner' | 'admin' | 'member'
  isOwner: boolean
  isAdmin: boolean
  createdAt: string
}

interface TeamMember {
  chatId: string
  firstName: string | null
  lastName: string | null
  username: string | null
  plan: string
  role: 'owner' | 'admin' | 'member'
  isMe: boolean
}

interface TeamDetail {
  id: string
  name: string
  ownerChatId: string
  plan: string
  inviteCode: string
  inviteUrl: string
  myRole: 'owner' | 'admin' | 'member'
  isOwner: boolean
  isAdmin: boolean
  members: TeamMember[]
  createdAt: string
}

interface TeamTask {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: string | null
  dueTime: string | null
  tags: string[]
  assignees: string[]
  ownerChatId: string | null
  authorChatId: string | null
  createdAt: string
}

export function TeamsView() {
  const confirm = useConfirmDialog()
  const { state, dispatch } = useApp()

  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null)
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([])

  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects' | 'members' | 'settings'>('tasks')

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [copiedInvite, setCopiedInvite] = useState(false)

  // New Team Task Modal
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskDueTime, setNewTaskDueTime] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')

  // Edit Team Name
  const [editName, setEditName] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'inprogress' | 'done'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 4000)
  }

  const fetchTeams = async (selectId?: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/teams', {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        const list = data.teams || []
        setTeams(list)
        if (list.length > 0) {
          const targetId = selectId || (activeTeamId && list.some((t: any) => t.id === activeTeamId) ? activeTeamId : list[0].id)
          setActiveTeamId(targetId)
        } else {
          setActiveTeamId(null)
          setTeamDetail(null)
          setTeamTasks([])
        }
      }
    } catch {
      showNotice('error', 'Ошибка загрузки списка команд')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/teams/${id}`, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success && data.team) {
        setTeamDetail(data.team)
        setEditName(data.team.name)
      }
    } catch {}
  }

  const fetchTeamTasks = async (id: string) => {
    setTasksLoading(true)
    try {
      const res = await fetch(`/api/teams/${id}/tasks`, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setTeamTasks(data.tasks || [])
      }
    } catch {}
    finally {
      setTasksLoading(false)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  useEffect(() => {
    if (activeTeamId) {
      fetchTeamDetail(activeTeamId)
      fetchTeamTasks(activeTeamId)
    }
  }, [activeTeamId])

  // Create Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) return

    setActionLoading('create')
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newTeamName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', `Команда «${newTeamName}» успешно создана!`)
        setNewTeamName('')
        setCreateModalOpen(false)
        fetchTeams(data.team?.id)
      } else {
        showNotice('error', data.error || 'Ошибка создания команды')
      }
    } catch {
      showNotice('error', 'Ошибка соединения с сервером')
    } finally {
      setActionLoading(null)
    }
  }

  // Join Team by code
  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return

    setActionLoading('join')
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode: joinCode.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', `Вы успешно присоединились к команде «${data.team?.name || ''}»!`)
        setJoinCode('')
        setJoinModalOpen(false)
        fetchTeams(data.team?.id)
      } else {
        showNotice('error', data.error || 'Неверный инвайт-код или ссылка')
      }
    } catch {
      showNotice('error', 'Ошибка присоединения к команде')
    } finally {
      setActionLoading(null)
    }
  }

  // Create Team Task
  const handleCreateTeamTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTeamId || !newTaskTitle.trim()) return

    setActionLoading('create_task')
    try {
      const res = await fetch(`/api/teams/${activeTeamId}/tasks`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim() || undefined,
          priority: newTaskPriority,
          dueDate: newTaskDueDate || undefined,
          dueTime: newTaskDueTime || undefined,
          assignees: newTaskAssignee ? [newTaskAssignee] : [],
        }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', 'Командная задача создана!')
        setNewTaskTitle('')
        setNewTaskDesc('')
        setNewTaskDueDate('')
        setNewTaskDueTime('')
        setNewTaskAssignee('')
        setCreateTaskOpen(false)
        fetchTeamTasks(activeTeamId)
      } else {
        showNotice('error', data.error || 'Ошибка создания задачи')
      }
    } catch {
      showNotice('error', 'Ошибка отправки задачи')
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle Team Task Status
  const handleToggleTaskStatus = async (task: TeamTask) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    // Optimistic update
    setTeamTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      })
    } catch {
      if (activeTeamId) fetchTeamTasks(activeTeamId)
    }
  }

  // Member role action
  const handleMemberRole = async (memberChatId: string, newRole: 'admin' | 'member') => {
    if (!activeTeamId) return
    setActionLoading(`role_${memberChatId}`)
    try {
      const res = await fetch(`/api/teams/${activeTeamId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'set_role', memberChatId, role: newRole }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', 'Роль участника обновлена')
        fetchTeamDetail(activeTeamId)
      } else {
        showNotice('error', data.error || 'Ошибка изменения роли')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

  // Kick member
  const handleKickMember = async (member: TeamMember) => {
    if (!activeTeamId) return
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.username || member.chatId
    const ok = await confirm({
      title: `Исключить ${name}?`,
      description: 'Участник потеряет доступ к общим проектам и задачам этой команды.',
      confirmText: 'Исключить',
      variant: 'danger',
    })
    if (!ok) return

    setActionLoading(`kick_${member.chatId}`)
    try {
      const res = await fetch(`/api/teams/${activeTeamId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'kick_member', memberChatId: member.chatId }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', `${name} исключен из команды`)
        fetchTeamDetail(activeTeamId)
        fetchTeams()
      } else {
        showNotice('error', data.error || 'Ошибка исключения')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

  // Save Team Settings (Name, etc.)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTeamId || !editName.trim()) return

    setSavingSettings(true)
    try {
      const res = await fetch(`/api/teams/${activeTeamId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'rename', name: editName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', 'Настройки команды сохранены!')
        fetchTeamDetail(activeTeamId)
        fetchTeams(activeTeamId)
      } else {
        showNotice('error', data.error || 'Ошибка сохранения')
      }
    } catch {
      showNotice('error', 'Ошибка сохранения')
    } finally {
      setSavingSettings(false)
    }
  }

  // Regenerate Invite Code
  const handleRegenerateInvite = async () => {
    if (!activeTeamId) return
    setActionLoading('regen_invite')
    try {
      const res = await fetch(`/api/teams/${activeTeamId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'regen_invite' }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', 'Сгенерирована новая ссылка-приглашение!')
        fetchTeamDetail(activeTeamId)
      } else {
        showNotice('error', data.error || 'Ошибка генерации ссылки')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

  // Leave / Delete Team
  const handleLeaveOrDelete = async () => {
    if (!activeTeamId || !teamDetail) return
    const isOwner = teamDetail.isOwner

    const ok = await confirm({
      title: isOwner ? `Удалить команду «${teamDetail.name}»?` : `Покинуть команду «${teamDetail.name}»?`,
      description: isOwner
        ? 'Все командные задачи и проекты будут безвозвратно удалены для всех участников.'
        : 'Вы потеряете доступ к общим проектам и задачам этой команды.',
      confirmText: isOwner ? 'Удалить команду' : 'Покинуть',
      variant: 'danger',
    })
    if (!ok) return

    setActionLoading('delete_team')
    try {
      const res = await fetch(`/api/teams/${activeTeamId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', isOwner ? 'Команда удалена' : 'Вы покинули команду')
        fetchTeams()
      } else {
        showNotice('error', data.error || 'Ошибка')
      }
    } catch {
      showNotice('error', 'Ошибка выполнения')
    } finally {
      setActionLoading(null)
    }
  }

  const copyInvite = () => {
    if (!teamDetail?.inviteUrl) return
    navigator.clipboard.writeText(teamDetail.inviteUrl)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return teamTasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (assigneeFilter !== 'all') {
        if (!t.assignees || !t.assignees.includes(assigneeFilter)) return false
      }
      return true
    })
  }, [teamTasks, statusFilter, assigneeFilter])

  // Team Projects
  const teamProjects = useMemo(() => {
    return state.projects.filter((p: any) => p.teamId === activeTeamId || p.ownerChatId === teamDetail?.ownerChatId)
  }, [state.projects, activeTeamId, teamDetail])

  return (
    <div className="max-w-6xl mx-auto w-full pb-20 font-sans space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-semibold backdrop-blur-md',
              notification.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-primary" />
            Команды & Корпоративные воркспейсы
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Совместная работа над проектами и задачами для компаний, команд и отделов
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setJoinModalOpen(true)}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold border border-border transition-all cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Вступить по коду</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Создать команду</span>
          </button>
        </div>
      </div>

      {/* ── 2. Multi-Team Switcher Bar (when teams exist) ── */}
      {teams.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {teams.map(t => {
            const isActive = t.id === activeTeamId
            return (
              <button
                key={t.id}
                onClick={() => setActiveTeamId(t.id)}
                className={cn(
                  'px-4 py-2.5 rounded-2xl border text-left transition-all shrink-0 flex items-center gap-3 cursor-pointer',
                  isActive
                    ? 'bg-card border-primary shadow-sm ring-1 ring-primary/40'
                    : 'bg-card/50 border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {t.name[0]?.toUpperCase() || 'T'}
                </div>
                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate max-w-[130px]">{t.name}</span>
                    {t.isOwner ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 font-bold">👑</span>
                    ) : t.isAdmin ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 font-bold">🛡️</span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.memberCount} участников</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 3. Active Team Dashboard OR Empty State ── */}
      {loading ? (
        <div className="p-16 rounded-3xl bg-card border border-border flex flex-col items-center justify-center gap-3 text-center shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-foreground">Загрузка воркспейсов...</p>
          <p className="text-xs text-muted-foreground">Синхронизируем список ваших команд</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-card/95 via-card/80 to-card/40 border border-border/80 shadow-lg text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary border border-primary/25 flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <span className="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider border border-primary/25 inline-block">
              Воркспейсы для команд и компаний
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground pt-1">
              У вас пока нет активных команд
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Создайте свою первую команду для совместного управления проектами, распределения задач и работы с коллегами без ограничений, или вступите по инвайт-коду.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="w-full sm:w-auto h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Создать первую команду</span>
            </button>
            <button
              onClick={() => setJoinModalOpen(true)}
              className="w-full sm:w-auto h-11 px-6 rounded-2xl bg-muted/70 hover:bg-muted text-foreground text-xs sm:text-sm font-bold border border-border transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4 text-muted-foreground" />
              <span>Вступить по коду</span>
            </button>
          </div>

          {/* 3 Value Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-border/60 text-left">
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <FolderOpen className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-foreground">Совместные проекты</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Общие проекты с этапами, целями и задачами, доступные каждому участнику воркспейса.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-foreground">Задачи без подтверждений</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Поручайте задачи коллегам напрямую в боте и на сайте без ожидания взаимных разрешений.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-foreground">Роли и управление</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Назначайте администраторов, генерируйте инвайт-ссылки и управляйте доступом в один клик.
              </p>
            </div>
          </div>
        </div>
      ) : teamDetail ? (
        <div className="space-y-6">
          {/* Active Team Header Card */}
          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 flex items-center justify-center font-black text-lg">
                {teamDetail.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground">{teamDetail.name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                    🏢 Воркспейс
                  </span>
                  {teamDetail.isOwner ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[10px] font-bold uppercase tracking-wide border border-rose-500/20">
                      Владелец
                    </span>
                  ) : teamDetail.isAdmin ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold uppercase tracking-wide border border-amber-500/20">
                      Администратор
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium border border-border">
                      Участник
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Участников: {teamDetail.members.length} • План: Корпоративный • Задач: {teamTasks.length}
                </p>
              </div>
            </div>

            {/* Quick Invite Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={copyInvite}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-all cursor-pointer"
              >
                {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedInvite ? 'Скопировано!' : 'Инвайт-ссылка'}</span>
              </button>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(teamDetail.inviteUrl)}&text=${encodeURIComponent(`Присоединяйся к команде «${teamDetail.name}» в Zerf Note:`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold border border-border transition-all"
              >
                <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>В Telegram</span>
              </a>
            </div>
          </div>

          {/* ── Sub Navigation Tabs ── */}
          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
            {[
              { id: 'tasks' as const, label: `📋 Задачи (${teamTasks.length})` },
              { id: 'projects' as const, label: `📂 Проекты (${teamProjects.length})` },
              { id: 'members' as const, label: `👥 Участники (${teamDetail.members.length})` },
              { id: 'settings' as const, label: '⚙️ Настройки' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB 1: Team Tasks (No confirmation checkboxes needed!) ── */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {/* Filter & Add Task Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="h-8 px-2.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">Все статусы</option>
                    <option value="todo">К выполнению</option>
                    <option value="inprogress">В процессе</option>
                    <option value="done">Выполненные</option>
                  </select>

                  {/* Assignee filter */}
                  <select
                    value={assigneeFilter}
                    onChange={e => setAssigneeFilter(e.target.value)}
                    className="h-8 px-2.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="all">Все исполнители</option>
                    {teamDetail.members.map(m => {
                      const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || m.chatId
                      return (
                        <option key={m.chatId} value={m.chatId}>
                          {name} {m.isMe ? '(Вы)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <button
                  onClick={() => setCreateTaskOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Новая задача</span>
                </button>
              </div>

              {/* Task list */}
              {tasksLoading ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span>Загрузка задач команды...</span>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground bg-card border border-border rounded-3xl space-y-2">
                  <p className="font-semibold text-sm text-foreground">Задач в этом фильтре нет</p>
                  <p className="text-muted-foreground">Назначьте новую задачу любому участнику команды без подтверждений</p>
                  <button
                    onClick={() => setCreateTaskOpen(true)}
                    className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer"
                  >
                    Создать задачу команды
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map(t => {
                    const isDone = t.status === 'done'
                    const assigneeMember = teamDetail.members.find(m => t.assignees?.includes(m.chatId))
                    const assigneeName = assigneeMember
                      ? [assigneeMember.firstName, assigneeMember.lastName].filter(Boolean).join(' ') || assigneeMember.username || assigneeMember.chatId
                      : null

                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'p-3.5 rounded-2xl bg-card border border-border/80 flex items-center justify-between gap-3 hover:border-primary/40 transition-all shadow-2xs group',
                          isDone && 'opacity-65'
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Complete checkbox */}
                          <button
                            onClick={() => handleToggleTaskStatus(t)}
                            className={cn(
                              'w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center transition-all cursor-pointer shrink-0',
                              isDone
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-border hover:border-primary bg-muted/40'
                            )}
                          >
                            {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          <div className="min-w-0 space-y-1">
                            <p className={cn(
                              'text-xs sm:text-sm font-semibold text-foreground truncate',
                              isDone && 'line-through text-muted-foreground'
                            )}>
                              {t.title}
                            </p>
                            {t.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {t.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                              <PriorityBadge priority={t.priority as any} />
                              {t.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  {t.dueDate} {t.dueTime || ''}
                                </span>
                              )}
                              {assigneeName && (
                                <span className="flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold">
                                  <User className="w-3 h-3" /> {assigneeName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: Team Projects ── */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Совместные проекты команды, доступные всем участникам
                </p>
                <button
                  onClick={() => dispatch({ type: 'SET_VIEW', view: 'projects' })}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Открыть раздел Проектов</span>
                </button>
              </div>

              {teamProjects.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground bg-card border border-border rounded-3xl space-y-2">
                  <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-1" />
                  <p className="font-semibold text-sm text-foreground">Проектов в команде пока нет</p>
                  <p className="text-muted-foreground">Создавайте проекты и делитесь ими с коллегами</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teamProjects.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        dispatch({ type: 'SET_VIEW', view: 'projects' })
                      }}
                      className="p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/50 transition-all cursor-pointer space-y-3 group shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {p.title[0]}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase font-bold">
                          {p.status || 'Active'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {p.title}
                        </h4>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: Team Members ── */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Invite link card */}
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserPlus className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">Приглашение новых участников</p>
                    <p className="text-[11px] text-muted-foreground truncate">{teamDetail.inviteUrl}</p>
                  </div>
                </div>
                <button
                  onClick={copyInvite}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shrink-0 cursor-pointer"
                >
                  {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInvite ? 'Скопировано' : 'Копировать ссылку'}</span>
                </button>
              </div>

              {/* Members List */}
              <div className="divide-y divide-border/60 bg-card border border-border rounded-3xl overflow-hidden">
                {teamDetail.members.map(member => {
                  const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.username || `ID ${member.chatId}`
                  const isAction = !!actionLoading && actionLoading.includes(member.chatId)

                  return (
                    <div
                      key={member.chatId}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary font-bold flex items-center justify-center text-xs uppercase">
                          {fullName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-foreground">{fullName}</span>
                            {member.isMe && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-semibold text-muted-foreground">Вы</span>
                            )}
                            {member.role === 'owner' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[10px] font-bold flex items-center gap-1">
                                <Crown className="w-3 h-3" /> Владелец
                              </span>
                            ) : member.role === 'admin' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Администратор
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                                Участник
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            ID: {member.chatId} {member.username && `• @${member.username.replace(/^@/, '')}`}
                          </p>
                        </div>
                      </div>

                      {/* Controls (for owner / admins) */}
                      {teamDetail.isAdmin && !member.isMe && member.role !== 'owner' && (
                        <div className="flex items-center gap-2">
                          {teamDetail.isOwner && (
                            <button
                              onClick={() => handleMemberRole(member.chatId, member.role === 'admin' ? 'member' : 'admin')}
                              disabled={isAction}
                              className="px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-semibold border border-border text-foreground transition-all cursor-pointer"
                            >
                              {member.role === 'admin' ? 'Снять админа' : 'Сделать админом'}
                            </button>
                          )}
                          <button
                            onClick={() => handleKickMember(member)}
                            disabled={isAction}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer"
                            title="Исключить из команды"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TAB 4: Team Settings ── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* General Settings */}
              <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-foreground">Основные настройки</h4>

                <form onSubmit={handleSaveSettings} className="space-y-3 max-w-md">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Название команды:</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted/50 border border-border outline-none focus:border-primary text-foreground"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings || !editName.trim()}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-all hover:brightness-110 cursor-pointer disabled:opacity-50"
                  >
                    {savingSettings ? 'Сохранение...' : 'Сохранить название'}
                  </button>
                </form>
              </div>

              {/* Invite Code Regeneration */}
              {teamDetail.isAdmin && (
                <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-foreground">Безопасность инвайт-ссылок</h4>
                  <p className="text-xs text-muted-foreground">
                    Если ссылка попала посторонним, вы можете сгенерировать новый код. Старая ссылка сразу перестанет работать.
                  </p>
                  <button
                    onClick={handleRegenerateInvite}
                    disabled={actionLoading === 'regen_invite'}
                    className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-xs font-semibold border border-border text-foreground transition-all cursor-pointer"
                  >
                    {actionLoading === 'regen_invite' ? 'Генерация...' : 'Сгенерировать новый инвайт-код'}
                  </button>
                </div>
              )}

              {/* Danger Zone */}
              <div className="p-5 rounded-3xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-rose-500">Опасная зона</h4>
                <p className="text-xs text-muted-foreground">
                  {teamDetail.isOwner
                    ? 'Удаление команды безвозвратно удалит все общие задачи и исключит участников.'
                    : 'Покинув команду, вы потеряете доступ к её задачам и проектам.'}
                </p>
                <button
                  onClick={handleLeaveOrDelete}
                  disabled={actionLoading === 'delete_team'}
                  className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold transition-all hover:bg-rose-600 cursor-pointer disabled:opacity-50"
                >
                  {teamDetail.isOwner ? 'Удалить команду' : 'Покинуть команду'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── MODAL: Create Team ── */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Building2 className="w-5 h-5" />
                  <span>Создать новую команду</span>
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Название команды / компании:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: ⚡️ Разработка, 🎨 Дизайн, 🚀 Zerf Core"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary leading-relaxed">
                  💡 Вы станете владельцем команды и сможете приглашать коллег, распределять задачи и вести проекты без ограничений.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!newTeamName.trim() || actionLoading === 'create'}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === 'create' ? 'Создание...' : 'Создать команду'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Join Team by Code ── */}
      <AnimatePresence>
        {joinModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Key className="w-5 h-5" />
                  <span>Вступить в команду по коду</span>
                </div>
                <button
                  onClick={() => setJoinModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Инвайт-код или ссылка команды:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: a1b2c3d4 или ссылка из бота"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setJoinModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!joinCode.trim() || actionLoading === 'join'}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === 'join' ? 'Проверка...' : 'Присоединиться'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Create Team Task ── */}
      <AnimatePresence>
        {createTaskOpen && teamDetail && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <CheckSquare className="w-5 h-5" />
                  <span>Новая задача в «{teamDetail.name}»</span>
                </div>
                <button
                  onClick={() => setCreateTaskOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTeamTask} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Название задачи:</label>
                  <input
                    type="text"
                    required
                    placeholder="Например: Подготовить квартальный отчет"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Описание (опционально):</label>
                  <textarea
                    rows={2}
                    placeholder="Детали задачи, ссылки или чек-лист..."
                    value={newTaskDesc}
                    onChange={e => setNewTaskDesc(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted/50 border border-border text-foreground outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Assignee */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Исполнитель:</label>
                    <select
                      value={newTaskAssignee}
                      onChange={e => setNewTaskAssignee(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="">Без назначения (Общая)</option>
                      {teamDetail.members.map(m => {
                        const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || m.chatId
                        return (
                          <option key={m.chatId} value={m.chatId}>
                            {name} {m.isMe ? '(Вы)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Приоритет:</label>
                    <select
                      value={newTaskPriority}
                      onChange={e => setNewTaskPriority(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="urgent">Срочно</option>
                      <option value="high">Высокий</option>
                      <option value="medium">Средний</option>
                      <option value="low">Низкий</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Дедлайн (дата):</label>
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={e => setNewTaskDueDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Время:</label>
                    <input
                      type="time"
                      value={newTaskDueTime}
                      onChange={e => setNewTaskDueTime(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateTaskOpen(false)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim() || actionLoading === 'create_task'}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === 'create_task' ? 'Создание...' : 'Создать задачу'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
