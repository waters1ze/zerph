'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Terminal, ShieldCheck, CheckCircle2, XCircle, Loader2, Sparkles, Crown, ArrowRight, Laptop } from 'lucide-react'

function CliAuthContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams.get('code')?.trim().toUpperCase() || ''

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<{ chatId: string; name?: string; plan?: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'success' | 'rejected' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/user/limits')
      .then(res => res.json())
      .then(data => {
        if (data && data.chatId) {
          setUser({
            chatId: data.chatId,
            name: data.name || data.username || `Пользователь #${data.chatId}`,
            plan: data.plan || 'free',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleApprove = async () => {
    if (!code) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/cli/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: 'approve' }),
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
    if (!code) return
    setSubmitting(true)
    try {
      await fetch('/api/cli/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: 'reject' }),
      })
      setStatus('rejected')
    } catch {}
    setSubmitting(false)
  }

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

        {/* Code Badge */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
            Код подтверждения из терминала
          </span>
          <div className="text-2xl font-mono font-extrabold tracking-widest text-sky-400">
            {code || 'НЕ УКАЗАН'}
          </div>
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
              Теперь вы можете вернуться в терминал. Сессия Zerf CLI активна и синхронизирована с аккаунтом.
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
          </div>
        ) : user ? (
          /* User Profile & Actions */
          <div className="space-y-5">
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                  {user.name?.[0]?.toUpperCase() || 'U'}
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
                <span className="text-emerald-400">✔</span> Генерация расширений и ИИ-планирование
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
                disabled={submitting || !code}
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
          /* Not Logged In */
          <div className="text-center space-y-4 py-2">
            <p className="text-xs text-slate-300">
              Чтобы авторизовать терминал, сначала войдите в свой аккаунт Zerf Note.
            </p>
            <a
              href={`/?returnTo=${encodeURIComponent(`/cli-auth?code=${code}`)}`}
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-sky-500/20"
            >
              Войти на сайт
            </a>
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
