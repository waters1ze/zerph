'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Sparkles, Globe, BookOpen, Zap, Code, ArrowRight,
  ExternalLink, Copy, Check, Bookmark, CheckSquare, RotateCcw,
  Clock, Share2, Layers, MessageSquare, ChevronRight, CornerDownLeft,
  AlertCircle, ShieldCheck, Terminal, Heart, Eye, ArrowUpRight,
  FileText, Lightbulb, Compass, Database, Hash, HelpCircle,
  SlidersHorizontal, Flame, Cpu, GraduationCap, Bot, Trash2
} from 'lucide-react'
import { cn, isBirthdayTask, isHolidayTask } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'
import type { Note, Task } from '@/lib/types'
import type { EntropySearchResult, EntropySource } from '@/app/api/entropy/search/route'
import { ZerfikMascot, type ZerfikMood } from '@/components/views/tikhonya-mascot'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const STARTER_TOPICS = [
  {
    category: 'AI & Технологии',
    icon: '🔮',
    queries: [
      'Архитектура MoE vs Dense модели в LLM 2026',
      'Локальный инференс LLM на Apple Silicon и Ollama',
      'Механизм внимания FlashAttention-3 и оптимизация KV-cache',
    ],
  },
  {
    category: 'Продуктивность & Базы знаний',
    icon: '📚',
    queries: [
      'Методология Zettelkasten vs PARA для базы знаний',
      'Time-blocking и управление дофамином при глубокой работе',
      'Нейробиология сна и циркадные ритмы для фокуса',
    ],
  },
  {
    category: 'Инженерия & Код',
    icon: '💻',
    queries: [
      'Сравнение Rust, Go и Zig для высоконагруженных систем',
      'Архитектура distributed key-value хранилищ',
      'Оптимизация сборки React 19 и Next.js Turbopack',
    ],
  },
  {
    category: 'Стартапы & Продукты',
    icon: '🚀',
    queries: [
      'Unit-экономика B2B SaaS продуктов и расчет LTV/CAC',
      'Стратегии Product-Led Growth (PLG) для AI стартапов',
      'Фреймворки приоритизации фичей: RICE vs ICE vs Kano',
    ],
  },
]

function formatDynamicModelName(modelId?: string | null): string {
  if (!modelId || typeof modelId !== 'string') return ''
  const trimmed = modelId.trim()
  if (!trimmed) return ''

  // Parse vendor / model parts dynamically
  const parts = trimmed.split('/')
  const vendor = parts.length > 1 ? parts[0] : ''
  const rawModelName = parts[parts.length - 1]

  // Clean and split words
  const words = rawModelName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')

  const formattedWords = words.map(word => {
    const lower = word.toLowerCase()
    if (lower === 'gpt') return 'GPT'
    if (lower === 'oss') return 'OSS'
    if (lower === 'ai') return 'AI'
    if (lower === 'llm') return 'LLM'
    if (lower === 'moe') return 'MoE'
    if (lower === 'r1') return 'R1'
    if (/^v\d+$/i.test(lower)) return lower.toUpperCase()
    if (/^\d+(\.\d+)?b$/i.test(lower)) return lower.toUpperCase()
    return word.charAt(0).toUpperCase() + word.slice(1)
  })

  let result = formattedWords.join(' ')

  if (vendor && vendor.toLowerCase() === 'groq' && !result.toLowerCase().includes('groq')) {
    result = `Groq ${result}`
  }

  return result
}

function PerplexityCitationBadge({
  sourceId,
  sources,
  onOpenNote,
  onOpenTask,
}: {
  sourceId: number
  sources?: EntropySource[]
  onOpenNote?: (id: string) => void
  onOpenTask?: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const sourceList = sources && sources.length > 0 ? sources : []
  
  const initialIdx = Math.max(0, sourceList.findIndex(s => s.id === sourceId))
  const [currentIndex, setCurrentIndex] = useState(initialIdx !== -1 ? initialIdx : 0)

  const currentSource = sourceList[currentIndex] || sourceList.find(s => s.id === sourceId)

  const isNote = currentSource?.type === 'note' || Boolean(currentSource?.noteId)
  const isTask = currentSource?.type === 'task' || Boolean(currentSource?.taskId)

  const cleanDomain = currentSource?.domain
    ? currentSource.domain.replace(/^www\./, '').replace(/^m\./, '')
    : 'источник'

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isNote && currentSource?.noteId && onOpenNote) {
      onOpenNote(currentSource.noteId)
    } else if (isTask && currentSource?.taskId && onOpenTask) {
      onOpenTask(currentSource.taskId)
    } else if (currentSource?.url) {
      window.open(currentSource.url, '_blank', 'noopener,noreferrer')
    }
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : sourceList.length - 1))
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(prev => (prev < sourceList.length - 1 ? prev + 1 : 0))
  }

  return (
    <span
      className="relative inline-block align-baseline mx-0.5"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[11px] font-sans font-medium transition-all cursor-pointer shadow-2xs select-none hover:scale-105 active:scale-95 no-underline align-baseline',
          isNote
            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
            : isTask
            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            : 'bg-muted/70 hover:bg-muted text-foreground/80 hover:text-foreground border-border/80 hover:border-primary/40'
        )}
      >
        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
        <span className="truncate max-w-[110px]">
          {isNote ? 'Заметка' : isTask ? 'Задача' : cleanDomain}
        </span>
        {sourceList.length > 1 && (
          <span className="text-[9px] text-muted-foreground font-mono">+{sourceList.length - 1}</span>
        )}
      </button>

      {/* Perplexity Hover Popover Card */}
      <AnimatePresence>
        {isOpen && currentSource && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-84 p-3.5 rounded-2xl bg-zinc-950/95 border border-zinc-700/80 shadow-2xl backdrop-blur-xl text-left select-text font-sans pointer-events-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header with Navigation and Total Sources count */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1">
                {sourceList.length > 1 && (
                  <div className="flex items-center gap-0.5 mr-1.5">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      title="Предыдущий источник"
                    >
                      <ChevronRight className="w-3 h-3 rotate-180" />
                    </button>
                    <span className="font-mono text-[10px] text-zinc-300">
                      {currentIndex + 1}/{sourceList.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      title="Следующий источник"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-300">
                  <Globe className="w-3 h-3 text-primary shrink-0" />
                  <span className="truncate max-w-[130px]">{cleanDomain}</span>
                </div>
              </div>

              <span className="text-[10px] text-zinc-400 font-mono">
                {sourceList.length} {sourceList.length === 1 ? 'источник' : 'источника'}
              </span>
            </div>

            {/* Source Title */}
            <h5 className="font-bold text-xs text-zinc-100 line-clamp-2 mb-1.5 leading-snug">
              {currentSource.title || `Источник #${currentSource.id}`}
            </h5>

            {/* Snippet / Excerpt */}
            {currentSource.snippet && (
              <p className="text-[11px] text-zinc-300 line-clamp-3 mb-2.5 leading-relaxed bg-zinc-900/90 p-2 rounded-xl border border-zinc-800/80 font-serif italic">
                «{currentSource.snippet}»
              </p>
            )}

            {/* Reliability / Trust Section */}
            <div className="pt-1 space-y-2 border-t border-zinc-800/70">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {isNote
                    ? 'Личная проверенная заметка'
                    : isTask
                    ? 'Активная задача в расписании'
                    : 'Надёжный источник фактов'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                {isNote
                  ? 'Синтезировано из вашей персональной базы знаний Zerf Note.'
                  : isTask
                  ? 'Синтезировано из вашего активного трекера задач Zerf.'
                  : `${cleanDomain} верифицирован поисковым ядром Entropy для точного факт-чекинга.`}
              </p>

              {/* Action Button */}
              {currentSource.url && !isNote && !isTask ? (
                <a
                  href={currentSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 px-3 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Узнать больше на {cleanDomain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : isNote && currentSource.noteId ? (
                <button
                  type="button"
                  onClick={handleClick}
                  className="w-full py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Открыть заметку</span>
                </button>
              ) : isTask && currentSource.taskId ? (
                <button
                  type="button"
                  onClick={handleClick}
                  className="w-full py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>Открыть задачу</span>
                </button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

export function EntropySearchView() {
  const { state, dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [activeMode, setActiveMode] = useState<'web' | 'academic' | 'notes' | 'fast' | 'code'>('web')
  const [searchDepth, setSearchDepth] = useState<'lite' | 'high' | 'max'>('high')
  const [isProSearch, setIsProSearch] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchStep, setSearchStep] = useState<number>(0)
  const [result, setResult] = useState<EntropySearchResult | null>(null)
  const [streamedAnswer, setStreamedAnswer] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const typingTimerRef = useRef<any>(null)
  
  const userSelectedExtensionModel = state.settings.integrations?.aiTaskModels?.extensions || state.settings.integrations?.aiModel

  const [usageInfo, setUsageInfo] = useState<{
    used: number
    limit: number
    remaining: number
    isUnlimited: boolean
    plan: string
    model?: string
    modelDisplayName?: string
    pro?: {
      used: number
      limit: number
      remaining: number
      isAllowed: boolean
      isUnlimited: boolean
    }
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('zerf_entropy_usage_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && typeof parsed === 'object') return parsed
        }
        const savedPlan = localStorage.getItem('zerf_user_plan') || 'creator'
        const isUnlimited = savedPlan === 'pro' || savedPlan === 'corp' || savedPlan === 'creator' || savedPlan === 'admin'
        return {
          used: 0,
          limit: isUnlimited ? -1 : 10,
          remaining: isUnlimited ? 999999 : 10,
          isUnlimited,
          plan: savedPlan,
          model: 'openai/gpt-oss-120b',
          modelDisplayName: 'GPT OSS 120B Flagship',
          pro: {
            used: 0,
            limit: isUnlimited ? -1 : 5,
            remaining: isUnlimited ? 999999 : 5,
            isAllowed: true,
            isUnlimited,
          }
        }
      } catch {}
    }
    return {
      used: 0,
      limit: -1,
      remaining: 999999,
      isUnlimited: true,
      plan: 'creator',
      model: 'openai/gpt-oss-120b',
      modelDisplayName: 'GPT OSS 120B Flagship',
      pro: {
        used: 0,
        limit: -1,
        remaining: 999999,
        isAllowed: true,
        isUnlimited: true,
      }
    }
  })

  const [history, setHistory] = useState<EntropySearchResult[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_entropy_search_history')
        return saved ? JSON.parse(saved) : []
      } catch {}
    }
    return []
  })

  const [zerfikMood, setZerfikMood] = useState<ZerfikMood>('normal')
  const [zerfikStatus, setZerfikStatus] = useState<string>('Зерфик готов исследовать любые темы на максимальной глубине')
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [savedAsNote, setSavedAsNote] = useState(false)
  const [savedAsTasks, setSavedAsTasks] = useState(false)
  const [activeSourceHover, setActiveSourceHover] = useState<EntropySource | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const followUpInputRef = useRef<HTMLInputElement>(null)

  // Dynamic personalized suggestions based on workspace context (birthdays, holidays, tasks, notes, goals)
  const personalizedSuggestions = useMemo(() => {
    const suggestions: string[] = []

    // 1. Check for upcoming birthdays (highest emotional & gift context)
    const birthdayTasks = (state.tasks || []).filter(t => isBirthdayTask(t) && t.status !== 'done')
    if (birthdayTasks.length > 0) {
      const topBday = birthdayTasks[0]
      const cleanName = (topBday.title || '')
        .replace(/^[🎂🎉🎈🎁\s]+/, '')
        .replace(/^(день\s+рождения|др)[\s:]*/i, '')
        .trim() || 'близкого человека'
      suggestions.push(`🎁 Что подарить на день рождения: ${cleanName}? Идеи подарков и поздравлений`)
    }

    // 2. Check for upcoming holidays & celebrations
    const holidayTasks = (state.tasks || []).filter(t => isHolidayTask(t) && !isBirthdayTask(t) && t.status !== 'done')
    if (holidayTasks.length > 0 && suggestions.length < 2) {
      const topHoliday = holidayTasks[0]
      const cleanHoliday = (topHoliday.title || '').replace(/^[🎂🎉🎈🎁\s]+/, '').trim()
      suggestions.push(`🎉 Идеи для празднования и подарков: ${cleanHoliday}`)
    }

    // 3. Check for active goals
    const activeGoals = (state.goals || []).filter(g => g.status !== 'completed')
    if (activeGoals.length > 0 && suggestions.length < 3) {
      const topGoal = activeGoals[0]
      suggestions.push(`🎯 Стратегия и пошаговый план к цели «${topGoal.title.slice(0, 35)}»`)
    }

    // 4. Check for actionable tasks
    const actionableTasks = (state.tasks || []).filter(t => !isBirthdayTask(t) && !isHolidayTask(t) && t.status !== 'done')
    if (actionableTasks.length > 0 && suggestions.length < 3) {
      const topTask = actionableTasks[0]
      const titleLower = (topTask.title || '').toLowerCase()
      const cleanTitle = (topTask.title || '').replace(/^[✓\s\d.-]+/, '').trim()

      if (titleLower.includes('купить') || titleLower.includes('выбрать') || titleLower.includes('заказать')) {
        suggestions.push(`🛍️ Сравнение вариантов и где выгоднее: ${cleanTitle.slice(0, 35)}`)
      } else if (titleLower.includes('поездк') || titleLower.includes('билет') || titleLower.includes('отель') || titleLower.includes('отпуск') || titleLower.includes('путешеств')) {
        suggestions.push(`✈️ Маршрут, лайфхаки и чек-лист поездки: ${cleanTitle.slice(0, 35)}`)
      } else if (titleLower.includes('экзамен') || titleLower.includes('курс') || titleLower.includes('диплом') || titleLower.includes('учеб') || titleLower.includes('книг')) {
        suggestions.push(`🎓 Экспресс-план подготовки и конспект: ${cleanTitle.slice(0, 35)}`)
      } else if (titleLower.includes('код') || titleLower.includes('api') || titleLower.includes('баг') || titleLower.includes('фикс') || titleLower.includes('разработ')) {
        suggestions.push(`💻 Архитектурные паттерны и решения: ${cleanTitle.slice(0, 35)}`)
      } else if (titleLower.includes('тренировк') || titleLower.includes('спорт') || titleLower.includes('зал') || titleLower.includes('бег') || titleLower.includes('питани')) {
        suggestions.push(`💪 Эффективная программа и рекомендации: ${cleanTitle.slice(0, 35)}`)
      } else {
        suggestions.push(`⚡ Чек-лист и лучшие практики для задачи «${cleanTitle.slice(0, 35)}»`)
      }
    }

    // 5. Check for recent user notes
    if (state.notes && state.notes.length > 0 && suggestions.length < 3) {
      const recentNote = state.notes[0]
      if (recentNote.title && recentNote.title.length > 2) {
        suggestions.push(`📝 Синтез первоисточников и фактчекинг: ${recentNote.title.slice(0, 35)}`)
      }
    }

    // 6. Recent search history exploration
    if (history.length > 0 && suggestions.length < 3) {
      const lastQuery = history[0].query
      suggestions.push(`🔍 Углубленный анализ по теме «${lastQuery.slice(0, 35)}»`)
    }

    // 7. Time of day / Trending global topics fallback
    const hour = new Date().getHours()
    if (suggestions.length < 4) {
      if (hour >= 5 && hour < 12) {
        suggestions.push('🌅 Утренний дайджест: главные мировые tech-тренды и наука')
      } else if (hour >= 12 && hour < 18) {
        suggestions.push('⚡ Синтез трендов в разработке, AI и продуктивности на сегодня')
      } else {
        suggestions.push('🌙 Вечерний аналитический обзор ключевых исследований')
      }
    }

    // Fallbacks if user has completely empty workspace
    const fallbacks = [
      'Архитектура MoE vs Dense модели в LLM 2026',
      'Методология Zettelkasten для базы знаний',
      'Сравнение Rust и Go для высоконагруженных сервисов',
    ]

    while (suggestions.length < 3) {
      const nextFallback = fallbacks.shift()
      if (nextFallback && !suggestions.includes(nextFallback)) {
        suggestions.push(nextFallback)
      } else {
        break
      }
    }

    return suggestions.slice(0, 4)
  }, [state.tasks, state.goals, state.notes, history])

  // Fetch initial usage limits on mount and persist
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/entropy/search', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.success && data.usage) {
          setUsageInfo(data.usage)
          try {
            localStorage.setItem('zerf_entropy_usage_cache', JSON.stringify(data.usage))
            if (data.usage.plan) {
              localStorage.setItem('zerf_user_plan', data.usage.plan)
            }
          } catch {}
        }
      } catch {}
    }
    fetchUsage()
  }, [])

  // Auto-focus search on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Listen to open event from elsewhere
  useEffect(() => {
    const handleOpen = () => {
      inputRef.current?.focus()
    }
    window.addEventListener('zerf_open_entropy_search', handleOpen)
    return () => window.removeEventListener('zerf_open_entropy_search', handleOpen)
  }, [])

  const handleSearch = async (searchQuery?: string) => {
    const targetQuery = (searchQuery || query).trim()
    if (!targetQuery) return

    setQuery(targetQuery)
    setIsLoading(true)
    setSavedAsNote(false)
    setSavedAsTasks(false)
    setZerfikMood('thinking')
    setZerfikStatus(`Поиск первоисточников по «${targetQuery}»...`)
    setSearchStep(1)

    const stepTimer1 = setTimeout(() => {
      setSearchStep(2)
      setZerfikStatus('Синтезирую факты и проверяю цитаты...')
    }, 600)
    const stepTimer2 = setTimeout(() => {
      setSearchStep(3)
      setZerfikStatus('Структурирую аналитический отчет...')
    }, 1200)

    try {
      const res = await fetch('/api/entropy/search', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: targetQuery,
          mode: activeMode,
          isPro: isProSearch,
          depth: searchDepth,
          model: userSelectedExtensionModel || undefined,
          userNotes: (state.notes || []).slice(0, 25).map(n => ({
            id: n.id,
            title: n.title,
            content: (n.content || '').slice(0, 500),
            tags: n.tags,
          })),
          userTasks: (state.tasks || []).slice(0, 25).map(t => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            status: t.status,
            tags: t.tags,
          })),
          userGoals: (state.goals || []).slice(0, 10).map(g => ({
            id: g.id,
            title: g.title,
            progress: g.progress,
            deadline: g.deadline,
            status: g.status,
          })),
        }),
      })

      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)

      // ── TRUE LIVE STREAMING: consume SSE tokens as the LLM generates them ──
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let sseBuf = ''
        let accAnswer = ''
        let streamError: string | null = null
        let finalUsage: any = null

        const handleSseEvent = (ev: string, dataStr: string) => {
          let d: any = {}
          try { d = JSON.parse(dataStr) } catch { return }
          if (ev === 'meta') {
            const skeleton: EntropySearchResult = {
              query: d.query,
              mode: d.mode,
              depth: d.depth,
              isPro: d.isPro,
              sources: d.sources || [],
              answer: '',
              takeaways: [],
              followUpQuestions: [],
              tikhonyaComment: 'Зерфик синтезирует ответ...',
              createdAt: new Date().toISOString(),
              usage: d.usage,
            }
            setResult(skeleton)
            if (d.usage) setUsageInfo(d.usage)
            setIsLoading(false)
            setSearchStep(0)
            setIsStreaming(true)
            setStreamedAnswer('')
            setZerfikMood('happy')
            setZerfikStatus('Пишу ответ в прямом эфире...')
          } else if (ev === 'delta') {
            accAnswer += d.t || ''
            setStreamedAnswer(accAnswer)
          } else if (ev === 'extras') {
            setResult(prev => prev ? {
              ...prev,
              takeaways: Array.isArray(d.takeaways) ? d.takeaways : [],
              followUpQuestions: Array.isArray(d.followUpQuestions) ? d.followUpQuestions : [],
              tikhonyaComment: String(d.tikhonyaComment || prev.tikhonyaComment).replace(/тихоня/gi, 'Зерфик'),
            } : prev)
          } else if (ev === 'done') {
            if (d.usage) finalUsage = d.usage
          } else if (ev === 'error') {
            streamError = d.message || 'Ошибка стриминга'
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          sseBuf += decoder.decode(value, { stream: true })
          // Split SSE frames by blank line; each frame's fields by single newline
          const blocks = sseBuf.split(/\r?\n\r?\n/)
          sseBuf = blocks.pop() || ''
          for (const block of blocks) {
            const lines = block.split(/\r?\n/)
            const evLine = lines.find(l => l.startsWith('event:'))
            const dataStr = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('')
            if (evLine && dataStr) handleSseEvent(evLine.slice(6).trim(), dataStr)
          }
        }

        if (streamError) {
          setZerfikMood('normal')
          setZerfikStatus(streamError)
          alert(streamError)
          return
        }

        // Finalize the streamed result
        setResult(prev => prev ? { ...prev, answer: accAnswer } : prev)
        if (finalUsage) setUsageInfo(finalUsage)
        setIsStreaming(false)
        setZerfikStatus(prevStatus => prevStatus)

        // Save to local history
        setHistory(prev => {
          const filtered = prev.filter(h => h.query.toLowerCase() !== targetQuery.toLowerCase())
          const entry = { ...(result || ({} as EntropySearchResult)), query: targetQuery, answer: accAnswer }
          const nextHistory = [entry, ...filtered].slice(0, 30)
          try { localStorage.setItem('zerf_entropy_search_history', JSON.stringify(nextHistory)) } catch {}
          return nextHistory
        })
        return
      }

      const data = await res.json()

      const rawResult = data.result || (data.answer ? data : null)

      if (rawResult) {
        const cleanComment = (rawResult.tikhonyaComment || 'Зерфик завершил глубокое исследование первоисточников')
          .replace(/тихоня/gi, 'Зерфик')
          .replace(/\[\s*[˘ˇ^]\s*[ᴗ◡‿_]\s*[˘ˇ^]\s*\]/g, '')
          .trim()
        const sanitizedResult = { ...rawResult, tikhonyaComment: cleanComment }

        setResult(sanitizedResult)
        setZerfikMood('happy')
        setZerfikStatus(cleanComment)

        if (rawResult.usage) {
          setUsageInfo(rawResult.usage)
        }

        // Save to local history
        setHistory(prev => {
          const filtered = prev.filter(h => h.query.toLowerCase() !== targetQuery.toLowerCase())
          const nextHistory = [sanitizedResult, ...filtered].slice(0, 30)
          try {
            localStorage.setItem('zerf_entropy_search_history', JSON.stringify(nextHistory))
          } catch {}
          return nextHistory
        })
        if (typingTimerRef.current) clearInterval(typingTimerRef.current)

        const fullAnswer = sanitizedResult.answer || ''
        setStreamedAnswer('')
        setIsStreaming(true)

        // Perplexity-style word-by-word streaming: reveal 2–4 words per tick
        const tokens = fullAnswer.split(/(\s+)/)
        let tokenIndex = 0
        const tickMs = Math.max(26, Math.min(70, Math.floor(2800 / Math.max(1, tokens.length))))

        typingTimerRef.current = setInterval(() => {
          const chunk = 2 + Math.floor(Math.random() * 3)
          tokenIndex = Math.min(tokens.length, tokenIndex + chunk)
          setStreamedAnswer(tokens.slice(0, tokenIndex).join(''))
          if (tokenIndex >= tokens.length) {
            clearInterval(typingTimerRef.current)
            typingTimerRef.current = null
            setIsStreaming(false)
          }
        }, tickMs)
      } else {
        setZerfikMood('normal')
        setZerfikStatus(data.error || 'Не удалось выполнить поиск. Попробуйте еще раз.')
        alert(data.error || 'Ошибка поиска')
      }
    } catch (e: any) {
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      if (typingTimerRef.current) clearInterval(typingTimerRef.current)
      setZerfikMood('normal')
      setZerfikStatus('Ошибка сети при поиске. Проверьте соединение.')
      alert('Ошибка при выполнении запроса к поисковому движку')
    } finally {
      setIsLoading(false)
      setSearchStep(0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleCopyAnswer = () => {
    if (!result) return
    navigator.clipboard.writeText(result.answer)
    setCopiedAnswer(true)
    setTimeout(() => setCopiedAnswer(false), 2000)
  }

  const handleSaveAsNote = () => {
    if (!result) return

    let content = `# 🔍 ${result.query}\n\n`
    content += `${result.answer}\n\n`

    if (result.takeaways && result.takeaways.length > 0) {
      content += `### 💡 Ключевые выводы:\n`
      result.takeaways.forEach(t => {
        content += `- ${t}\n`
      })
      content += `\n`
    }

    if (result.sources && result.sources.length > 0) {
      content += `### 🌐 Первоисточники:\n`
      result.sources.forEach(s => {
        content += `[${s.id}] [${s.title}](${s.url}) (${s.domain})\n`
      })
    }

    const newNote: Note = {
      id: `note_entropy_${Date.now()}`,
      title: `[Исследование] ${result.query.slice(0, 60)}`,
      content,
      type: 'note',
      tags: ['entropy', 'ai-search', result.mode],
      pinned: false,
      aiGenerated: true,
      folder: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    dispatch({ type: 'ADD_NOTE', note: newNote })
    setSavedAsNote(true)
    setTimeout(() => setSavedAsNote(false), 3000)
  }

  const handleCreateTasksFromTakeaways = () => {
    if (!result || !result.takeaways || result.takeaways.length === 0) return

    result.takeaways.forEach((takeaway, idx) => {
      const newTask: Task = {
        id: `task_entropy_${Date.now()}_${idx}`,
        title: `[Entropy] ${takeaway.slice(0, 100)}`,
        status: 'todo',
        priority: 'medium',
        tags: ['entropy', 'research'],
        assignees: [],
        isShared: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_TASK', task: newTask })
    })

    setSavedAsTasks(true)
    setTimeout(() => setSavedAsTasks(false), 3000)
  }

  const handleSelectHistoryItem = (item: EntropySearchResult) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    const cleanComment = (item.tikhonyaComment || 'Открыто сохраненное исследование')
      .replace(/тихоня/gi, 'Зерфик')
      .replace(/\[\s*[˘ˇ^]\s*[ᴗ◡‿_]\s*[˘ˇ^]\s*\]/g, '')
      .trim()
    setQuery(item.query)
    setResult({ ...item, tikhonyaComment: cleanComment })
    setStreamedAnswer(item.answer || '')
    setIsStreaming(false)
    setZerfikMood('happy')
    setZerfikStatus(cleanComment)
  }

  const handleDeleteHistoryItem = (indexToDelete: number) => {
    setHistory(prev => {
      const nextHistory = prev.filter((_, idx) => idx !== indexToDelete)
      try {
        localStorage.setItem('zerf_entropy_search_history', JSON.stringify(nextHistory))
      } catch {}
      return nextHistory
    })
  }

  const handleResetSearch = () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    setQuery('')
    setResult(null)
    setStreamedAnswer('')
    setIsStreaming(false)
    setZerfikMood('normal')
    setZerfikStatus('Зерфик готов исследовать новые темы')
    inputRef.current?.focus()
  }

  return (
    <div className="w-full min-h-screen px-3 sm:px-6 md:px-8 py-4 md:py-6 space-y-5 pb-24 text-foreground font-sans max-w-none">
      {/* ── TOP HERO HEADER (PERPLEXITY MINIMALIST STYLE) ── */}
      <div className="p-4 md:p-5 rounded-2xl bg-card/60 border border-border/70 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 relative overflow-hidden backdrop-blur-md">
        {/* Left: Blended Organic Mascot & Status */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ZerfikMascot
            mood={zerfikMood}
            statusText={zerfikStatus}
            size="md"
            onMascotClick={() => {
              setZerfikMood('celebrate')
              setZerfikStatus('Зерфик готов к новым исследованиям!')
            }}
          />
        </div>

        {/* Right: Engine Model Badge & Daily Quotas */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
          {/* Real AI Neural Network Engine Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/80 text-[11px] text-muted-foreground font-mono">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <span>
              {userSelectedExtensionModel
                ? formatDynamicModelName(userSelectedExtensionModel)
                : (usageInfo as any)?.modelDisplayName || (
                  usageInfo?.plan === 'corp' || usageInfo?.plan === 'creator' || usageInfo?.plan === 'admin' || usageInfo?.plan === 'pro' || isProSearch
                    ? 'GPT OSS 120B Flagship'
                    : usageInfo?.plan === 'plus'
                    ? 'Qwen 3.6 27B'
                    : 'Groq Compound Mini'
                )}
            </span>
          </div>

          {/* Daily Usage Badge */}
          {usageInfo && (
            <div
              className={cn(
                'px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-2xs transition-all',
                isProSearch
                  ? usageInfo.pro?.isUnlimited
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-primary/10 text-primary border-primary/20'
                  : usageInfo.isUnlimited
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  : usageInfo.remaining > 5
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              )}
              title="Дневные лимиты поисковых запросов Entropy AI"
            >
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>
                {isProSearch
                  ? usageInfo.pro?.isUnlimited
                    ? '✦ Pro Search: Безлимит'
                    : `⚡ Pro: ${usageInfo.pro?.used ?? 0} / ${usageInfo.pro?.limit ?? 0} сегодня`
                  : usageInfo.isUnlimited
                  ? '✦ Безлимит (Creator / Pro)'
                  : `🔋 ${usageInfo.used} / ${usageInfo.limit} сегодня`}
              </span>
            </div>
          )}

          {result && (
            <button
              onClick={handleResetSearch}
              className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Новый поиск</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SEARCH BAR & FOCUS MODES ── */}
      <div className="space-y-3">
        {/* Focus Modes Pills & Pro Toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'web', label: 'All Web & Факты', icon: Globe },
              { id: 'academic', label: 'Академический (arXiv)', icon: GraduationCap },
              { id: 'notes', label: 'База Zerf Note', icon: BookOpen },
              { id: 'code', label: 'Код & GitHub', icon: Code },
              { id: 'fast', label: 'Быстрый факт-чекинг', icon: Zap },
            ].map(m => {
              const Icon = m.icon
              const active = activeMode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMode(m.id as any)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all shrink-0 cursor-pointer',
                    active
                      ? 'bg-primary/15 border-primary/40 text-primary shadow-xs'
                      : 'bg-card border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>

          {/* Depth / Length Selector */}
          <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-xl border border-border shrink-0">
            {[
              { id: 'lite', label: 'Lite', limit: 'до 400 зн.', Icon: Zap, desc: 'Краткий блиц (до 400 символов)' },
              { id: 'high', label: 'High', limit: 'до 1200 зн.', Icon: Layers, desc: 'Развернутый анализ (800–1200 символов)' },
              { id: 'max',  label: 'Max',  limit: 'до 2500 зн.', Icon: FileText, desc: 'Глубокий отчет-лонгрид (1500–2500 символов)' },
            ].map(d => {
              const Icon = d.Icon
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSearchDepth(d.id as any)}
                  title={`${d.desc} — ${d.limit}`}
                  className={cn(
                    'px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    searchDepth === d.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{d.label}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => {
              if (!isProSearch && usageInfo?.pro && !usageInfo.pro.isAllowed) {
                alert('🔒 Режим Pro Search доступен с тарифом Zerf Plus (3 Pro-поиска в день), Zerf Pro (20 Pro-поисков в день) или Corp (100/день). Перейдите в Настройки для оформления подписки!')
                return
              }
              setIsProSearch(!isProSearch)
            }}
            className={cn(
              'px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer shrink-0',
              isProSearch
                ? 'bg-primary/20 border-primary/40 text-primary'
                : 'bg-muted/40 border-border text-muted-foreground'
            )}
            title="Глубокий многоступенчатый анализ первоисточников"
          >
            <Sparkles className="w-3 h-3" />
            <span>Pro Search</span>
            <span className={cn('w-1.5 h-1.5 rounded-full', isProSearch ? 'bg-primary animate-pulse' : 'bg-muted-foreground')} />
          </button>
        </div>

        {/* Clean Perplexity Search Capsule */}
        <div className="p-2.5 rounded-2xl bg-card border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-xs transition-all flex items-center gap-2">
          <div className="pl-2 text-muted-foreground">
            <Search className="w-5 h-5 text-primary/80" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Спросите что угодно: сравнение архитектур, поиск фактов, синтез первоисточников..."
            className="flex-1 h-10 bg-transparent text-sm md:text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
          />

          <div className="flex items-center gap-1.5 pr-1">
            {query && !isLoading && (
              <button
                onClick={() => setQuery('')}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted text-xs transition-colors"
                title="Очистить поле"
              >
                ✕
              </button>
            )}

            <button
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
              className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Поиск...</span>
                </>
              ) : (
                <>
                  <span>Исследовать</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Personalized Suggestions Pills */}
        {!result && !isLoading && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              💡 Для вас:
            </span>
            {personalizedSuggestions.map((sug: string, sIdx: number) => (
              <button
                key={sIdx}
                onClick={() => handleSearch(sug)}
                className="px-2.5 py-1 rounded-xl bg-card border border-border/80 hover:border-primary/50 text-[11px] text-foreground/80 hover:text-foreground font-medium transition-all shrink-0 cursor-pointer shadow-2xs hover:shadow-xs flex items-center gap-1"
              >
                <span>{sug}</span>
                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Shortcuts bar */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2">
          <div className="flex items-center gap-2">
            <span>Клавиша <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground">Enter</kbd> для запуска</span>
            <span>·</span>
            <span>CLI команда: <code className="font-mono text-primary font-bold">/search</code> или <code className="font-mono text-primary font-bold">/entropy</code></span>
          </div>

          {history.length > 0 && (
            <span className="text-[10px] font-mono">
              В истории: {history.length} исследований
            </span>
          )}
        </div>
      </div>

      {/* Loading state is shown via the mascot status line — no bulky progress slider.
          The answer itself streams live token-by-token once generation starts. */}

      {/* ── ACTIVE RESEARCH RESULTS VIEW (PERPLEXITY STYLE) ── */}
      {result && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* 1. SOURCES — compact Perplexity-style bar with favicon circles */}
          {result.sources && result.sources.length > 0 && (
            <div className="flex items-center gap-2.5 p-2.5 pl-3.5 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-xs font-bold text-foreground shrink-0">Источники</span>

              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
                {result.sources.map(source => {
                  const isInternalNote = source.type === 'note' || Boolean(source.noteId)
                  const isInternalTask = source.type === 'task' || Boolean(source.taskId)
                  const cleanDomain = (source.domain || 'web').replace(/^www\./, '').replace(/^m\./, '')
                  // Deterministic brand-like color per domain
                  const hue = Array.from(cleanDomain).reduce((a, c) => a + c.charCodeAt(0), 0) % 360

                  const handleClick = (e: React.MouseEvent) => {
                    if (isInternalNote && source.noteId) {
                      e.preventDefault()
                      dispatch({ type: 'SET_VIEW', view: 'notes' })
                      dispatch({ type: 'SELECT_NOTE', id: source.noteId })
                    } else if (isInternalTask && source.taskId) {
                      e.preventDefault()
                      dispatch({ type: 'SET_VIEW', view: 'tasks' })
                      dispatch({ type: 'SELECT_TASK', id: source.taskId })
                    }
                  }

                  return (
                    <a
                      key={source.id}
                      href={source.url}
                      target={isInternalNote || isInternalTask ? '_self' : '_blank'}
                      rel="noopener noreferrer"
                      onClick={handleClick}
                      title={`${source.id}. ${source.title || cleanDomain}`}
                      className={cn(
                        'w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border transition-all hover:scale-110 cursor-pointer',
                        isInternalNote
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : isInternalTask
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'border-transparent text-white'
                      )}
                      style={!isInternalNote && !isInternalTask ? { backgroundColor: `hsl(${hue} 55% 42%)` } : undefined}
                    >
                      {isInternalNote ? 'З' : isInternalTask ? '✓' : cleanDomain.charAt(0).toUpperCase()}
                    </a>
                  )
                })}
              </div>

              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {result.sources.length}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </div>
          )}

          {/* 2. SYNTHESIZED ANSWER SECTION */}
          <div className="p-6 md:p-8 rounded-3xl bg-card border border-border/80 shadow-xs space-y-5">
            {/* Header Action Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Синтез ответа и фактологический отчет</h3>
                
                {/* Result Depth Mode Badge */}
                <span className="px-2 py-0.5 rounded-md bg-muted/80 text-foreground border border-border text-[10px] font-bold font-mono flex items-center gap-1">
                  {result.depth === 'lite' ? (
                    <>
                      <Zap className="w-2.5 h-2.5 text-muted-foreground" />
                      <span>Lite (до 400 зн.)</span>
                    </>
                  ) : result.depth === 'max' ? (
                    <>
                      <FileText className="w-2.5 h-2.5 text-muted-foreground" />
                      <span>Max (до 2500 зн.)</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-2.5 h-2.5 text-muted-foreground" />
                      <span>High (до 1200 зн.)</span>
                    </>
                  )}
                </span>

                {result.isPro && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold font-mono flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Pro Search
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyAnswer}
                  className="px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 border border-border transition-colors cursor-pointer"
                  title="Скопировать ответ"
                >
                  {copiedAnswer ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAnswer ? 'Скопировано' : 'Копировать'}</span>
                </button>

                <button
                  onClick={handleSaveAsNote}
                  className="px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 border border-border transition-colors cursor-pointer"
                  title="Сохранить в заметки Zerf Note"
                >
                  <Bookmark className={cn('w-3.5 h-3.5', savedAsNote ? 'text-primary' : '')} />
                  <span>{savedAsNote ? 'Сохранено в заметки!' : 'В заметки'}</span>
                </button>

                {result.takeaways && result.takeaways.length > 0 && (
                  <button
                    onClick={handleCreateTasksFromTakeaways}
                    className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium flex items-center gap-1 border border-primary/20 transition-colors cursor-pointer"
                    title="Создать задачи из выводов"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{savedAsTasks ? 'Задачи созданы!' : 'Создать задачи'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Markdown Rendered Content with Live Citation Badges */}
            <div className="text-sm md:text-base leading-relaxed space-y-3 prose prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mt-4 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold text-foreground mt-3 mb-2 border-b border-border/40 pb-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-bold text-foreground mt-2 mb-1">{children}</h3>,
                  p: ({ children }) => <p className="text-foreground/90 leading-relaxed my-2">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2 text-foreground/90">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2 text-foreground/90">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-3 bg-muted/20 py-1 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  code: ({ node, inline, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline ? (
                      <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 text-xs font-mono overflow-x-auto border border-border/80 my-3">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    ) : (
                      <code className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-xs text-primary font-semibold" {...props}>
                        {children}
                      </code>
                    )
                  },
                  a: ({ href, children, title }) => {
                    if (href?.startsWith('cite:') || href?.startsWith('#cite-')) {
                      const sId = parseInt(href.replace(/^(cite:|#cite-)/, ''), 10)
                      return (
                        <PerplexityCitationBadge
                          key={`cite-${sId}`}
                          sourceId={sId}
                          sources={result.sources}
                          onOpenNote={(noteId) => {
                            dispatch({ type: 'SET_VIEW', view: 'notes' })
                            dispatch({ type: 'SELECT_NOTE', id: noteId })
                          }}
                          onOpenTask={(taskId) => {
                            dispatch({ type: 'SET_VIEW', view: 'tasks' })
                            dispatch({ type: 'SELECT_TASK', id: taskId })
                          }}
                        />
                      )
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={title}
                        className="text-primary hover:underline underline-offset-2 font-medium"
                      >
                        {children}
                      </a>
                    )
                  },
                }}
              >
                {(
                  // While streaming, hide raw [n] fragments (incomplete markdown
                  // links would render as literal "[#2](cite..." text). Once the
                  // answer is complete, [n] becomes a Perplexity-style badge.
                  isStreaming
                    ? streamedAnswer.replace(/\[(\d+)\]/g, '')
                    : (result.answer || '').replace(/\[(\d+)\]/g, '[[#$1]](cite:$1)')
                )
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '')
                  .replace(/\\t/g, '  ')
                  .replace(/\\"/g, '"')}
              </ReactMarkdown>

              {/* Blinking typewriter streaming indicator */}
              {isStreaming && (
                <span className="inline-block w-2 h-4.5 ml-1 bg-primary animate-pulse rounded-xs align-middle" />
              )}
            </div>

            {/* 3. KEY TAKEAWAYS (Инсайты) */}
            {result.takeaways && result.takeaways.length > 0 && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 space-y-2.5 mt-4">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Ключевые выводы и инсайты:</span>
                </h4>
                <ul className="space-y-1.5">
                  {result.takeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-foreground/85 leading-relaxed">
                      <span className="text-primary font-bold mt-0.5">◈</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 4. FOLLOW-UP QUESTIONS & ASK NEXT (Perplexity style) */}
          <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-400" />
              <span>Уточнить или продолжить исследование:</span>
            </h4>

            {result.followUpQuestions && result.followUpQuestions.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
                {result.followUpQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(q)}
                    className="px-3.5 py-2 rounded-2xl bg-muted/60 hover:bg-muted border border-border hover:border-primary/40 text-xs font-medium text-foreground flex items-center justify-between gap-2 transition-all cursor-pointer text-left group"
                  >
                    <span>{q}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Follow-up Question Input Capsule */}
            <div className="p-2 rounded-2xl bg-muted/40 border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 flex items-center gap-2">
              <input
                ref={followUpInputRef}
                type="text"
                placeholder="Задайте уточняющий вопрос Зерфику..."
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSearch(e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
                className="flex-1 h-9 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
              <button
                onClick={() => {
                  if (followUpInputRef.current?.value) {
                    handleSearch(followUpInputRef.current.value)
                    followUpInputRef.current.value = ''
                  }
                }}
                className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>Спросить</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── STARTER TOPICS (SLEEK MINIMALIST CARDS) ── */}
      {!result && !isLoading && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Рекомендуемые темы исследований
            </h3>
            <span className="text-[10px] text-muted-foreground font-mono">
              Нажмите для мгновенного запуска
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {STARTER_TOPICS.map((group, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/40 transition-all shadow-2xs space-y-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{group.icon}</span>
                  <h4 className="text-xs font-bold text-foreground">{group.category}</h4>
                </div>

                <div className="space-y-1.5">
                  {group.queries.map((topic, qIdx) => (
                    <button
                      key={qIdx}
                      onClick={() => handleSearch(topic)}
                      className="w-full p-2.5 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 hover:border-primary/40 text-left text-xs text-foreground/90 hover:text-foreground font-medium flex items-center justify-between gap-2 transition-all cursor-pointer group"
                    >
                      <span className="truncate">{topic}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Research History List if exists */}
          {history.length > 0 && (
            <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3 mt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Недавние исследования ({history.length})</span>
                </h4>
                <button
                  onClick={() => {
                    setHistory([])
                    localStorage.removeItem('zerf_entropy_search_history')
                  }}
                  className="text-[10px] text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Очистить историю
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {history.map((hItem, hIdx) => (
                  <div
                    key={hIdx}
                    onClick={() => handleSelectHistoryItem(hItem)}
                    className="p-3 rounded-2xl bg-muted/40 hover:bg-muted border border-border hover:border-primary/40 text-left transition-all cursor-pointer space-y-1.5 group flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors flex-1 min-w-0">
                        {hItem.query}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteHistoryItem(hIdx)
                        }}
                        className="p-1 rounded-lg hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
                        title="Удалить этот поиск из истории"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{hItem.sources.length} источников</span>
                      <span>{new Date(hItem.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
