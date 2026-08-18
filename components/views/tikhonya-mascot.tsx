'use client'

import { useState, useEffect, useRef } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)

  const [cursorVector, setCursorVector] = useState<{ dx: number; dy: number; facing: number; tilt: number }>({
    dx: 0,
    dy: 0,
    facing: 1,
    tilt: 0,
  })

  useEffect(() => {
    setCurrentMood(mood)
  }, [mood])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = e.clientX - centerX
      const dy = e.clientY - centerY
      const maxDist = Math.max(window.innerWidth, window.innerHeight) || 1000

      // Normalize offsets smoothly
      const normX = Math.max(-10, Math.min(10, (dx / maxDist) * 32))
      const normY = Math.max(-8, Math.min(8, (dy / maxDist) * 24))
      const tilt = Math.max(-12, Math.min(12, (dx / maxDist) * 35))
      const facing = dx < -25 ? -1 : 1

      setCursorVector({ dx: normX, dy: normY, facing, tilt })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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

  // Determine active sprite based on posture and mood
  let activeSprite = '/images/zerfik_idle.png'
  if (isThinking) {
    activeSprite = '/images/zerfik_thinking.png'
  } else if (currentMood === 'celebrate' || currentMood === 'happy') {
    activeSprite = '/images/zerfik_happy.png'
  } else if (cursorVector.dx < -3) {
    activeSprite = '/images/zerfik_left.png'
  } else if (cursorVector.dx > 3) {
    activeSprite = '/images/zerfik_right.png'
  }

  // Clean status text: ensure no old "Тихоня" mentions
  const displayStatus = (statusText || ZERFIK_QUOTES[quoteIndex])
    .replace(/тихоня/gi, 'Зерфик')
    .replace(/\[\s*[˘ˇ^]\s*[ᴗ◡‿_]\s*[˘ˇ^]\s*\]/g, '')
    .trim()

  return (
    <div className={cn('flex items-center gap-3.5 select-none relative', className)}>
      {/* ── Floating Seamless Spirit Figure (No Box, No Background, Pure Transparent Hologram) ── */}
      <div
        ref={containerRef}
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
            opacity: isThinking ? [0.5, 0.9, 0.5] : [0.2, 0.35, 0.2],
          }}
          transition={{ duration: isThinking ? 1.4 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-radial from-cyan-400/30 via-primary/15 to-transparent blur-xl pointer-events-none"
        />

        {/* Orbiting Thinking Rings & Aesthetic Celestial Sparkles */}
        {isThinking && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-1 rounded-full border border-dashed border-cyan-400/40 pointer-events-none"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-3 rounded-full border border-dotted border-primary/50 pointer-events-none"
            />

            {/* Orbiting Floating Celestial Stars around Zerfik */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-cyan-300 font-bold text-xs filter drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]">
                ✦
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-amber-300 font-bold text-xs filter drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]">
                ✧
              </div>
              <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 text-sky-200 font-bold text-xs filter drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]">
                ✨
              </div>
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 text-cyan-300 font-bold text-xs filter drop-shadow-[0_0_8px_rgba(147,197,253,0.9)]">
                ✦
              </div>
            </motion.div>
          </>
        )}

        {/* Floating Glowing Spirit Cutout with Dynamic Multi-Sprite Poses */}
        <motion.div
          animate={{
            x: cursorVector.dx,
            y: isThinking ? [-3, 3, -3] : cursorVector.dy,
            rotate: isThinking ? [-2, 4, -2] : cursorVector.tilt,
            scale: currentMood === 'celebrate' ? [1, 1.15, 1] : 1,
          }}
          transition={{
            x: { type: 'spring', stiffness: 200, damping: 22 },
            y: isThinking ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 200, damping: 22 },
            rotate: isThinking ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 180, damping: 18 },
            scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="relative flex items-center justify-center transition-all pointer-events-auto select-none"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            filter: isThinking
              ? 'drop-shadow(0 0 16px rgba(34, 211, 238, 0.85)) drop-shadow(0 0 4px rgba(6, 182, 212, 0.9))'
              : isHovered
              ? 'drop-shadow(0 0 14px rgba(34, 211, 238, 0.75))'
              : 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.5))',
          }}
        >
          <div className="relative w-full h-full select-none">
            <Image
              src={activeSprite}
              alt="Зерфик — Zerf AI Spirit"
              fill
              sizes="140px"
              className="object-contain transition-all duration-200"
              style={{ imageRendering: 'pixelated' }}
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
