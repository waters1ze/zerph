'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type ZerfikMood } from '@/components/views/tikhonya-mascot'
import { getAuthHeaders } from '@/lib/store'

export type ZerfikGesture = 'none' | 'chair_sit' | 'waving_arms' | 'jump_and_float' | 'spread' | 'head_tilt' | 'nod'

export interface LiveChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  mood?: ZerfikMood
  gesture?: ZerfikGesture
  timestamp: number
}

export interface ZerfikVoiceProfile {
  id: string
  name: string
  subtitle: string
  tag: string
  gender: 'male' | 'female'
  pitch: number
  rate: number
  description: string
}

export const ZERFIK_VOICE_PROFILES: ZerfikVoiceProfile[] = [
  {
    id: 'zerfik_original',
    name: 'Зерфик (Тихоня / Магический)',
    subtitle: 'Звонкий, светлый, сказочный',
    tag: 'Фирменный',
    gender: 'male',
    pitch: 1.70,
    rate: 1.12,
    description: 'Звонкий и светлый тембр духа-Тихони для волшебной и дружеской атмосферы.',
  },
  {
    id: 'zerfik_friend',
    name: 'Зерфик (Живой друг)',
    subtitle: 'Естественный, живой, разговорный',
    tag: 'Человек',
    gender: 'male',
    pitch: 1.05,
    rate: 1.05,
    description: 'Естественная человеческая речь, разговорный стиль и быстрый диалог без роботоподобности.',
  },
  {
    id: 'alex_baritone',
    name: 'Алекс (Бархатный бас)',
    subtitle: 'Глубокий, плотный мужской баритон',
    tag: 'Бас',
    gender: 'male',
    pitch: 0.35,
    rate: 0.82,
    description: 'Глубокий бархатный мужской бас для спокойного разбора дня и солидных ответов.',
  },
  {
    id: 'viktor_brutal',
    name: 'Виктор (Суровый командир)',
    subtitle: 'Грубый, низкий, с хрипотцой',
    tag: 'Брутал',
    gender: 'male',
    pitch: 0.22,
    rate: 0.86,
    description: 'Суровый, низкий и грубый мужской голос для дисциплины и железной продуктивности.',
  },
  {
    id: 'dmitry_business',
    name: 'Дмитрий (Коуч / Драйв)',
    subtitle: 'Энергичный, мотивирующий, четкий',
    tag: 'Драйв',
    gender: 'male',
    pitch: 0.88,
    rate: 1.30,
    description: 'Динамичный и напористый мужской тембр для тайм-менеджмента и продуктивного фокуса.',
  },
  {
    id: 'alisa_soft',
    name: 'Алиса (Нежный / Мягкий)',
    subtitle: 'Светлый, женский, умиротворяющий',
    tag: 'Нежный',
    gender: 'female',
    pitch: 1.38,
    rate: 0.94,
    description: 'Приятный женский голос с мягкими интонациями для уютных разговоров.',
  },
  {
    id: 'elena_business',
    name: 'Елена (Деловой / Четкий)',
    subtitle: 'Уверенный, структурный, женский',
    tag: 'Бизнес',
    gender: 'female',
    pitch: 0.98,
    rate: 1.16,
    description: 'Четкий и выразительный женский голос персонального бизнес-ассистента.',
  },
]

interface ZerficLiveContextType {
  isActive: boolean
  isListening: boolean
  isThinking: boolean
  isSpeaking: boolean
  isMuted: boolean
  autoListen: boolean
  audioLevel: number
  statusText: string
  interimText: string
  mood: ZerfikMood
  gesture: ZerfikGesture
  selectedVoiceId: string
  voiceVolume: number
  selectedModelId: string
  messages: LiveChatMessage[]
  setIsMuted: (val: boolean) => void
  setAutoListen: (val: boolean) => void
  setSelectedVoiceId: (val: string) => void
  setVoiceVolume: (val: number) => void
  setSelectedModelId: (val: string) => void
  setMood: (val: ZerfikMood) => void
  setGesture: (val: ZerfikGesture) => void
  startListeningSession: () => Promise<void>
  stopListeningSession: () => void
  sendToZerfik: (text: string) => Promise<void>
  speakText: (text: string, voiceOverride?: string | ZerfikVoiceProfile) => void
  stopSpeaking: () => void
  clearMessages: () => void
}

const ZerficLiveContext = createContext<ZerficLiveContextType | null>(null)

export function ZerficLiveProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [autoListen, setAutoListen] = useState(true)
  const [audioLevel, setAudioLevel] = useState(0)
  const [statusText, setStatusText] = useState('Зерфик готов к общению')
  const [interimText, setInterimText] = useState('')
  const [mood, setMood] = useState<ZerfikMood>('happy')
  const [gesture, setGesture] = useState<ZerfikGesture>('chair_sit')

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('zerfik_original')
  const [voiceVolume, setVoiceVolume] = useState<number>(0.85)
  const [selectedModelId, setSelectedModelId] = useState<string>('allam-2-7b')
  const [messages, setMessages] = useState<LiveChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zerf_live_chat_history')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {}
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Привет! Я Зерфик в живом голосовом эфире. Задавай вопросы, надиктовывай задачи или давай просто поболтаем!',
        mood: 'happy',
        gesture: 'waving_arms',
        timestamp: Date.now(),
      },
    ]
  })

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recognitionRef = useRef<any>(null)
  const isSpeakingRef = useRef(false)
  const isActiveRef = useRef(false)
  const silenceTimerRef = useRef<any>(null)
  const lastProcessedSpeechRef = useRef<{ text: string; time: number }>({ text: '', time: 0 })
  const currentSpokenTextRef = useRef<string>('')
  const isInterruptedRef = useRef(false)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  isActiveRef.current = isActive

  // Persist chat history
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('zerf_live_chat_history', JSON.stringify(messages.slice(-30)))
      } catch {}
    }
  }, [messages])

  // Broadcast state updates to widget and parent window
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zerfic_live_state_change', {
          detail: {
            isActive,
            isSpeaking,
            isThinking,
            isListening,
            statusText,
            interimText,
          },
        })
      )
    }
  }, [isActive, isSpeaking, isThinking, isListening, statusText, interimText])

  const browserVoicesRef = useRef<SpeechSynthesisVoice[]>([])

  // Preload and cache browser synthesizer voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v && v.length > 0) {
        browserVoicesRef.current = v
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    const timer = setTimeout(loadVoices, 300)
    return () => clearTimeout(timer)
  }, [])

  const selectedVoice = useMemo(() => {
    return ZERFIK_VOICE_PROFILES.find(v => v.id === selectedVoiceId) || ZERFIK_VOICE_PROFILES[0]
  }, [selectedVoiceId])

  // Stop active speech synthesis
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    isSpeakingRef.current = false
    currentSpokenTextRef.current = ''
    setIsSpeaking(false)
    isInterruptedRef.current = true
  }, [])

  // Speech synthesis with distinct timbres, real-world cadence and pitch modulation
  const speakText = useCallback((textToSpeak: string, voiceOverride?: string | ZerfikVoiceProfile) => {
    if (typeof window === 'undefined') return
    stopSpeaking()

    const activeVoice = typeof voiceOverride === 'string'
      ? ZERFIK_VOICE_PROFILES.find(v => v.id === voiceOverride) || selectedVoice
      : voiceOverride || selectedVoice

    currentSpokenTextRef.current = textToSpeak.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, '')
    isSpeakingRef.current = true

    if ('speechSynthesis' in window) {
      isInterruptedRef.current = false

      // Character-based speech cadence formatting
      let formattedSpeech = textToSpeak
      if (activeVoice.id === 'alex_baritone') {
        formattedSpeech = formattedSpeech.replace(/([,;:])\s*/g, '$1... ')
      } else if (activeVoice.id === 'viktor_brutal') {
        formattedSpeech = formattedSpeech.replace(/,\s*/g, '. ').replace(/!+/g, '! ')
      } else if (activeVoice.id === 'dmitry_business') {
        formattedSpeech = formattedSpeech.replace(/\.\.+/g, '! ')
      }

      const utterance = new SpeechSynthesisUtterance(formattedSpeech)
      utterance.rate = activeVoice.rate
      utterance.pitch = activeVoice.pitch
      utterance.volume = isMuted ? 0 : voiceVolume
      utterance.lang = 'ru-RU'

      let voices = browserVoicesRef.current
      if (!voices || voices.length === 0) {
        voices = window.speechSynthesis.getVoices() || []
      }
      const ruVoices = voices.filter(v => v.lang.toLowerCase().startsWith('ru'))

      if (ruVoices.length > 0) {
        if (activeVoice.id === 'alisa_soft') {
          const femaleVoice = ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('svetlana') || n.includes('alisa') || n.includes('milena') || n.includes('google русский') || n.includes('dariya')
          }) || ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('female') || n.includes('женск') || !n.includes('pavel')
          }) || ruVoices[0]
          utterance.voice = femaleVoice
        } else if (activeVoice.id === 'elena_business') {
          const femaleVoice = ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('ekaterina') || n.includes('tatiana') || n.includes('irina') || n.includes('female')
          }) || ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('female') || n.includes('женск') || !n.includes('pavel')
          }) || ruVoices[0]
          utterance.voice = femaleVoice
        } else if (activeVoice.id === 'alex_baritone' || activeVoice.id === 'viktor_brutal') {
          const deepMale = ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('dmitry') || n.includes('boris') || n.includes('ivan') || n.includes('aleksandr')
          }) || ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('pavel') || n.includes('male') || n.includes('мужск') || !n.includes('irina')
          }) || ruVoices[0]
          utterance.voice = deepMale
        } else if (activeVoice.id === 'dmitry_business') {
          const fastMale = ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('dmitry') || n.includes('pavel') || n.includes('male')
          }) || ruVoices[0]
          utterance.voice = fastMale
        } else {
          const standardMale = ruVoices.find(v => {
            const n = v.name.toLowerCase()
            return n.includes('pavel') || n.includes('male') || n.includes('google')
          }) || ruVoices[0]
          utterance.voice = standardMale
        }
      }

      utterance.onstart = () => {
        isSpeakingRef.current = true
        setIsSpeaking(true)
        setStatusText(`${activeVoice.name} говорит...`)
      }

      utterance.onend = () => {
        isSpeakingRef.current = false
        currentSpokenTextRef.current = ''
        setIsSpeaking(false)
        if (autoListen && isActiveRef.current && !isInterruptedRef.current) {
          setStatusText('Слушаю вас...')
          setMood('normal')
        } else {
          setStatusText('Готов к разговору')
        }
      }

      utterance.onerror = () => {
        isSpeakingRef.current = false
        currentSpokenTextRef.current = ''
        setIsSpeaking(false)
        setStatusText('Готов к разговору')
      }

      currentUtteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    } else {
      fetch('/api/extensions/zerfic-live/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voiceId: activeVoice.id }),
      })
        .then(r => r.arrayBuffer())
        .then(buf => {
          const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }))
          const audio = new Audio(url)
          audio.volume = isMuted ? 0 : voiceVolume
          isSpeakingRef.current = true
          setIsSpeaking(true)
          setStatusText('Зерфик говорит...')
          audio.onended = () => {
            isSpeakingRef.current = false
            currentSpokenTextRef.current = ''
            setIsSpeaking(false)
            setStatusText(autoListen ? 'Слушаю вас...' : 'Готов к разговору')
          }
          audio.play().catch(() => {
            isSpeakingRef.current = false
            setIsSpeaking(false)
          })
        })
        .catch(() => {
          isSpeakingRef.current = false
          setIsSpeaking(false)
        })
    }
  }, [selectedVoice, voiceVolume, isMuted, autoListen, stopSpeaking])

  // Send message to backend AI
  const sendToZerfik = useCallback(async (userText: string) => {
    const trimmed = userText.trim()
    if (!trimmed) return

    const now = Date.now()
    if (
      lastProcessedSpeechRef.current.text === trimmed &&
      now - lastProcessedSpeechRef.current.time < 2500
    ) {
      return
    }
    lastProcessedSpeechRef.current = { text: trimmed, time: now }

    stopSpeaking()
    setIsThinking(true)
    setStatusText('Зерфик обдумывает ответ...')
    setMood('thinking')
    setGesture('chair_sit')
    setInterimText('')

    const userMsg: LiveChatMessage = {
      id: `u_${now}`,
      role: 'user',
      text: trimmed,
      timestamp: now,
    }

    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].text === trimmed) {
        return prev
      }
      return [...prev, userMsg]
    })

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
          message: trimmed,
          history: historyPayload,
          model: selectedModelId,
          voiceId: selectedVoiceId,
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
      const botGesture: ZerfikGesture = data.gesture || 'waving_arms'

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

      speakText(botReply)
    } catch (err) {
      console.error('Zerfic Live Chat Error:', err)
      setIsThinking(false)
      setStatusText('Ошибка сети')
    }
  }, [messages, selectedModelId, selectedVoiceId, stopSpeaking, speakText])

  // Setup Continuous Speech Recognition & VAD
  const startListeningSession = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx = new AudioCtx()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioCtx
      analyserRef.current = analyser

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

        if (isActiveRef.current) {
          requestAnimationFrame(checkLevel)
        }
      }
      checkLevel()

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ru-RU'

        recognition.onstart = () => {
          setIsListening(true)
          if (!isSpeakingRef.current) {
            setStatusText('Слушаю вас...')
          }
        }

        recognition.onresult = (event: any) => {
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

          const rawText = (finalTranscript || currentInterim).trim()
          const normalizedIncoming = rawText.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, '')

          // Echo cancellation
          if (isSpeakingRef.current && currentSpokenTextRef.current) {
            if (
              currentSpokenTextRef.current.includes(normalizedIncoming) ||
              normalizedIncoming.includes(currentSpokenTextRef.current.slice(0, 30))
            ) {
              return
            }
            if (normalizedIncoming.length > 5) {
              stopSpeaking()
            }
          }

          if (currentInterim) {
            setInterimText(currentInterim)
            setMood('thinking')
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }

          if (finalTranscript.trim()) {
            setInterimText('')
            sendToZerfik(finalTranscript.trim())
          } else if (currentInterim.trim()) {
            silenceTimerRef.current = setTimeout(() => {
              if (currentInterim.trim().length > 1) {
                setInterimText('')
                sendToZerfik(currentInterim.trim())
              }
            }, 650)
          }
        }

        recognition.onerror = (e: any) => {
          console.warn('Speech Recognition notice:', e.error)
        }

        recognition.onend = () => {
          if (isActiveRef.current && autoListen && !isMuted) {
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
      setStatusText('Слушаю вас...')
      setMood('normal')
      setGesture('none')
    } catch (err) {
      console.error('Microphone Access Error:', err)
      setStatusText('Нет доступа к микрофону')
      setIsActive(false)
      setIsListening(false)
    }
  }, [autoListen, isMuted, stopSpeaking, sendToZerfik])

  // Stop session
  const stopListeningSession = useCallback(() => {
    stopSpeaking()
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
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    setIsActive(false)
    setIsListening(false)
    setIsThinking(false)
    setIsSpeaking(false)
    setStatusText('Зерфик готов к общению')
    setMood('happy')
    setGesture('chair_sit')
    setAudioLevel(0)
  }, [stopSpeaking])

  // Background tab persistence resilience: auto-resume recognition if browser paused it on tab change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isActiveRef.current && autoListen && !isMuted) {
        if (!document.hidden && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch {}
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [autoListen, isMuted])

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Привет! История диалога очищена. Я слушаю!',
        mood: 'happy',
        gesture: 'waving_arms',
        timestamp: Date.now(),
      },
    ])
    try {
      localStorage.removeItem('zerf_live_chat_history')
    } catch {}
  }, [])

  return (
    <ZerficLiveContext.Provider
      value={{
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
      }}
    >
      {children}
    </ZerficLiveContext.Provider>
  )
}

export function useZerficLive() {
  const context = useContext(ZerficLiveContext)
  if (!context) {
    throw new Error('useZerficLive must be used within a ZerficLiveProvider')
  }
  return context
}
