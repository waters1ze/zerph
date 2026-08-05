'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSettings, useApp } from '@/lib/store'
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

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
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
            className="h-8 px-3 rounded-lg bg-muted/50 border border-border text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors w-44"
          />
        </Row>

        <Row label="Focus mode" description="Hides distractions and shows only today's tasks">
          <Toggle checked={settings.focusModeEnabled} onChange={v => update({ focusModeEnabled: v })} />
        </Row>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
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
