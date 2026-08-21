'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  Mic, MicOff, Volume2, Volume1, VolumeX, Sparkles, Settings2, Trash2,
  ChevronDown, MessageSquare, Play, Square, RefreshCw, Zap,
  CheckCircle2, Radio, Sliders, Shield, ArrowUpRight, Crown, CornerDownLeft
} from 'lucide-react'
import { useApp, getAuthHeaders, getTgChatId } from '@/lib/store'
import { cn } from '@/lib/utils'
import { type ZerfikMood } from '@/components/views/tikhonya-mascot'
import { planAtLeast, type PlanId } from '@/lib/plans'
import {
  useZerficLive,
  ZERFIK_VOICE_PROFILES,
  type ZerfikVoiceProfile,
  type LiveChatMessage,
  type ZerfikGesture
} from '@/lib/zerfic-live-context'

export { ZERFIK_VOICE_PROFILES, type ZerfikVoiceProfile, type LiveChatMessage, type ZerfikGesture }

export interface ZerficCompanionProps {
  mood: ZerfikMood | 'curious' | 'surprised'
  gesture?: ZerfikGesture
  isListening: boolean
  isThinking: boolean
  isSpeaking: boolean
  audioLevel: number
  onClick?: () => void
}

/**
 * Genuine Minecraft Allay (Тихоня) Mascot Spirit for Zerfik Live
 * Features animated translucent fairy wings, authentic sprites, orbiting celestial sparkles,
 * soundwave aura, and smooth floating physics.
 */
export function ZerficAllayCompanion({
  mood,
  gesture = 'none',
  isListening,
  isThinking,
  isSpeaking,
  audioLevel,
  onClick,
}: ZerficCompanionProps) {
  const [specialAction, setSpecialAction] = useState<'none' | 'jump' | 'wave'>('none')
  const [cursorVector, setCursorVector] = useState({ dx: 0, dy: 0, rawDx: 0, rawDy: 0, tilt: 0 })

  // Mouse cursor gaze tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const rawDx = e.clientX - cx
      const rawDy = e.clientY - cy
      const maxDist = Math.max(window.innerWidth, window.innerHeight) || 1000

      const normX = Math.max(-12, Math.min(12, (rawDx / maxDist) * 30))
      const normY = Math.max(-10, Math.min(10, (rawDy / maxDist) * 24))
      const tilt = Math.max(-12, Math.min(12, (rawDx / maxDist) * 35))

      setCursorVector({ dx: normX, dy: normY, rawDx, rawDy, tilt })
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const isHappy = mood === 'happy' || mood === 'celebrate' || isSpeaking
  const isThink = mood === 'thinking' || isThinking

  // Select authentic Allay sprite based on mood, actions and gaze
  let activeSprite = '/images/zerfik_idle.png'
  if (isThink) {
    activeSprite = '/images/zerfik_thinking.png'
  } else if (specialAction === 'jump' || gesture === 'jump_and_float') {
    activeSprite = '/images/zerfik_spread.png'
  } else if (specialAction === 'wave' || gesture === 'waving_arms') {
    activeSprite = '/images/zerfik_wave.png'
  } else if (isHappy) {
    activeSprite = '/images/zerfik_happy.png'
  } else if (cursorVector.rawDy > 35 && Math.abs(cursorVector.rawDy) >= Math.abs(cursorVector.rawDx) * 0.7) {
    activeSprite = '/images/zerfik_down.png'
  } else if (cursorVector.rawDy < -35 && Math.abs(cursorVector.rawDy) >= Math.abs(cursorVector.rawDx) * 0.7) {
    activeSprite = '/images/zerfik_up.png'
  } else if (cursorVector.rawDx < -20) {
    activeSprite = '/images/zerfik_left.png'
  } else if (cursorVector.rawDx > 20) {
    activeSprite = '/images/zerfik_right.png'
  }

  const handleMascotClick = () => {
    setSpecialAction('jump')
    setTimeout(() => setSpecialAction('none'), 2400)
    if (onClick) onClick()
  }

  return (
    <div
      onClick={handleMascotClick}
      className="relative flex items-center justify-center cursor-pointer select-none group"
      style={{ width: 280, height: 280 }}
    >
      {/* ── Sound & Energy Aura Rings (reactive to microphone decibels) ── */}
      <AnimatePresence>
        {isListening && (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.4 + audioLevel * 1.8, 1],
                opacity: [0.3, 0.75, 0.3],
              }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-emerald-400/50 pointer-events-none"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: [1.1, 1.7 + audioLevel * 2.2, 1.1],
                opacity: [0.15, 0.45, 0.15],
              }}
              transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
              className="absolute inset-0 rounded-full border border-emerald-400/30 pointer-events-none"
            />
          </>
        )}

        {isSpeaking && (
          <>
            <motion.div
              animate={{
                scale: [1, 1.35, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-cyan-400/50 pointer-events-none"
            />
            <motion.div
              animate={{
                scale: [1.15, 1.6, 1.15],
                opacity: [0.15, 0.4, 0.15],
              }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              className="absolute inset-0 rounded-full border border-sky-400/30 pointer-events-none"
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Soft Ambient Glow ── */}
      <div
        className="absolute w-56 h-56 rounded-full blur-3xl transition-all duration-500 pointer-events-none"
        style={{
          background: isSpeaking
            ? 'rgba(34, 211, 238, 0.45)'
            : isListening
            ? 'rgba(52, 211, 153, 0.45)'
            : isThink
            ? 'rgba(251, 191, 36, 0.45)'
            : isHappy
            ? 'rgba(147, 197, 253, 0.4)'
            : 'rgba(34, 211, 238, 0.25)',
        }}
      />

      {/* ── Orbiting Celestial Sparkles & Magic Dust ── */}
      {(isThink || isSpeaking || isListening) && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: isSpeaking ? 3.5 : 5.0, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-2 flex items-center justify-center pointer-events-none"
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-cyan-300 font-bold text-sm filter drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]">
            ✦
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-amber-300 font-bold text-sm filter drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]">
            ✧
          </div>
          <div className="absolute top-1/2 -left-2 -translate-y-1/2 text-sky-200 font-bold text-base filter drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]">
            ✨
          </div>
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 text-cyan-300 font-bold text-sm filter drop-shadow-[0_0_8px_rgba(147,197,253,0.9)]">
            ✦
          </div>
        </motion.div>
      )}

      {/* ── Floating Character Physical Rig ── */}
      <motion.div
        animate={
          specialAction === 'jump'
            ? {
                y: [0, -38, -32, -34, -16, 2, 0],
                rotate: [0, -10, 10, -8, 8, -2, 0],
                scale: [1, 1.2, 1.1, 1.15, 1.05, 0.95, 1],
              }
            : {
                x: cursorVector.dx,
                y: isSpeaking
                  ? [-6, 6, -6]
                  : isListening
                  ? [-3, 3, -3]
                  : isThink
                  ? [-4, 4, -4]
                  : [-8, 8, -8],
                rotate: isThink ? -4 + cursorVector.tilt * 0.5 : cursorVector.tilt,
                scale: isSpeaking ? [1, 1.04, 1] : 1,
              }
        }
        transition={
          specialAction === 'jump'
            ? { duration: 2.4, ease: 'easeInOut' }
            : {
                y: { duration: isSpeaking ? 1.4 : isThink ? 2.0 : 3.6, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 2.0, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
              }
        }
        className="relative z-10 flex items-center justify-center pointer-events-auto"
      >
        {/* ── Animated Translucent Fairy Wings (Flapping 3D) ── */}
        {/* Left Fairy Wing */}
        <motion.div
          animate={{
            rotateY: isSpeaking ? [-45, 45, -45] : [-25, 25, -25],
            scaleX: isSpeaking ? [0.7, 1.25, 0.7] : [0.85, 1.15, 0.85],
            scaleY: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: isSpeaking ? 0.35 : 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: 'right center' }}
          className="absolute -left-12 top-6 w-16 h-22 rounded-full bg-gradient-to-tr from-cyan-300/70 via-sky-200/50 to-transparent backdrop-blur-xs border border-cyan-200/60 shadow-[0_0_16px_rgba(34,211,238,0.85)] -z-10 pointer-events-none"
        />

        {/* Right Fairy Wing */}
        <motion.div
          animate={{
            rotateY: isSpeaking ? [45, -45, 45] : [25, -25, 25],
            scaleX: isSpeaking ? [0.7, 1.25, 0.7] : [0.85, 1.15, 0.85],
            scaleY: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: isSpeaking ? 0.35 : 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: 'left center' }}
          className="absolute -right-12 top-6 w-16 h-22 rounded-full bg-gradient-to-tl from-cyan-300/70 via-sky-200/50 to-transparent backdrop-blur-xs border border-cyan-200/60 shadow-[0_0_16px_rgba(34,211,238,0.85)] -z-10 pointer-events-none"
        />

        {/* ── Central Spirit Body Sprite (Minecraft Allay Тихоня) ── */}
        <div
          className="relative w-44 h-44 flex items-center justify-center select-none"
          style={{
            filter: isThink
              ? 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.85)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.9))'
              : isSpeaking
              ? 'drop-shadow(0 0 22px rgba(34, 211, 238, 0.95)) drop-shadow(0 0 8px rgba(56, 189, 248, 0.9))'
              : isListening
              ? 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.85)) drop-shadow(0 0 6px rgba(34, 211, 238, 0.7))'
              : 'drop-shadow(0 0 16px rgba(34, 211, 238, 0.65))',
          }}
        >
          <Image
            src={activeSprite}
            alt="Зерфик — Тихоня AI Spirit"
            fill
            sizes="180px"
            priority
            className="object-contain pointer-events-none select-none"
          />
        </div>
      </motion.div>
    </div>
  )
}

const AVAILABLE_MODELS = [
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B Fast', desc: 'Ультра-быстрый живой диалог (1000 T/s, ~150ms)', minPlan: 'free' },
  { id: 'groq/compound-mini', name: 'Compound Mini', desc: 'Компактная быстрая система оркестрации', minPlan: 'free' },
  { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', desc: 'Глубокое понимание контекста и структурирование', minPlan: 'plus' },
  { id: 'groq/compound', name: 'Groq Compound System', desc: 'Комплексная система с авто-роутингом инструментов', minPlan: 'plus' },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B Flagship', desc: 'Флагманская сверхмощная модель Zerf (500 T/s)', minPlan: 'pro' },
]

export function ZerficLiveView() {
  const { state, dispatch } = useApp()
  const userPlan = (state.settings?.userPlan as PlanId) || 'free'
  const live = useZerficLive()

  const [liveModels, setLiveModels] = useState(() => AVAILABLE_MODELS)

  useEffect(() => {
    let isMounted = true
    fetch('/api/ai/models')
      .then(r => r.json())
      .then(d => {
        if (isMounted && Array.isArray(d.models) && d.models.length > 0) {
          setLiveModels(d.models.map((m: any) => ({
            id: m.id,
            name: m.name,
            desc: m.desc || '',
            minPlan: m.minTier,
          })))
        }
      })
      .catch(() => {})
    return () => { isMounted = false }
  }, [])

  const {
    isActive,
    isListening,
    isThinking,
    isSpeaking,
    isMuted,
    autoListen,
    audioLevel,
    statusText,
    interimText,
    mood,
    gesture,
    selectedVoiceId,
    voiceVolume,
    selectedModelId,
    messages,
    setIsMuted,
    setAutoListen,
    setSelectedVoiceId,
    setVoiceVolume,
    setSelectedModelId,
    setMood,
    setGesture,
    startListeningSession,
    stopListeningSession,
    sendToZerfik,
    speakText,
    stopSpeaking,
    clearMessages,
  } = live

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(true)
  const [typedInput, setTypedInput] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedVoice = useMemo(() => {
    return ZERFIK_VOICE_PROFILES.find(v => v.id === selectedVoiceId) || ZERFIK_VOICE_PROFILES[0]
  }, [selectedVoiceId])

  // Audio Visualizer Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const draw = () => {
      if (!running) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const width = canvas.width
      const height = canvas.height
      const centerY = height / 2

      if (isListening || isSpeaking || isThinking) {
        const barsCount = 28
        const barWidth = 4
        const gap = 6
        const totalWidth = barsCount * (barWidth + gap)
        const startX = (width - totalWidth) / 2

        for (let i = 0; i < barsCount; i++) {
          const t = Date.now() / 200 + i * 0.2
          let factor = 0.15

          if (isListening) {
            factor = Math.max(0.1, audioLevel * 2.5 + Math.sin(t) * 0.15)
          } else if (isSpeaking) {
            factor = 0.3 + Math.abs(Math.sin(t * 1.5)) * 0.6
          } else if (isThinking) {
            factor = 0.2 + Math.abs(Math.sin(t * 0.8)) * 0.35
          }

          const barHeight = Math.max(4, Math.min(height * 0.85, height * factor))
          const x = startX + i * (barWidth + gap)
          const y = centerY - barHeight / 2

          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight)
          if (isSpeaking) {
            grad.addColorStop(0, 'rgba(34, 211, 238, 0.95)')
            grad.addColorStop(1, 'rgba(14, 165, 233, 0.4)')
          } else if (isListening) {
            grad.addColorStop(0, 'rgba(52, 211, 153, 0.95)')
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.35)')
          } else {
            grad.addColorStop(0, 'rgba(251, 191, 36, 0.95)')
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.35)')
          }

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.roundRect(x, y, barWidth, barHeight, 2)
          ctx.fill()
        }
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
        ctx.lineWidth = 2
        ctx.beginPath()
        const startX = width * 0.2
        const endX = width * 0.8
        ctx.moveTo(startX, centerY)
        ctx.lineTo(endX, centerY)
        ctx.stroke()
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      running = false
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isListening, isSpeaking, isThinking, audioLevel])

  // Handle Main Call Button
  const handleToggleCall = () => {
    if (isActive) {
      stopListeningSession()
    } else {
      startListeningSession()
    }
  }

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!typedInput.trim()) return
    sendToZerfik(typedInput.trim())
    setTypedInput('')
  }

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground font-sans overflow-hidden select-none">
      {/* ── Top Header Toolbar ── */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-border/60 bg-card/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-xs">
            <Radio className={cn('w-4 h-4', isActive && 'text-emerald-400 animate-pulse')} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground">Зерфик Live</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/25 flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full bg-emerald-400', isActive && 'animate-ping')} />
                {isActive ? 'В эфире' : 'Готов к звонку'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Голосовой диалог в реальном времени (ChatGPT Voice Mode)</p>
          </div>
        </div>

        {/* Top Controls: Voice, Model, Volume, Drawer Toggle */}
        <div className="flex items-center gap-2">
          {/* Voice Selector Pill */}
          <div className="relative group">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground/90 hover:text-foreground text-xs font-medium border border-border/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{selectedVoice.name}</span>
              <span className="sm:hidden">Голос</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>

          {/* AI Model Selector */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground/90 hover:text-foreground text-xs font-medium border border-border/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline font-mono">{liveModels.find(m => m.id === selectedModelId)?.name || 'Groq Compound'}</span>
            <span className="md:hidden">Модель</span>
          </button>

          {/* Transcript Toggle */}
          <button
            onClick={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
            className={cn(
              'p-2 rounded-xl border transition-all cursor-pointer shadow-2xs',
              showTranscriptDrawer
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
            )}
            title="История реплик"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Clear History */}
          <button
            onClick={clearMessages}
            className="p-2 rounded-xl bg-muted/60 hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 border border-border/80 transition-all cursor-pointer shadow-2xs"
            title="Очистить историю разговора"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Main Stage Area ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left / Center: Interactive Mascot & Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-between p-6 sm:p-10 relative overflow-hidden bg-radial from-card/30 via-background to-background">
          {/* Subtle decorative glow orb */}
          <div
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full blur-[110px] pointer-events-none transition-all duration-700',
              isActive && isSpeaking
                ? 'bg-cyan-500/25 scale-125'
                : isActive && isListening
                ? 'bg-emerald-500/20 scale-110'
                : isThinking
                ? 'bg-amber-500/20 scale-115'
                : 'bg-cyan-500/10 scale-90'
            )}
          />

          {/* Top Status Capsule */}
          <div className="z-10 flex flex-col items-center gap-1.5">
            <motion.div
              layout
              className={cn(
                'px-4 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md shadow-xs flex items-center gap-2 transition-all',
                isSpeaking
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : isListening
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : isThinking
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-card/80 text-muted-foreground border-border/60'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isSpeaking
                    ? 'bg-cyan-400 animate-pulse'
                    : isListening
                    ? 'bg-emerald-400 animate-ping'
                    : isThinking
                    ? 'bg-amber-400 animate-bounce'
                    : 'bg-muted-foreground'
                )}
              />
              <span>{statusText}</span>
            </motion.div>

            {/* Interim Speech Preview */}
            <AnimatePresence>
              {interimText && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-3 py-1 rounded-xl bg-card/90 border border-primary/30 text-xs font-medium text-foreground max-w-[380px] text-center shadow-lg"
                >
                  «{interimText}»
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Central Hero Mascot Presentation (Minecraft Allay Тихоня) */}
          <div className="z-10 flex flex-col items-center justify-center my-auto relative">
            <ZerficAllayCompanion
              mood={mood}
              gesture={gesture}
              isListening={isListening}
              isThinking={isThinking}
              isSpeaking={isSpeaking}
              audioLevel={audioLevel}
              onClick={() => {
                if (!isActive) startListeningSession()
                else if (isSpeaking) stopSpeaking()
              }}
            />

            {/* 60FPS Audio Waveform Canvas */}
            <div className="w-full max-w-[320px] h-12 mt-2 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={320}
                height={48}
                className="w-full h-full rounded-xl pointer-events-none"
              />
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="z-10 w-full max-w-xl flex items-center justify-center gap-2 flex-wrap mb-3">
            {[
              'Что у меня на сегодня?',
              'Помоги спланировать день',
              'Создай задачу на завтра',
              'Расскажи интересный факт',
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => sendToZerfik(prompt)}
                disabled={isThinking}
                className="px-3 py-1 rounded-full bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground text-[11px] font-medium border border-border/60 hover:border-cyan-400/40 transition-all cursor-pointer shadow-2xs hover:scale-102"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* ── Main Call Action Controls Bar (With Volume Slider) ── */}
          <div className="z-10 flex items-center gap-3 bg-card/85 backdrop-blur-xl border border-border/80 px-5 py-2.5 rounded-full shadow-2xl">
            {/* Mute Microphone Button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                'p-2.5 rounded-full border transition-all cursor-pointer',
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-muted/60 hover:bg-muted text-foreground border-border'
              )}
              title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Pulsing Main Start/Stop Call Button */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleToggleCall}
              className={cn(
                'px-7 py-3 rounded-full font-bold text-sm flex items-center gap-2.5 transition-all cursor-pointer shadow-lg',
                isActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25 hover:shadow-primary/40'
              )}
            >
              {isActive ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>Завершить звонок</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Начать разговор</span>
                </>
              )}
            </motion.button>

            {/* Interruption / Stop Speech Button */}
            <button
              onClick={stopSpeaking}
              disabled={!isSpeaking}
              className={cn(
                'p-2.5 rounded-full border transition-all cursor-pointer',
                isSpeaking
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-muted/30 text-muted-foreground/40 border-border/40 cursor-not-allowed'
              )}
              title="Перебить / Остановить голос Зерфика"
            >
              <VolumeX className="w-4 h-4" />
            </button>

            {/* Volume Slider Control */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/60">
              <button
                type="button"
                onClick={() => setVoiceVolume(voiceVolume === 0 ? 0.85 : 0)}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Громкость речи Зерфика"
              >
                {voiceVolume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : voiceVolume < 0.4 ? (
                  <Volume1 className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={voiceVolume}
                onChange={e => setVoiceVolume(parseFloat(e.target.value))}
                className="w-18 sm:w-22 h-1.5 bg-muted rounded-lg accent-primary cursor-pointer"
                title={`Громкость: ${Math.round(voiceVolume * 100)}%`}
              />
              <span className="text-[10px] text-muted-foreground font-mono w-7">
                {Math.round(voiceVolume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Right Side: Live Speech Transcript Drawer ── */}
        <AnimatePresence>
          {showTranscriptDrawer && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="hidden sm:flex flex-col h-full border-l border-border/60 bg-card/30 backdrop-blur-md shrink-0 overflow-hidden"
            >
              <div className="p-3.5 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-foreground">Стенограмма диалога</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{messages.length} реплик</span>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex flex-col max-w-[88%]',
                      msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                    )}
                  >
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-1 font-mono">
                      <span>{msg.role === 'user' ? 'Вы' : 'Зерфик'}</span>
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      className={cn(
                        'px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-xs font-medium'
                          : 'bg-card border border-border/80 text-foreground rounded-tl-xs'
                      )}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Text Input fallback */}
              <div className="p-3 border-t border-border/60 bg-card/50">
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    const input = (e.currentTarget.elements.namedItem('textInput') as HTMLInputElement)
                    if (input?.value.trim()) {
                      sendToZerfik(input.value)
                      input.value = ''
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    name="textInput"
                    type="text"
                    placeholder="Напишите Зерфику..."
                    className="flex-1 bg-muted/60 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-hidden focus:border-primary transition-colors"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Settings Modal: Voice & Model Selection ── */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-foreground">Настройки голоса и модели Зерфика</h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Volume Slider in Settings */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <span>Громкость голоса</span>
                  </label>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {Math.round(voiceVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceVolume}
                  onChange={e => setVoiceVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg accent-primary cursor-pointer"
                />
              </div>

              {/* Voice Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Выберите тембр и характер голоса</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ZERFIK_VOICE_PROFILES.map(voice => {
                    const isSelected = voice.id === selectedVoiceId
                    const samplePhrases: Record<string, string> = {
                      zerfik_original: 'Привет! Зерфик на связи, давай творить продуктивность и наводить порядок!',
                      zerfik_friend: 'Здорово! Зерфик на связи, готов помочь со всеми делами, рассказывай!',
                      alex_baritone: 'Добрый день. Зерфик слушает. Давайте спокойно и взвешенно разберём ваши планы.',
                      viktor_brutal: 'Так, отставить прокрастинацию. Зерфик в строю, время действовать!',
                      dmitry_business: 'Привет! Зерфик заряжен на максимум! Погнали забирать победы прямо сейчас!',
                      alisa_soft: 'Привет... Зерфик рядом. Мы со всем спокойно справимся, не переживай.',
                      elena_business: 'Здравствуйте. Зерфик на связи. Готов к работе с расписанием, проектами и отчетами.',
                    }

                    return (
                      <button
                        key={voice.id}
                        onClick={() => {
                          setSelectedVoiceId(voice.id)
                          speakText(samplePhrases[voice.id] || `Привет! Голос ${voice.name}`, voice.id)
                        }}
                        className={cn(
                          'p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5',
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs'
                            : 'bg-muted/30 border-border hover:bg-muted/60 text-foreground'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{voice.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">{voice.tag}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{voice.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* AI Model Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Нейросетевой движок</span>
                </label>
                <div className="space-y-2">
                  {liveModels.map(m => {
                    const isSelected = m.id === selectedModelId
                    const isLocked = m.minPlan !== 'free' && !planAtLeast(userPlan, m.minPlan as PlanId)
                    return (
                      <button
                        key={m.id}
                        disabled={isLocked}
                        onClick={() => setSelectedModelId(m.id)}
                        className={cn(
                          'w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer',
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                            : isLocked
                            ? 'opacity-50 cursor-not-allowed bg-muted/20 border-border'
                            : 'bg-muted/30 border-border hover:bg-muted/60 text-foreground'
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{m.name}</span>
                            {isLocked && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/20 uppercase">
                                {m.minPlan}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer"
              >
                Сохранить параметры
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
