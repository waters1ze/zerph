'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, Lock, ExternalLink, Mail, Key, User, Loader2, CheckCircle2, X } from 'lucide-react'
import { GithubIcon } from '@/components/views/extensions-view'
import { getTgChatId, isUserAuthenticated } from '@/lib/store'
import { cn } from '@/lib/utils'

export function AuthGateModal({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  // Synchronous check (localStorage + cookie): returning users never see the
  // login gate flash in and out on load.
  const [isAuth, setIsAuth] = useState(() => isUserAuthenticated())
  const [authTab, setAuthTab] = useState<'google' | 'email' | 'tg' | 'vk' | 'github'>('google')
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [googleEmail, setGoogleEmail] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handlePinAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPin = pinCode.trim().replace(/\s+/g, '')
    if (!cleanPin) return
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/auth/login-token?token=${cleanPin}`)
      const data = await res.json()
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Неверный или устаревший код (действует 10 минут)')
      }
      if (data.chatId) localStorage.setItem('zerf_chat_id', String(data.chatId))
      if (data.sessionToken) localStorage.setItem('zerf_auth_token', data.sessionToken)
      setSuccessMsg('Успешный вход!')
      // Notify topbar/gate instantly, then reload to hydrate the new session
      window.dispatchEvent(new CustomEvent('zerf:auth_changed'))
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err: any) {
      setError(err.message || 'Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkAuth = () => setIsAuth(isUserAuthenticated())
    checkAuth()
    window.addEventListener('storage', checkAuth)
    window.addEventListener('zerf:auth_changed', checkAuth)
    return () => {
      window.removeEventListener('storage', checkAuth)
      window.removeEventListener('zerf:auth_changed', checkAuth)
    }
  }, [])

  const shouldOpen = open !== undefined ? open : !isAuth


  const handleGoogleDirectAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: googleEmail, firstName: name })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка входа через Google')

      if (data.chatId) localStorage.setItem('zerf_chat_id', data.chatId)
      if (data.token) localStorage.setItem('zerf_auth_token', data.token)
      if (data.firstName) localStorage.setItem('zerf_user_name', data.firstName)

      setSuccessMsg(data.message || 'Успешный вход!')
      window.dispatchEvent(new CustomEvent('zerf:auth_changed'))
      setTimeout(() => {
        window.location.reload()
      }, 700)
    } catch (err: any) {
      setError(err.message || 'Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

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
        throw new Error(data.error || 'Ошибка авторизации')
      }

      localStorage.setItem('zerf_chat_id', data.chatId)
      if (data.token) localStorage.setItem('zerf_auth_token', data.token)
      if (data.firstName) localStorage.setItem('zerf_user_name', data.firstName)

      setSuccessMsg(data.message || 'Успешно!')
      window.dispatchEvent(new CustomEvent('zerf:auth_changed'))
      setTimeout(() => {
        window.location.reload()
      }, 700)
    } catch (err: any) {
      setError(err.message || 'Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const handleGlobalOpen = () => {
      if (open === undefined) {
        setIsAuth(false)
      }
    }
    window.addEventListener('zerf_open_auth_modal', handleGlobalOpen)
    return () => window.removeEventListener('zerf_open_auth_modal', handleGlobalOpen)
  }, [open])

  return (
    <AnimatePresence>
      {shouldOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md bg-card border border-border/80 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-4 z-10"
          >
            {/* Background Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Icon + Close Button */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3.5 relative">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-foreground flex items-center gap-1.5">
                    Вход в Zerf Note
                    <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </h3>
                  <p className="text-[12px] text-muted-foreground">
                    Войдите для сохранения задач и синхронизации
                  </p>
                </div>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                  title="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-muted/60 border border-border/60">
              <button
                type="button"
                onClick={() => { setAuthTab('google'); setError(null) }}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                  authTab === 'google' ? 'bg-card text-rose-400 shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="font-bold text-xs">G</span>
                <span>Google</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('email'); setError(null) }}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                  authTab === 'email' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('tg'); setError(null) }}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                  authTab === 'tg' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                <span>TG</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('vk'); setError(null) }}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                  authTab === 'vk' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="font-bold text-xs text-[#0077FF]">VK</span>
                <span>ВК</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('github'); setError(null) }}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all',
                  authTab === 'github' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>GitHub</span>
              </button>
            </div>

            {/* Content per Tab */}
            {authTab === 'google' && (
              <div className="flex flex-col gap-3 pt-1">
                <a
                  href="/api/auth/google"
                  className="w-full h-11 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs sm:text-[13px] transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-500/20 active:scale-95"
                >
                  <span className="font-bold text-sm bg-white text-rose-500 rounded-full w-5 h-5 flex items-center justify-center">G</span>
                  <span>Войти через Google в 1 клик</span>
                </a>

                <div className="flex items-center gap-2 my-1 text-muted-foreground text-[11px]">
                  <div className="flex-1 h-px bg-border" />
                  <span>или введите Google Email</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleGoogleDirectAuth} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Ваш Google Email (Gmail)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={googleEmail}
                        onChange={e => setGoogleEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-rose-500 transition-colors text-foreground"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                      {error}
                    </p>
                  )}

                  {successMsg && (
                    <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {successMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !googleEmail.trim()}
                    className="w-full h-10 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Войти по адресу Gmail</span>
                  </button>
                </form>
              </div>
            )}

            {authTab === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-3 pt-1">
                {isRegister && (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Ваше имя
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Александр"
                        className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="alex@gmail.com"
                      className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Пароль *
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                    {error}
                  </p>
                )}

                {successMsg && (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {successMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRegister ? 'Зарегистрироваться' : 'Войти в аккаунт'}</span>
                </button>

                <div className="flex items-center justify-end text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => { setIsRegister(!isRegister); setError(null) }}
                    className="text-primary hover:underline font-medium"
                  >
                    {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                  </button>
                </div>
              </form>
            )}

            {authTab === 'tg' && (
              <div className="flex flex-col gap-3 pt-1">
                <div className="bg-muted/40 border border-border/50 rounded-2xl p-3.5 text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-1">
                  <p className="text-foreground font-semibold">Вход по коду из Telegram бота @Zerph_bot:</p>
                  <p>1. Отправьте боту команду <code className="px-1 py-0.5 rounded bg-muted font-mono text-primary">/login</code></p>
                  <p>2. Введите полученный 6-значный код или нажмите ссылку.</p>
                </div>

                <form onSubmit={handlePinAuth} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={7}
                    value={pinCode}
                    onChange={e => setPinCode(e.target.value)}
                    placeholder="Код: 123 456"
                    className="flex-1 h-11 px-3 rounded-2xl bg-muted/50 border border-border text-center font-mono text-base tracking-widest text-foreground outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={loading || !pinCode.trim()}
                    className="px-4 h-11 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Войти</span>}
                  </button>
                </form>

                <div className="relative flex py-0.5 items-center">
                  <div className="flex-grow border-t border-border/60"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">или</span>
                  <div className="flex-grow border-t border-border/60"></div>
                </div>

                <a
                  href="https://t.me/Zerph_bot?start=login"
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 rounded-2xl bg-[#229ED9] hover:bg-[#1e8dbf] text-white font-medium text-[13px] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#229ED9]/20"
                >
                  <Send className="w-4 h-4" />
                  <span>Открыть Telegram (@Zerph_bot)</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              </div>
            )}

            {authTab === 'vk' && (
              <div className="flex flex-col gap-3 pt-1">
                <a
                  href="/api/auth/vk"
                  className="w-full h-11 rounded-2xl bg-[#0077FF] hover:bg-[#0066DD] text-white font-medium text-xs sm:text-[13px] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#0077FF]/20 active:scale-95 cursor-pointer"
                >
                  <span className="font-bold text-sm bg-white/20 px-1.5 py-0.5 rounded-md">VK</span>
                  <span>Войти / Зарегистрироваться через VK ID</span>
                </a>

                <div className="flex items-center gap-2 my-1 text-muted-foreground text-[11px]">
                  <div className="flex-1 h-px bg-border" />
                  <span>или через диалог ВКонтакте</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="bg-muted/40 border border-border/50 rounded-2xl p-3.5 text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-1.5">
                  <p className="text-foreground font-semibold">Вход через бота сообщества:</p>
                  <p>1. Напишите в сообщения группы команду <code className="px-1 py-0.5 rounded bg-muted font-mono text-[#0077FF]">/login</code></p>
                  <p>2. Перейдите по полученной ссылке прямого входа.</p>
                </div>

                <a
                  href="https://vk.com/im?sel=-240878278"
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border font-medium text-xs transition-all flex items-center justify-center gap-2"
                >
                  <span>Открыть диалог ВКонтакте</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>
            )}

            {authTab === 'github' && (
              <div className="flex flex-col gap-3 pt-1">
                <a
                  href="/api/auth/github"
                  className="w-full h-11 rounded-2xl bg-[#24292e] hover:bg-[#1b1f23] text-white font-medium text-xs sm:text-[13px] transition-all flex items-center justify-center gap-2 shadow-md shadow-black/20 active:scale-95 cursor-pointer"
                >
                  <GithubIcon className="w-4 h-4 text-white" />
                  <span>Войти / Зарегистрироваться через GitHub</span>
                </a>

                <div className="bg-muted/40 border border-border/50 rounded-2xl p-3.5 text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-1">
                  <p className="text-foreground font-semibold">Быстрая регистрация и вход в 1 клик:</p>
                  <p>Если аккаунт уже есть — войдёте в него. Если вы впервые — аккаунт будет создан автоматически с сохранением всех задач и настроек.</p>
                </div>
              </div>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-1 h-8 rounded-xl text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors"
              >
                Закрыть
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
