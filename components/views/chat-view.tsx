'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Sparkles, Bot, User, Trash2, Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/lib/types'

export function ChatView() {
  const { state, dispatch } = useApp()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.chat, isTyping])

  const send = async () => {
    const text = input.trim()
    if (!text || isTyping) return
    setInput('')

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

  return (
    <div className="flex flex-col h-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">Nexus AI</p>
            <p className="text-[11px] text-muted-foreground">Your intelligent work assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--status-done)]/10 border border-[var(--status-done)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-done)]" />
            <span className="text-[11px] text-[var(--status-done)] font-medium">Online</span>
          </div>
          <span className="text-[11px] text-muted-foreground/60">{state.settings.integrations.aiModel}</span>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 mb-4 flex-wrap shrink-0">
        {[
          'Prioritize my tasks today',
          'Summarize my goals',
          "What's overdue?",
          'Help me write a note',
        ].map(prompt => (
          <button
            key={prompt}
            onClick={() => { setInput(prompt); inputRef.current?.focus() }}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-muted/60 text-muted-foreground border border-border/50 hover:bg-accent/50 hover:text-foreground hover:border-primary/30 transition-all"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {state.chat.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            {/* Avatar */}
            <div className={cn(
              'w-7 h-7 rounded-xl shrink-0 flex items-center justify-center',
              msg.role === 'assistant' ? 'bg-primary/15' : 'bg-muted/80'
            )}>
              {msg.role === 'assistant'
                ? <Bot className="w-3.5 h-3.5 text-primary" />
                : <User className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </div>

            {/* Bubble */}
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-card border border-border rounded-tl-sm'
            )}>
              {msg.role === 'assistant' ? (
                <div className="prose-task text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed">{msg.content}</p>
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
      <div className="shrink-0 pt-4 mt-2 border-t border-border">
        <div className="flex items-end gap-2 bg-muted/40 rounded-xl border border-border/60 focus-within:border-primary/50 transition-colors px-3 py-2.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your tasks, goals, or notes…"
            rows={1}
            className="flex-1 text-[13px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed max-h-28"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={send}
            disabled={!input.trim() || isTyping}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0 mb-0.5"
          >
            {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </motion.button>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-1.5 px-1">
          Shift+Enter for newline &nbsp;·&nbsp; Backend integration ready — connect your AI API key in Settings
        </p>
      </div>
    </div>
  )
}
