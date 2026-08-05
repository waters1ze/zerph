'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import {
  Users, UserPlus, Trash2, CheckSquare, Circle,
  Clock, X, Mail, Send, Plus
} from 'lucide-react'
import type { Friend } from '@/lib/types'

const STATUS_CONFIG = {
  online: { label: 'Online', dot: 'bg-[var(--status-done)]' },
  away:   { label: 'Away',   dot: 'bg-[var(--priority-medium)]' },
  offline:{ label: 'Offline',dot: 'bg-muted-foreground/40' },
}

function FriendCard({ friend, onRemove }: { friend: Friend; onRemove: () => void }) {
  const { state } = useApp()
  const sharedTasks = state.tasks.filter(t => t.assignees.includes(friend.id))
  const doneTasks = sharedTasks.filter(t => t.status === 'done')
  const sc = STATUS_CONFIG[friend.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-card border border-border group"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {friend.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', sc.dot)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-semibold text-foreground">{friend.name}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" />
                {friend.email}
              </p>
            </div>
            <button
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status & shared tasks */}
          <div className="flex items-center gap-3 mt-2.5">
            <span className={cn('flex items-center gap-1 text-[11px] font-medium', friend.status === 'online' ? 'text-[var(--status-done)]' : 'text-muted-foreground')}>
              <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
              {sc.label}
            </span>
            <span className="text-muted-foreground text-[10px]">·</span>
            <span className="text-[11px] text-muted-foreground">
              {sharedTasks.length} shared task{sharedTasks.length !== 1 ? 's' : ''}
            </span>
            {sharedTasks.length > 0 && (
              <>
                <span className="text-muted-foreground text-[10px]">·</span>
                <span className="text-[11px] text-muted-foreground">
                  {doneTasks.length}/{sharedTasks.length} done
                </span>
              </>
            )}
          </div>

          {/* Shared tasks list */}
          {sharedTasks.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {sharedTasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex items-center gap-2">
                  {task.status === 'done'
                    ? <CheckSquare className="w-3.5 h-3.5 text-[var(--status-done)] shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-border shrink-0" />
                  }
                  <span className={cn('text-[12px]', task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground')}>
                    {task.title}
                  </span>
                </div>
              ))}
              {sharedTasks.length > 3 && (
                <p className="text-[11px] text-muted-foreground pl-5">+{sharedTasks.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function FriendsView() {
  const { state, dispatch } = useApp()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')

  const addFriend = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return
    dispatch({
      type: 'ADD_FRIEND',
      friend: {
        id: `f-${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        status: 'offline',
        addedAt: new Date().toISOString(),
      },
    })
    setInviteName(''); setInviteEmail(''); setShowInvite(false)
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Invite colleagues and collaborate on shared tasks
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite
        </button>
      </div>

      {/* Invite form */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-foreground">Invite a colleague</p>
                <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                <input
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Имя коллеги / друга"
                  className="h-9 px-3 rounded-lg bg-muted/50 border border-border/60 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Telegram @username или Email"
                  className="h-9 px-3 rounded-lg bg-muted/50 border border-border/60 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowInvite(false)}
                  className="h-8 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={addFriend}
                  disabled={!inviteName.trim() || !inviteEmail.trim()}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  <Send className="w-3.5 h-3.5" />
                  Добавить в команду
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Online summary */}
      <div className="grid grid-cols-3 gap-3">
        {(['online', 'away', 'offline'] as const).map(status => {
          const count = state.friends.filter(f => f.status === status).length
          const sc = STATUS_CONFIG[status]
          return (
            <div key={status} className="p-3.5 rounded-xl bg-card border border-border flex items-center gap-2.5">
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', sc.dot)} />
              <div>
                <p className="text-base font-bold text-foreground leading-none">{count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sc.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Friends list */}
      {state.friends.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Users className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-sm font-medium text-muted-foreground">No teammates yet</p>
          <p className="text-xs text-muted-foreground/60">Invite colleagues to collaborate on tasks</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.friends.map(f => (
            <FriendCard
              key={f.id}
              friend={f}
              onRemove={() => dispatch({ type: 'REMOVE_FRIEND', id: f.id })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
