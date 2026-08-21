'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type ZerfikMood } from '@/components/views/tikhonya-mascot'
import { getAuthHeaders, useSettings } from '@/lib/store'

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
    name: 'Зерфик Волшебный',
    subtitle: 'Звонкий, светлый, сказочный',
    tag: 'Фирменный',
    gender: 'male',
    pitch: 1.70,
    rate: 1.12,
    description: 'Звонкий и светлый тембр духа-Тихони для волшебной и дружеской атмосферы.',
  },
  {
    id: 'zerfik_friend',
    name: 'Зерфик Дружелюбный',
    subtitle: 'Естественный, живой, разговорный',
    tag: 'Человек',
    gender: 'male',
    pitch: 1.05,
    rate: 1.05,
    description: 'Естественная человеческая речь, разговорный стиль и быстрый диалог без роботоподобности.',
  },
  {
    id: 'alex_baritone',
    name: 'Зерфик Мужественный',
    subtitle: 'Глубокий, плотный мужской баритон',
    tag: 'Бас',
    gender: 'male',
    pitch: 0.35,
    rate: 0.82,
    description: 'Глубокий бархатный мужской бас для спокойного разбора дня и солидных ответов.',
  },
  {
    id: 'viktor_brutal',
    name: 'Зерфик Суровый',
    subtitle: 'Грубый, низкий, с хрипотцой',
    tag: 'Брутал',
    gender: 'male',
    pitch: 0.22,
    rate: 0.86,
    description: 'Суровый, низкий и грубый мужской голос для дисциплины и железной продуктивности.',
  },
  {
    id: 'dmitry_business',
    name: 'Зерфик Энергичный',
    subtitle: 'Энергичный, мотивирующий, четкий',
    tag: 'Драйв',
    gender: 'male',
    pitch: 0.88,
    rate: 1.30,
    description: 'Динамичный и напористый мужской тембр для тайм-менеджмента и продуктивного фокуса.',
  },
  {
    id: 'alisa_soft',
    name: 'Зерфик Нежный',
    subtitle: 'Светлый, женский, умиротворяющий',
    tag: 'Нежный',
    gender: 'female',
    pitch: 1.38,
    rate: 0.94,
    description: 'Приятный женский голос с мягкими интонациями для уютных разговоров.',
  },
  {
    id: 'elena_business',
    name: 'Зерфик Деловой',
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

  const { settings } = useSettings()
  const configuredModel = settings?.integrations?.aiTaskModels?.extensions || settings?.integrations?.aiModel

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('zerfik_original')
  const [voiceVolume, setVoiceVolume] = useState<number>(0.85)
  const [selectedModelId, setSelectedModelId] = useState<string>(() => configuredModel || 'openai/gpt-oss-20b')

  useEffect(() => {
    if (configuredModel) {
      setSelectedModelId(configuredModel)
    }
  }, [configuredModel])
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
  const speechQueueRef = useRef<string[]>([])
  const activeVoiceRef = useRef<ZerfikVoiceProfile | null>(null)
  // ── Audio-synced text reveal state ──
  const activeBotMsgIdRef = useRef<string | null>(null)
  const fullReplyRef = useRef('')
  const sentenceEndsRef = useRef<number[]>([])
  const sentenceCursorRef = useRef(0)
  const revealIdxRef = useRef(0)
  const revealTimerRef = useRef<any>(null)
  // Guard window after speech ends: mic echo of TTS must not trigger a new turn
  const lastSpeechEndRef = useRef(0)
  // Full text of the last spoken reply — used to filter TTS echo picked up by mic
  const lastSpokenTextRef = useRef('')
  // Stable voice per profile: prevents the voice "drifting" between sentences
  const chosenVoiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

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

  // Reveal exactly N characters of the bot reply in the transcript bubble
  const setRevealedText = useCallback((n: number) => {
    const botMsgId = activeBotMsgIdRef.current
    if (!botMsgId) return
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === botMsgId)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], text: fullReplyRef.current.slice(0, n) }
      return next
    })
  }, [])

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }, [])

  // Progressively reveal text up to `target` over `durationMs`,
  // so on-screen typing speed matches the voice playback speed
  const revealUpTo = useCallback((target: number, durationMs: number) => {
    clearRevealTimer()
    const start = revealIdxRef.current
    if (target <= start) {
      revealIdxRef.current = target
      setRevealedText(target)
      return
    }
    if (durationMs <= 80) {
      revealIdxRef.current = target
      setRevealedText(target)
      return
    }
    const t0 = performance.now()
    revealTimerRef.current = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / durationMs)
      const n = Math.round(start + (target - start) * p)
      revealIdxRef.current = n
      setRevealedText(n)
      if (p >= 1) clearRevealTimer()
    }, 40)
  }, [clearRevealTimer, setRevealedText])

  // Play next sentence in queue for ultra-fast early response start
  const playSentenceFromQueue = useCallback(() => {
    if (speechQueueRef.current.length === 0) {
      isSpeakingRef.current = false
      currentSpokenTextRef.current = ''
      // Finish revealing any remaining text so the bubble shows the full reply
      revealIdxRef.current = fullReplyRef.current.length
      setRevealedText(fullReplyRef.current.length)
      lastSpeechEndRef.current = Date.now()
      lastSpokenTextRef.current = fullReplyRef.current
      setIsSpeaking(false)
      if (autoListen && isActiveRef.current && !isInterruptedRef.current) {
        setStatusText('Слушаю вас...')
        setMood('normal')
      } else {
        setStatusText('Готов к разговору')
      }
      return
    }

    const currentSentence = speechQueueRef.current.shift()
    if (!currentSentence || !currentSentence.trim()) {
      playSentenceFromQueue()
      return
    }

    const activeVoice = activeVoiceRef.current || selectedVoice

    currentSpokenTextRef.current = currentSentence.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, '')
    isSpeakingRef.current = true
    setIsSpeaking(true)
    setStatusText(`${activeVoice.name} говорит...`)

    // Sync on-screen text with this sentence's estimated voice duration
    const k = sentenceCursorRef.current
    sentenceCursorRef.current += 1
    const startIdx = k === 0 ? 0 : (sentenceEndsRef.current[k - 1] ?? 0)
    const endIdx = sentenceEndsRef.current[k] ?? fullReplyRef.current.length
    // Russian TTS pace ≈ 13 chars/sec scaled by the voice rate
    const cps = 13 * (activeVoice.rate || 1)
    const estMs = Math.max(500, ((endIdx - startIdx) / cps) * 1000)
    revealUpTo(endIdx, estMs)

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      isInterruptedRef.current = false

      let formattedSpeech = currentSentence
      if (activeVoice.id === 'alex_baritone') {
        formattedSpeech = formattedSpeech.replace(/([,;:])\s*/g, '$1... ')
      } else if (activeVoice.id === 'viktor_brutal') {
        formattedSpeech = formattedSpeech.replace(/,\s*/g, '. ').replace(/!+/g, '! ')
      } else if (activeVoice.id === 'dmitry_business') {
        formattedSpeech = formattedSpeech.replace(/\.\.+/g, '! ')
      }

      const utterance = new SpeechSynthesisUtterance(formattedSpeech)
      utterance.rate = activeVoice.rate
      // Clamp pitch: extreme values make some engines fall back to the default voice
      utterance.pitch = Math.min(1.5, Math.max(0.4, activeVoice.pitch))
      utterance.volume = isMuted ? 0 : voiceVolume
      utterance.lang = 'ru-RU'

      // Pick the system voice ONCE per profile and cache it — re-resolving per
      // sentence caused the voice to "drift"/change mid-reply.
      let stableVoice = chosenVoiceCacheRef.current.get(activeVoice.id)
      if (!stableVoice) {
        const voices = browserVoicesRef.current.length > 0
          ? browserVoicesRef.current
          : (window.speechSynthesis.getVoices() || [])
        const ruVoices = voices.filter(v => v.lang.toLowerCase().startsWith('ru'))
        if (ruVoices.length > 0) {
          const wantFemale = activeVoice.gender === 'female'
          stableVoice = wantFemale
            ? (ruVoices.find(v => {
                const n = v.name.toLowerCase()
                return n.includes('svetlana') || n.includes('milena') || n.includes('alisa') ||
                       n.includes('google русский') || n.includes('dariya') || n.includes('ekaterina') ||
                       n.includes('tatiana') || n.includes('irina')
              })
              || ruVoices.find(v => {
                const n = v.name.toLowerCase()
                return n.includes('female') || n.includes('женск') || !n.includes('pavel')
              })
              || ruVoices[0])
            : (ruVoices.find(v => {
                const n = v.name.toLowerCase()
                return n.includes('pavel') || n.includes('dmitry') || n.includes('yuri') ||
                       n.includes('male') || n.includes('мужск')
              })
              || ruVoices[0])
          if (stableVoice) chosenVoiceCacheRef.current.set(activeVoice.id, stableVoice)
        }
      }
      if (stableVoice) utterance.voice = stableVoice

      utterance.onend = () => {
        if (!isInterruptedRef.current) {
          // Snap reveal to this sentence's true end to avoid text/audio drift
          const sentEnd = sentenceEndsRef.current[sentenceCursorRef.current - 1] ?? fullReplyRef.current.length
          revealIdxRef.current = sentEnd
          setRevealedText(sentEnd)
          playSentenceFromQueue()
        }
      }

      utterance.onerror = () => {
        if (!isInterruptedRef.current) {
          playSentenceFromQueue()
        }
      }

      currentUtteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    } else {
      fetch('/api/extensions/zerfic-live/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentSentence, voiceId: activeVoice.id }),
      })
        .then(r => r.arrayBuffer())
        .then(buf => {
          const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }))
          const audio = new Audio(url)
          audio.volume = isMuted ? 0 : voiceVolume
          audio.onended = () => {
            if (!isInterruptedRef.current) {
              const sentEnd = sentenceEndsRef.current[sentenceCursorRef.current - 1] ?? fullReplyRef.current.length
              revealIdxRef.current = sentEnd
              setRevealedText(sentEnd)
              playSentenceFromQueue()
            }
          }
          audio.play().catch(() => {
            playSentenceFromQueue()
          })
        })
        .catch(() => {
          playSentenceFromQueue()
        })
    }
  }, [selectedVoice, voiceVolume, isMuted, autoListen, revealUpTo, setRevealedText])

  // Stop active speech synthesis and clear sentence queue
  const stopSpeaking = useCallback(() => {
    speechQueueRef.current = []
    clearRevealTimer()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    isSpeakingRef.current = false
    currentSpokenTextRef.current = ''
    lastSpeechEndRef.current = Date.now()
    setIsSpeaking(false)
    isInterruptedRef.current = true
  }, [clearRevealTimer])

  // Speech synthesis with distinct timbres, real-world cadence and sentence-by-sentence streaming
  const speakText = useCallback((textToSpeak: string, voiceOverride?: string | ZerfikVoiceProfile) => {
    if (typeof window === 'undefined') return
    stopSpeaking()

    const activeVoice = typeof voiceOverride === 'string'
      ? ZERFIK_VOICE_PROFILES.find(v => v.id === voiceOverride) || selectedVoice
      : voiceOverride || selectedVoice

    activeVoiceRef.current = activeVoice
    isInterruptedRef.current = false

    // Split text into natural sentence chunks for rapid early-start playback.
    // The first sentence starts speaking immediately while the rest are queued,
    // and on-screen text is revealed in sync with each sentence's audio.
    const rawSentences = textToSpeak
      .replace(/([.!?])\s+/g, '$1|__SPLIT__|')
      .split('|__SPLIT__|')
      .map(s => s.trim())
      .filter(Boolean)

    const sentences = rawSentences.length > 0 ? rawSentences : [textToSpeak]

    fullReplyRef.current = textToSpeak
    sentenceCursorRef.current = 0
    revealIdxRef.current = 0
    let acc = 0
    sentenceEndsRef.current = sentences.map(s => {
      acc += s.length + 1
      return acc
    })

    speechQueueRef.current = sentences
    playSentenceFromQueue()
  }, [stopSpeaking, selectedVoice, playSentenceFromQueue])

  // Append newly streamed sentences to the active speech queue WITHOUT
  // resetting it — used by live streaming so later sentences continue
  // seamlessly after the first one already started playing.
  const queueMoreSpeech = useCallback((moreText: string) => {
    const parts = moreText
      .replace(/([.!?])\s+/g, '$1|__SPLIT__|')
      .split('|__SPLIT__|')
      .map(s => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return

    const sep = fullReplyRef.current && !/\s$/.test(fullReplyRef.current) ? ' ' : ''
    const baseLen = fullReplyRef.current.length + sep.length
    fullReplyRef.current = fullReplyRef.current + sep + moreText

    let acc = baseLen
    for (const p of parts) {
      acc += p.length + 1
      sentenceEndsRef.current.push(acc)
    }
    speechQueueRef.current.push(...parts)

    // If playback already finished naturally, kick off the newly queued text
    if (!isSpeakingRef.current && !isInterruptedRef.current && speechQueueRef.current.length > 0) {
      playSentenceFromQueue()
    }
  }, [playSentenceFromQueue])

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
          stream: true,
        }),
      })

      // Create the assistant bubble up-front so the audio-synced reveal loop
      // can fill it while sentences stream in and get spoken.
      const botMsgId = `b_${Date.now()}`
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'assistant',
        text: '',
        mood: 'happy',
        gesture: 'waving_arms',
        timestamp: Date.now(),
      }])

      // ── TRUE LIVE STREAMING: speak each sentence the moment it is generated ──
      const respType = res.headers.get('content-type') || ''
      if (respType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let sseBuf = ''
        let textBuf = ''
        let processedIdx = 0
        let speechStarted = false
        let gotAnyText = false
        let streamError: string | null = null

        const flushCompletedSentences = () => {
          const re = /[^.!?…]+[.!?…]+/g
          re.lastIndex = 0
          let lastEnd = -1
          let m: RegExpExecArray | null
          while ((m = re.exec(textBuf)) !== null) {
            lastEnd = re.lastIndex
          }
          if (lastEnd > processedIdx) {
            const chunk = textBuf.slice(processedIdx, lastEnd)
            processedIdx = lastEnd
            if (!speechStarted) {
              speechStarted = true
              activeBotMsgIdRef.current = botMsgId
              setIsThinking(false)
              setStatusText(`${selectedVoice.name} говорит...`)
              speakText(chunk, selectedVoiceId)
            } else {
              queueMoreSpeech(chunk)
            }
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          sseBuf += decoder.decode(value, { stream: true })
          // Split SSE frames without literal newline escapes (tooling-safe)
          const NL = String.fromCharCode(10)
          const blocks = sseBuf.split(NL + NL)
          sseBuf = blocks.pop() || ''
          for (const block of blocks) {
            const lines = block.split(NL)
            const evLine = lines.find(l => l.startsWith('event:'))
            const dataStr = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('')
            if (!evLine || !dataStr) continue
            const ev = evLine.slice(6).trim()
            let d: any = {}
            try { d = JSON.parse(dataStr) } catch { continue }
            if (ev === 'meta') {
              setMood(d.mood || 'happy')
              setGesture(d.gesture || 'waving_arms')
            } else if (ev === 'delta') {
              gotAnyText = true
              textBuf += d.t || ''
              flushCompletedSentences()
            } else if (ev === 'error') {
              streamError = d.message || 'Ошибка стриминга'
            }
          }
        }

        // Speak any remaining tail after the stream ends
        const tail = textBuf.slice(processedIdx).trim()
        if (tail) {
          if (!speechStarted) {
            speechStarted = true
            activeBotMsgIdRef.current = botMsgId
            setIsThinking(false)
            setStatusText(`${selectedVoice.name} говорит...`)
            speakText(tail, selectedVoiceId)
          } else {
            queueMoreSpeech(tail)
          }
        } else if (!gotAnyText && !speechStarted) {
          activeBotMsgIdRef.current = botMsgId
          setIsThinking(false)
          speakText(streamError || 'Я тебя услышал!', selectedVoiceId)
        }
        return
      }

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

      setMood(botMood)
      setGesture(botGesture)
      setIsThinking(false)
      setStatusText(`${selectedVoice.name} говорит...`)

      // The transcript bubble is filled by the audio-synced reveal loop inside
      // speakText (sentence-by-sentence, at the speed of the voice) — no separate
      // typewriter here, otherwise two writers would fight over the same message.
      activeBotMsgIdRef.current = botMsgId
      speakText(botReply, selectedVoiceId)
    } catch (err) {
      console.error('Zerfic Live Chat Error:', err)
      setIsThinking(false)
      setStatusText('Ошибка сети')
    }
  }, [messages, selectedModelId, selectedVoiceId, selectedVoice.name, stopSpeaking, speakText])

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
      if (!SpeechRecognition) {
        // Mobile browsers / Telegram WebView often lack the Web Speech API —
        // tell the user honestly instead of silently doing nothing.
        setStatusText('Диктовка не поддерживается в этом браузере — пишите текстом или откройте в Chrome')
      }
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

          // ANTI SELF-INTERRUPTION & ANTI ECHO-TURNS:
          // 1) While Zerfic speaks (and for a guard window after), ALL mic
          //    input is ignored — browser TTS played through speakers gets
          //    picked up by the mic and previously caused self-interruptions
          //    AND phantom follow-up turns (the "multiple answers" bug).
          // 2) Even after the window, input that matches the text Zerfic just
          //    spoke is treated as echo and dropped.
          if (isSpeakingRef.current || Date.now() - lastSpeechEndRef.current < 2500) {
            return
          }
          // Word-overlap echo filter: ASR mishears its own TTS slightly, so an
          // exact substring match is not enough — require <55% word overlap
          // with what was just spoken to accept the turn.
          const normIncoming = rawText.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, '').trim()
          const spokenNorm = (lastSpokenTextRef.current || '').toLowerCase().replace(/[^a-zа-я0-9\s]/gi, '').trim()
          if (normIncoming.length > 6 && spokenNorm.length > 12) {
            const spokenWords = new Set(spokenNorm.split(/\s+/))
            const incWords = normIncoming.split(/\s+/)
            const overlap = incWords.filter(w => spokenWords.has(w)).length
            if (incWords.length > 0 && overlap / incWords.length >= 0.55) {
              return
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
