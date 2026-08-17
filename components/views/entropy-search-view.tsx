'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Sparkles, Globe, BookOpen, Zap, Code, ArrowRight,
  ExternalLink, Copy, Check, Bookmark, CheckSquare, RotateCcw,
  Clock, Share2, Layers, MessageSquare, ChevronRight, CornerDownLeft,
  AlertCircle, ShieldCheck, Terminal, Heart, Eye, ArrowUpRight,
  FileText, Lightbulb, Compass, Database, Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'
import type { Note, Task } from '@/lib/types'
import type { EntropySearchResult, EntropySource } from '@/app/api/entropy/search/route'

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
  const [activeMode, setActiveMode] = useState<'web' | 'notes' | 'fast' | 'code'>('web')
  const [isLoading, setIsLoading] = useState(false)
  const [searchStep, setSearchStep] = useState<number>(0)
  const [result, setResult] = useState<EntropySearchResult | null>(null)
  const [history, setHistory] = useState<EntropySearchResult[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_entropy_search_history')
        return saved ? JSON.parse(saved) : []
      } catch {}
    }
    return []
  })

  const [tikhonyaMood, setTikhonyaMood] = useState<'normal' | 'happy' | 'thinking' | 'wink'>('normal')
  const [tikhonyaQuote, setTikhonyaQuote] = useState('Тихоня готов исследовать любые темы на максимальной глубине [ ˘ ᴗ ˘ ]')
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [savedAsNote, setSavedAsNote] = useState(false)
  const [savedAsTasks, setSavedAsTasks] = useState(false)
  const [activeSourceHover, setActiveSourceHover] = useState<EntropySource | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

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

  // Tikhonya Mascot Idle Animation
  useEffect(() => {
    if (isLoading) {
      setTikhonyaMood('thinking')
      setTikhonyaQuote('Тихоня краулит первоисточники и синтезирует данные...')
      return
    }

    const timer = setInterval(() => {
      setTikhonyaMood(prev => (prev === 'normal' ? 'wink' : 'normal'))
    }, 4000)
    return () => clearInterval(timer)
  }, [isLoading])

  const handleSearch = async (searchQuery?: string) => {
    const targetQuery = (searchQuery || query).trim()
    if (!targetQuery) return

    setQuery(targetQuery)
    setIsLoading(true)
    setSavedAsNote(false)
    setSavedAsTasks(false)
    setSearchStep(1)

    // Simulate progressive research pipeline steps for delightful UX
    const stepTimer1 = setTimeout(() => setSearchStep(2), 600)
    const stepTimer2 = setTimeout(() => setSearchStep(3), 1200)

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
          focus: activeMode === 'notes' ? 'knowledge_base' : undefined,
        }),
      })

      const data = await res.json()

      if (data.success && data.result) {
        setResult(data.result)
        setTikhonyaMood('happy')
        setTikhonyaQuote(data.result.tikhonyaComment || 'Тихоня успешно синтезировал первоисточники ✧')

        // Save to search history
        setHistory(prev => {
          const next = [data.result, ...prev.filter(item => item.query !== data.result.query)].slice(0, 20)
          try {
            localStorage.setItem('zerf_entropy_search_history', JSON.stringify(next))
          } catch {}
          return next
        })
      } else {
        alert(data.error || 'Не удалось выполнить поиск. Попробуйте еще раз.')
      }
    } catch (e: any) {
      console.error(e)
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

  const handleCopyMarkdown = () => {
    if (!result) return
    let text = `# 🔮 ${result.query}\n\n`
    text += `${result.answer}\n\n`
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

    let noteContent = `${result.answer}\n\n---\n### 📚 Синтезированные первоисточники:\n`
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
    setTikhonyaQuote(item.tikhonyaComment || 'Тихоня открыл сохраненное исследование ✧')
  }

  const handleResetSearch = () => {
    setQuery('')
    setResult(null)
    setTikhonyaMood('normal')
    setTikhonyaQuote('Тихоня готов исследовать новые горизонты [ ˘ ᴗ ˘ ]')
    inputRef.current?.focus()
  }

  // Tikhonya Mascot ASCII Face Render
  const renderTikhonyaAscii = () => {
    switch (tikhonyaMood) {
      case 'thinking':
        return {
          top: '◈',
          face: '[ ◉ ᴗ ◉ ]',
          arms: '/| ◈ |\\',
          body: '/ |   | \\',
          bottom: '~ \'---\' ~',
        }
      case 'happy':
        return {
          top: '✧',
          face: '[ ✧ ᴗ ✧ ]',
          arms: '\\| ◈ |/',
          body: '/ |   | \\',
          bottom: '~ \'---\' ~',
        }
      case 'wink':
        return {
          top: '◈',
          face: '[ ˘ ᴗ ◉ ]',
          arms: '/| ◈ |\\',
          body: '/ |   | \\',
          bottom: '~ \'---\' ~',
        }
      default:
        return {
          top: '◈',
          face: '[ ˘ ᴗ ˘ ]',
          arms: '/| ◈ |\\',
          body: '/ |   | \\',
          bottom: '~ \'---\' ~',
        }
    }
  }

  const mascot = renderTikhonyaAscii()

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 pb-24 text-foreground font-sans">
      {/* ── TOP HEADER / HUB ── */}
      <div className="p-5 md:p-6 rounded-3xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left: Тихоня ASCII Mascot & Persona */}
        <div className="flex items-center gap-4.5 min-w-0">
          {/* Animated Mascot Box */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setTikhonyaMood(prev => (prev === 'normal' ? 'happy' : 'normal'))
              setTikhonyaQuote('Тихоня взмахнул крыльями и передает вам привет! ✧ ٩(ˊᗜˋ*)و ✧')
            }}
            className="font-mono text-[11px] leading-tight text-sky-400 bg-slate-950/90 p-3.5 rounded-2xl border border-sky-500/30 shrink-0 text-center select-none shadow-md cursor-pointer hover:border-sky-400/60 transition-all group"
            title="Нажмите на Тихоню, чтобы поприветствовать его"
          >
            <div className="text-sky-300 group-hover:animate-bounce">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{mascot.top}&nbsp;&nbsp;&nbsp;</div>
            <div className="text-white font-bold">&nbsp;&nbsp;{mascot.face}</div>
            <div className="text-indigo-400">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{mascot.arms}</div>
            <div className="text-sky-400">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{mascot.body}</div>
            <div className="text-indigo-500">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{mascot.bottom}</div>
          </motion.div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold border border-primary/25">
                🔮 Entropy AI v1.0.0
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ◈ Тихоня · Zerf Allay Companion
              </span>
            </div>
            <h1 className="text-base md:text-lg font-bold text-foreground truncate">
              Глубокий исследовательский поиск инсайтов
            </h1>
            <p className="text-xs text-sky-400/90 font-mono flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">{tikhonyaQuote}</span>
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {result && (
            <button
              onClick={handleResetSearch}
              className="px-3 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Новый поиск</span>
            </button>
          )}

          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'extensions' })}
            className="px-3.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground font-medium text-xs flex items-center gap-1.5 border border-border transition-colors cursor-pointer"
            title="Открыть магазин расширений Zerf Note"
          >
            <span>🧩 Магазин расширений</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH BAR & MODE SELECTOR (PERPLEXITY STYLE) ── */}
      <div className="space-y-3">
        {/* Modes Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'web', label: '🌐 Deep Web & Факты', icon: Globe },
            { id: 'notes', label: '📚 Моя база Zerf Note', icon: BookOpen },
            { id: 'fast', label: '⚡ Быстрый синтез', icon: Zap },
            { id: 'code', label: '💻 Код & Архитектура', icon: Code },
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

        {/* Big Search Input Box */}
        <div className="p-2 rounded-2xl bg-card border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-md transition-all flex items-center gap-2">
          <div className="pl-2.5 text-muted-foreground">
            <Search className="w-5 h-5 text-primary/80" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Спросите что угодно: сравнение архитектур, поиск фактов, синтез источников..."
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
            <span>CLI команды: <code className="font-mono text-primary font-bold">/search</code>, <code className="font-mono text-primary font-bold">/entropy</code></span>
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

            {/* Answer Text Body with Highlighted Citations */}
            <div className="prose prose-invert max-w-none text-xs md:text-sm text-foreground/90 leading-relaxed space-y-3 whitespace-pre-line">
              {result.answer}
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

          {/* 4. FOLLOW-UP QUESTIONS (Уточняющие вопросы Perplexity style) */}
          {result.followUpQuestions && result.followUpQuestions.length > 0 && (
            <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-400" />
                <span>Уточнить или продолжить исследование:</span>
              </h4>

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
            </div>
          )}
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
                  className="text-[10px] text-muted-foreground hover:text-rose-400 transition-colors"
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
