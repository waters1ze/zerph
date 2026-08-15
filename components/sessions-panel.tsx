'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, Smartphone, Globe, Trash2, LogOut, RefreshCw, Shield, Clock } from 'lucide-react'
import { getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'

interface Session {
  id: string
  deviceName: string
  deviceType: 'web' | 'telegram' | 'mobile'
  ipAddress: string | null
  lastSeenAt: string
  createdAt: string
  isCurrent: boolean
}

function DeviceIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'mobile') return <Smartphone className={cn('w-4 h-4', className)} />
  if (type === 'telegram') return <Globe className={cn('w-4 h-4', className)} />
  return <Monitor className={cn('w-4 h-4', className)} />
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин. назад`
  if (h < 24) return `${h} ч. назад`
  if (d < 7) return `${d} дн. назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text })
    setTimeout(() => setNotice(null), 3000)
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions', { headers: getAuthHeaders() })
      const data = await res.json()
      if (data.sessions) setSessions(data.sessions)
    } catch {
      showNotice('error', 'Не удалось загрузить сессии')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const revokeSession = async (id: string) => {
    setRevoking(id)
    try {
      const res = await fetch(`/api/sessions?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id))
        showNotice('success', 'Сессия завершена')
      }
    } catch {
      showNotice('error', 'Ошибка при завершении сессии')
    } finally {
      setRevoking(null)
    }
  }

  const revokeAll = async () => {
    if (!confirm('Завершить все остальные сессии? Вы останетесь в текущей.')) return
    setRevokingAll(true)
    try {
      const res = await fetch('/api/sessions?all=true', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.isCurrent))
        showNotice('success', 'Все другие сессии завершены')
      }
    } catch {
      showNotice('error', 'Ошибка при завершении сессий')
    } finally {
      setRevokingAll(false)
    }
  }

  const otherSessions = sessions.filter(s => !s.isCurrent)
  const currentSession = sessions.find(s => s.isCurrent)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Активные сессии</h3>
          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {otherSessions.length > 0 && (
            <button
              onClick={revokeAll}
              disabled={revokingAll}
              className="flex items-center gap-1.5 text-[12px] text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3 h-3" />
              {revokingAll ? 'Завершаем...' : 'Завершить все'}
            </button>
          )}
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'text-[12px] px-3 py-2 rounded-xl',
              notice.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            )}
          >
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Current session */}
      {!loading && currentSession && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Текущая сессия</p>
          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
              <DeviceIcon type={currentSession.deviceType} className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate">{currentSession.deviceName}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {timeAgo(currentSession.lastSeenAt)}
                </span>
                {currentSession.ipAddress && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {currentSession.ipAddress}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[11px] text-primary font-semibold shrink-0 bg-primary/10 px-2 py-0.5 rounded-full">
              Вы здесь
            </span>
          </div>
        </div>
      )}

      {/* Other sessions */}
      {!loading && otherSessions.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Другие устройства</p>
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {otherSessions.map(session => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3.5 p-3 rounded-lg bg-card border border-border/60 hover:border-border transition-colors group"
                >
                  <div className="w-9 h-9 rounded-md bg-muted/60 border border-border/40 flex items-center justify-center shrink-0">
                    <DeviceIcon type={session.deviceType} className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{session.deviceName}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {timeAgo(session.lastSeenAt)}
                      </span>
                      {session.ipAddress && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {session.ipAddress}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60">
                        Вход: {formatDate(session.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
                    title="Завершить сессию"
                  >
                    {revoking === session.id
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="py-6 text-center border border-dashed border-border/50 rounded-xl bg-muted/20">
          <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">Нет активных сессий</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Войдите через бота командой /login
          </p>
        </div>
      )}

      {/* No other sessions */}
      {!loading && sessions.length > 0 && otherSessions.length === 0 && (
        <p className="text-[12px] text-muted-foreground text-center py-2">
          Нет других активных устройств
        </p>
      )}
    </div>
  )
}
