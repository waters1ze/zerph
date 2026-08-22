'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import {
  Users, Plus, Edit2, Trash2, Check, X,
  ArrowRight, Shield, Sparkles, FolderPlus, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Friend, FriendGroup } from '@/lib/types'

const PRESET_EMOJIS = ['👥', '🚀', '🎓', '💼', '🏠', '⚽', '🎮', '🍕', '💡', '🔥', '💻', '🎨']
const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#64748b', // Slate
]

export function FriendGroupsSection() {
  const { state, dispatch } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<FriendGroup | null>(null)

  // Form State
  const [groupName, setGroupName] = useState('')
  const [groupEmoji, setGroupEmoji] = useState('👥')
  const [groupColor, setGroupColor] = useState('#3b82f6')
  const [groupDesc, setGroupDesc] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [friendSearch, setFriendSearch] = useState('')

  const openCreateModal = () => {
    setEditingGroup(null)
    setGroupName('')
    setGroupEmoji('👥')
    setGroupColor('#3b82f6')
    setGroupDesc('')
    setSelectedMemberIds([])
    setFriendSearch('')
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEditModal = (group: FriendGroup) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupEmoji(group.emoji || '👥')
    setGroupColor(group.color || '#3b82f6')
    setGroupDesc(group.description || '')
    setSelectedMemberIds(group.memberIds || [])
    setFriendSearch('')
    setErrorMsg(null)
    setModalOpen(true)
  }

  const toggleMember = (friend: Friend) => {
    const friendId = friend.id
    const friendCid = friend.chatId || ''
    setSelectedMemberIds(prev => {
      const isSelected = prev.includes(friendId) || (friendCid && prev.includes(friendCid))
      if (isSelected) {
        return prev.filter(x => x !== friendId && x !== friendCid)
      } else {
        return [...prev, friendCid || friendId]
      }
    })
  }

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = groupName.trim()
    if (!trimmed) {
      setErrorMsg('Введите название группы')
      return
    }

    if (editingGroup) {
      dispatch({
        type: 'UPDATE_FRIEND_GROUP',
        id: editingGroup.id,
        updates: {
          name: trimmed,
          emoji: groupEmoji,
          color: groupColor,
          description: groupDesc.trim(),
          memberIds: selectedMemberIds,
        }
      })
    } else {
      const newGroup: FriendGroup = {
        id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed,
        emoji: groupEmoji,
        color: groupColor,
        description: groupDesc.trim(),
        memberIds: selectedMemberIds,
        createdAt: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_FRIEND_GROUP', group: newGroup })
    }

    setModalOpen(false)
  }

  const handleDeleteGroup = (groupId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту группу?')) {
      dispatch({ type: 'DELETE_FRIEND_GROUP', id: groupId })
    }
  }

  const handleViewTasks = (group: FriendGroup) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('zerf_task_filter_group', group.id)
        localStorage.setItem('zerf_task_filter_friend', 'all')
        window.dispatchEvent(new CustomEvent('zerf_filter_tasks', { detail: { groupId: group.id, friendId: 'all' } }))
      } catch {}
    }
    dispatch({ type: 'SET_VIEW', view: 'tasks' })
  }

  const friendGroups = state.friendGroups || []

  return (
    <div className="space-y-3.5 font-sans">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Группы с друзьями</h3>
            <p className="text-[11px] text-muted-foreground">Объединяйте друзей для совместных задач и проектов</p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border/80 text-xs font-semibold hover:border-primary/50 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          <span>Создать группу</span>
        </button>
      </div>

      {/* Group Cards Grid */}
      {friendGroups.length === 0 ? (
        <div className="p-5 rounded-2xl bg-card/40 border border-dashed border-border/80 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-foreground">У вас пока нет групп</p>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Создайте группу (например, «Семья», «Учёба» или «Стартап») и добавьте в неё друзей для совместных задач.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Создать первую группу</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {friendGroups.map(group => {
            const memberCount = (group.memberIds || []).length
            // Match member details from state.friends
            const members = (group.memberIds || [])
              .map(id => state.friends.find(f => f.id === id || f.chatId === id))
              .filter(Boolean) as Friend[]

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl bg-card border border-border hover:border-border/90 flex flex-col justify-between gap-3 shadow-xs relative group transition-all"
              >
                <div>
                  {/* Top Bar: Emoji, Name, Options */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0 p-1.5 rounded-xl bg-muted/60 border border-border/50">
                        {group.emoji || '👥'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-foreground truncate">{group.name}</h4>
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: group.color || '#3b82f6' }}
                          />
                        </div>
                        {group.description && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{group.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => openEditModal(group)}
                        title="Редактировать группу"
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        title="Удалить группу"
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Members list preview with real names */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Участники ({memberCount}):
                    </span>
                    {members.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground italic">пока нет участников</span>
                    ) : (
                      <div className="flex items-center -space-x-1.5 overflow-hidden py-0.5">
                        {members.slice(0, 4).map(m => (
                          <div
                            key={m.id}
                            title={m.name || m.username || 'Друг'}
                            className="w-6 h-6 rounded-full bg-primary/20 text-primary border-2 border-card flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
                          >
                            {(m.name || 'U')[0]}
                          </div>
                        ))}
                        {members.length > 4 && (
                          <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground border-2 border-card flex items-center justify-center text-[9px] font-bold shrink-0">
                            +{members.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions: View Group Tasks & Manage Members */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(group)}
                    className="py-2 px-3 rounded-xl bg-muted/70 hover:bg-muted text-foreground border border-border/60 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Добавить или удалить участников из группы"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Участники</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewTasks(group)}
                    className="flex-1 py-2 px-3 rounded-xl bg-muted/60 hover:bg-primary hover:text-primary-foreground text-foreground border border-border/60 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer group/btn"
                  >
                    <span>Задачи группы</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit Group Modal ── */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{groupEmoji}</span>
                  <h3 className="text-base font-bold text-foreground">
                    {editingGroup ? 'Редактировать группу' : 'Новая группа друзей'}
                  </h3>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveGroup} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Название группы *
                  </label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Например: Семья, Стартап, Учёба..."
                    className="w-full h-10 px-3.5 rounded-xl bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Описание (опционально)
                  </label>
                  <input
                    type="text"
                    value={groupDesc}
                    onChange={e => setGroupDesc(e.target.value)}
                    placeholder="Для чего эта группа..."
                    className="w-full h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Emoji Picker */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Иконка группы
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_EMOJIS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setGroupEmoji(em)}
                        className={cn(
                          'w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer',
                          groupEmoji === em
                            ? 'bg-primary/20 border-2 border-primary scale-105'
                            : 'bg-muted/50 border border-border/50 hover:bg-muted'
                        )}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Цветовой акцент
                  </label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setGroupColor(col)}
                        style={{ backgroundColor: col }}
                        className={cn(
                          'w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center',
                          groupColor === col ? 'scale-125 ring-2 ring-foreground/40' : 'opacity-80 hover:opacity-100'
                        )}
                      >
                        {groupColor === col && <Check className="w-3 h-3 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Members Selector from real friends */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Выберите участников ({selectedMemberIds.length} выбрано)
                    </label>
                    {selectedMemberIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMemberIds([])}
                        className="text-[10px] text-muted-foreground hover:text-rose-400 font-semibold cursor-pointer"
                      >
                        Сбросить выбор
                      </button>
                    )}
                  </div>

                  {state.friends.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic p-3 bg-muted/40 rounded-xl border border-border">
                      В вашем списке друзей пока никого нет. Добавьте друзей во вкладке «Контакты», чтобы включить их в группу.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {state.friends.length > 4 && (
                        <input
                          type="text"
                          value={friendSearch}
                          onChange={e => setFriendSearch(e.target.value)}
                          placeholder="Поиск по имени или @username..."
                          className="w-full h-8 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground/70"
                        />
                      )}

                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 no-scrollbar border border-border/60 rounded-xl p-2 bg-muted/30">
                        {state.friends
                          .filter(f => {
                            if (!friendSearch) return true
                            const q = friendSearch.toLowerCase()
                            return (
                              f.name.toLowerCase().includes(q) ||
                              (f.username && f.username.toLowerCase().includes(q))
                            )
                          })
                          .map(friend => {
                            const isSelected = selectedMemberIds.includes(friend.id) || (friend.chatId && selectedMemberIds.includes(friend.chatId))
                            return (
                              <div
                                key={friend.id}
                                onClick={() => toggleMember(friend)}
                                className={cn(
                                  'p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none border',
                                  isSelected
                                    ? 'bg-primary/10 border-primary/40 text-foreground font-medium'
                                    : 'bg-card/50 border-border/50 hover:bg-card text-muted-foreground'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                    {friend.name[0] || 'U'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-foreground truncate">{friend.name}</p>
                                    {friend.username && (
                                      <p className="text-[10px] text-muted-foreground truncate">@{friend.username.replace(/^@/, '')}</p>
                                    )}
                                  </div>
                                </div>

                                <div className={cn(
                                  'w-5 h-5 rounded-md border flex items-center justify-center transition-colors',
                                  isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card'
                                )}>
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                    {errorMsg}
                  </p>
                )}

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 h-9 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-5 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
                  >
                    {editingGroup ? 'Сохранить изменения' : 'Создать группу'}
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
