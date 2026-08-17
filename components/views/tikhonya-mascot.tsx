'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Sparkles, Heart, Zap, Shield, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TikhonyaMood = 'normal' | 'thinking' | 'happy' | 'wink' | 'celebrate'

interface TikhonyaMascotProps {
  mood?: TikhonyaMood
  statusText?: string
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  showSpeechBubble?: boolean
  className?: string
  onMascotClick?: () => void
}

const TIKHONYA_QUOTES = [
  'Тихоня готов исследовать любые темы на максимальной глубине! [ ˘ ᴗ ˘ ]',
  'Синтезирую проверенные первоисточники и цитаты ✧',
  'Крылышки заряжены, знания структурированы! ٩(ˊᗜˋ*)و',
  'Спросите меня о чем угодно: архитектура, наука, код или заметки ◈',
  'Тихоня помнит все ваши проекты и задачи в Zerf Note ✨',
]

export function TikhonyaMascot({
  mood = 'normal',
  statusText,
  size = 'md',
  interactive = true,
  showSpeechBubble = true,
  className,
  onMascotClick,
}: TikhonyaMascotProps) {
  const [currentMood, setCurrentMood] = useState<TikhonyaMood>(mood)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [particleKey, setParticleKey] = useState(0)

  useEffect(() => {
    setCurrentMood(mood)
  }, [mood])

  const handleClick = () => {
    setQuoteIndex(prev => (prev + 1) % TIKHONYA_QUOTES.length)
    setCurrentMood('celebrate')
    setParticleKey(prev => prev + 1)
    setTimeout(() => setCurrentMood(mood), 1800)
    if (onMascotClick) onMascotClick()
  }

  const dimensions = {
    sm: { width: 56, height: 56, text: 'text-[10px]' },
    md: { width: 84, height: 84, text: 'text-xs' },
    lg: { width: 120, height: 120, text: 'text-sm' },
  }[size]

  return (
    <div className={cn('flex items-center gap-3.5 select-none relative', className)}>
      {/* ── Visual 3D + Holographic Animated Character ── */}
      <div
        className="relative cursor-pointer group shrink-0"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Glowing Aura Ring Background */}
        <motion.div
          animate={{
            scale: currentMood === 'thinking' ? [1, 1.25, 1] : [1, 1.1, 1],
            opacity: currentMood === 'thinking' ? [0.6, 0.9, 0.6] : [0.35, 0.6, 0.35],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400/40 via-cyan-400/30 to-indigo-500/40 blur-xl pointer-events-none"
        />

        {/* Floating Physics Wrapper */}
        <motion.div
          animate={{
            y: currentMood === 'thinking' ? [-2, 2, -2] : [0, -6, 0],
            rotate: currentMood === 'celebrate' ? [0, -5, 5, 0] : [0, 1.5, -1.5, 0],
          }}
          transition={{
            duration: currentMood === 'thinking' ? 0.8 : 3.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={cn(
            'relative rounded-2xl overflow-hidden border border-sky-400/40 bg-slate-950/80 shadow-lg shadow-sky-500/10 transition-all p-1 group-hover:border-sky-300 group-hover:shadow-sky-400/25',
            currentMood === 'thinking' && 'ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-background'
          )}
          style={{ width: dimensions.width, height: dimensions.height }}
        >
          {/* Avatar Image */}
          <div className="relative w-full h-full rounded-xl overflow-hidden">
            <Image
              src="/tikhonya.jpg"
              alt="Тихоня — Zerf Allay Spirit"
              fill
              sizes="120px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority
            />

            {/* Pulsing Core Diamond Overlay */}
            <motion.div
              animate={{
                opacity: [0.3, 0.8, 0.3],
                scale: [0.95, 1.05, 0.95],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-t from-sky-500/20 to-transparent pointer-events-none"
            />
          </div>

          {/* Thinking / Searching Ring */}
          {currentMood === 'thinking' && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-2xl border-2 border-dashed border-cyan-400/70 pointer-events-none"
            />
          )}

          {/* Sparkle Particle Badge */}
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-900/80 border border-sky-400/60 flex items-center justify-center text-[9px] text-sky-300 shadow-sm">
            {currentMood === 'thinking' ? '⚙️' : currentMood === 'celebrate' ? '✧' : '◈'}
          </div>
        </motion.div>
      </div>

      {/* ── Interactive Speech & Dynamic Status ── */}
      {showSpeechBubble && (
        <div className="space-y-1 min-w-0 max-w-md">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 font-mono text-[10px] font-bold border border-sky-500/25 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Тихоня (Zerf Companion)</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              [ ˘ ᴗ ˘ ]
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={statusText || quoteIndex}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              className={cn(
                'font-medium text-foreground/90 leading-snug line-clamp-2',
                dimensions.text
              )}
            >
              {statusText || TIKHONYA_QUOTES[quoteIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
