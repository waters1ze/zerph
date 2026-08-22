'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, getAuthHeaders, getTgChatId } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn, isTaskOnDate } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Sparkles, Bot, User, Loader2, X, ChevronLeft,
  Mic, Paperclip, ArrowRight, Trash2,
  Copy, Check
} from 'lucide-react'
import type { ChatMessage } from '@/lib/types'

const QUICK_PROMPTS = [
  '📊 Приоритеты задач',
  '🎯 Сводка по целям',
  '⏰ Что просрочено?',
  '📅 План на сегодня',
  '💡 Совет по продуктивности',
]

const COMMANDS = [
  { cmd: '/today', label: 'Задачи на сегодня', desc: 'Список запланированных дел на текущий день' },
  { cmd: '/week', label: 'План на 7 дней', desc: 'Задачи и дедлайны на ближайшую неделю' },
  { cmd: '/goals', label: 'Мои цели', desc: 'Прогресс по активным долгосрочным целям' },
  { cmd: '/notes', label: 'Заметки и идеи', desc: 'Последние сохраненные заметки' },
  { cmd: '/stats', label: 'Аналитика и стрик', desc: 'Продуктивность, стрик дней и статистика' },
  { cmd: '/matrix', label: 'Матрица Эйзенхауэра', desc: 'Срочно / Важно приоритеты' },
  { cmd: '/listen', label: 'Озвучить планы', desc: 'Краткий голосовой AI-брифинг' },
  { cmd: '/help', label: 'Все команды', desc: 'Полное руководство по возможностям ассистента' },
]

/**
 * Custom Markdown Components for Responsive Schedules, Tables & Code Blocks
 */
const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="my-2.5 w-full overflow-x-auto rounded-xl border border-border/80 bg-muted/20 shadow-xs">
      <table className="w-full text-left text-xs border-collapse min-w-[280px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/80 text-[11px] font-bold text-muted-foreground border-b border-border/70 select-none">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-bold tracking-tight text-foreground whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-border/30 text-[12px] text-foreground leading-snug align-top">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-muted/40 transition-colors even:bg-muted/15">{children}</tr>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '')
    if (!inline && match) {
      return (
        <div className="relative my-2 rounded-xl bg-card border border-border overflow-hidden text-xs shadow-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/80 border-b border-border text-[10px] font-mono text-muted-foreground">
            <span>{match[1]}</span>
          </div>
          <pre className="p-3 overflow-x-auto font-mono text-[11px] text-foreground leading-relaxed">
            <code>{children}</code>
          </pre>
        </div>
      )
    }
    return (
      <code className="px-1.5 py-0.5 rounded-md bg-muted/80 font-mono text-[11px] text-primary border border-border/50 font-semibold" {...props}>
        {children}
      </code>
    )
  },
  ul: ({ children }) => <ul className="my-1.5 list-disc pl-4 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal pl-4 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-[12.5px] leading-relaxed text-foreground">{children}</li>,
  p: ({ children }) => <p className="mb-1.5 last:mb-0 text-[12.5px] leading-relaxed text-foreground">{children}</p>,
  h1: ({ children }) => <h1 className="text-sm font-bold text-foreground mt-2.5 mb-1.5 flex items-center gap-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[13px] font-bold text-foreground mt-2 mb-1 flex items-center gap-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-bold text-foreground mt-1.5 mb-1">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/70 pl-3 py-0.5 italic text-muted-foreground bg-muted/20 rounded-r-lg text-xs">
      {children}
    </blockquote>
  ),
}

/**
 * Progressive Typewriter component for assistant messages
 */
function TypewriterMessage({
  content,
  isLatest,
  onTypingProgress,
}: {
  content: string
  isLatest: boolean
  onTypingProgress?: () => void
}) {
  const [displayedLength, setDisplayedLength] = useState(() => (isLatest ? Math.min(20, content.length) : content.length))
  const [isFinished, setIsFinished] = useState(!isLatest || content.length <= 20)

  useEffect(() => {
    if (!isLatest || isFinished || displayedLength >= content.length) {
      setIsFinished(true)
      return
    }

    const timer = setInterval(() => {
      setDisplayedLength(prev => {
        const step = Math.max(6, Math.floor((content.length - prev) / 12) + 6)
        const next = Math.min(content.length, prev + step)
        if (next >= content.length) {
          setIsFinished(true)
          clearInterval(timer)
        }
        if (onTypingProgress) onTypingProgress()
        return next
      })
    }, 18)

    return () => clearInterval(timer)
  }, [content, isLatest, isFinished, displayedLength, onTypingProgress])

  const visibleContent = isFinished ? content : content.slice(0, displayedLength)

  return (
    <div
      onClick={() => {
        if (!isFinished) {
          setDisplayedLength(content.length)
          setIsFinished(true)
        }
      }}
      className="prose-task leading-relaxed text-foreground cursor-pointer select-text"
      title={!isFinished ? 'Нажмите, чтобы показать весь текст' : undefined}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {visibleContent}
      </ReactMarkdown>
      {!isFinished && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary rounded-xs animate-pulse align-middle" />
      )}
    </div>
  )
}

/**
 * Animated Progress & Inspection steps during AI thinking
 */
function AiAnalysisProgress({
  tasksCount,
  contextLabel = 'задач',
  goalsCount,
  notesCount,
}: {
  tasksCount: number
  contextLabel?: string
  goalsCount: number
  notesCount: number
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 350)
    const t2 = setTimeout(() => setStep(2), 850)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const steps = [
    { label: 'Анализирую задачи и расписание...', icon: '📋', progress: 35 },
    { label: 'Изучаю контекст заметок и целей...', icon: '📝', progress: 75 },
    { label: 'Генерирую персональный ответ...', icon: '⚡', progress: 95 },
  ]

  const cur = steps[step] || steps[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex gap-2.5 items-start max-w-[92%]"
    >
      <div className="w-7 h-7 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
        <Sparkles className="w-3.5 h-3.5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <div className="flex-1 p-3 rounded-2xl rounded-tl-xs bg-card border border-border/80 shadow-md flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
            <span>{cur.icon}</span>
            <span>{cur.label}</span>
          </span>
          <span className="text-[10px] font-mono font-bold text-primary shrink-0">
            {cur.progress}%
          </span>
        </div>

        {/* Smooth animated progress bar */}
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-emerald-400 to-primary rounded-full"
            initial={{ width: '20%' }}
            animate={{ width: `${cur.progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Inspected workspace context tags */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Контекст:</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/80 text-foreground border border-border/50">
            📌 {tasksCount} {contextLabel}
          </span>
          {goalsCount > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/80 text-foreground border border-border/50">
              🎯 {goalsCount} целей
            </span>
          )}
          {notesCount > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/80 text-foreground border border-border/50">
              📝 {notesCount} заметок
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function AiChatPanel() {
  const { state, dispatch, syncData } = useApp()
  const confirm = useConfirmDialog()
  const isOpen = state.isChatOpen
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCommands, setShowCommands] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Resizable Width State (Desktop) ──
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_ai_chat_width')
        if (saved) {
          const parsed = Number(saved)
          if (!isNaN(parsed) && parsed >= 340 && parsed <= 1200) return parsed
        }
      } catch {}
    }
    return 460
  })
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(460)

  // Drag resize handler for desktop
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    resizeStartXRef.current = e.clientX
    resizeStartWidthRef.current = panelWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return
      const delta = resizeStartXRef.current - moveEvent.clientX
      const maxW = Math.min(window.innerWidth * 0.85, 950)
      const newW = Math.max(340, Math.min(maxW, resizeStartWidthRef.current + delta))
      setPanelWidth(newW)
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        try {
          localStorage.setItem('zerf_ai_chat_width', String(panelWidth))
        } catch {}
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Quick width presets
  const setQuickWidth = (w: number) => {
    const clamped = Math.min(w, window.innerWidth * 0.88)
    setPanelWidth(clamped)
    try {
      localStorage.setItem('zerf_ai_chat_width', String(clamped))
    } catch {}
  }

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [state.chat, isTyping, imagePreview, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return []
    const q = input.toLowerCase()
    return COMMANDS.filter(c => c.cmd.toLowerCase().startsWith(q) || c.label.toLowerCase().includes(q.slice(1)))
  }, [input])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    setShowCommands(val.startsWith('/') && val.length < 15)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) {
          setSelectedImage(file)
          setImagePreview(URL.createObjectURL(file))
          e.preventDefault()
          break
        }
      }
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectCommand = (cmd: string) => {
    setInput(cmd)
    setShowCommands(false)
    send(cmd)
  }

  const copyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {})
    setCopiedMsgId(msgId)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }

  const clearChatHistory = async () => {
    const ok = await confirm({
      title: 'Очистить историю чата?',
      description: 'Все предыдущие сообщения диалога с ассистентом будут удалены.',
      confirmText: 'Очистить',
      variant: 'danger',
    })
    if (ok) {
      dispatch({ type: 'CLEAR_CHAT' })
    }
  }

  const send = async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : input).trim()
    if ((!text && !selectedImage) || isTyping) return

    const chatId = getTgChatId()
    const token = typeof window !== 'undefined' ? localStorage.getItem('zerf_auth_token') : null
    const initData = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : null
    const vkLaunch = typeof window !== 'undefined' ? localStorage.getItem('zerf_vk_launch') : null
    const isAuthed = Boolean(chatId && !chatId.startsWith('guest_') && (token || initData || vkLaunch))

    if (!isAuthed) {
      window.dispatchEvent(new CustomEvent('zerf_open_auth_modal'))
      return
    }

    setInput('')
    setShowCommands(false)
    setError(null)

    if (selectedImage) {
      const userText = text || '📸 Распознай задачи и расписание на этом изображении'
      const userMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'user',
        content: userText,
        createdAt: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_CHAT_MESSAGE', message: userMsg })
      setIsTyping(true)
      const curImg = selectedImage
      removeImage()

      try {
        const qChatId = getTgChatId() || ''
        const formData = new FormData()
        formData.append('file', curImg)
        if (qChatId) formData.append('chatId', qChatId)

        const res = await fetch('/api/vision/tasks', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Ошибка распознавания')

        const tasks = data.tasks || []
        let reply = `📸 **Распознано элементов:** ${tasks.length}\n\n`
        tasks.forEach((t: any) => {
          const time = t.dueTime ? ` (${t.dueTime})` : ''
          const date = t.dueDate ? ` [${t.dueDate}]` : ''
          reply += `• **${t.title}**${time}${date}\n`
          dispatch({ type: 'ADD_TASK', task: t })
        })
        reply += `\n_Все задачи добавлены в ваш список и синхронизированы!_`

        const botMsg: ChatMessage = {
          id: `m-${Date.now()}-bot`,
          role: 'assistant',
          content: reply,
          createdAt: new Date().toISOString(),
          action: {
            type: 'task_created',
            targetType: 'tasks',
            title: `Распознано ${tasks.length} задач`,
          },
        }
        dispatch({ type: 'ADD_CHAT_MESSAGE', message: botMsg })
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        const botMsg: ChatMessage = {
          id: `m-${Date.now()}-err`,
          role: 'assistant',
          content: `❌ Ошибка распознавания скриншота: ${msg}`,
          createdAt: new Date().toISOString(),
        }
        dispatch({ type: 'ADD_CHAT_MESSAGE', message: botMsg })
      } finally {
        setIsTyping(false)
      }
      return
    }

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_CHAT_MESSAGE', message: userMsg })
    setIsTyping(true)

    try {
      const qChatId = getTgChatId() || ''

      const context = {
        tasks: state.tasks.slice(0, 30).map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, dueTime: t.dueTime })),
        goals: state.goals.slice(0, 12).map(g => ({ id: g.id, title: g.title, status: g.status, progress: g.progress, deadline: g.deadline })),
        notes: state.notes.slice(0, 10).map(n => ({ id: n.id, title: n.title, type: n.type })),
      }

      const messages = state.chat.slice(-10).map(m => ({ role: m.role, content: m.content }))
      messages.push({ role: 'user', content: text })

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {}),
        },
        body: JSON.stringify({
          messages,
          apiKey: state.settings.integrations?.groqApiKey || '',
          context,
          model: state.settings.integrations?.aiTaskModels?.chat || state.settings.integrations?.aiModel || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка ИИ-ассистента')
      }

      const actionsToRun = Array.isArray(data.actions) && data.actions.length > 0 ? data.actions : (data.action ? [data.action] : [])
      let shouldSync = false

      for (const act of actionsToRun) {
        if (act.type === 'task_created' && act.item) {
          dispatch({ type: 'ADD_TASK', task: act.item, skipSync: true })
        } else if (act.type === 'goal_created' && act.item) {
          dispatch({ type: 'ADD_GOAL', goal: act.item, skipSync: true })
        } else if (act.type === 'note_created' && act.item) {
          dispatch({ type: 'ADD_NOTE', note: act.item, skipSync: true })
        } else if (act.type === 'note_deleted') {
          if (act.targetId) {
            dispatch({ type: 'DELETE_NOTE', id: act.targetId })
          } else {
            shouldSync = true
          }
        } else if (act.type === 'goal_deleted') {
          if (act.targetId) {
            dispatch({ type: 'DELETE_GOAL', id: act.targetId })
          } else {
            shouldSync = true
          }
        } else if (act.type === 'task_completed' || act.type === 'task_deleted' || act.type === 'task_updated') {
          if (act.type === 'task_deleted' && act.targetId) {
            dispatch({ type: 'DELETE_TASK', id: act.targetId })
          } else {
            shouldSync = true
          }
        }
      }

      if (shouldSync) {
        syncData()
      }

      const botMsg: ChatMessage = {
        id: `m-${Date.now()}-bot`,
        role: 'assistant',
        content: data.content,
        createdAt: new Date().toISOString(),
        action: data.action,
      }
      dispatch({ type: 'ADD_CHAT_MESSAGE', message: botMsg })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      const botMsg: ChatMessage = {
        id: `m-${Date.now()}-err`,
        role: 'assistant',
        content: `❌ ${msg}`,
        createdAt: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_CHAT_MESSAGE', message: botMsg })
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-xs"
            onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
          />
        )}
      </AnimatePresence>

      {/* Floating Edge Trigger Tab */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="trigger-tab"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
            aria-label="Открыть ИИ-чат"
            className={cn(
              'fixed right-0 top-1/2 -translate-y-1/2 z-40',
              'flex items-center justify-center gap-1',
              'h-16 w-8 sm:w-9',
              'bg-primary text-primary-foreground',
              'rounded-l-2xl shadow-xl shadow-primary/25',
              'hover:w-11 transition-all duration-200 ease-out cursor-pointer',
              'border-t border-b border-l border-primary/60',
            )}
          >
            <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Resizable Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="chat-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100vw' : `${panelWidth}px` }}
            className={cn(
              'fixed right-0 top-0 bottom-0 z-40',
              'max-w-[100vw] sm:max-w-[88vw]',
              'flex flex-col',
              'bg-card/98 border-l border-border/80',
              'shadow-2xl shadow-black/30 backdrop-blur-xl',
            )}
          >
            {/* Desktop Drag Handle */}
            <div
              onMouseDown={handleMouseDownResize}
              className="hidden md:block absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-primary/40 active:bg-primary/70 transition-colors z-50 group"
              title="Перетащите, чтобы изменить ширину окна"
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-card/90 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary/20 to-primary/40 border border-primary/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-foreground truncate">Zerf AI</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Ассистент продуктивности
                  </p>
                </div>
              </div>

              {/* Header Actions & Presets */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Desktop Width Switchers */}
                <div className="hidden sm:flex items-center gap-0.5 mr-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
                  <button
                    onClick={() => setQuickWidth(420)}
                    className={cn(
                      'px-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer',
                      panelWidth <= 480 ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Компактный вид (420px)"
                  >
                    420
                  </button>
                  <button
                    onClick={() => setQuickWidth(650)}
                    className={cn(
                      'px-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer',
                      panelWidth > 480 && panelWidth <= 720 ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Стандартный вид с таблицами (650px)"
                  >
                    650
                  </button>
                  <button
                    onClick={() => setQuickWidth(880)}
                    className={cn(
                      'px-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer',
                      panelWidth > 720 ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Широкое рабочее окно (880px)"
                  >
                    880
                  </button>
                </div>

                <button
                  onClick={clearChatHistory}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                  title="Очистить историю чата"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Закрыть чат"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Quick Prompts Bar */}
            <div className="px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0 border-b border-border/50 bg-card/60 no-scrollbar">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1 shrink-0 cursor-pointer select-none"
                >
                  <span className="mono-emoji">{prompt.slice(0, 2)}</span>
                  <span>{prompt.slice(2)}</span>
                </button>
              ))}
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 select-text">
              {state.chat.map((msg, idx) => {
                const isUser = msg.role === 'user'
                const isLatestBot = !isUser && idx === state.chat.length - 1

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn('flex gap-2.5 group', isUser ? 'flex-row-reverse' : 'flex-row')}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        'w-7 h-7 rounded-xl shrink-0 flex items-center justify-center mt-0.5 shadow-xs select-none',
                        isUser ? 'bg-primary/20 text-primary' : 'bg-gradient-to-tr from-primary/20 to-primary/30 text-primary border border-primary/20'
                      )}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-4 py-3 shadow-xs flex flex-col gap-1 relative',
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-xs selection:bg-white selection:text-slate-950 font-medium'
                          : 'bg-background border border-border/80 rounded-tl-xs selection:bg-primary/25 selection:text-foreground'
                      )}
                    >
                      {/* Copy action button */}
                      <button
                        onClick={() => copyMessage(msg.id, msg.content)}
                        className={cn(
                          'absolute top-2 right-2 p-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer',
                          isUser ? 'hover:bg-primary-foreground/20 text-primary-foreground/80' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        )}
                        title="Скопировать текст"
                      >
                        {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>

                      {/* Content */}
                      {isUser ? (
                        <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap selection:bg-white selection:text-slate-950">
                          {msg.content}
                        </p>
                      ) : (
                        <TypewriterMessage
                          content={msg.content}
                          isLatest={isLatestBot}
                          onTypingProgress={scrollToBottom}
                        />
                      )}

                      {/* Interactive Action Card & Direct 1-Click Navigation */}
                      {msg.action && !isUser && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="mt-2.5 p-3 rounded-xl bg-card border border-primary/30 shadow-md flex flex-col gap-2 select-none"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              {msg.action.type === 'goal_created'
                                ? 'Цель создана'
                                : msg.action.type === 'note_created'
                                ? 'Заметка сохранена'
                                : msg.action.type === 'task_completed'
                                ? 'Выполнено'
                                : msg.action.type === 'task_deleted'
                                ? 'Удалено'
                                : msg.action.type === 'stats_summary'
                                ? 'Сводка'
                                : 'Задача добавлена'}
                            </span>
                            {msg.action.priority && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">
                                {msg.action.priority === 'urgent'
                                  ? '🔴 Срочно'
                                  : msg.action.priority === 'high'
                                  ? '🟠 Высокий'
                                  : '🟢 Средний'}
                              </span>
                            )}
                          </div>
                          {msg.action.title && (
                            <p className="text-xs font-bold text-foreground truncate">
                              {msg.action.title}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const targetView = msg.action?.targetType || 'tasks'
                              dispatch({ type: 'SET_VIEW', view: targetView as any })
                              if (window.innerWidth < 768) {
                                dispatch({ type: 'TOGGLE_CHAT' })
                              }
                            }}
                            className="mt-1 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer group"
                          >
                            <span>
                              {msg.action.targetType === 'goals'
                                ? '🎯 Открыть в Целях'
                                : msg.action.targetType === 'notes'
                                ? '📝 Открыть в Заметках'
                                : msg.action.targetType === 'stats'
                                ? '📊 Открыть Аналитику'
                                : msg.action.targetType === 'today'
                                ? '📅 Открыть План на сегодня'
                                : '↗️ Перейти к задаче'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </motion.div>
                      )}

                      {/* Timestamp */}
                      <p
                        className={cn(
                          'text-[9.5px] mt-1 select-none font-mono',
                          isUser ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
                        )}
                      >
                        {format(parseISO(msg.createdAt), 'HH:mm')}
                      </p>
                    </div>
                  </motion.div>
                )
              })}

              {/* Animated Analysis & Progress Indicator */}
              <AnimatePresence>
                {isTyping && (() => {
                  const lastUserMsg = state.chat.slice().reverse().find(m => m.role === 'user')?.content || ''
                  const qLower = lastUserMsg.toLowerCase()
                  const todayYmd = format(new Date(), 'yyyy-MM-dd')
                  const tomorrowYmd = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')

                  let relevantTasksCount = state.tasks.filter(t => t.status !== 'done').length
                  let contextLabel = 'активных задач'

                  if (qLower.includes('завтра') || qLower.includes('завтрашн')) {
                    const tomorrowTasks = state.tasks.filter(t => t.dueDate === tomorrowYmd || isTaskOnDate(t, tomorrowYmd, tomorrowYmd))
                    relevantTasksCount = tomorrowTasks.length
                    contextLabel = 'на завтра'
                  } else if (qLower.includes('сегодня') || qLower.includes('сегодняшн')) {
                    const todayTasks = state.tasks.filter(t => t.dueDate === todayYmd || !t.dueDate || isTaskOnDate(t, todayYmd, todayYmd))
                    relevantTasksCount = todayTasks.length
                    contextLabel = 'на сегодня'
                  }

                  return (
                    <AiAnalysisProgress
                      tasksCount={relevantTasksCount}
                      contextLabel={contextLabel}
                      goalsCount={state.goals.length}
                      notesCount={state.notes.length}
                    />
                  )
                })()}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            {/* Command Autocomplete Popover */}
            <AnimatePresence>
              {showCommands && filteredCommands.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mx-4 mb-2 p-1.5 rounded-2xl bg-popover/98 border border-border shadow-2xl z-20 flex flex-col gap-1 max-h-48 overflow-y-auto backdrop-blur-md"
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span>Быстрые команды:</span>
                  </div>
                  {filteredCommands.map(c => (
                    <button
                      key={c.cmd}
                      type="button"
                      onClick={() => selectCommand(c.cmd)}
                      className="px-2.5 py-1.5 rounded-xl text-left hover:bg-muted/80 flex items-center justify-between gap-2 transition-colors group cursor-pointer"
                    >
                      <span className="font-mono text-xs font-bold text-primary">{c.cmd}</span>
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground truncate">{c.desc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Footer */}
            <div className="shrink-0 px-4 pb-4 pt-3 border-t border-border/80 bg-card/90 flex flex-col gap-2">
              {/* Image Preview */}
              <AnimatePresence>
                {imagePreview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                    className="relative self-start rounded-xl overflow-hidden border border-border bg-muted/60 p-1 shadow-sm flex items-center gap-2 max-w-[220px]"
                  >
                    <img src={imagePreview} alt="Selected" className="w-12 h-12 object-cover rounded-lg" />
                    <div className="flex-1 min-w-0 pr-1">
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {selectedImage?.name || 'Скриншот'}
                      </p>
                      <p className="text-[9px] text-muted-foreground">Vision OCR</p>
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors text-[10px] cursor-pointer"
                      title="Удалить скриншот"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />

              <div className="flex items-end gap-2 bg-muted/40 rounded-2xl border border-border/80 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all px-3 py-2.5 shadow-xs">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5 cursor-pointer"
                  title="Прикрепить скриншот или фото расписания"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </motion.button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={selectedImage ? "Добавьте комментарий..." : "Спроси о задачах, расписании, вставь скриншот (Ctrl+V) или /..."}
                  rows={1}
                  className="flex-1 text-[12.5px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed max-h-28"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'TOGGLE_CHAT' })
                    window.dispatchEvent(new CustomEvent('zerf:open-voice'))
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5 cursor-pointer"
                  title="Голосовой ввод"
                >
                  <Mic className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => send()}
                  disabled={(!input.trim() && !selectedImage) || isTyping}
                  className="w-7 h-7 flex items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5 cursor-pointer shadow-xs"
                  aria-label="Отправить сообщение"
                >
                  {isTyping
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />}
                </motion.button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 px-1 text-center select-none">
                Enter — отправить · Ctrl+V — скриншот · Перетащите левый край для ширины
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
