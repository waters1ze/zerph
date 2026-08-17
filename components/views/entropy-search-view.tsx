'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Sparkles, Globe, BookOpen, Zap, Code, ArrowRight,
  ExternalLink, Copy, Check, Bookmark, CheckSquare, RotateCcw,
  Clock, Share2, Layers, MessageSquare, ChevronRight, CornerDownLeft,
  AlertCircle, ShieldCheck, Terminal, Heart, Eye, ArrowUpRight,
  FileText, Lightbulb, Compass, Database, Hash, HelpCircle,
  SlidersHorizontal, Flame, Cpu, GraduationCap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'
import type { Note, Task } from '@/lib/types'
import type { EntropySearchResult, EntropySource } from '@/app/api/entropy/search/route'
import { TikhonyaMascot, type TikhonyaMood } from '@/components/views/tikhonya-mascot'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const STARTER_TOPICS = [
  {
    category: 'AI & Технологии',
    icon: '🔮',
    color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-400',
    queries: [
      'Архитектура MoE vs Dense модели в LLM 2026',
      'Локальный инференс LLM на Apple Silicon и Ollama',
      'Механизм внимания FlashAttention-3 и оптимизация KV-cache',
    ],
  },
  {
    category: 'Продуктивность & Заметки',
    icon: '🧘',
    color: 'from-sky-500/20 to-cyan-500/20 border-sky-500/30 text-sky-400',
    queries: [
      'Методология Zettelkasten vs PARA для базы знаний',
      'Time-blocking и управление дофамином при глубокой работе',
      'Нейробиология сна и циркадные ритмы для фокуса',
    ],
  },
  {
    category: 'Инженерия & Код',
    icon: '💻',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    queries: [
      'Сравнение Rust, Go и Zig для высоконагруженных систем',
      'Архитектура distributed key-value хранилищ',
      'Оптимизация сборки React 19 и Next.js Turbopack',
    ],
  },
  {
    category: 'Стартапы & Продукты',
    icon: '🚀',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
    queries: [
      'Unit-экономика B2B SaaS продуктов и расчет LTV/CAC',
      'Стратегии Product-Led Growth (PLG) для AI стартапов',
      'Фреймворки приоритизации фичей: RICE vs ICE vs Kano',
    ],
  },
]

export function EntropySearchView() {
  const { state, dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [activeMode, setActiveMode] = useState<'web' | 'academic' | 'notes' | 'fast' | 'code'>('web')
  const [isProSearch, setIsProSearch] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [searchStep, setSearchStep] = useState<number>(0)
  const [result, setResult] = useState<EntropySearchResult | null>(null)
  const [usageInfo, setUsageInfo] = useState<{
    used: number
    limit: number
    remaining: number
    isUnlimited: boolean
    plan: string
    pro?: {
      used: number
      limit: number
      remaining: number
      isAllowed: boolean
      isUnlimited: boolean
    }
  } | null>(null)

  const [history, setHistory] = useState<EntropySearchResult[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_entropy_search_history')
        return saved ? JSON.parse(saved) : []
      } catch {}
    }
    return []
  })

  const [tikhonyaMood, setTikhonyaMood] = useState<TikhonyaMood>('normal')
  const [tikhonyaStatus, setTikhonyaStatus] = useState<string>('Тихоня готов исследовать любые темы на максимальной глубине [ ˘ ᴗ ˘ ]')
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [savedAsNote, setSavedAsNote] = useState(false)
  const [savedAsTasks, setSavedAsTasks] = useState(false)
  const [activeSourceHover, setActiveSourceHover] = useState<EntropySource | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const followUpInputRef = useRef<HTMLInputElement>(null)

  // Fetch initial usage limits on mount
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/entropy/search', { headers: getAuthHeaders() })
        const data = await res.json()
        if (data.success && data.usage) {
          setUsageInfo(data.usage)
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
    setTikhonyaMood('thinking')
    setTikhonyaStatus(`Тихоня ищет первоисточники по «${targetQuery}»...`)
    setSearchStep(1)

    // Simulate progressive research pipeline steps for delightful UX
    const stepTimer1 = setTimeout(() => {
      setSearchStep(2)
      setTikhonyaStatus('Тихоня синтезирует факты и проверяет цитаты 🧠')
    }, 600)
    const stepTimer2 = setTimeout(() => {
      setSearchStep(3)
      setTikhonyaStatus('Тихоня структурирует аналитический отчет ✧')
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
          focus: activeMode === 'notes' ? 'knowledge_base' : undefined,
        }),
      })

      const data = await res.json()

      if (data.success && data.result) {
        setResult(data.result)
        if (data.result.usage) {
          setUsageInfo(data.result.usage)
        }
        setTikhonyaMood('happy')
        setTikhonyaStatus(data.result.tikhonyaComment || 'Тихоня успешно синтезировал первоисточники ✧')

        // Save to search history
        setHistory(prev => {
          const next = [data.result, ...prev.filter(item => item.query !== data.result.query)].slice(0, 20)
          try {
            localStorage.setItem('zerf_entropy_search_history', JSON.stringify(next))
          } catch {}
          return next
        })
      } else {
        setTikhonyaMood('normal')
        setTikhonyaStatus(data.error || 'Не удалось выполнить поиск')
        alert(data.error || 'Не удалось выполнить поиск. Проверьте лимиты или попробуйте еще раз.')
      }
    } catch (e: any) {
      console.error(e)
      setTikhonyaMood('normal')
      setTikhonyaStatus('Ошибка связи с поисковым движком')
      alert('Ошибка соединения с поисковым движком Entropy AI')
    } finally {
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
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

  const cleanText = (s: string) =>
    (s || '')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '  ')
      .replace(/\\"/g, '"')
      .trim()

  const handleCopyMarkdown = () => {
    if (!result) return
    let text = `# 🔮 ${result.query}\n\n`
    text += `${cleanText(result.answer)}\n\n`
    if (result.sources.length > 0) {
      text += `### 📚 Источники:\n`
      result.sources.forEach(s => {
        text += `- [${s.id}] [${s.title}](${s.url}) — *${s.domain}*\n`
      })
    }
    navigator.clipboard.writeText(text)
    setCopiedAnswer(true)
    setTimeout(() => setCopiedAnswer(false), 2500)
  }

  const handleSaveToZerfNotes = () => {
    if (!result) return

    let noteContent = `${cleanText(result.answer)}\n\n---\n### 📚 Синтезированные первоисточники:\n`
    result.sources.forEach(s => {
      noteContent += `- **[${s.id}]** [${s.title}](${s.url}) — *${s.domain}*\n  > ${s.snippet}\n`
    })

    if (result.takeaways && result.takeaways.length > 0) {
      noteContent += `\n### 💡 Ключевые выводы:\n`
      result.takeaways.forEach(t => {
        noteContent += `- ${t}\n`
      })
    }

    const newNote: Note = {
      id: `note_entropy_${Date.now()}`,
      title: `🔮 ${result.query}`,
      content: noteContent,
      type: 'note',
      tags: ['entropy', 'ai-research', 'deep-search', activeMode],
      folder: 'Entropy AI',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiGenerated: true,
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
    setQuery(item.query)
    setResult(item)
    setTikhonyaMood('happy')
    setTikhonyaStatus(item.tikhonyaComment || 'Тихоня открыл сохраненное исследование ✧')
  }

  const handleResetSearch = () => {
    setQuery('')
    setResult(null)
    setTikhonyaMood('normal')
    setTikhonyaStatus('Тихоня готов исследовать новые горизонты [ ˘ ᴗ ˘ ]')
    inputRef.current?.focus()
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 pb-24 text-foreground font-sans">
      {/* ── TOP HERO HEADER WITH VISUAL TIKHONYA MASCOT ── */}
      <div className="p-5 md:p-6 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left: 3D Visual Mascot & Persona */}
        <TikhonyaMascot
          mood={tikhonyaMood}
          statusText={tikhonyaStatus}
          size="md"
          onMascotClick={() => {
            setTikhonyaMood('celebrate')
            setTikhonyaStatus('Тихоня взмахнул крыльями и рад вам помочь! ✧ ٩(ˊᗜˋ*)و ✧')
          }}
        />

        {/* Right: Limits & Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Daily Usage Badge */}
          {usageInfo && (
            <div
              className={cn(
                'px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 shadow-2xs transition-all',
                isProSearch
                  ? usageInfo.pro?.isUnlimited
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    : 'bg-primary/15 text-primary border-primary/30'
                  : usageInfo.isUnlimited
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  : usageInfo.remaining > 5
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              )}
              title="Ваши дневные лимиты поисковых запросов Entropy AI"
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
              className="px-3.5 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Новый поиск</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SEARCH BAR & FOCUS MODES (PERPLEXITY PRO STYLE) ── */}
      <div className="space-y-3">
        {/* Focus Modes Pills & Pro Toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'web', label: '🌐 All Web & Факты', icon: Globe },
              { id: 'academic', label: '🔬 Академический (arXiv)', icon: GraduationCap },
              { id: 'notes', label: '📚 База Zerf Note', icon: BookOpen },
              { id: 'code', label: '💻 Код & GitHub', icon: Code },
              { id: 'fast', label: '⚡ Быстрый факт-чекинг', icon: Zap },
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
                : 'bg-muted border-border text-muted-foreground'
            )}
            title="Глубокий многоступенчатый анализ первоисточников"
          >
            <Sparkles className="w-3 h-3" />
            <span>Pro Search</span>
            <span className={cn('w-1.5 h-1.5 rounded-full', isProSearch ? 'bg-primary animate-pulse' : 'bg-muted-foreground')} />
          </button>
        </div>

        {/* Big Perplexity Search Capsule */}
        <div className="p-2.5 rounded-2xl bg-card border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-md transition-all flex items-center gap-2">
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

      {/* ── LOADING PROGRESS ANIMATION ── */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-card border border-primary/30 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span>
                {searchStep === 1 && '🔍 Поиск и краулинг первоисточников...'}
                {searchStep === 2 && '🧠 Фактологический анализ и синтез цитат...'}
                {searchStep === 3 && '✨ Финализация ответа и проверка связей...'}
                {searchStep === 0 && 'Подготовка поискового конвейера...'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-primary font-bold">
              {searchStep === 1 ? '35%' : searchStep === 2 ? '75%' : '95%'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-sky-400 rounded-full"
              initial={{ width: '10%' }}
              animate={{ width: searchStep === 1 ? '35%' : searchStep === 2 ? '75%' : '95%' }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground font-mono">
            Тихоня анализирует публикации на arXiv, GitHub, научные статьи и статьи в Википедии...
          </p>
        </motion.div>
      )}

      {/* ── ACTIVE RESEARCH RESULTS VIEW (PERPLEXITY STYLE) ── */}
      {result && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* 1. SOURCES SECTION (Carousel / Grid) */}
          {result.sources && result.sources.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span>Использованные первоисточники ({result.sources.length})</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Верифицировано движком Entropy
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {result.sources.map(source => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => setActiveSourceHover(source)}
                    onMouseLeave={() => setActiveSourceHover(null)}
                    className="p-3 rounded-2xl bg-card border border-border hover:border-primary/50 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-2 group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold font-mono">
                          [{source.id}]
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate">
                          <span>{source.domain}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {source.title}
                      </h4>
                    </div>

                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {source.snippet}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 2. SYNTHESIZED ANSWER (Markdown & Citations) */}
          <div className="p-6 rounded-3xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  🔮
                </div>
                <h3 className="text-sm md:text-base font-bold text-foreground">
                  Синтез ответа и фактологический разбор
                </h3>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleSaveToZerfNotes}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border',
                    savedAsNote
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                  )}
                  title="Сохранить это исследование как заметку в Zerf Note"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>{savedAsNote ? '✓ Сохранено в Заметки!' : 'В Заметки Zerf'}</span>
                </button>

                <button
                  onClick={handleCreateTasksFromTakeaways}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border',
                    savedAsTasks
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                  )}
                  title="Создать задачи в Zerf Tasks на основе выводов"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{savedAsTasks ? '✓ Задачи созданы!' : 'Создать задачи'}</span>
                </button>

                <button
                  onClick={handleCopyMarkdown}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs border border-border cursor-pointer transition-colors"
                  title="Скопировать ответ с цитатами в буфер"
                >
                  {copiedAnswer ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Answer Text Body with Highlighted Citations & Rich Markdown */}
            <div className="prose prose-invert max-w-none text-xs md:text-sm text-foreground/90 leading-relaxed space-y-3 font-sans">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h3 className="text-base md:text-lg font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/60">{children}</h3>,
                  h2: ({ children }) => <h4 className="text-sm md:text-base font-bold text-foreground mt-3 mb-1.5 text-primary/95">{children}</h4>,
                  h3: ({ children }) => <h5 className="text-xs md:text-sm font-bold text-foreground mt-3 mb-1 flex items-center gap-1.5"><span className="text-primary font-bold">◈</span>{children}</h5>,
                  h4: ({ children }) => <h6 className="text-xs font-bold text-foreground mt-2 mb-1">{children}</h6>,
                  p: ({ children }) => <p className="text-xs md:text-sm text-foreground/90 leading-relaxed mb-3">{children}</p>,
                  ul: ({ children }) => <ul className="space-y-1.5 mb-3 pl-2 list-none">{children}</ul>,
                  ol: ({ children }) => <ol className="space-y-1.5 mb-3 pl-4 list-decimal text-xs md:text-sm text-foreground/90 space-y-1">{children}</ol>,
                  li: ({ children }) => (
                    <li className="flex items-start gap-2 text-xs md:text-sm text-foreground/90 leading-relaxed">
                      <span className="text-primary font-bold mt-1 text-[10px] shrink-0">▪</span>
                      <div className="flex-1">{children}</div>
                    </li>
                  ),
                  strong: ({ children }) => <strong className="font-bold text-foreground font-sans">{children}</strong>,
                  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
                  blockquote: ({ children }) => (
                    <blockquote className="pl-3 py-1 my-2 border-l-2 border-primary/60 bg-primary/5 rounded-r-lg text-xs italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                  code: ({ node, inline, className, children, ...props }: any) => {
                    return (
                      <code className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[11px] text-primary border border-border" {...props}>
                        {children}
                      </code>
                    )
                  },
                  a: ({ href, title, children }) => {
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
                  text: ({ children }) => {
                    if (typeof children === 'string' && /\[\d+\]/.test(children)) {
                      const parts = children.split(/(\[\d+\])/g)
                      return (
                        <>
                          {parts.map((part, pIdx) => {
                            const match = part.match(/^\[(\d+)\]$/)
                            if (match) {
                              const sId = parseInt(match[1], 10)
                              const source = result.sources?.find(s => s.id === sId)
                              return (
                                <a
                                  key={pIdx}
                                  href={source?.url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={source ? `${source.title} (${source.domain})` : `Источник #${sId}`}
                                  className="inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 rounded-md bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground font-mono text-[10px] font-bold border border-primary/30 shadow-2xs transition-all cursor-pointer select-none align-baseline no-underline transform hover:scale-105"
                                >
                                  [{sId}]
                                </a>
                              )
                            }
                            return part
                          })}
                        </>
                      )
                    }
                    return <>{children}</>
                  }
                }}
              >
                {result.answer
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '')
                  .replace(/\\t/g, '  ')
                  .replace(/\\"/g, '"')
                  .replace(/([^\s\[])(\[\d+\])/g, '$1 $2')}
              </ReactMarkdown>
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
                placeholder="Задайте уточняющий вопрос Тихоне..."
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

      {/* ── STARTER TOPICS / INSPIRATION (When idle) ── */}
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
                className={cn(
                  'p-4 rounded-2xl bg-gradient-to-br border shadow-2xs space-y-2.5',
                  group.color
                )}
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
                      className="w-full p-2 rounded-xl bg-card/60 hover:bg-card border border-border/60 hover:border-primary/40 text-left text-xs text-foreground/90 hover:text-foreground font-medium flex items-center justify-between gap-2 transition-all cursor-pointer group"
                    >
                      <span className="truncate">{topic}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
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
                  <button
                    key={hIdx}
                    onClick={() => handleSelectHistoryItem(hItem)}
                    className="p-3 rounded-2xl bg-muted/40 hover:bg-muted border border-border hover:border-primary/40 text-left transition-all cursor-pointer space-y-1 group"
                  >
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {hItem.query}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{hItem.sources.length} источников</span>
                      <span>{new Date(hItem.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
