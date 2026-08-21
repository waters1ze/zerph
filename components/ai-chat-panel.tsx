'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, getAuthHeaders, getTgChatId } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Sparkles, Bot, User, Loader2, X, ChevronLeft, AlertCircle,
  Mic, Terminal, Paperclip, Image as ImageIcon, ArrowRight, ArrowUpRight,
  CheckCircle2, Target, Calendar as CalendarIcon, FileText, BarChart3
} from 'lucide-react'
import type { ChatMessage } from '@/lib/types'

const QUICK_PROMPTS = [
  '📊 Приоритеты задач',
  '🎯 Сводка по целям',
  '⏰ Что просрочено?',
  '📅 План на сегодня',
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

export function AiChatPanel() {
  const { state, dispatch, syncData } = useApp()
  const isOpen = state.isChatOpen
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCommands, setShowCommands] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat, isTyping, imagePreview])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 350)
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
        reply += `\n_Все задачи добавлены в ваш список и синхронизированы с календарем!_`

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

      // Build context from current state
      const context = {
        tasks: state.tasks.slice(0, 25).map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, dueTime: t.dueTime })),
        goals: state.goals.slice(0, 10).map(g => ({ id: g.id, title: g.title, status: g.status, progress: g.progress, deadline: g.deadline })),
        notes: state.notes.slice(0, 8).map(n => ({ id: n.id, title: n.title, type: n.type })),
      }

      // Build messages history
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
          apiKey: state.settings.integrations.groqApiKey || '',
          context,
          model: state.settings.integrations?.aiTaskModels?.chat || state.settings.integrations?.aiModel || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка ИИ-ассистента')
      }

      // If backend created/modified an item, reactively update client store immediately
      if (data.action) {
        if (data.action.type === 'task_created' && data.action.item) {
          dispatch({ type: 'ADD_TASK', task: data.action.item })
        } else if (data.action.type === 'goal_created' && data.action.item) {
          dispatch({ type: 'ADD_GOAL', goal: data.action.item })
        } else if (data.action.type === 'note_created' && data.action.item) {
          dispatch({ type: 'ADD_NOTE', note: data.action.item })
        } else if (data.action.type === 'task_completed' || data.action.type === 'task_deleted' || data.action.type === 'task_updated') {
          syncData()
        }
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
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
          />
        )}
      </AnimatePresence>

      {/* Edge trigger tab */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="trigger-tab"
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
            aria-label="Open AI Chat"
            className={cn(
              'fixed right-0 top-1/2 -translate-y-1/2 z-40',
              'flex items-center justify-center',
              'h-16 w-7',
              'bg-primary text-primary-foreground',
              'rounded-l-xl',
              'shadow-lg shadow-primary/20',
              'hover:w-9 transition-all duration-200 ease-out',
              'border-t border-b border-primary/60',
            )}
          >
            <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sliding panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="chat-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'fixed right-0 top-0 bottom-0 z-40',
              'w-[360px] max-w-[92vw]',
              'flex flex-col',
              'bg-card border-l border-border',
              'shadow-2xl shadow-black/20',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-foreground leading-none">Zerf Note</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-none">
                    Персональный ИИ-ассистент
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-medium text-emerald-400">
                    Live
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Quick prompts */}
            <div className="px-4 pt-3 pb-2 flex gap-1.5 flex-wrap shrink-0 border-b border-border/50">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="mono-emoji">{prompt.slice(0, 2)}</span>
                  <span>{prompt.slice(2)}</span>
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {state.chat.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5',
                    msg.role === 'assistant' ? 'bg-primary/15' : 'bg-muted/80'
                  )}>
                    {msg.role === 'assistant'
                      ? <Bot className="w-3 h-3 text-primary" />
                      : <User className="w-3 h-3 text-muted-foreground" />
                    }
                  </div>
                  <div className={cn(
                    'max-w-[84%] rounded-2xl px-3.5 py-2.5 shadow-xs flex flex-col gap-1',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-background border border-border rounded-tl-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="prose-task text-[12px] leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-[12px] leading-relaxed">{msg.content}</p>
                    )}

                    {/* Interactive Action Card & Direct 1-Click Navigation */}
                    {msg.action && msg.role === 'assistant' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="mt-2.5 p-3 rounded-2xl bg-card/90 border border-primary/30 shadow-md backdrop-blur-md flex flex-col gap-2"
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

                    <p className={cn(
                      'text-[10px] mt-1',
                      msg.role === 'user' ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'
                    )}>
                      {format(parseISO(msg.createdAt), 'HH:mm')}
                    </p>
                  </div>
                </motion.div>
              ))}

              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex gap-2.5 items-center"
                  >
                    <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-background border border-border flex items-center gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
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
                  className="mx-4 mb-2 p-1.5 rounded-2xl bg-popover border border-border shadow-2xl z-20 flex flex-col gap-1 max-h-48 overflow-y-auto"
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Terminal className="w-3 h-3" />
                    <span>Быстрые команды:</span>
                  </div>
                  {filteredCommands.map(c => (
                    <button
                      key={c.cmd}
                      type="button"
                      onClick={() => selectCommand(c.cmd)}
                      className="px-2.5 py-1.5 rounded-xl text-left hover:bg-muted/70 flex items-center justify-between gap-2 transition-colors group"
                    >
                      <span className="font-mono text-xs font-bold text-primary">{c.cmd}</span>
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground truncate">{c.desc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="shrink-0 px-4 pb-4 pt-3 border-t border-border bg-card/80 flex flex-col gap-2">
              {/* Image Preview if selected */}
              <AnimatePresence>
                {imagePreview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                    className="relative self-start rounded-xl overflow-hidden border border-border/80 bg-muted/60 p-1 shadow-sm flex items-center gap-2 max-w-[200px]"
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
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-[10px]"
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

              <div className="flex items-end gap-2 bg-muted/40 rounded-xl border border-border/60 focus-within:border-primary/50 transition-colors px-3 py-2.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5"
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
                  placeholder={selectedImage ? "Добавьте комментарий (необязательно)..." : "Спроси о задачах, целях, вставь скриншот (Ctrl+V) или /..."}
                  rows={1}
                  className="flex-1 text-[12px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed max-h-24"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    dispatch({ type: 'TOGGLE_CHAT' })
                    window.dispatchEvent(new CustomEvent('zerf:open-voice'))
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5"
                  title="Голосовой ввод"
                >
                  <Mic className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => send()}
                  disabled={(!input.trim() && !selectedImage) || isTyping}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5"
                  aria-label="Отправить сообщение"
                >
                  {isTyping
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Send className="w-3 h-3" />}
                </motion.button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 px-0.5 text-center">
                Enter — отправка · Ctrl+V — вставить скриншот · / — команды
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
