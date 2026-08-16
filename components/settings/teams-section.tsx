'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Crown, Shield, User, Plus, Copy, Check, Trash2,
  LogOut, ExternalLink, RefreshCw, Loader2, AlertCircle, CheckCircle,
  UserPlus, ArrowRight, X, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'

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

export function TeamsSection() {
  const confirm = useConfirmDialog()
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Creation state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  
  // Join state
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  // Team detail modal
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 4000)
  }

  const fetchTeams = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/teams', {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setTeams(data.teams || [])
      }
    } catch {}
    finally {
      setLoading(false)
    }
  }

  const fetchTeamDetail = async (id: string) => {
    setActionLoading(`load_${id}`)
    try {
      const res = await fetch(`/api/teams/${id}`, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setTeamDetail(data.team)
        setActiveTeamId(id)
      } else {
        showNotice('error', data.error || 'Ошибка загрузки команды')
      }
    } catch {
      showNotice('error', 'Ошибка соединения')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

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
        showNotice('success', data.message || 'Команда создана!')
        setNewTeamName('')
        setCreateModalOpen(false)
        fetchTeams()
      } else {
        showNotice('error', data.error || 'Ошибка создания')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

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
        showNotice('success', data.message || 'Вы присоединились к команде!')
        setJoinCode('')
        setJoinModalOpen(false)
        fetchTeams()
      } else {
        showNotice('error', data.error || 'Ошибка присоединения')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleAdminRole = async (targetChatId: string, currentRole: string) => {
    if (!activeTeamId) return
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    setActionLoading(`role_${targetChatId}`)
    try {
      const res = await fetch(`/api/teams/${activeTeamId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetChatId, role: newRole }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', data.message || 'Роль изменена')
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

  const handleKickMember = async (kickChatId: string, name: string) => {
    if (!activeTeamId) return
    const ok = await confirm({
      title: `Исключить ${name}?`,
      description: 'Участник потеряет доступ к общим проектам и задачам этой команды.',
      confirmText: 'Исключить',
      variant: 'danger',
    })
    if (!ok) return

    setActionLoading(`kick_${kickChatId}`)
    try {
      const res = await fetch(`/api/teams/${activeTeamId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kickChatId }),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', data.message || 'Участник исключен')
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

  const handleDeleteOrLeaveTeam = async () => {
    if (!teamDetail) return
    const isOwner = teamDetail.isOwner
    const ok = await confirm({
      title: isOwner ? `Удалить команду «${teamDetail.name}»?` : `Покинуть команду «${teamDetail.name}»?`,
      description: isOwner
        ? 'Все командные связи будут удалены без возможности восстановления.'
        : 'Вы потеряете доступ к общим проектам этой команды.',
      confirmText: isOwner ? 'Удалить команду' : 'Покинуть',
      variant: 'danger',
    })
    if (!ok) return

    setActionLoading('delete_team')
    try {
      const res = await fetch(`/api/teams/${teamDetail.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        showNotice('success', data.message)
        setActiveTeamId(null)
        setTeamDetail(null)
        fetchTeams()
      } else {
        showNotice('error', data.error || 'Ошибка')
      }
    } catch {
      showNotice('error', 'Ошибка запроса')
    } finally {
      setActionLoading(null)
    }
  }

  const copyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2500)
  }

  return (
    <div className="space-y-5 font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'p-3 rounded-xl border text-xs font-medium flex items-center gap-2',
              notification.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            )}
          >
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Actions */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Команды и Корпоративные проекты</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
                PRO
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Совместные проекты, распределение задач и единая рабочая область
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setJoinModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold border border-border transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Вступить по коду</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Создать команду</span>
          </button>
        </div>
      </div>

      {/* Teams List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Ваши команды ({teams.length})
          </h4>
          <button
            type="button"
            onClick={fetchTeams}
            disabled={loading}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            <span>Обновить</span>
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="p-8 rounded-2xl bg-card border border-border/80 text-center space-y-3">
            <Users className="w-8 h-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-bold text-foreground">У вас пока нет команд</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Создайте команду или присоединитесь по ссылке-приглашению
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
              >
                Создать первую команду
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map(t => (
              <div
                key={t.id}
                onClick={() => fetchTeamDetail(t.id)}
                className="p-4 rounded-2xl bg-card hover:bg-muted/30 border border-border hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-2xs group"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {t.name}
                      </span>
                      {t.isOwner ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Владелец
                        </span>
                      ) : t.isAdmin ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Админ
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                          Участник
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.memberCount} {t.memberCount === 1 ? 'участник' : t.memberCount < 5 ? 'участника' : 'участников'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                  <span>Код: <code className="font-mono font-bold text-foreground">{t.inviteCode}</code></span>
                  <span className="text-primary font-semibold">Управление →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL: Create Team ── */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span>Создать новую команду</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Название команды / компании
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: Marketing Team, Zerf Studio"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
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
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {actionLoading === 'create' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Создать</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Join Team ── */}
      <AnimatePresence>
        {joinModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <span>Вступить в команду по коду</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Код приглашения команды
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: a1b2c3d4"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Код можно получить у владельца или администратора команды
                  </p>
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
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {actionLoading === 'join' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Присоединиться</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Team Detail & Members Management ── */}
      <AnimatePresence>
        {teamDetail && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{teamDetail.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Участников: {teamDetail.members.length}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamDetail(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Invite Link Card */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="text-xs font-bold text-foreground">Ссылка-приглашение в команду:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={teamDetail.inviteUrl}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-mono select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyInviteLink(teamDetail.inviteUrl)}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInvite ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Список участников ({teamDetail.members.length})
                </h4>
                <div className="space-y-1.5">
                  {teamDetail.members.map(m => {
                    const fullName = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || `ID ${m.chatId}`
                    return (
                      <div
                        key={m.chatId}
                        className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center font-bold text-xs text-foreground">
                            {fullName[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-foreground">{fullName}</span>
                              {m.isMe && (
                                <span className="text-[10px] text-muted-foreground">(вы)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {m.role === 'owner' ? (
                                <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                                  <Crown className="w-3 h-3" /> Владелец
                                </span>
                              ) : m.role === 'admin' ? (
                                <span className="text-[10px] font-bold text-blue-500 flex items-center gap-0.5">
                                  <Shield className="w-3 h-3" /> Администратор
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  Участник
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions for Owner */}
                        {teamDetail.isOwner && !m.isMe && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAdminRole(m.chatId, m.role)}
                              disabled={actionLoading === `role_${m.chatId}`}
                              className="px-2 py-1 rounded-lg text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
                              title={m.role === 'admin' ? 'Снять права админа' : 'Сделать администратором'}
                            >
                              {m.role === 'admin' ? 'Разжаловать' : 'Сделать админом'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleKickMember(m.chatId, fullName)}
                              disabled={actionLoading === `kick_${m.chatId}`}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
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

              {/* Danger Zone: Leave / Delete */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleDeleteOrLeaveTeam}
                  disabled={actionLoading === 'delete_team'}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {teamDetail.isOwner ? <Trash2 className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                  <span>{teamDetail.isOwner ? 'Удалить команду' : 'Покинуть команду'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamDetail(null)}
                  className="px-4 py-1.5 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
