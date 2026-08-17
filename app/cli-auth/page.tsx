'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Terminal, ShieldCheck, CheckCircle2, XCircle, Loader2,
  Crown, ArrowRight, LogIn, Mail, Lock, Send, Edit3, Sparkles
} from 'lucide-react'
import { getAuthHeaders, getTgChatId } from '@/lib/store'

function CliAuthContent() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<{ chatId: string; name?: string; plan?: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'success' | 'rejected' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Quick Inline Login Form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Extract code safely on mount from searchParams OR window.location.search & unregister stale SW
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const r of regs) {
            r.unregister().catch(() => {})
          }
        }).catch(() => {})
      }

      const sp = new URLSearchParams(window.location.search)
      const c = sp.get('code') || sp.get('c') || searchParams.get('code') || searchParams.get('c') || ''
      if (c) {
        setCode(c.trim().toUpperCase())
      }
    }
  }, [searchParams])

  const checkAuth = async () => {
    try {
      setLoading(true)
      const headers = getAuthHeaders()
      const res = await fetch('/api/subscription', { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.chatId) {
          setUser({
            chatId: String(data.chatId),
            name: data.name || `Пользователь #${data.chatId}`,
            plan: data.plan || 'free',
          })
        }
      }
    } catch (e) {
      console.error('Auth check error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  // Auto-listen to Telegram Bot 1-click authorization
  useEffect(() => {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode || status === 'success') return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/cli/auth?code=${encodeURIComponent(cleanCode)}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'approved') {
            setStatus('success')
            clearInterval(timer)
          } else if (data.status === 'rejected') {
            setStatus('rejected')
            clearInterval(timer)
          }
        }
      } catch {}
    }, 1500)

    return () => clearInterval(timer)
  }, [code, status])

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) return
    setLoginLoading(true)
    setLoginError(null)

    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: loginEmail,
          password: loginPassword,
        }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('zerf_auth_token', data.token)
        if (data.chatId) {
          localStorage.setItem('zerf_chat_id', String(data.chatId))
        }
        document.cookie = `zerf_auth_token=${data.token}; path=/; max-age=31536000; SameSite=Lax`
        await checkAuth()
      } else {
        setLoginError(data.error || 'Неверный email или пароль')
      }
    } catch (err: any) {
      setLoginError(err.message || 'Ошибка входа')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleApprove = async () => {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      setErrorMsg('Пожалуйста, укажите код подтверждения из терминала')
      setStatus('error')
      return
    }
    setSubmitting(true)
    setErrorMsg('')
    try {
      const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      }
      const res = await fetch('/api/cli/auth', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ code: cleanCode, action: 'approve' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus('success')
      } else {
        setErrorMsg(data.error || 'Ошибка авторизации. Возможно, срок действия кода истёк.')
        setStatus('error')
      }
    } catch (e: any) {
      setErrorMsg(String(e?.message || e))
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) return
    setSubmitting(true)
    try {
      await fetch('/api/cli/auth', {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, action: 'reject' }),
      })
      setStatus('rejected')
    } catch {}
    setSubmitting(false)
  }

  const tgBotCliUrl = code
    ? `https://t.me/Zerph_bot?start=cli_${code.replace(/-/g, '_')}`
    : `https://t.me/Zerph_bot?start=login`

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4 selection:bg-sky-500/30">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
      >
        {/* Glow Header Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-sky-500/15 blur-3xl pointer-events-none rounded-full" />

        {/* Mascot & Icon Header */}
        <div className="flex flex-col items-center text-center space-y-3 relative">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Terminal className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-[11px]">
              🪽
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              Подключение Zerf CLI
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Терминальный ассистент запрашивает доступ к вашему аккаунту
            </p>
          </div>
        </div>

        {/* Code Input / Badge */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center justify-center gap-1">
            Код подтверждения из терминала
          </span>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            maxLength={12}
            className="w-full text-center text-2xl font-mono font-extrabold tracking-widest text-sky-400 bg-transparent border-b border-dashed border-slate-700 focus:border-sky-400 focus:outline-none py-1 uppercase transition-colors placeholder:text-slate-700"
          />
        </div>

        {/* Status Views */}
        {status === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-400">Успешно авторизовано!</h3>
            <p className="text-xs text-slate-300">
              Сессия в терминале активирована. Вы можете вернуться в консоль и начать работу с Zerf CLI.
            </p>
          </motion.div>
        ) : status === 'rejected' ? (
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2">
            <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-rose-400">Запрос отклонён</h3>
            <p className="text-xs text-slate-300">Сессия в терминале не была активирована.</p>
          </div>
        ) : status === 'error' ? (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
            <XCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <h3 className="text-xs font-bold text-amber-400">Ошибка</h3>
            <p className="text-xs text-slate-300">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="text-[11px] text-sky-400 underline cursor-pointer mt-1 block mx-auto"
            >
              Попробовать снова
            </button>
          </div>
        ) : user ? (
          /* User Profile & Actions */
          <div className="space-y-5">
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  ❖
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-400">ID: {user.chatId}</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {user.plan === 'pro' || user.plan === 'corp' ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase border border-amber-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> {user.plan}
                  </span>
                ) : user.plan === 'plus' ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase border border-emerald-500/30">
                    Plus
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold uppercase">
                    {user.plan}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-[11px] text-slate-400 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
                <ShieldCheck className="w-4 h-4 text-sky-400" /> Разрешения для терминала:
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✔</span> Доступ к вашим задачам, заметкам и целям
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✔</span> Синхронизация в реальном времени с сайтом и ботом
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✔</span> Создание персонального PAT-токена (365 дней)
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Отклонить
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting || !code.trim()}
                className="flex-2 h-11 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Разрешить доступ</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Inline Login Card */
          <div className="space-y-4 pt-1">
            <div className="text-center space-y-1">
              <p className="text-xs text-slate-300 font-medium">
                Войдите в аккаунт Zerf Note для авторизации терминала:
              </p>
            </div>

            {/* Telegram Fast 1-Click Auth Link */}
            <a
              href={tgBotCliUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" /> Войти через Telegram Бота (1 клик)
            </a>

            <div className="flex items-center gap-3 text-slate-600 text-[10px] uppercase font-bold">
              <div className="flex-1 h-px bg-slate-800" />
              <span>или Email</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <form onSubmit={handleInlineLogin} className="space-y-2.5">
              {loginError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center">
                  {loginError}
                </div>
              )}

              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="Ваш Email"
                  required
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Пароль"
                  required
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Войти по Email'}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default function CliAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    }>
      <CliAuthContent />
    </Suspense>
  )
}
