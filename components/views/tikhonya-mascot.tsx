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
  const [idleGesture, setIdleGesture] = useState<'none' | 'spread' | 'wave' | 'happy'>('none')
  const containerRef = useRef<HTMLDivElement>(null)

  const [cursorVector, setCursorVector] = useState<{ dx: number; dy: number; rawDx: number; rawDy: number; facing: number; tilt: number }>({
    dx: 0,
    dy: 0,
    rawDx: 0,
    rawDy: 0,
    facing: 1,
    tilt: 0,
  })

  useEffect(() => {
    setCurrentMood(mood)
  }, [mood])

  // Random periodic lively gestures (stretching arms, waving, flapping wings) every 12s - 45s
  useEffect(() => {
    let timer: NodeJS.Timeout

    const scheduleNextGesture = () => {
      const delay = Math.floor(Math.random() * 28000) + 12000
      timer = setTimeout(() => {
        if (!isHovered && currentMood === 'normal') {
          const gestures: Array<'spread' | 'wave' | 'happy'> = ['spread', 'wave', 'spread', 'happy']
          const chosen = gestures[Math.floor(Math.random() * gestures.length)]
          setIdleGesture(chosen)

          // Hold the stretch/wave for 2.2 seconds, then return to calm hanging arms
          setTimeout(() => {
            setIdleGesture('none')
            scheduleNextGesture()
          }, 2200)
        } else {
          scheduleNextGesture()
        }
      }, delay)
    }

    scheduleNextGesture()
    return () => clearTimeout(timer)
  }, [isHovered, currentMood])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const rawDx = e.clientX - centerX
      const rawDy = e.clientY - centerY
      const maxDist = Math.max(window.innerWidth, window.innerHeight) || 1000

      // Normalize offsets smoothly
      const normX = Math.max(-12, Math.min(12, (rawDx / maxDist) * 35))
      const normY = Math.max(-10, Math.min(10, (rawDy / maxDist) * 28))
      const tilt = Math.max(-14, Math.min(14, (rawDx / maxDist) * 40))
      const facing = rawDx < -20 ? -1 : 1

      setCursorVector({ dx: normX, dy: normY, rawDx, rawDy, facing, tilt })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleClick = () => {
    setQuoteIndex(prev => (prev + 1) % ZERFIK_QUOTES.length)
    setCurrentMood('celebrate')
    setTimeout(() => setCurrentMood(mood), 1800)
    if (onMascotClick) onMascotClick()
  }

  const dimensions = {
    sm: { width: 52, height: 52, aura: 68 },
    md: { width: 78, height: 78, aura: 100 },
    lg: { width: 106, height: 106, aura: 136 },
  }[size]

  const isThinking = currentMood === 'thinking'
  const isHappy = currentMood === 'celebrate' || currentMood === 'happy' || isHovered
  const isGesturing = idleGesture !== 'none'

  // Determine active sprite based on posture, cursor direction, periodic gestures and mood
  let activeSprite = '/images/zerfik_idle.png'
  if (isThinking) {
    activeSprite = '/images/zerfik_thinking.png'
  } else if (isHappy) {
    // Raises arms high, joyfully moves and cheers!
    activeSprite = '/images/zerfik_happy.png'
  } else if (idleGesture === 'spread') {
    // Stretches arms/wings wide out to the sides!
    activeSprite = '/images/zerfik_spread.png'
  } else if (idleGesture === 'wave') {
    // Waves friendly to the user!
    activeSprite = '/images/zerfik_wave.png'
  } else if (idleGesture === 'happy') {
    activeSprite = '/images/zerfik_happy.png'
  } else if (cursorVector.rawDy > 35 && Math.abs(cursorVector.rawDy) >= Math.abs(cursorVector.rawDx) * 0.7) {
    // Cursor is below (e.g. in search bar or cards below) -> looks down at cursor
    activeSprite = '/images/zerfik_down.png'
  } else if (cursorVector.rawDy < -35 && Math.abs(cursorVector.rawDy) >= Math.abs(cursorVector.rawDx) * 0.7) {
    // Cursor is above -> looks up at cursor
    activeSprite = '/images/zerfik_up.png'
  } else if (cursorVector.rawDx < -20) {
    // Cursor is to the left -> looks left
    activeSprite = '/images/zerfik_left.png'
  } else if (cursorVector.rawDx > 20) {
    // Cursor is to the right -> looks right
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
            y: isThinking ? [-3, 3, -3] : isHappy ? [-8, 0, -4, 0] : isGesturing ? [-5, 0, -5] : cursorVector.dy,
            rotate: isThinking ? [-2, 4, -2] : isHappy ? [-4, 4, -4] : isGesturing ? [-3, 3, -3] : cursorVector.tilt,
            scale: isHappy ? [1, 1.15, 1.05] : isGesturing ? [1, 1.08, 1] : 1,
          }}
          transition={{
            x: { type: 'spring', stiffness: 200, damping: 22 },
            y: isThinking ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : isHappy ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : isGesturing ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 200, damping: 22 },
            rotate: isThinking ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : isHappy ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : isGesturing ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 180, damping: 18 },
            scale: { duration: 0.4, ease: 'easeOut' },
          }}
          className="relative flex items-center justify-center transition-all pointer-events-auto select-none"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            filter: isThinking
              ? 'drop-shadow(0 0 16px rgba(34, 211, 238, 0.85)) drop-shadow(0 0 4px rgba(6, 182, 212, 0.9))'
              : isHappy
              ? 'drop-shadow(0 0 16px rgba(56, 189, 248, 0.9)) drop-shadow(0 0 6px rgba(125, 211, 252, 0.8))'
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
