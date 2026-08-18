'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Sparkles, Clock, Shuffle, Check } from 'lucide-react'
import { EMOJI_CATEGORIES, ALL_EMOJIS, type EmojiCategory } from '@/lib/emoji-data'
import { cn } from '@/lib/utils'

interface EmojiPickerModalProps {
  isOpen: boolean
  currentEmoji?: string
  onSelect: (emoji: string) => void
  onClose: () => void
  title?: string
}

const EMOJI_FONT_STYLE = {
  fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', 'Twemoji Mozilla', 'Segoe UI Symbol', sans-serif",
}

export function EmojiPickerModal({
  isOpen,
  currentEmoji = '👤',
  onSelect,
  onClose,
  title = 'Выберите эмодзи для профиля'
}: EmojiPickerModalProps) {
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string>(EMOJI_CATEGORIES[0].id)
  const [customEmojiInput, setCustomEmojiInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Recent Emojis (stored in localStorage)
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_recent_emojis')
        return saved ? JSON.parse(saved) : ['🤖', '⚡', '🧠', '🔮', '✨', '💻', '🔥', '👑']
      } catch {}
    }
    return ['🤖', '⚡', '🧠', '🔮', '✨', '💻', '🔥', '👑']
  })

  // Auto-focus search when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle selection and save to recent
  const handleEmojiClick = (emoji: string) => {
    if (!emoji) return
    const nextRecents = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 16)
    setRecentEmojis(nextRecents)
    try {
      localStorage.setItem('zerf_recent_emojis', JSON.stringify(nextRecents))
    } catch {}
    onSelect(emoji)
    onClose()
  }

  // Filtered emojis based on search or active category
  const displayedEmojis = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      const activeCat = EMOJI_CATEGORIES.find(c => c.id === activeCategoryId)
      return activeCat ? activeCat.emojis : ALL_EMOJIS
    }

    // Match across all categories or emoji directly
    return ALL_EMOJIS.filter(e => {
      if (e.includes(query)) return true
      // Category keywords search
      const parentCategory = EMOJI_CATEGORIES.find(c => c.emojis.includes(e))
      if (parentCategory && parentCategory.name.toLowerCase().includes(query)) return true
      return false
    })
  }, [search, activeCategoryId])

  const handleRandomPick = () => {
    const random = ALL_EMOJIS[Math.floor(Math.random() * ALL_EMOJIS.length)]
    handleEmojiClick(random)
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customEmojiInput.trim()) {
      handleEmojiClick(customEmojiInput.trim().slice(0, 4))
      setCustomEmojiInput('')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-foreground font-sans"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shadow-xs shrink-0 select-none"
                style={EMOJI_FONT_STYLE}
              >
                {currentEmoji}
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">{title}</h3>
                <p className="text-[11px] text-muted-foreground">Более 1000 цветных эмодзи: ИИ, нейросети, киберпанк и др.</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleRandomPick}
                className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground hover:text-primary transition-colors cursor-pointer touch-manipulation"
                title="Случайный эмодзи"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer touch-manipulation"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar & Custom Input */}
          <div className="p-3.5 border-b border-border/80 space-y-2.5 bg-card">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 px-3 rounded-xl bg-muted/40 border border-border flex items-center gap-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск эмодзи (нейросеть, код, огонь, кот...)"
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-xs text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Direct Emoji Paste input */}
              <form onSubmit={handleCustomSubmit} className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={customEmojiInput}
                  onChange={e => setCustomEmojiInput(e.target.value)}
                  placeholder="Свой"
                  maxLength={4}
                  className="w-14 h-9 px-2 text-center rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary"
                  title="Вставить любой свой эмодзи"
                />
                <button
                  type="submit"
                  disabled={!customEmojiInput.trim()}
                  className="h-9 px-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs disabled:opacity-40 cursor-pointer shrink-0"
                >
                  ОК
                </button>
              </form>
            </div>

            {/* Category Navigation Pills without scrollbar */}
            {!search && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {EMOJI_CATEGORIES.map(cat => {
                  const active = activeCategoryId === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer touch-manipulation',
                        active
                          ? 'bg-primary/15 text-primary border border-primary/30 shadow-2xs'
                          : 'bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent'
                      )}
                      title={cat.name}
                    >
                      <span style={EMOJI_FONT_STYLE}>{cat.icon}</span>
                      <span className="text-[11px] hidden sm:inline">{cat.name.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Emojis Grid Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[380px] [scrollbar-width:thin]">
            {/* Recent Emojis Section */}
            {!search && recentEmojis.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-primary" />
                    <span>Недавние эмодзи</span>
                  </span>
                  <span className="text-[9px] font-mono">{recentEmojis.length} шт.</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {recentEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEmojiClick(emoji)}
                      style={EMOJI_FONT_STYLE}
                      className={cn(
                        'h-10 rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer hover:bg-muted hover:scale-110 select-none touch-manipulation',
                        'grayscale contrast-125 opacity-80 hover:opacity-100 hover:grayscale-0',
                        currentEmoji === emoji ? 'bg-primary/20 border border-primary/40 opacity-100' : 'bg-card border border-border/40'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Category / Search Results */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
                <span>
                  {search
                    ? `Результаты поиска (${displayedEmojis.length})`
                    : EMOJI_CATEGORIES.find(c => c.id === activeCategoryId)?.name || 'Все эмодзи'}
                </span>
                <span className="text-[9px] font-mono">
                  {displayedEmojis.length} эмодзи (Ч/Б)
                </span>
              </div>

              {displayedEmojis.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Эмодзи не найдены. Попробуйте другой запрос или введите эмодзи вручную в поле «Свой».
                </div>
              ) : (
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
                  {displayedEmojis.map((emoji, idx) => {
                    const isSelected = currentEmoji === emoji
                    return (
                      <button
                        key={idx}
                        onClick={() => handleEmojiClick(emoji)}
                        style={EMOJI_FONT_STYLE}
                        className={cn(
                          'h-10 rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer hover:bg-muted/80 hover:scale-115 active:scale-95 select-none relative group touch-manipulation',
                          'grayscale contrast-125 opacity-80 hover:opacity-100 hover:grayscale-0',
                          isSelected
                            ? 'bg-primary/20 border-2 border-primary shadow-xs opacity-100'
                            : 'bg-muted/20 hover:bg-muted/50 border border-transparent'
                        )}
                        title={emoji}
                      >
                        <span>{emoji}</span>
                        {isSelected && (
                          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border/80 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span className="text-[11px]">Нажмите на эмодзи для мгновенной установки</span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
