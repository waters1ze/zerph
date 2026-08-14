'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSettings, useApp, getTgChatId, getAuthHeaders } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Sun, Moon, Monitor, Bell, BellOff, Link, Key,
  User, Mail, Palette, Save, Check, MessageSquare,
  Zap, Globe, Shield, ChevronRight
} from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-1">{title}</h3>
      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        {description && <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-border'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
        style={{ left: checked ? 'calc(100% - 18px)' : '2px' }}
      />
    </button>
  )
}

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark',  label: 'Dark',  icon: Moon },
  { id: 'system',label: 'System',icon: Monitor },
] as const

const AI_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it']

export function SettingsView() {
  const { state } = useApp()
  const { settings, update } = useSettings()
  const { language, setLanguage } = useLanguage()
  const [saved, setSaved] = useState(false)

  // Initialize usage from localStorage to prevent "Free" flickering
  const cachedUsage = typeof window !== 'undefined' ? localStorage.getItem('zerf-usage') : null
  const [usage, setUsage] = useState<any>(cachedUsage ? JSON.parse(cachedUsage) : null)
  const [loadingPay, setLoadingPay] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null

  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [adminSearch, setAdminSearch] = useState('')
  const [userBirthday, setUserBirthday] = useState('')
  const isAdmin = currentChatId === '6136950061' || currentChatId === '5078516086'

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/admin/subscription?secret=zerph-admin-2024')
        .then(r => r.json())
        .then(data => {
          if (data.users) setAdminUsers(data.users)
        })
        .catch(() => {})
    }
    if (currentChatId) {
      fetch(`/api/telegram/user?chatId=${currentChatId}`)
        .then(r => r.json())
        .then(d => { if (d.birthday) setUserBirthday(d.birthday) })
        .catch(() => {})
    }
  }, [isAdmin, currentChatId])

  const handleUserBirthdayChange = async (val: string) => {
    setUserBirthday(val)
    if (!currentChatId) return
    try {
      await fetch(`/api/telegram/user?chatId=${currentChatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday: val }),
      })
    } catch {}
  }

  const handleAdminAction = async (targetId: string, action: string, days = 30) => {
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer zerph-admin-2024' },
        body: JSON.stringify({ chatId: targetId, action, days }),
      })
      const data = await res.json()
      alert(data.message || data.error || 'Готово')
      const r = await fetch('/api/admin/subscription?secret=zerph-admin-2024')
      const d = await r.json()
      if (d.users) setAdminUsers(d.users)
    } catch (e) {
      alert('Ошибка')
    }
  }

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const fetchSubscription = () => {
    fetch('/api/subscription', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        setUsage(data)
        try { localStorage.setItem('zerf-usage', JSON.stringify(data)) } catch {}
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchSubscription()
  }, [])

  const handleSubscribe = async (period: 'month' | 'year' = 'month') => {
    setLoadingPay(true)
    try {
      const cid = getTgChatId()
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }

      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ownerChatId: cid, period }),
      })
      const data = await res.json()
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      }
    } catch {
      alert('Ошибка при генерации ссылки на оплату ЮMoney')
    } finally {
      setLoadingPay(false)
    }
  }

  const isPremium = usage?.plan === 'premium'

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      {/* Subscription & Limits */}
      <Section title="Подписка и Дневные Лимиты">
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase',
                isPremium
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              )}>
                {isPremium ? '✨ Zerf Premium' : 'Free (Бесплатный)'}
              </span>
              {isPremium && usage?.subscriptionExpiry && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Активна до: {new Date(usage.subscriptionExpiry).toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>
            {!isPremium ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSubscribe('year')}
                  disabled={loadingPay}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium text-[12px] hover:brightness-110 active:scale-95 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>⭐ 1 год (-15%)</span>
                  <span className="opacity-90">1009 ₽</span>
                </button>
                <button
                  onClick={() => handleSubscribe('month')}
                  disabled={loadingPay}
                  className="px-3.5 py-2 rounded-xl bg-muted/80 hover:bg-muted text-foreground font-medium text-[12px] border border-border/80 transition-all disabled:opacity-50"
                >
                  1 месяц — 99 ₽
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSubscribe('year')}
                  disabled={loadingPay}
                  className="px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] border border-border/60 transition-all"
                >
                  Продлить на год (-15%)
                </button>
              </div>
            )}
          </div>

          {/* Limits Progress */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            {/* Voice limit */}
            <div>
              <div className="flex justify-between text-[12px] mb-1 font-medium">
                <span>🎙 Голосовые сообщения (до 3 минут)</span>
                {isPremium ? (
                  <span className="text-emerald-500 font-semibold">Безлимитно ✨</span>
                ) : (
                  <span className={(usage?.voice?.used || 0) >= (usage?.voice?.max || 5) ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}>
                    {(usage?.voice?.used || 0) >= (usage?.voice?.max || 5)
                      ? `${usage?.voice?.used || 0} / ${usage?.voice?.max || 5} (Лимит исчерпан)`
                      : `${usage?.voice?.used || 0} / ${usage?.voice?.max || 5} в день`}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    isPremium
                      ? 'bg-emerald-500'
                      : (usage?.voice?.used || 0) >= (usage?.voice?.max || 5)
                        ? 'bg-rose-500'
                        : 'bg-primary'
                  )}
                  style={{
                    width: isPremium
                      ? '100%'
                      : `${Math.min(100, Math.round(((usage?.voice?.used || 0) / (usage?.voice?.max || 5)) * 100))}%`
                  }}
                />
              </div>
            </div>

            {/* Notes limit */}
            <div>
              <div className="flex justify-between text-[12px] mb-1 font-medium">
                <span>📌 Заметки в день</span>
                {isPremium ? (
                  <span className="text-emerald-500 font-semibold">Безлимитно ✨</span>
                ) : (
                  <span className={(usage?.notes?.used || 0) >= (usage?.notes?.max || 5) ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}>
                    {(usage?.notes?.used || 0) >= (usage?.notes?.max || 5)
                      ? `${usage?.notes?.used || 0} / ${usage?.notes?.max || 5} (Лимит исчерпан)`
                      : `${usage?.notes?.used || 0} / ${usage?.notes?.max || 5} в день`}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    isPremium
                      ? 'bg-emerald-500'
                      : (usage?.notes?.used || 0) >= (usage?.notes?.max || 5)
                        ? 'bg-rose-500'
                        : 'bg-primary'
                  )}
                  style={{
                    width: isPremium
                      ? '100%'
                      : `${Math.min(100, Math.round(((usage?.notes?.used || 0) / (usage?.notes?.max || 5)) * 100))}%`
                  }}
                />
              </div>
            </div>

            {/* AI Chat limit */}
            <div>
              <div className="flex justify-between text-[12px] mb-1 font-medium">
                <span>💬 Сообщения в ИИ чат</span>
                {isPremium ? (
                  <span className="text-emerald-500 font-semibold">Безлимитно ✨</span>
                ) : (
                  <span className={(usage?.chat?.used || 0) >= (usage?.chat?.max || 20) ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}>
                    {(usage?.chat?.used || 0) >= (usage?.chat?.max || 20)
                      ? `${usage?.chat?.used || 0} / ${usage?.chat?.max || 20} (Лимит исчерпан)`
                      : `${usage?.chat?.used || 0} / ${usage?.chat?.max || 20} в день`}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    isPremium
                      ? 'bg-emerald-500'
                      : (usage?.chat?.used || 0) >= (usage?.chat?.max || 20)
                        ? 'bg-rose-500'
                        : 'bg-primary'
                  )}
                  style={{
                    width: isPremium
                      ? '100%'
                      : `${Math.min(100, Math.round(((usage?.chat?.used || 0) / (usage?.chat?.max || 20)) * 100))}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Referral Program */}
      <Section title="Реферальная программа">
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[14px] font-bold text-foreground flex items-center gap-2">
                <span>🎁</span> Приглашай друзей — получай +3 дня Premium
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Поделись ссылкой с другом. Когда друг присоединится к Zerf AI, вы оба получите по +3 дня Zerf Premium!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border">
            <input
              type="text"
              readOnly
              value={`https://t.me/Zerph_bot?start=ref_${currentChatId || ''}`}
              className="bg-transparent text-[12px] text-foreground font-mono flex-1 outline-none px-2"
            />
            <button
              onClick={() => {
                const link = `https://t.me/Zerph_bot?start=ref_${currentChatId || ''}`
                navigator.clipboard.writeText(link)
                setCopiedRef(true)
                setTimeout(() => setCopiedRef(false), 2000)
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
              {copiedRef ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        </div>
      </Section>

      {/* Admin Panel (Visible ONLY to system admin) */}
      {isAdmin && (
        <Section title="🛡️ Панель Администратора">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-foreground">Поиск и управление людьми</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Всего зарегистрировано в системе: {adminUsers.length} чел.</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="🔍 Поиск по имени, @username или Chat ID..."
              value={adminSearch}
              onChange={e => setAdminSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-[12px] text-foreground outline-none focus:border-primary"
            />

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {adminUsers
                .filter(u => {
                  if (!adminSearch.trim()) return true
                  const q = adminSearch.toLowerCase().replace('@', '')
                  const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase()
                  const uname = (u.username || '').toLowerCase()
                  const cid = String(u.chatId)
                  return name.includes(q) || uname.includes(q) || cid.includes(q)
                })
                .map(u => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Без имени'
                  const isPrem = u.plan === 'premium'
                  const exp = u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString('ru-RU') : null

                  return (
                    <div key={u.chatId} className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-foreground truncate">
                          {name} {u.username ? `${u.username}` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          ID: {u.chatId} | {isPrem ? `✨ Premium (до ${exp})` : '🆓 Free'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPrem ? (
                          <button
                            onClick={() => handleAdminAction(u.chatId, 'revoke')}
                            className="px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-[11px] font-semibold hover:bg-destructive/20 transition-colors"
                          >
                            Забрать
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdminAction(u.chatId, 'grant', 30)}
                            className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                          >
                            +30 дн. Premium
                          </button>
                        )}
                        <button
                          onClick={() => handleAdminAction(u.chatId, 'reset_usage')}
                          className="px-2.5 py-1 rounded-lg bg-muted border border-border text-[11px] text-foreground hover:bg-card transition-colors"
                        >
                          Сброс
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </Section>
      )}

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Theme" description="Choose your preferred color scheme">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border">
            {THEMES.map(t => {
              const Icon = t.icon
              const isActive = settings.theme === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => update({ theme: t.id })}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150',
                    isActive
                      ? 'bg-card text-foreground shadow-sm border border-border/50'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </Row>

        <Row label="Accent color" description="Primary brand color across the interface">
          <div className="flex items-center gap-2">
            {['#2d7a4f', '#c9a84c', '#4a7c8a', '#6366f1', '#a16207', '#dc2626'].map(color => (
              <button
                key={color}
                onClick={() => update({ accentColor: color })}
                className={cn(
                  'w-6 h-6 rounded-full transition-all duration-150',
                  settings.accentColor === color ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground/40 scale-110' : 'hover:scale-105'
                )}
                style={{ background: color }}
                aria-label={`Set accent color to ${color}`}
              />
            ))}
          </div>
        </Row>

        <Row label="Week starts on" description="First day of the week in calendars">
          <select
            value={settings.weekStartsOn}
            onChange={e => update({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
            className="text-[12px] bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border outline-none cursor-pointer text-foreground"
          >
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
          </select>
        </Row>

        <Row label="Language" description="Interface display language">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
            {([['en', '🇺🇸 EN'], ['ru', '🇷🇺 RU']] as const).map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150',
                  language === code
                    ? 'bg-card text-foreground shadow-sm border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* Profile */}
      <Section title="Profile">
        <Row label="Display name" description="Your name shown throughout the app">
          <input
            value={settings.name}
            onChange={e => update({ name: e.target.value })}
            onBlur={e => {
              if (currentChatId) {
                fetch('/api/telegram/user', {
                  method: 'POST',
                  headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: e.target.value })
                }).catch(() => {})
              }
            }}
            placeholder="Ваше имя"
            className="h-8 px-3 rounded-lg bg-muted/50 border border-border text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors w-44"
          />
        </Row>

        <Row label="🎂 Мой День рождения" description="Ваши друзья в Zerf AI автоматически увидят напоминание в своём календаре">
          <input
            type="date"
            value={userBirthday}
            onChange={e => handleUserBirthdayChange(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-muted/50 border border-border text-[12px] text-foreground outline-none focus:border-primary/50 transition-colors w-40 cursor-pointer"
          />
        </Row>

        <Row
          label="Telegram аккаунт"
          description={
            currentChatId
              ? `Профиль навсегда привязан к этому устройству (ID: ${currentChatId})`
              : 'Привязка происходит автоматически при открытии приложения из бота'
          }
        >
          {currentChatId ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-medium text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Синхронизировано
              </span>
              <a
                href="https://t.me/Zerph_bot"
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded-lg bg-[#229ED9]/15 hover:bg-[#229ED9]/25 text-[#229ED9] border border-[#229ED9]/30 text-[11px] font-medium transition-all flex items-center gap-1"
              >
                Бот @Zerph_bot
              </a>
            </div>
          ) : (
            <a
              href="https://t.me/Zerph_bot"
              target="_blank"
              rel="noreferrer"
              className="h-8 px-3.5 rounded-lg bg-[#229ED9] text-white text-[12px] font-medium hover:bg-[#1e8dbf] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>Подключить @Zerph_bot</span>
            </a>
          )}
        </Row>

        <Row label="Focus mode" description="Hides distractions and shows only today's tasks">
          <Toggle checked={settings.focusModeEnabled} onChange={v => update({ focusModeEnabled: v })} />
        </Row>
      </Section>

      {/* Notifications */}
      <Section title="Notifications & Reminders">
        <Row label="Desktop notifications" description="Browser push notifications for reminders">
          <Toggle
            checked={settings.notifications.desktop}
            onChange={v => update({ notifications: { ...settings.notifications, desktop: v } })}
          />
        </Row>
        <Row label="Due date reminders" description="Notifications when tasks are approaching deadline">
          <Toggle
            checked={settings.notifications.dueReminders}
            onChange={v => update({ notifications: { ...settings.notifications, dueReminders: v } })}
          />
        </Row>
        <Row label="Reminder interval" description="Minutes between multi-stage reminders before deadline">
          <select
            value={settings.notifications.reminderIntervalMinutes || 5}
            onChange={e => update({ notifications: { ...settings.notifications, reminderIntervalMinutes: Number(e.target.value) } })}
            className="text-[12px] bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border outline-none cursor-pointer text-foreground"
          >
            <option value={1}>1 min</option>
            <option value={3}>3 min</option>
            <option value={5}>5 min (Default)</option>
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
          </select>
        </Row>
        <Row label="Reminder count" description="How many times to remind before and at deadline">
          <select
            value={settings.notifications.reminderRepeatCount || 3}
            onChange={e => update({ notifications: { ...settings.notifications, reminderRepeatCount: Number(e.target.value) } })}
            className="text-[12px] bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border outline-none cursor-pointer text-foreground"
          >
            <option value={1}>1 time (Exact time only)</option>
            <option value={2}>2 times</option>
            <option value={3}>3 times (Default: -10m, -5m, 0m)</option>
            <option value={5}>5 times</option>
          </select>
        </Row>
        <Row label="Team updates" description="Activity from shared tasks and collaborators">
          <Toggle
            checked={settings.notifications.teamUpdates}
            onChange={v => update({ notifications: { ...settings.notifications, teamUpdates: v } })}
          />
        </Row>
        <Row label="🌙 Вечерний итог дня (21:00 MSK)" description="Персональная сводка закрытых задач и перенос оставшихся на завтра">
          <Toggle
            checked={settings.eveningReview?.enabled ?? true}
            onChange={v => update({
              eveningReview: {
                enabled: v,
                time: settings.eveningReview?.time || '21:00'
              }
            })}
          />
        </Row>
      </Section>

      {/* Focus & Pomodoro Mode */}
      <Section title="🔥 Focus Mode & Pomodoro">
        <Row label="Длительность фокус-сессии" description="Стандартное время непрерывной глубокой работы">
          <select
            value={settings.focusSettings?.defaultDurationMinutes || 25}
            onChange={e => update({
              focusSettings: {
                defaultDurationMinutes: Number(e.target.value),
                breakDurationMinutes: settings.focusSettings?.breakDurationMinutes || 5
              }
            })}
            className="text-[12px] bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border outline-none cursor-pointer text-foreground"
          >
            <option value={15}>15 минут (Быстрый спринт)</option>
            <option value={25}>25 минут (Помодоро по умолч.)</option>
            <option value={45}>45 минут (Глубокий фокус)</option>
            <option value={60}>60 минут (1 час)</option>
            <option value={90}>90 минут (Ультра-фокус)</option>
          </select>
        </Row>
        <Row label="Длительность перерыва" description="Время на отдых и разминку после каждого фокуса">
          <select
            value={settings.focusSettings?.breakDurationMinutes || 5}
            onChange={e => update({
              focusSettings: {
                defaultDurationMinutes: settings.focusSettings?.defaultDurationMinutes || 25,
                breakDurationMinutes: Number(e.target.value)
              }
            })}
            className="text-[12px] bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border outline-none cursor-pointer text-foreground"
          >
            <option value={5}>5 минут (Рекомендуется)</option>
            <option value={10}>10 минут</option>
            <option value={15}>15 минут</option>
          </select>
        </Row>
      </Section>

      {/* AI & Integrations */}
      <Section title="AI & Integrations">
        <Row label="🎙️ Голосовые ответы бота (TTS)" description="Бот присылает короткие голосовые сообщения в ответ на голосовые">
          <Toggle
            checked={settings.voiceSettings?.ttsResponseEnabled ?? true}
            onChange={v => update({
              voiceSettings: { ttsResponseEnabled: v }
            })}
          />
        </Row>
        <Row label="AI model" description="Model used for the chat assistant">
          <select
            value={settings.integrations.aiModel}
            onChange={e => update({ integrations: { ...settings.integrations, aiModel: e.target.value } })}
            className="text-[12px] bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border outline-none cursor-pointer text-foreground"
          >
            {AI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Row>

        <Row label="Telegram bot" description="Receive task reminders via Telegram">
          <Toggle
            checked={settings.integrations.telegram}
            onChange={v => update({ integrations: { ...settings.integrations, telegram: v } })}
          />
        </Row>
      </Section>

      {/* Siri & Mobile Voice Ecosystem */}
      <Section title="🍏 Siri, Action Button & Mobile Shortcuts">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-lg shadow-md shrink-0">
              🎙️
            </div>
            <div>
              <h4 className="text-[14px] font-semibold text-foreground">Голосовой ассистент Siri и кнопка телефона</h4>
              <p className="text-[12px] text-muted-foreground">Создавайте задачи за 1 секунду голосом или через кнопку Action Button на iPhone / Android.</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ваш персональный Chat ID:</span>
              <span className="font-mono font-bold text-foreground bg-card px-2 py-0.5 rounded border border-border">
                {currentChatId || 'Не привязан (введите выше)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API Шлюз для Быстрых команд:</span>
              <button
                onClick={() => {
                  const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://zeprh.vercel.app'}/api/shortcuts`
                  navigator.clipboard.writeText(url)
                  alert('✅ URL скопирован в буфер обмена!')
                }}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                Скопировать URL 📋
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
            <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <span>🍎</span> Для iPhone (Siri & Action Button)
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Откройте приложение <b>Команды</b> ➔ <b>+</b></li>
                <li>Добавьте <b>Диктовать текст</b></li>
                <li>Добавьте <b>Получить содержимое URL</b>:
                  <div className="text-[11px] font-mono bg-muted/60 p-1.5 rounded my-1">
                    POST /api/shortcuts<br/>
                    Body: {`{"chatId": ${currentChatId || 12345}, "text": [Диктовка]}`}
                  </div>
                </li>
                <li>Добавьте <b>Произнести текст</b> из ответа</li>
                <li>Назначьте команду на <b>Action Button</b> или <b>Стук по крышке</b>!</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <span>🤖</span> Для Android (Виджет в 1 клик)
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Установите <b>HTTP Shortcuts</b> из Google Play</li>
                <li>Создайте ярлык с методом <b>POST</b> на шлюз Zerf</li>
                <li>Укажите ваш Chat ID: <b className="font-mono">{currentChatId || '...'}</b></li>
                <li>Вынесите виджет на рабочий стол или экран блокировки</li>
                <li>Нажимайте кнопку и диктуйте мысли в любое время!</li>
              </ol>
            </div>
          </div>
        </div>
      </Section>

      {/* Data & Privacy */}
      <Section title="Data & Privacy">
        <Row label="Export data" description="Download all your tasks, notes and goals as JSON">
          <button
            onClick={() => {
              const { tasks, goals, notes, projects } = state
              const data = JSON.stringify({ exportedAt: new Date().toISOString(), tasks, goals, notes, projects }, null, 2)
              const blob = new Blob([data], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'zerf-export.json'; a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            Export
          </button>
        </Row>
        <Row label="Version" description="Application version">
          <span className="text-[12px] font-mono text-muted-foreground">1.0.0-beta</span>
        </Row>
      </Section>

      {/* Save button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={save}
        className={cn(
          'flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-semibold transition-all duration-200',
          saved
            ? 'bg-[var(--status-done)] text-white'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        )}
      >
        {saved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save settings</>}
      </motion.button>
    </div>
  )
}
