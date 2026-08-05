'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Sparkles, Bot, User, Loader2, X, ChevronLeft, AlertCircle } from 'lucide-react'
import type { ChatMessage } from '@/lib/types'

const QUICK_PROMPTS = [
  'Prioritize my tasks',
  'Summarize goals',
  "What's overdue?",
  'Help me plan today',
]

export function AiChatPanel() {
  const { state, dispatch } = useApp()
  const isOpen = state.isChatOpen
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat, isTyping])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [isOpen])

  const send = async () => {
    const text = input.trim()
    if (!text || isTyping) return
    setInput('')
    setError(null)

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_CHAT_MESSAGE', message: userMsg })
    setIsTyping(true)

    const groqApiKey = state.settings.integrations.groqApiKey

    if (!groqApiKey) {
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: `m-${Date.now()}-bot`,
          role: 'assistant',
          content: '⚠️ No Groq API key found. Please go to **Settings → AI & Integrations** and add your free Groq API key from [console.groq.com](https://console.groq.com).',
          createdAt: new Date().toISOString(),
        }
        dispatch({ type: 'ADD_CHAT_MESSAGE', message: botMsg })
        setIsTyping(false)
      }, 400)
      return
    }

    try {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, apiKey: groqApiKey, context }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Unknown error')
      }

      const botMsg: ChatMessage = {
        id: `m-${Date.now()}-bot`,
        role: 'assistant',
        content: data.content,
        createdAt: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_CHAT_MESSAGE', message: botMsg })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      const botMsg: ChatMessage = {
        id: `m-${Date.now()}-err`,
        role: 'assistant',
        content: `❌ **Error:** ${msg}`,
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

  const hasApiKey = !!state.settings.integrations.groqApiKey

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
                  <p className="text-[13px] font-semibold text-foreground leading-none">Zerf AI</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
                    {state.settings.integrations.aiModel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-full border',
                  hasApiKey
                    ? 'bg-[var(--status-done)]/10 border-[var(--status-done)]/20'
                    : 'bg-[var(--priority-high)]/10 border-[var(--priority-high)]/20'
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    hasApiKey ? 'bg-[var(--status-done)]' : 'bg-[var(--priority-high)]'
                  )} />
                  <span className={cn(
                    'text-[11px] font-medium',
                    hasApiKey ? 'text-[var(--status-done)]' : 'text-[var(--priority-high)]'
                  )}>
                    {hasApiKey ? 'Live' : 'No Key'}
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

            {/* No API key warning */}
            {!hasApiKey && (
              <div className="mx-4 mt-3 px-3.5 py-3 rounded-xl bg-[var(--priority-high)]/10 border border-[var(--priority-high)]/20 flex items-start gap-2.5 shrink-0">
                <AlertCircle className="w-4 h-4 text-[var(--priority-high)] shrink-0 mt-0.5" />
                <p className="text-[12px] text-foreground/80 leading-snug">
                  Add your <strong>Groq API key</strong> in Settings to enable real AI responses.
                  Free at <span className="text-primary">console.groq.com</span>
                </p>
              </div>
            )}

            {/* Quick prompts */}
            <div className="px-4 pt-3 pb-2 flex gap-1.5 flex-wrap shrink-0 border-b border-border/50">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus() }}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/50 hover:bg-accent/60 hover:text-foreground hover:border-primary/30 transition-all"
                >
                  {prompt}
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
                    'max-w-[82%] rounded-2xl px-3.5 py-2.5',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-background border border-border rounded-tl-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="prose-task text-[12px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-[12px] leading-relaxed">{msg.content}</p>
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

            {/* Input */}
            <div className="shrink-0 px-4 pb-4 pt-3 border-t border-border bg-card/80">
              <div className="flex items-end gap-2 bg-muted/40 rounded-xl border border-border/60 focus-within:border-primary/50 transition-colors px-3 py-2.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about tasks, goals, notes…"
                  rows={1}
                  className="flex-1 text-[12px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed max-h-24"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={send}
                  disabled={!input.trim() || isTyping}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5"
                  aria-label="Send message"
                >
                  {isTyping
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Send className="w-3 h-3" />}
                </motion.button>
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-0.5">
                Shift+Enter for newline · Powered by Groq llama-3.3-70b
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
