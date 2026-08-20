'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, getAuthHeaders, getTgChatId } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Sparkles, Bot, User, Trash2, Loader2, Paperclip, X,
  Image as ImageIcon, ArrowRight, CheckCircle2, Target, Calendar as CalendarIcon, FileText, BarChart3
} from 'lucide-react'
import type { ChatMessage } from '@/lib/types'

const QUICK_PROMPTS = [
  '📊 Приоритеты задач',
  '🎯 Сводка по целям',
  '⏰ Что просрочено?',
  '📅 План на сегодня',
]

export function ChatView() {
  const { state, dispatch, syncData } = useApp()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat, isTyping, imagePreview])

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

  const send = async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : input).trim()
    if ((!text && !selectedImage) || isTyping) return
    setInput('')

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
        reply += `\n_Все задачи добавлены в ваш список и календарь!_`

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
        const botMsg: ChatMessage = {
          id: `m-${Date.now()}-err`,
          role: 'assistant',
          content: `❌ **Ошибка:** ${msg}`,
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
        tasks: state.tasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate })),
        goals: state.goals.slice(0, 10).map(g => ({ id: g.id, title: g.title, status: g.status, progress: g.progress, deadline: g.deadline })),
        notes: state.notes.slice(0, 5).map(n => ({ id: n.id, title: n.title, type: n.type })),
      }

      // Build messages history (last 10 for context)
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

      // Reactive update client store if item was created/modified
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
      const botMsg: ChatMessage = {
        id: `m-${Date.now()}-err`,
        role: 'assistant',
        content: `❌ **Ошибка:** ${msg}`,
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
    <div className="flex flex-col h-full max-w-3xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">Zerf Note AI</p>
            <p className="text-[11px] text-muted-foreground">Интеллектуальный ИИ-ассистент продуктивности</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--status-done)]/10 border border-[var(--status-done)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-done)] animate-pulse" />
            <span className="text-[11px] text-[var(--status-done)] font-bold">Online</span>
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 mb-4 flex-wrap shrink-0">
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => send(prompt)}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-muted/60 text-muted-foreground border border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="mono-emoji">{prompt.slice(0, 2)}</span>
            <span>{prompt.slice(2)}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {state.chat.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            {/* Avatar */}
            <div className={cn(
              'w-7 h-7 rounded-xl shrink-0 flex items-center justify-center mt-0.5',
              msg.role === 'assistant' ? 'bg-primary/15' : 'bg-muted/80'
            )}>
              {msg.role === 'assistant'
                ? <Bot className="w-3.5 h-3.5 text-primary" />
                : <User className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </div>

            {/* Bubble */}
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3 flex flex-col gap-1 shadow-xs',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-card border border-border rounded-tl-sm'
            )}>
              {msg.role === 'assistant' ? (
                <div className="prose-task text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed">{msg.content}</p>
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
                'text-[10px] mt-1.5',
                msg.role === 'user' ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'
              )}>
                {format(parseISO(msg.createdAt), 'HH:mm')}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-3 items-center"
            >
              <div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
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

      {/* Input */}
      <div className="shrink-0 pt-3 mt-2 border-t border-border flex flex-col gap-2">
        {/* Image Preview if selected */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 4 }}
              className="relative self-start rounded-xl overflow-hidden border border-border/80 bg-muted/60 p-1 shadow-sm flex items-center gap-2 max-w-[220px]"
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
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-0.5"
            title="Прикрепить скриншот или фото расписания"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </motion.button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={selectedImage ? "Добавьте комментарий (необязательно)..." : "Спроси о задачах, целях, вставь скриншот (Ctrl+V)..."}
            rows={1}
            className="flex-1 text-[13px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed max-h-28"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => send()}
            disabled={(!input.trim() && !selectedImage) || isTyping}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5"
          >
            {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </motion.button>
        </div>
        <p className="text-[11px] text-muted-foreground/50 px-1">
          Enter — отправка · Ctrl+V — вставить скриншот из буфера
        </p>
      </div>
    </div>
  )
}
