'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface DigestRow {
  id: string
  level: string
  periodStart: string
  periodEnd: string
  text: string
  inputTokens: number
}

const LEVEL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  day: { label: 'День', icon: '☀️', color: '#38bdf8' },
  week: { label: 'Неделя', icon: '🗓', color: '#818cf8' },
  month: { label: 'Месяц', icon: '🌙', color: '#f59e0b' },
  year: { label: 'Год', icon: '🏆', color: '#10b981' },
}

export default function ArchivePage() {
  const [digests, setDigests] = useState<DigestRow[]>([])
  const [stats, setStats] = useState<{ totalTokensSpent: number; totalDigests: number } | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    setAuthToken(
      url.searchParams.get('auth_token') ||
        document.cookie.match(/zerf_auth_token=([^;]+)/)?.[1] ||
        null
    )
    setChatId(
      url.searchParams.get('chatId') ||
        document.cookie.match(/zerf_chat_id=([^;]+)/)?.[1] ||
        null
    )
  }, [])

  useEffect(() => {
    if (!authToken) {
      setLoading(false)
      return
    }
    fetch(`/api/digests${filter ? `?level=${filter}` : ''}`, {
      headers: { 'x-auth-token': authToken },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => {
        setDigests(data.digests || [])
        setStats(data.stats || null)
      })
      .catch(() => setDigests([]))
      .finally(() => setLoading(false))
  }, [authToken, filter])

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  if (!authToken && !loading) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-200 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🗄️</div>
          <h1 className="text-xl font-semibold mb-2">Архив памяти</h1>
          <p className="text-sm opacity-70">
            Открой архив через приложение Zerf Note — нужна авторизованная сессия.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200 p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">🗄️ Архив памяти</h1>
            <p className="text-sm opacity-60 mt-1">
              Дни → недели → месяцы → годы. Ничего не забывается.
            </p>
          </div>
          {stats && (
            <div className="text-xs opacity-60 text-right">
              <div>{stats.totalDigests} дайджестов</div>
              <div>≈{Math.round(stats.totalTokensSpent / 1000)}k токенов всего</div>
            </div>
          )}
        </header>

        <div className="flex gap-2 mb-6 flex-wrap">
          {[null, 'day', 'week', 'month', 'year'].map(l => (
            <button
              key={l || 'all'}
              onClick={() => setFilter(l)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                filter === l
                  ? 'border-sky-400 bg-sky-400/10 text-sky-300'
                  : 'border-white/10 text-slate-400 hover:border-white/25'
              }`}
            >
              {l ? `${LEVEL_LABELS[l].icon} ${LEVEL_LABELS[l].label}` : '✨ Всё'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="opacity-50 animate-pulse">Загрузка…</div>
        ) : digests.length === 0 ? (
          <div className="opacity-50">Пока пусто — дайджесты появятся после первых закрытых дней.</div>
        ) : (
          <ol className="relative border-l border-white/10 ml-3 space-y-6">
            {digests.map(d => {
              const meta = LEVEL_LABELS[d.level]
              return (
                <li key={d.id} className="ml-6">
                  <span
                    className="absolute -left-[9px] w-4 h-4 rounded-full border-2"
                    style={{ background: '#090d16', borderColor: meta.color }}
                  />
                  <div className="flex items-center gap-2 text-xs opacity-60 mb-1">
                    <span>{meta.icon} {meta.label}</span>
                    <span>·</span>
                    <span>{fmtDate(d.periodStart)}</span>
                    {d.inputTokens > 0 && (
                      <>
                        <span>·</span>
                        <span>{d.inputTokens} tok</span>
                      </>
                    )}
                  </div>
                  <article className="rounded-xl bg-white/[0.03] border border-white/10 p-4 prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {d.text || '_без текста_'}
                    </ReactMarkdown>
                  </article>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
