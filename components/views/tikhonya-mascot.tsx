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
    sm: { width: 52, height: 52, aura: 68 },
    md: { width: 78, height: 78, aura: 100 },
    lg: { width: 106, height: 106, aura: 136 },
  }[size]

  const isThinking = currentMood === 'thinking'

  // Clean status text: ensure no old "Тихоня" mentions
  const displayStatus = (statusText || ZERFIK_QUOTES[quoteIndex])
    .replace(/тихоня/gi, 'Зерфик')
    .replace(/\[\s*[˘ˇ^]\s*[ᴗ◡‿_]\s*[˘ˇ^]\s*\]/g, '')
    .trim()

  return (
    <div className={cn('flex items-center gap-3.5 select-none relative', className)}>
      {/* ── Floating Seamless Spirit Figure (No Box, No Background, Pure Transparent Hologram) ── */}
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
            scale: isThinking ? [1, 1.4, 1] : [1, 1.15, 1],
            opacity: isThinking ? [0.6, 0.95, 0.6] : [0.2, 0.4, 0.2],
          }}
          transition={{ duration: isThinking ? 1.2 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-radial from-cyan-400/35 via-primary/20 to-transparent blur-xl pointer-events-none"
        />

        {/* Orbiting Thinking Rings */}
        {isThinking && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-1 rounded-full border border-dashed border-cyan-400/60 pointer-events-none"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-3 rounded-full border border-dotted border-primary/70 pointer-events-none"
            />
            <motion.div
              animate={{ scale: [0.95, 1.25, 0.95], opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border border-cyan-300/40 pointer-events-none"
            />
          </>
        )}

        {/* Floating Glowing Spirit Cutout (Seamless Screen Blending) */}
        <motion.div
          animate={{
            y: isThinking ? [-4, 4, -4] : [-3, 3, -3],
            rotate: isThinking ? [-2, 2, -2] : [-1.5, 1.5, -1.5],
            scale: currentMood === 'celebrate' ? [1, 1.15, 1] : 1,
          }}
          transition={{
            duration: isThinking ? 1.0 : 3.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative flex items-center justify-center transition-all pointer-events-auto"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            filter: isThinking
              ? 'drop-shadow(0 0 16px rgba(34, 211, 238, 0.85)) drop-shadow(0 0 4px rgba(6, 182, 212, 0.9))'
              : isHovered
              ? 'drop-shadow(0 0 14px rgba(34, 211, 238, 0.7))'
              : 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.45))',
          }}
        >
          {/* Transparent Blended Spirit Hologram with Seamless Radial Feathering */}
          <div
            className="relative w-full h-full rounded-full overflow-hidden select-none"
            style={{
              mixBlendMode: 'screen',
              maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 28%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.25) 58%, rgba(0,0,0,0) 68%)',
              WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 28%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.25) 58%, rgba(0,0,0,0) 68%)',
            }}
          >
            <Image
              src="/tikhonya.jpg"
              alt="Зерфик — Zerf AI Spirit"
              fill
              sizes="120px"
              className="object-cover scale-110 transition-transform duration-300 group-hover:scale-125"
              priority
            />
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
              key={displayStatus}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-foreground/90 font-medium leading-relaxed"
            >
              {displayStatus}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// Backwards compatibility alias
export const TikhonyaMascot = ZerfikMascot
