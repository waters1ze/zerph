'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, Lock, ExternalLink, Mail, Key, User, Loader2, CheckCircle2 } from 'lucide-react'
import { getTgChatId } from '@/lib/store'
import { cn } from '@/lib/utils'

export function AuthGateModal({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const [isAuth, setIsAuth] = useState(true)
  const [authTab, setAuthTab] = useState<'email' | 'tg' | 'vk'>('email')
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = () => {
      const chatId = getTgChatId()
      // Authenticated means: real chatId AND verifiable credentials
      // (session token, Telegram initData, or signed VK launch params).
      const token = localStorage.getItem('zerf_auth_token')
      const initData = (window as any).Telegram?.WebApp?.initData
      const vkLaunch = localStorage.getItem('zerf_vk_launch')
      const hasCredentials = Boolean(token || initData || vkLaunch)
      setIsAuth(Boolean(chatId && !chatId.startsWith('guest_') && hasCredentials))
    }
    checkAuth()
    window.addEventListener('storage', checkAuth)
    return () => window.removeEventListener('storage', checkAuth)
  }, [])

  const shouldOpen = open !== undefined ? open : !isAuth

  if (isAuth && open === undefined) return null

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
      setTimeout(() => {
        window.location.reload()
      }, 700)
    } catch (err: any) {
      setError(err.message || 'Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

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

            {/* Header Icon */}
            <div className="flex items-center gap-3 border-b border-border/50 pb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-foreground flex items-center gap-1.5">
                  Вход в Zerf Note
                  <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                </h3>
                    <p className="text-[12px] text-muted-foreground">
                      Войдите по Email, Telegram или VK
                    </p>
              </div>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
              <button
                type="button"
                onClick={() => { setAuthTab('email'); setError(null) }}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
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
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  authTab === 'tg' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                <span>Telegram</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('vk'); setError(null) }}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  authTab === 'vk' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="font-bold text-xs text-[#0077FF]">VK</span>
                <span>ВКонтакте</span>
              </button>
            </div>

            {/* Content per Tab */}
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
                <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2">
                  <p className="text-foreground font-semibold">Вход через Telegram бота @Zerph_bot:</p>
                  <p>1. Откройте бота и отправьте команду <code className="px-1 py-0.5 rounded bg-muted font-mono text-primary">/login</code></p>
                  <p>2. Нажмите полученную ссылку для моментального входа без пароля.</p>
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
                <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 text-[12px] text-muted-foreground leading-relaxed flex flex-col gap-2">
                  <p className="text-foreground font-semibold">Вход через сообщество ВКонтакте:</p>
                  <p>1. Напишите боту в сообщения группы слово <code className="px-1 py-0.5 rounded bg-muted font-mono text-[#0077FF]">/login</code></p>
                  <p>2. Перейдите по персональной ссылке прямого входа.</p>
                </div>

                <a
                  href="https://vk.com/im?sel=-240878278"
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 rounded-2xl bg-[#0077FF] hover:bg-[#0066DD] text-white font-medium text-[13px] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#0077FF]/20"
                >
                  <span className="font-bold text-sm">VK</span>
                  <span>Открыть диалог ВКонтакте</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
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
