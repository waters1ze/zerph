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
  const [inputChatId, setInputChatId] = useState('')
  const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null

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

  const handleSubscribe = async () => {
    setLoadingPay(true)
    try {
      const cid = getTgChatId()
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }

      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ownerChatId: cid }),
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
          <div className="flex items-center justify-between">
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
            {!isPremium && (
              <button
                onClick={handleSubscribe}
                disabled={loadingPay}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium text-[13px] hover:brightness-110 active:scale-95 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {loadingPay ? 'Переход...' : 'Подписаться 99 ₽/мес'}
              </button>
            )}
          </div>

          {/* Limits Progress */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div>
              <div className="flex justify-between text-[12px] mb-1 font-medium">
                <span>🎙 Голосовые сообщения в день</span>
                <span className="text-muted-foreground">
                  {isPremium
                    ? `${Math.round((usage?.voice?.secondsUsed || 0) / 60)}м / 10 мин`
                    : `${usage?.voice?.used || 0} / 2`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: isPremium
                      ? `${Math.min(100, ((usage?.voice?.secondsUsed || 0) / 600) * 100)}%`
                      : `${Math.min(100, ((usage?.voice?.used || 0) / 2) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[12px] mb-1 font-medium">
                <span>📌 Заметки в день</span>
                <span className="text-muted-foreground">
                  {isPremium ? 'Безлимитно ✨' : `${usage?.notes?.used || 0} / 2`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: isPremium ? '0%' : `${Math.min(100, ((usage?.notes?.used || 0) / 2) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[12px] mb-1 font-medium">
                <span>💬 Сообщения в ИИ чат</span>
                <span className="text-muted-foreground">
                  {isPremium ? 'Безлимитно ✨' : `${usage?.chat?.used || 0} / 10`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: isPremium ? '0%' : `${Math.min(100, ((usage?.chat?.used || 0) / 10) * 100)}%` }}
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
            placeholder="Ваше имя"
            className="h-8 px-3 rounded-lg bg-muted/50 border border-border text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors w-44"
          />
        </Row>

        <Row label="Telegram account" description={currentChatId ? `Связанный Chat ID: ${currentChatId}` : "Привяжите Telegram chatId для синхронизации подписки и задач"}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ваш Chat ID (напр. 6136950061)"
              defaultValue={currentChatId || ''}
              onChange={e => setInputChatId(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-muted/50 border border-border text-[12px] text-foreground outline-none focus:border-primary/50 transition-colors w-40"
            />
            <button
              onClick={() => {
                const targetId = inputChatId || currentChatId || ''
                if (targetId.trim()) {
                  localStorage.setItem('zerf_chat_id', targetId.trim())
                  update({ integrations: { ...settings.integrations, telegram: true } })
                  fetchSubscription()
                  alert(`✅ Telegram Chat ID (${targetId.trim()}) успешно привязан к сайту!`)
                }
              }}
              className="h-8 px-3 rounded-lg bg-[#229ED9] text-white text-[12px] font-medium hover:bg-[#1e8dbf] transition-colors shrink-0 shadow-sm"
            >
              Синхронизировать
            </button>
          </div>
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
      </Section>

      {/* AI & Integrations */}
      <Section title="AI & Integrations">
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
