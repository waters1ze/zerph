'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Mic, Volume2, Sparkles, MessageSquare, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'

export type ZerfikMood = 'normal' | 'thinking' | 'happy' | 'wink' | 'celebrate'
export type ZerfikGesture = 'none' | 'chair_sit' | 'waving_arms' | 'jump_and_float' | 'spread'

interface VoiceMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  audioUrl?: string
  mood?: ZerfikMood
  gesture?: ZerfikGesture
  timestamp: number
}

interface ZerficLiveModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ZerficLiveModal({ isOpen, onClose }: ZerficLiveModalProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Привет! Я Зерфик. Можешь спросить меня о делах, целях или просто поболтать!',
      mood: 'happy',
      gesture: 'waving_arms',
      timestamp: Date.now(),
    },
  ])

  const [mood, setMood] = useState<ZerfikMood>('happy')
  const [gesture, setGesture] = useState<ZerfikGesture>('chair_sit')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<'zerfik_original' | 'zerfik_intellect' | 'zerfik_coach'>('zerfik_original')
  const [isLoading, setIsLoading] = useState(false)
  const [waveStep, setWaveStep] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (gesture === 'waving_arms') {
      const interval = setInterval(() => setWaveStep(p => (p + 1) % 4), 180)
      return () => clearInterval(interval)
    }
  }, [gesture])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStartTalk = async () => {
    if (isListening || isSpeaking || isLoading) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorder.start(250)
      mediaRecorderRef.current = mediaRecorder

      setIsListening(true)
      setMood('thinking')
      setGesture('chair_sit')
    } catch (err) {
      console.error('Mic error:', err)
      alert('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.')
    }
  }

  const handleStopTalk = async () => {
    if (!isListening || !mediaRecorderRef.current) return
    setIsListening(false)
    setIsLoading(true)

    const recorder = mediaRecorderRef.current
    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      try {
        const formData = new FormData()
        formData.append('file', audioBlob, 'speech.webm')

        const res = await fetch('/api/extensions/zerfic-live/chat', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        if (data.error) {
          alert(data.error)
          setIsLoading(false)
          return
        }

        const userMsg: VoiceMessage = {
          id: 'u_' + Date.now(),
          role: 'user',
          text: data.transcript,
          timestamp: Date.now(),
        }

        const botMsg: VoiceMessage = {
          id: 'b_' + Date.now(),
          role: 'assistant',
          text: data.reply,
          mood: data.mood || 'normal',
          gesture: data.gesture || 'none',
          timestamp: Date.now(),
        }

        setMessages(prev => [...prev, userMsg, botMsg])
        setMood(data.mood || 'normal')
        setGesture(data.gesture || 'chair_sit')

        // Synthesize and play voice
        const ttsRes = await fetch('/api/extensions/zerfic-live/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ text: data.reply, voiceId: selectedVoice }),
        })

        if (ttsRes.ok) {
          const audioBuf = await ttsRes.arrayBuffer()
          const audioBlobUrl = URL.createObjectURL(new Blob([audioBuf], { type: 'audio/mpeg' }))
          const audio = new Audio(audioBlobUrl)
          currentAudioRef.current = audio
          setIsSpeaking(true)
          audio.onended = () => setIsSpeaking(false)
          audio.onerror = () => setIsSpeaking(false)
          await audio.play()
        }
      } catch (err) {
        console.error('Conversation error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    recorder.stop()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-xl h-[85vh] sm:h-[680px] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg">
              🎙️
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>Zerfic Live</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Мужской голос
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">Живой разговорный ИИ-собеседник</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="zerfik_original">👨 Зерфик (Фирменный)</option>
              <option value="zerfik_intellect">🧠 Зерфик (Интеллект)</option>
              <option value="zerfik_coach">⚡ Зерфик (Драйв / Коуч)</option>
            </select>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Animated Mascot Stage */}
        <div className="py-5 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900/40 via-amber-950/10 to-transparent border-b border-slate-800/40 shrink-0">
          <div className="relative w-28 h-28 flex items-center justify-center cursor-pointer select-none">
            {/* Glow Aura */}
            <div
              className={cn(
                'absolute inset-0 rounded-full blur-xl transition-all duration-500',
                isSpeaking ? 'bg-amber-500/40 scale-125 animate-pulse' :
                isListening ? 'bg-sky-500/40 scale-125 animate-ping' :
                'bg-amber-500/15 scale-100'
              )}
            />

            {/* Mascot Container */}
            <div
              className={cn(
                'relative z-10 w-full h-full flex flex-col items-center justify-center transition-all duration-300',
                gesture === 'jump_and_float' ? 'animate-bounce -translate-y-3' :
                gesture === 'chair_sit' ? 'translate-y-1' : ''
              )}
            >
              {/* Chair Element if sitting */}
              {gesture === 'chair_sit' && (
                <div className="absolute -bottom-1 z-0 w-24 h-12 bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-xl flex items-center justify-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">🪑 Zerf Chair</span>
                </div>
              )}

              {/* Head / Body */}
              <div className="relative z-10 w-16 h-16 bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-300 rounded-2xl shadow-xl flex flex-col items-center justify-center border-2 border-amber-200/70">
                {/* Eyes */}
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={cn(
                      'w-2.5 h-3.5 bg-slate-950 rounded-full transition-all duration-200',
                      mood === 'wink' ? 'scale-y-25' : isListening ? 'scale-125' : ''
                    )}
                  />
                  <div
                    className={cn(
                      'w-2.5 h-3.5 bg-slate-950 rounded-full transition-all duration-200',
                      mood === 'happy' ? 'scale-y-50' : ''
                    )}
                  />
                </div>

                {/* Mouth */}
                <div
                  className={cn(
                    'bg-slate-950 rounded-full transition-all duration-150',
                    isSpeaking ? 'w-3.5 h-3 rounded-full animate-pulse' :
                    mood === 'happy' || mood === 'celebrate' ? 'w-3.5 h-1.5 rounded-b-full' :
                    'w-2 h-0.5'
                  )}
                />
              </div>

              {/* Arms */}
              <div className="absolute w-24 flex items-center justify-between pointer-events-none">
                <div
                  className={cn(
                    'w-3.5 h-6 bg-amber-400 rounded-full shadow-md transition-transform duration-200',
                    gesture === 'waving_arms' ? (waveStep % 2 === 0 ? '-rotate-45 -translate-y-2' : '-rotate-12') :
                    gesture === 'spread' ? '-rotate-60 -translate-y-2' : 'rotate-0'
                  )}
                />
                <div
                  className={cn(
                    'w-3.5 h-6 bg-amber-400 rounded-full shadow-md transition-transform duration-200',
                    gesture === 'waving_arms' ? (waveStep % 2 === 0 ? 'rotate-45 -translate-y-2' : 'rotate-12') :
                    gesture === 'spread' ? 'rotate-60 -translate-y-2' : 'rotate-0'
                  )}
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] font-semibold text-slate-400 mt-2">
            {isListening ? '🔴 Зерфик слушает вас...' :
             isSpeaking ? '🔊 Зерфик говорит...' :
             isLoading ? '💭 Зерфик думает над ответом...' :
             'Нажмите и удерживайте кнопку ниже, чтобы поговорить'}
          </p>
        </div>

        {/* Live Conversation Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {messages.map(m => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={cn(
                  'max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed',
                  m.role === 'user'
                    ? 'bg-amber-500 text-slate-950 font-semibold rounded-br-none shadow-sm'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Push-to-Talk Action Bar */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <button
            onMouseDown={handleStartTalk}
            onMouseUp={handleStopTalk}
            onTouchStart={handleStartTalk}
            onTouchEnd={handleStopTalk}
            disabled={isLoading || isSpeaking}
            className={cn(
              'w-full max-w-xs py-3.5 rounded-2xl font-bold text-xs shadow-xl transition-all select-none cursor-pointer flex items-center justify-center gap-2 transform active:scale-95',
              isListening
                ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/30'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950'
            )}
          >
            <Mic className="w-4 h-4" />
            <span>{isListening ? 'Слушаю вас... (Отпустите)' : 'Зажмите, чтобы говорить с Зерфиком'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
