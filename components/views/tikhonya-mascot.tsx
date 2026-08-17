'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Sparkles, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ZerfikMood = 'normal' | 'thinking' | 'happy' | 'wink' | 'celebrate'
export type TikhonyaMood = ZerfikMood

interface ZerfikMascotProps {
  mood?: ZerfikMood
  statusText?: string
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  showSpeechBubble?: boolean
  className?: string
  onMascotClick?: () => void
}

const ZERFIK_QUOTES = [
  'Зерфик готов исследовать любые темы на максимальной глубине',
  'Синтезирую проверенные первоисточники и цитирую факты',
  'Нейросетевой анализ активирован, данные структурированы',
  'Спросите меня о чем угодно: архитектура, наука, код или заметки',
  'Зерфик синхронизирует аналитику с вашими проектами и задачами',
]

export function ZerfikMascot({
  mood = 'normal',
  statusText,
  size = 'md',
  interactive = true,
  showSpeechBubble = true,
  className,
  onMascotClick,
}: ZerfikMascotProps) {
  const [currentMood, setCurrentMood] = useState<ZerfikMood>(mood)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    setCurrentMood(mood)
  }, [mood])

  const handleClick = () => {
    setQuoteIndex(prev => (prev + 1) % ZERFIK_QUOTES.length)
    setCurrentMood('celebrate')
    setTimeout(() => setCurrentMood(mood), 1600)
    if (onMascotClick) onMascotClick()
  }

  const dimensions = {
    sm: { width: 48, height: 48, aura: 64 },
    md: { width: 72, height: 72, aura: 96 },
    lg: { width: 100, height: 100, aura: 130 },
  }[size]

  const isThinking = currentMood === 'thinking'

  return (
    <div className={cn('flex items-center gap-3.5 select-none relative', className)}>
      {/* ── Seamless Organic Mascot Avatar (Blended into UI) ── */}
      <div
        className="relative cursor-pointer group shrink-0 flex items-center justify-center"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: dimensions.aura, height: dimensions.aura }}
      >
        {/* Ambient Radial Soft Glow */}
        <motion.div
          animate={{
            scale: isThinking ? [1, 1.35, 1] : [1, 1.15, 1],
            opacity: isThinking ? [0.6, 0.95, 0.6] : [0.25, 0.45, 0.25],
          }}
          transition={{ duration: isThinking ? 1.4 : 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-radial from-cyan-400/30 via-primary/20 to-transparent blur-xl pointer-events-none"
        />

        {/* Orbiting Thinking Rings */}
        {isThinking && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-1 rounded-full border border-dashed border-cyan-400/50 pointer-events-none"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-3 rounded-full border border-dotted border-primary/60 pointer-events-none"
            />
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border border-cyan-300/40 pointer-events-none"
            />
          </>
        )}

        {/* Floating Avatar Sphere */}
        <motion.div
          animate={{
            y: isThinking ? [-3, 3, -3] : [0, -4, 0],
            scale: currentMood === 'celebrate' ? [1, 1.1, 1] : 1,
          }}
          transition={{
            duration: isThinking ? 0.9 : 3.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={cn(
            'relative rounded-full overflow-hidden transition-all p-0.5',
            'bg-gradient-to-b from-cyan-500/20 via-background/40 to-background/90',
            'shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30 group-hover:ring-cyan-400/60'
          )}
          style={{ width: dimensions.width, height: dimensions.height }}
        >
          {/* Internal Image Container with Rounded Avatar */}
          <div className="relative w-full h-full rounded-full overflow-hidden">
            <Image
              src="/tikhonya.jpg"
              alt="Зерфик — Zerf AI Spirit"
              fill
              sizes="100px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority
            />

            {/* Glowing Holographic Lens Filter */}
            <div className="absolute inset-0 bg-radial from-transparent via-cyan-500/10 to-slate-950/40 mix-blend-overlay pointer-events-none" />
          </div>

          {/* Status Indicator Dot */}
          <div className="absolute top-1 right-1">
            <span className="relative flex h-2 w-2">
              {isThinking && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              )}
              <span className={cn('relative inline-flex rounded-full h-2 w-2', isThinking ? 'bg-cyan-400' : 'bg-primary/80')} />
            </span>
          </div>
        </motion.div>
      </div>

      {/* ── Companion Status & Message ── */}
      {showSpeechBubble && (
        <div className="space-y-1 min-w-0 max-w-md">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono text-[10px] font-bold border border-cyan-500/20 flex items-center gap-1">
              <Bot className="w-2.5 h-2.5" />
              <span>Зерфик AI</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {isThinking ? '• исследование источников...' : '• онлайн'}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={statusText || quoteIndex}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-foreground/90 font-medium leading-relaxed"
            >
              {statusText || ZERFIK_QUOTES[quoteIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// Backwards compatibility alias
export const TikhonyaMascot = ZerfikMascot
