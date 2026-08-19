'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Volume2, VolumeX, Sparkles, Settings2, Trash2,
  ChevronDown, MessageSquare, Play, Square, RefreshCw, Zap,
  CheckCircle2, Radio, Sliders, Shield, ArrowUpRight, Crown, CornerDownLeft
} from 'lucide-react'
import { useApp, getAuthHeaders, getTgChatId } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ZerfikMascot, type ZerfikMood } from '@/components/views/tikhonya-mascot'
import { planAtLeast, type PlanId } from '@/lib/plans'

export type ZerfikGesture = 'none' | 'chair_sit' | 'waving_arms' | 'jump_and_float' | 'spread' | 'head_tilt' | 'nod'

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
 * High-Definition Interactive Animated Vector Companion for Zerfic Live
 * 60 FPS physics, eye-tracking, audio-reactive mouth waveform, and animated particle aura.
 */
export function ZerficLivingCompanion({
  mood,
  gesture = 'none',
  isListening,
  isThinking,
  isSpeaking,
  audioLevel,
  onClick,
}: ZerficCompanionProps) {
  const [blink, setBlink] = useState(false)
  const [lookOffset, setLookOffset] = useState({ x: 0, y: 0, tilt: 0 })
  const [interactiveWave, setInteractiveWave] = useState(0)

  // Natural blinking cycle (blinks every 3.5 - 6 seconds)
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout
    const scheduleBlink = () => {
      const delay = Math.random() * 2500 + 3500
      blinkTimeout = setTimeout(() => {
        setBlink(true)
        setTimeout(() => {
          setBlink(false)
          scheduleBlink()
        }, 180)
      }, delay)
    }
    scheduleBlink()
    return () => clearTimeout(blinkTimeout)
  }, [])

  // Dynamic soundwave mouth animation frame when speaking
  useEffect(() => {
    if (!isSpeaking) return
    const interval = setInterval(() => {
      setInteractiveWave(prev => (prev + 1) % 6)
    }, 120)
    return () => clearInterval(interval)
  }, [isSpeaking])

  // Mouse cursor gaze tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const dx = (e.clientX - cx) / (window.innerWidth / 2)
      const dy = (e.clientY - cy) / (window.innerHeight / 2)
      setLookOffset({
        x: Math.max(-6, Math.min(6, dx * 7)),
        y: Math.max(-5, Math.min(5, dy * 6)),
        tilt: Math.max(-8, Math.min(8, dx * 10)),
      })
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Aura Color and Pulse Dynamics
  const auraGlowColor = isSpeaking
    ? 'rgba(56, 189, 248, 0.45)'
    : isListening
      ? 'rgba(52, 211, 153, 0.45)'
      : isThinking
        ? 'rgba(251, 191, 36, 0.45)'
        : mood === 'happy' || mood === 'celebrate'
          ? 'rgba(168, 85, 247, 0.4)'
          : 'rgba(56, 189, 248, 0.25)'

  const isHappy = mood === 'happy' || mood === 'celebrate'
  const isCurious = mood === 'curious' || gesture === 'head_tilt'
  const isWink = mood === 'wink'

  return (
    <div
      onClick={onClick}
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
                scale: [1, 1.35 + audioLevel * 1.8, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-emerald-400/40 pointer-events-none"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: [1.1, 1.6 + audioLevel * 2.2, 1.1],
                opacity: [0.15, 0.45, 0.15],
              }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              className="absolute inset-0 rounded-full border border-emerald-400/25 pointer-events-none"
            />
          </>
        )}

        {isSpeaking && (
          <motion.div
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.25, 0.6, 0.25],
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full border-2 border-sky-400/40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* ── Soft Glow Ambient Backdrop ── */}
      <div
        className="absolute w-52 h-52 rounded-full blur-3xl transition-all duration-500 pointer-events-none"
        style={{ background: auraGlowColor }}
      />

      {/* ── Floating Character Physical Rig ── */}
      <motion.div
        animate={{
          y: isSpeaking
            ? [-4, 4, -4]
            : isListening
              ? [-2, 2, -2]
              : isThinking
                ? [-3, 3, -3]
                : [-6, 6, -6],
          rotate: isCurious
            ? 12 + lookOffset.tilt
            : isThinking
              ? -5 + lookOffset.tilt * 0.5
              : lookOffset.tilt,
          scale: isSpeaking ? [1, 1.02, 1] : 1,
        }}
        transition={{
          duration: isSpeaking ? 1.4 : isThinking ? 2.2 : 3.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative z-10 flex flex-col items-center justify-center"
      >
        {/* Top Floating Cyber-Antenna with pulsing beacon */}
        <div className="relative flex flex-col items-center -mb-2 z-20">
          <motion.div
            animate={{
              scale: isThinking ? [1, 1.4, 1] : isSpeaking ? [1, 1.2, 1] : [1, 1.1, 1],
              boxShadow: isThinking
                ? '0 0 16px rgba(251, 191, 36, 0.9)'
                : isListening
                  ? '0 0 16px rgba(52, 211, 153, 0.9)'
                  : '0 0 16px rgba(56, 189, 248, 0.9)',
            }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className={cn(
              'w-3.5 h-3.5 rounded-full border border-white/60 transition-colors',
              isThinking ? 'bg-amber-400' : isListening ? 'bg-emerald-400' : 'bg-sky-400'
            )}
          />
          <div className="w-1 h-3 bg-gradient-to-b from-slate-400 to-slate-700 rounded-full" />
        </div>

        {/* ── Main Head & Body Capsule Rig ── */}
        <div className="relative">
          {/* Side Retractable Cyber Wings */}
          <motion.div
            animate={{
              rotate: isHappy ? [-15, 15, -15] : isSpeaking ? [-4, 4, -4] : 0,
              scaleX: isSpeaking ? [1, 1.08, 1] : 1,
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -left-7 top-6 w-8 h-12 bg-gradient-to-l from-slate-700 to-sky-600/60 rounded-l-2xl border-l border-t border-sky-400/40 shadow-lg -z-10"
          />
          <motion.div
            animate={{
              rotate: isHappy ? [15, -15, 15] : isSpeaking ? [4, -4, 4] : 0,
              scaleX: isSpeaking ? [1, 1.08, 1] : 1,
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -right-7 top-6 w-8 h-12 bg-gradient-to-r from-slate-700 to-sky-600/60 rounded-r-2xl border-r border-t border-sky-400/40 shadow-lg -z-10"
          />

          {/* Head Chassis */}
          <div className="w-44 h-36 rounded-3xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-2.5 border-2 border-sky-500/40 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Subtle Metallic Reflex Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

            {/* Dark Visor Screen */}
            <div className="w-full h-full rounded-2xl bg-black/90 border border-slate-700/60 relative p-3 flex flex-col items-center justify-between overflow-hidden shadow-inner">
              {/* Top Sensor Notch */}
              <div className="w-12 h-1 rounded-full bg-slate-800/80 border border-slate-700/50" />

              {/* ── Expressive Digital Eyes Area ── */}
              <div
                className="flex items-center justify-center gap-7 my-auto transition-transform duration-150"
                style={{
                  transform: `translate(${lookOffset.x}px, ${lookOffset.y}px)`,
                }}
              >
                {/* Left Eye */}
                {isHappy ? (
                  // Smiling Crescent Eye ( ^ )
                  <motion.div
                    animate={{ scaleY: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-8 h-4 border-t-4 border-sky-300 rounded-t-full drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                  />
                ) : blink ? (
                  // Closed Blink Line ( - )
                  <div className="w-8 h-1 bg-sky-300 rounded-full drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
                ) : isThinking ? (
                  // Thinking Eye (looking up with data pulse)
                  <motion.div
                    animate={{ y: [-1, -3, -1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-7 h-8 rounded-xl bg-amber-400 border border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)] flex items-center justify-center overflow-hidden"
                  >
                    <div className="w-3 h-3 rounded-full bg-slate-950" />
                  </motion.div>
                ) : isListening ? (
                  // Listening Eye (wide attentive with pulsing radar pupil)
                  <motion.div
                    animate={{ scale: [1, 1.12 + audioLevel * 0.4, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="w-8 h-8 rounded-full bg-emerald-400 border-2 border-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.9)] flex items-center justify-center"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-950" />
                  </motion.div>
                ) : (
                  // Normal Lively Eye
                  <motion.div
                    animate={{ scaleY: isSpeaking ? [1, 1.08, 1] : 1 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-7 h-8 rounded-2xl bg-sky-400 border border-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.85)] flex items-center justify-center"
                  >
                    <div className="w-3 h-3 rounded-full bg-slate-950" />
                  </motion.div>
                )}

                {/* Right Eye */}
                {isWink ? (
                  // Winking Eye ( - )
                  <div className="w-8 h-1 bg-sky-300 rounded-full drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
                ) : isHappy ? (
                  // Smiling Crescent Eye ( ^ )
                  <motion.div
                    animate={{ scaleY: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-8 h-4 border-t-4 border-sky-300 rounded-t-full drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                  />
                ) : blink ? (
                  // Closed Blink Line ( - )
                  <div className="w-8 h-1 bg-sky-300 rounded-full drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
                ) : isThinking ? (
                  // Thinking Eye (looking up with data pulse)
                  <motion.div
                    animate={{ y: [-1, -3, -1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-7 h-8 rounded-xl bg-amber-400 border border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)] flex items-center justify-center overflow-hidden"
                  >
                    <div className="w-3 h-3 rounded-full bg-slate-950" />
                  </motion.div>
                ) : isListening ? (
                  // Listening Eye (wide attentive with pulsing radar pupil)
                  <motion.div
                    animate={{ scale: [1, 1.12 + audioLevel * 0.4, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="w-8 h-8 rounded-full bg-emerald-400 border-2 border-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.9)] flex items-center justify-center"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-950" />
                  </motion.div>
                ) : (
                  // Normal Lively Eye
                  <motion.div
                    animate={{ scaleY: isSpeaking ? [1, 1.08, 1] : 1 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-7 h-8 rounded-2xl bg-sky-400 border border-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.85)] flex items-center justify-center"
                  >
                    <div className="w-3 h-3 rounded-full bg-slate-950" />
                  </motion.div>
                )}
              </div>

              {/* ── Holographic Mouth / Audio-reactive Spectrum on Visor ── */}
              <div className="w-full flex items-center justify-center gap-1 h-3.5">
                {isSpeaking ? (
                  // 5-bar energetic voice equalizer mouth
                  [0.4, 0.9, 1.0, 0.8, 0.5].map((scale, idx) => (
                    <motion.div
                      key={idx}
                      animate={{
                        scaleY: [
                          scale * 0.4,
                          Math.sin(interactiveWave + idx) * 0.5 + 0.9,
                          scale * 0.4,
                        ],
                      }}
                      transition={{ duration: 0.25, repeat: Infinity }}
                      className="w-1.5 h-3.5 bg-sky-300 rounded-full drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]"
                    />
                  ))
                ) : isListening ? (
                  // Listening wave pulse matching mic
                  <motion.div
                    animate={{ scaleX: [0.6, 1 + audioLevel * 1.5, 0.6] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                    className="w-8 h-1 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                  />
                ) : isHappy ? (
                  // Smiling glowing mouth
                  <div className="w-6 h-2 border-b-2 border-sky-300 rounded-b-full drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
                ) : (
                  // Calm standby pulse
                  <div className="w-3 h-1 bg-sky-400/60 rounded-full shadow-[0_0_4px_rgba(56,189,248,0.5)]" />
                )}
              </div>
            </div>
          </div>

          {/* ── Lower Thruster / Jet Plasma Plume ── */}
          <div className="flex flex-col items-center -mt-1">
            {/* Thruster Nozzle */}
            <div className="w-8 h-2.5 bg-slate-800 border-x border-b border-slate-600 rounded-b-lg" />
            {/* Plasma Flame */}
            <motion.div
              animate={{
                scaleY: isSpeaking ? [1, 1.4, 1] : [0.9, 1.15, 0.9],
                opacity: isSpeaking ? [0.8, 1, 0.8] : [0.6, 0.85, 0.6],
              }}
              transition={{ duration: 0.35, repeat: Infinity }}
              className={cn(
                'w-4 h-6 rounded-b-full blur-xs transition-colors shadow-lg',
                isSpeaking
                  ? 'bg-gradient-to-b from-sky-300 via-sky-500 to-transparent'
                  : isListening
                    ? 'bg-gradient-to-b from-emerald-300 via-emerald-500 to-transparent'
                    : isThinking
                      ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-transparent'
                      : 'bg-gradient-to-b from-sky-400 via-sky-600 to-transparent'
              )}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export interface ZerfikMaleVoice {
  id: string
  name: string
  subtitle: string
  tag: string
  pitch: number
  rate: number
  description: string
}

export const ZERFIK_MALE_VOICES: ZerfikMaleVoice[] = [
  {
    id: 'zerfik_energetic',
    name: 'Зерфик (Оригинальный)',
    subtitle: 'Молодой, энергичный и дружелюбный',
    tag: 'Основной',
    pitch: 0.96,
    rate: 1.06,
    description: 'Живой, динамичный мужской голос для быстрого диалога и планирования задач.',
  },
  {
    id: 'alex_baritone',
    name: 'Алекс (Баритон)',
    subtitle: 'Спокойный, глубокий и рассудительный',
    tag: 'Баритон',
    pitch: 0.78,
    rate: 0.96,
    description: 'Глубокий мужской тембр для спокойного разбора дня и вдумчивых советов.',
  },
  {
    id: 'dmitry_business',
    name: 'Дмитрий (Деловой)',
    subtitle: 'Уверенный, чёткий и лаконичный',
    tag: 'Бизнес',
    pitch: 0.90,
    rate: 1.10,
    description: 'Чёткий мужской голос для продуктивного тайм-менеджмента.',
  },
  {
    id: 'mark_tech',
    name: 'Марк (Инженерный)',
    subtitle: 'Точный, умный цифровой ассистент',
    tag: 'AI Pro',
    pitch: 0.85,
    rate: 1.08,
    description: 'Сконцентрированный мужской голос для работы со структурой, кодом и аналитикой.',
  },
]

export interface LiveChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  mood?: ZerfikMood
  gesture?: ZerfikGesture
  timestamp: number
}

const AVAILABLE_MODELS = [
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Live', desc: 'Ультра-быстрый диалог (~120ms)', minPlan: 'free' },
  { id: 'qwen/qwen3.6-27b', name: 'Qwen 2.5 27B Chat', desc: 'Глубокое понимание контекста', minPlan: 'plus' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Pro', desc: 'Максимальная эрудиция и логика', minPlan: 'pro' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B Flagship', desc: 'Флагманская модель Zerf', minPlan: 'corp' },
]

export function ZerficLiveView() {
  const { state, dispatch } = useApp()
  const userPlan = (state.settings?.userPlan as PlanId) || 'free'

  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [autoListen, setAutoListen] = useState(true)

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('zerfik_energetic')
  const [selectedModelId, setSelectedModelId] = useState<string>('llama-3.1-8b-instant')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(true)

  const [mood, setMood] = useState<ZerfikMood>('happy')
  const [gesture, setGesture] = useState<ZerfikGesture>('chair_sit')
  const [statusText, setStatusText] = useState('Зерфик готов к общению')
  const [interimText, setInterimText] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)

  const [messages, setMessages] = useState<LiveChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_live_chat_history')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Привет! Я Зерфик. Можем обсудить твои дела на сегодня, распланировать задачи или просто поболтать. Я слушаю!',
        mood: 'happy',
        gesture: 'waving_arms',
        timestamp: Date.now(),
      },
    ]
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const isInterruptedRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Persist messages to storage
  useEffect(() => {
    try {
      localStorage.setItem('zerf_live_chat_history', JSON.stringify(messages.slice(-30)))
    } catch {}
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Broadcast live state to floating pill across all views
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zerf_live_state_changed', {
          detail: {
            active: isActive,
            status: isSpeaking ? 'speaking' : isThinking ? 'thinking' : isListening ? 'listening' : 'idle',
          },
        })
      )
    }
  }, [isActive, isSpeaking, isThinking, isListening])

  const selectedVoice = useMemo(() => {
    return ZERFIK_MALE_VOICES.find(v => v.id === selectedVoiceId) || ZERFIK_MALE_VOICES[0]
  }, [selectedVoiceId])

  // Stop any active TTS audio immediately (Barge-in / Interruption handler)
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
    isInterruptedRef.current = true
  }, [])

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

          // Gradient color: Emerald/Sky when listening, Amber/Purple when thinking, Primary/Cyan when speaking
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight)
          if (isSpeaking) {
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.95)')
            grad.addColorStop(1, 'rgba(14, 165, 233, 0.4)')
          } else if (isListening) {
            grad.addColorStop(0, 'rgba(52, 211, 153, 0.95)')
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.35)')
          } else {
            grad.addColorStop(0, 'rgba(251, 191, 36, 0.9)')
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.3)')
          }

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.roundRect(x, y, barWidth, barHeight, 2)
          ctx.fill()
        }
      } else {
        // Idle gentle breathing line
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

  // Process User Speech Text through AI Chat Engine
  const sendToZerfik = useCallback(async (userText: string) => {
    if (!userText.trim()) return

    stopSpeaking()
    setIsThinking(true)
    setStatusText('Зерфик обдумывает ответ...')
    setMood('thinking')
    setGesture('chair_sit')

    const userMsg: LiveChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: userText.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setInterimText('')

    try {
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.text,
      }))

      const res = await fetch('/api/extensions/zerfic-live/chat', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText.trim(),
          history: historyPayload,
          model: selectedModelId,
        }),
      })

      const data = await res.json()

      if (data.error) {
        const errorMsg: LiveChatMessage = {
          id: `b_${Date.now()}`,
          role: 'assistant',
          text: data.error,
          mood: 'normal',
          gesture: 'none',
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, errorMsg])
        setStatusText('Ошибка соединения')
        setIsThinking(false)
        return
      }

      const botReply = data.reply || 'Я тебя услышал!'
      const botMood: ZerfikMood = data.mood || 'happy'
      const botGesture: ZerfikGesture = data.gesture || 'chair_sit'

      const botMsg: LiveChatMessage = {
        id: `b_${Date.now()}`,
        role: 'assistant',
        text: botReply,
        mood: botMood,
        gesture: botGesture,
        timestamp: Date.now(),
      }

      setMessages(prev => [...prev, botMsg])
      setMood(botMood)
      setGesture(botGesture)
      setIsThinking(false)
      setStatusText('Зерфик говорит...')

      // Play Speech Synthesis
      speakText(botReply)
    } catch (err) {
      console.error('Zerfic Live Chat Error:', err)
      setIsThinking(false)
      setStatusText('Ошибка сети')
    }
  }, [messages, selectedModelId, stopSpeaking])

  // Speech Synthesis Function with Male Voice filtering
  const speakText = useCallback((textToSpeak: string) => {
    if (typeof window === 'undefined') return
    stopSpeaking()

    if ('speechSynthesis' in window) {
      isInterruptedRef.current = false
      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.rate = selectedVoice.rate
      utterance.pitch = selectedVoice.pitch
      utterance.lang = 'ru-RU'

      // Pick best matching Russian male voice if available
      const voices = window.speechSynthesis.getVoices()
      const ruVoices = voices.filter(v => v.lang.startsWith('ru'))
      const maleVoice = ruVoices.find(v =>
        v.name.toLowerCase().includes('pavel') ||
        v.name.toLowerCase().includes('dmitry') ||
        v.name.toLowerCase().includes('aleksandr') ||
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('русский')
      ) || ruVoices[0]

      if (maleVoice) {
        utterance.voice = maleVoice
      }

      utterance.onstart = () => {
        setIsSpeaking(true)
        setStatusText('Зерфик говорит...')
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        if (autoListen && isActive && !isInterruptedRef.current) {
          setStatusText('Слушаю вас...')
          setMood('normal')
        } else {
          setStatusText('Готов к разговору')
        }
      }

      utterance.onerror = () => {
        setIsSpeaking(false)
        setStatusText('Готов к разговору')
      }

      currentUtteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    } else {
      // Fallback server audio
      fetch('/api/extensions/zerfic-live/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voiceId: selectedVoice.id }),
      })
        .then(r => r.arrayBuffer())
        .then(buf => {
          const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }))
          const audio = new Audio(url)
          setIsSpeaking(true)
          setStatusText('Зерфик говорит...')
          audio.onended = () => {
            setIsSpeaking(false)
            setStatusText(autoListen ? 'Слушаю вас...' : 'Готов к разговору')
          }
          audio.play().catch(() => setIsSpeaking(false))
        })
        .catch(() => setIsSpeaking(false))
    }
  }, [selectedVoice, autoListen, isActive, stopSpeaking])

  // Setup Continuous Speech Recognition & VAD (Silence Detector)
  const startListeningSession = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Audio Context for Volume Level Detection
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx = new AudioCtx()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioCtx
      analyserRef.current = analyser

      // Level monitoring loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const checkLevel = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length / 255
        setAudioLevel(avg)

        // Barge-in trigger: if Zerfik is speaking and user starts talking noticeably
        if (avg > 0.15 && isSpeaking) {
          stopSpeaking()
        }

        if (isActive) {
          requestAnimationFrame(checkLevel)
        }
      }
      checkLevel()

      // Web Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ru-RU'

        recognition.onstart = () => {
          setIsListening(true)
          setStatusText('Слушаю вас...')
        }

        recognition.onresult = (event: any) => {
          // If Zerfik is speaking, user speaking interrupts him!
          if (isSpeaking) {
            stopSpeaking()
          }

          let finalTranscript = ''
          let currentInterim = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            } else {
              currentInterim += transcript
            }
          }

          if (currentInterim) {
            setInterimText(currentInterim)
            setMood('thinking')
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
          }

          if (finalTranscript.trim()) {
            sendToZerfik(finalTranscript.trim())
          } else if (currentInterim.trim()) {
            // Silence detection: after 900ms of no new words, send the interim transcript
            silenceTimerRef.current = setTimeout(() => {
              if (currentInterim.trim().length > 1) {
                sendToZerfik(currentInterim.trim())
              }
            }, 900)
          }
        }

        recognition.onerror = (e: any) => {
          console.warn('Speech Recognition notice:', e.error)
        }

        recognition.onend = () => {
          if (isActive && autoListen && !isMuted) {
            try {
              recognition.start()
            } catch {}
          } else {
            setIsListening(false)
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      }

      setIsActive(true)
      setIsListening(true)
      setStatusText('Слушаю вас... Говорите свободно')
      setMood('normal')
    } catch (err) {
      console.error('Microphone error:', err)
      alert('Пожалуйста, разрешите доступ к микрофону для разговора с Зерфиком.')
    }
  }, [isActive, autoListen, isMuted, isSpeaking, stopSpeaking, sendToZerfik])

  // Stop Listening Session
  const stopListeningSession = useCallback(() => {
    setIsActive(false)
    setIsListening(false)
    stopSpeaking()
    setInterimText('')
    setStatusText('Разговор завершён')
    setMood('normal')

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
    }
  }, [stopSpeaking])

  // Handle Main Call Button
  const handleToggleCall = () => {
    if (isActive) {
      stopListeningSession()
    } else {
      startListeningSession()
    }
  }

  // Clear Chat History
  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'assistant',
        text: 'История очищена. Я готов к новой теме!',
        mood: 'happy',
        gesture: 'waving_arms',
        timestamp: Date.now(),
      },
    ])
    try {
      localStorage.removeItem('zerf_live_chat_history')
    } catch {}
  }

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground font-sans overflow-hidden select-none">
      {/* ── Top Header Toolbar ── */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-border/60 bg-card/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
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

        {/* Top Controls: Voice, Model, Drawer Toggle */}
        <div className="flex items-center gap-2">
          {/* Male Voice Selector Pill */}
          <div className="relative group">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground/90 hover:text-foreground text-xs font-medium border border-border/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Volume2 className="w-3.5 h-3.5 text-primary" />
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
            <span className="hidden md:inline font-mono">{AVAILABLE_MODELS.find(m => m.id === selectedModelId)?.name || 'Llama 3.1'}</span>
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
            onClick={handleClearHistory}
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
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full blur-[100px] pointer-events-none transition-all duration-700',
              isActive && isSpeaking
                ? 'bg-primary/20 scale-125'
                : isActive && isListening
                  ? 'bg-emerald-500/20 scale-110'
                  : isThinking
                    ? 'bg-amber-500/20 scale-115'
                    : 'bg-muted/10 scale-90'
            )}
          />

          {/* Top Status Capsule */}
          <div className="z-10 flex flex-col items-center gap-1.5">
            <motion.div
              layout
              className={cn(
                'px-4 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md shadow-xs flex items-center gap-2 transition-all',
                isSpeaking
                  ? 'bg-primary/15 text-primary border-primary/30'
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
                    ? 'bg-primary animate-pulse'
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

          {/* Central Hero Mascot Presentation */}
          <div className="z-10 flex flex-col items-center justify-center my-auto relative">
            {/* Mascot Character Component */}
            <motion.div
              animate={{
                y: isSpeaking ? [0, -6, 0] : isListening ? [0, -3, 0] : [0, -4, 0],
                scale: isSpeaking ? [1, 1.03, 1] : 1,
              }}
              transition={{
                duration: isSpeaking ? 1.8 : 3.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="cursor-pointer transition-transform"
              onClick={() => {
                if (!isActive) startListeningSession()
                else if (isSpeaking) stopSpeaking()
              }}
            >
              <ZerficLivingCompanion
                mood={mood}
                gesture={gesture}
                isListening={isListening}
                isThinking={isThinking}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
              />
            </motion.div>

            {/* 60FPS Audio Waveform Canvas */}
            <div className="w-full max-w-[320px] h-12 mt-4 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={320}
                height={48}
                className="w-full h-full rounded-xl pointer-events-none"
              />
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="z-10 w-full max-w-xl flex items-center justify-center gap-2 flex-wrap mb-4">
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
                className="px-3 py-1 rounded-full bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground text-[11px] font-medium border border-border/60 hover:border-primary/40 transition-all cursor-pointer shadow-2xs hover:scale-102"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* ── Main Call Action Controls Bar ── */}
          <div className="z-10 flex items-center gap-4 bg-card/80 backdrop-blur-xl border border-border/80 px-6 py-3 rounded-full shadow-xl">
            {/* Mute Button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                'p-3 rounded-full border transition-all cursor-pointer',
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-muted/60 hover:bg-muted text-foreground border-border'
              )}
              title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Pulsing Main Start/Stop Call Button */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleToggleCall}
              className={cn(
                'px-8 py-3.5 rounded-full font-bold text-sm flex items-center gap-2.5 transition-all cursor-pointer shadow-lg',
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
                'p-3 rounded-full border transition-all cursor-pointer',
                isSpeaking
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-muted/30 text-muted-foreground/40 border-border/40 cursor-not-allowed'
              )}
              title="Перебить / Остановить голос Зерфика"
            >
              <VolumeX className="w-5 h-5" />
            </button>
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
                  <MessageSquare className="w-4 h-4 text-primary" />
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

      {/* ── Settings Modal: Male Voice & Model Selection ── */}
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
              className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Настройки голоса и нейросети Зерфика</h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Voice Selection (Only Male Voices) */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span>Мужской голос озвучки</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ZERFIK_MALE_VOICES.map(voice => {
                    const isSelected = voice.id === selectedVoiceId
                    return (
                      <button
                        key={voice.id}
                        onClick={() => {
                          setSelectedVoiceId(voice.id)
                          speakText(`Привет! Я говорю голосом ${voice.name}`)
                        }}
                        className={cn(
                          'p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
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
                  {AVAILABLE_MODELS.map(m => {
                    const isSelected = m.id === selectedModelId
                    const isLocked = m.minPlan !== 'free' && !planAtLeast(userPlan, m.minPlan as PlanId)
                    return (
                      <button
                        key={m.id}
                        disabled={isLocked}
                        onClick={() => setSelectedModelId(m.id)}
                        className={cn(
                          'w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3',
                          isLocked
                            ? 'opacity-50 bg-muted/20 border-border/40 cursor-not-allowed'
                            : isSelected
                              ? 'bg-primary/10 border-primary text-primary shadow-xs cursor-pointer'
                              : 'bg-muted/30 border-border hover:bg-muted/60 text-foreground cursor-pointer'
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{m.name}</span>
                            {m.minPlan !== 'free' && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-400 text-[9px] font-bold">
                                {m.minPlan.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{m.desc}</p>
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
