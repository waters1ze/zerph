'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings, useApp, getTgChatId, getAuthHeaders } from '@/lib/store'
import { useLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Sun, Moon, Monitor, Bell, BellOff, Link, Key,
  User, Mail, Palette, Save, Check, MessageSquare,
  Zap, Globe, Shield, ChevronRight, Smartphone, Sparkles,
  Lock, ExternalLink, Download, Layers, CheckCircle2, ArrowRight
} from 'lucide-react'
import { SessionsPanel } from '@/components/sessions-panel'

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
  { id: 'light', label: 'Светлая', icon: Sun },
  { id: 'dark',  label: 'Тёмная',  icon: Moon },
  { id: 'system',label: 'Системная',icon: Monitor },
] as const

type SettingsTab = 'account' | 'automation' | 'appearance' | 'pwa' | 'subscription' | 'data'

export function SettingsView() {
  const { state, dispatch } = useApp()
  const { settings, update } = useSettings()
  const { language, setLanguage } = useLanguage()
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const [saved, setSaved] = useState(false)

  // Auth form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState(state.settings.name || '')
  const [isRegister, setIsRegister] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSuccess, setAuthSuccess] = useState<string | null>(null)

  const cachedUsage = typeof window !== 'undefined' ? localStorage.getItem('zerf-usage') : null
  const [usage, setUsage] = useState<any>(cachedUsage ? JSON.parse(cachedUsage) : null)
  const [loadingPay, setLoadingPay] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const [copiedShortcut, setCopiedShortcut] = useState(false)
  const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null

  const cachedBirthday = typeof window !== 'undefined' ? localStorage.getItem('zerf_birthday') || '' : ''
  const [userBirthday, setUserBirthday] = useState(cachedBirthday)
  const isAdmin = currentChatId === '6136950061' || currentChatId === '5078516086'

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://zeprh.vercel.app'
  const effectiveChatId = currentChatId && !currentChatId.startsWith('guest_') ? currentChatId : 'ВАШ_CHAT_ID'
  const personalShortcutUrl = `${originUrl}/api/shortcuts?chatId=${effectiveChatId}&text=`

  useEffect(() => {
    if (currentChatId) {
      fetch(`/api/telegram/user?chatId=${currentChatId}`, {
        headers: getAuthHeaders(),
      })
        .then(r => r.json())
        .then(d => {
          if (d.birthday) {
            setUserBirthday(d.birthday)
            try { localStorage.setItem('zerf_birthday', d.birthday) } catch {}
          }
        })
        .catch(() => {})
    }
  }, [currentChatId])

  const handleUserBirthdayChange = async (val: string) => {
    setUserBirthday(val)
    try { localStorage.setItem('zerf_birthday', val) } catch {}
    if (!currentChatId) return
    try {
      await fetch(`/api/telegram/user?chatId=${currentChatId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ birthday: val }),
      })
    } catch {}
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthSuccess(null)
    setAuthLoading(true)

    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isRegister ? 'register' : 'login',
          email,
          password,
          firstName: name
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка входа')
      }

      localStorage.setItem('zerf_chat_id', data.chatId)
      if (data.token) localStorage.setItem('zerf_auth_token', data.token)
      if (data.firstName) {
        localStorage.setItem('zerf_user_name', data.firstName)
        update({ name: data.firstName })
      }

      setAuthSuccess(data.message || 'Успешно!')
      setTimeout(() => {
        window.location.reload()
      }, 700)
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка сети')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    const emailPrompt = prompt('Введите ваш Google Email:')
    if (!emailPrompt || !emailPrompt.includes('@')) return

    setAuthLoading(true)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailPrompt, name: emailPrompt.split('@')[0] })
      })
      const data = await res.json()
      if (data.chatId) {
        localStorage.setItem('zerf_chat_id', data.chatId)
        if (data.token) localStorage.setItem('zerf_auth_token', data.token)
        window.location.reload()
      }
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    if (confirm('Выйти из этого аккаунта на текущем устройстве?')) {
      try {
        localStorage.removeItem('zerf_chat_id')
        localStorage.removeItem('zerf_auth_token')
        localStorage.removeItem('zerf_birthday')
        document.cookie = 'zerf_chat_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        document.cookie = 'zerf_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      } catch {}
      window.location.reload()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>⚙️ Настройки Zerf Note</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Управление аккаунтом, синхронизацией, голосовыми командами и внешним видом
          </p>
        </div>

        {currentChatId && !currentChatId.startsWith('guest_') && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ID: {currentChatId}
            </span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/80 overflow-x-auto">
        <button
          onClick={() => setActiveTab('account')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'account' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <User className="w-3.5 h-3.5" />
          <span>Профиль & Вход</span>
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'automation' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Голос & Siri (iOS / Android)</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'appearance' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Оформление</span>
        </button>

        <button
          onClick={() => setActiveTab('pwa')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'pwa' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>PWA Приложение</span>
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'subscription' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Тариф & Лимиты</span>
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={cn(
            'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all',
            activeTab === 'data' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Данные & Экспорт</span>
        </button>
      </div>

      {/* ── TAB 1: Account & Authentication ──────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <Section title="Ваш Профиль">
            <Row label="Имя пользователя" description="Отображается в команде, совместных проектах и чате">
              <input
                type="text"
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  update({ name: e.target.value })
                  if (currentChatId) {
                    fetch(`/api/telegram/user?chatId=${currentChatId}`, {
                      method: 'POST',
                      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: e.target.value })
                    }).catch(() => {})
                  }
                }}
                placeholder="Ваше имя"
                className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors w-48"
              />
            </Row>

            <Row label="🎂 День рождения" description="Друзья в Zerf Note автоматически увидят напоминание в календаре">
              <input
                type="date"
                value={userBirthday}
                onChange={e => handleUserBirthdayChange(e.target.value)}
                className="h-9 px-3 rounded-xl bg-muted/50 border border-border text-xs text-foreground outline-none focus:border-primary transition-colors w-44 cursor-pointer"
              />
            </Row>
          </Section>

          {/* Email / Social Authentication Form */}
          <Section title="Авторизация & Подключение аккаунтов">
            <div className="p-5 space-y-4">
              {currentChatId && !currentChatId.startsWith('guest_') ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Аккаунт подключен</p>
                    <p className="text-[11px] text-muted-foreground">Идентификатор профиля: {currentChatId}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-all"
                  >
                    Выйти из аккаунта
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Войдите или зарегистрируйтесь по <b>Email</b>, через <b>Telegram (@Zerph_bot)</b> или <b>ВКонтакте</b>, чтобы сохранять задачи и получать напоминания.
                  </p>

                  <form onSubmit={handleEmailAuth} className="space-y-3 p-4 rounded-2xl bg-card border border-border/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-foreground">
                        {isRegister ? 'Регистрация по Email' : 'Вход по Email'}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setIsRegister(!isRegister); setAuthError(null) }}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        {isRegister ? 'Уже есть аккаунт? Войти' : 'Создать аккаунт'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="alex@gmail.com"
                          className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Пароль</label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {authError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                        {authError}
                      </p>
                    )}

                    {authSuccess && (
                      <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {authSuccess}
                      </p>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm"
                      >
                        {authLoading ? 'Загрузка...' : (isRegister ? 'Зарегистрироваться' : 'Войти')}
                      </button>

                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        className="px-3.5 h-9 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition-colors flex items-center gap-1.5"
                      >
                        <span>Google Вход</span>
                      </button>
                    </div>
                  </form>

                  {/* Telegram and VK Direct Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <a
                      href="https://t.me/Zerph_bot?start=login"
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 rounded-xl bg-[#229ED9]/10 border border-[#229ED9]/30 hover:bg-[#229ED9]/20 transition-all flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#229ED9] text-white flex items-center justify-center font-bold">TG</div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Войти через Telegram</p>
                          <p className="text-[10px] text-muted-foreground">@Zerph_bot (/login)</p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>

                    <a
                      href="https://vk.com/im?sel=-240878278"
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 rounded-xl bg-[#0077FF]/10 border border-[#0077FF]/30 hover:bg-[#0066DD]/20 transition-all flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#0077FF] text-white flex items-center justify-center font-bold">VK</div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Войти через ВКонтакте</p>
                          <p className="text-[10px] text-muted-foreground">Бот сообщества</p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {currentChatId && !currentChatId.startsWith('guest_') && (
            <Section title="Безопасность и активные сессии">
              <SessionsPanel />
            </Section>
          )}
        </div>
      )}

      {/* ── TAB 2: Voice Automation (iOS & Android) ──────────────────────────── */}
      {activeTab === 'automation' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>🔑</span> Ваш персональный шлюз голосового ввода:
              </p>
              <code className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block break-all">
                {personalShortcutUrl}[Текст]
              </code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(personalShortcutUrl)
                setCopiedShortcut(true)
                setTimeout(() => setCopiedShortcut(false), 2000)
              }}
              className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border shrink-0 transition-colors"
            >
              {copiedShortcut ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* iPhone Siri Card */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                    <span>🍏</span> Для iPhone (Siri & Action Button)
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                    Шаблон в 1 клик
                  </span>
                </div>

                <a
                  href="https://www.icloud.com/shortcuts/3d56a887eab84805808f984b93c50a97"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <span>🍏 Установить команду на iPhone</span>
                </a>

                <div className="space-y-2 text-[11px] text-muted-foreground">
                  <p className="font-semibold text-foreground">Пошаговая настройка:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-0.5">
                    <li>Нажмите кнопку выше и в окне на iPhone выберите <b>«Добавить команду»</b>.</li>
                    <li>В 3-м блоке *(«Получить содержимое URL»)* проверьте ваш Chat ID: <code>chatId={effectiveChatId}</code>.</li>
                    <li>Скажите Siri: <i>«Привет, Siri, Запиши в zerf»</i>!</li>
                  </ol>

                  {/* Blueprint block */}
                  <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-1.5 font-mono text-[10px] mt-2">
                    <div className="text-foreground font-bold font-sans text-[11px] mb-1">
                      📱 Структура блоков на iPhone:
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-sky-400 font-sans">
                      🎤 <b>1. Продиктовать текст</b> (Русский)
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-indigo-400 font-sans">
                      🔗 <b>2. URL Кодировать</b> [Продиктованный текст]
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-emerald-400 break-all font-sans">
                      🌐 <b>3. Получить содержимое URL:</b><br />
                      <span className="font-mono text-[9px]">{personalShortcutUrl}</span><span className="text-indigo-400 font-bold">[Кодированный в URL текст]</span>
                    </div>
                    <div className="p-1.5 rounded bg-card/80 border border-border/60 text-rose-400 font-sans">
                      🔊 <b>4. Произнести текст</b> [Содержимое URL]
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                💡 <i>Привяжите к Action Button на iPhone 15/16 Pro или к двойному постукиванию по задней крышке!</i>
              </p>
            </div>

            {/* Android Card */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                    <span>⚙️</span> Для Android (Виджет в 1 клик)
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    HTTP Shortcuts
                  </span>
                </div>

                <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground">Пошаговая инструкция для Android:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-0.5">
                    <li>Установите бесплатное приложение <b>HTTP Shortcuts</b> из Google Play.</li>
                    <li>Нажмите значок <b>+</b> ➔ Создайте <b>Обычный ярлык</b> (Regular Shortcut).</li>
                    <li>В разделе <i>«Переменные»</i> добавьте переменную <code>voice_input</code> с типом <i>«Голосовой ввод»</i>.</li>
                    <li>В поле <b>URL запроса</b> укажите:
                      <div className="text-[10px] font-mono bg-muted/90 p-2 rounded-lg my-1 break-all border border-border text-emerald-400">
                        {personalShortcutUrl}{'{voice_input}'}
                      </div>
                    </li>
                    <li>В разделе <i>«Ответ» (Response)</i> включите: <b>Озвучивать текст (TTS)</b>.</li>
                    <li>Вынесите созданный ярлык-виджет на главный экран Android!</li>
                  </ol>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground">
                ✨ Теперь по нажатию виджета сразу открывается микрофон: надиктовали задачу — бот озвучит ответ и сохранит всё в ваш аккаунт!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Appearance & Language ─────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <Section title="Тема оформления">
            <Row label="Цветовая тема" description="Выберите светлую, тёмную или системную тему">
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
                {THEMES.map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id}
                      onClick={() => update({ theme: t.id })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                        settings.theme === t.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </Row>

            <Row label="Первый день недели" description="С какого дня начинается календарная сетка">
              <select
                value={settings.weekStartsOn ?? 1}
                onChange={e => update({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
                className="text-xs bg-muted/50 rounded-xl px-3 py-1.5 border border-border outline-none cursor-pointer text-foreground"
              >
                <option value={1}>Понедельник (Рекомендуется)</option>
                <option value={0}>Воскресенье</option>
              </select>
            </Row>
          </Section>
        </div>
      )}

      {/* ── TAB 4: PWA App Installation ─────────────────────────────────────── */}
      {activeTab === 'pwa' && (
        <div className="space-y-6">
          <Section title="Установка на устройства">
            <div className="p-4 space-y-3.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Установите Zerf Note как отдельное приложение на телефон или компьютер. Оно работает без адресной строки браузера, запускается мгновенно и сохраняет авторизацию навсегда.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <span>🍏</span> На iPhone (iOS Safari)
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    1. Откройте сайт в <b>Safari</b>.<br />
                    2. Нажмите кнопку <b>«Поделиться»</b> (квадрат со стрелочкой вверх).<br />
                    3. Выберите <b>«На экран „Домой“»</b>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <span>🤖</span> На Android (Chrome)
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    1. Откройте сайт в <b>Chrome</b>.<br />
                    2. Нажмите <b>три точки (меню)</b> вверху справа.<br />
                    3. Нажмите <b>«Установить приложение»</b>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <p className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <span>💻</span> На ПК (Windows / Mac)
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    1. Откройте сайт в <b>Chrome</b> или <b>Edge</b>.<br />
                    2. В адресной строке нажмите значок <b>⊕ «Установить»</b>.<br />
                    3. Приложение появится на панели задач!
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB 5: Subscription & Limits ─────────────────────────────────────── */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <Section title="Тарифный план">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Zerf Premium</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Безлимитный ИИ-ассистент, голосовые ответы TTS, расширенная аналитика и приоритетная доставка
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-foreground">99 ₽</span>
                  <span className="text-xs text-muted-foreground"> / мес</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    const cid = getTgChatId()
                    window.open(`https://yoomoney.ru/to/410011887754321?comment=zerf_${cid}`, '_blank')
                  }}
                  className="py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20"
                >
                  Оформить подписку (99 ₽ / месяц)
                </button>

                <button
                  onClick={() => {
                    const cid = getTgChatId()
                    const refLink = `https://t.me/Zerph_bot?start=ref_${cid}`
                    navigator.clipboard.writeText(refLink)
                    setCopiedRef(true)
                    setTimeout(() => setCopiedRef(false), 2000)
                  }}
                  className="py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border transition-colors flex items-center justify-center gap-1.5"
                >
                  {copiedRef ? 'Ссылка скопирована!' : '🎁 Пригласить друга (Получить Premium)'}
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── TAB 6: Data & Privacy ────────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <Section title="Резервное копирование и экспорт">
            <Row label="Экспорт всех данных (JSON)" description="Скачать полный архив задач, заметок, целей и проектов">
              <button
                onClick={() => {
                  const { tasks, goals, notes, projects } = state
                  const data = JSON.stringify({ exportedAt: new Date().toISOString(), tasks, goals, notes, projects }, null, 2)
                  const blob = new Blob([data], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `zerf-note-export-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать JSON</span>
              </button>
            </Row>
          </Section>
        </div>
      )}
    </div>
  )
}
