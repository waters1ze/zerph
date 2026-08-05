'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, Check, X, Loader2, AlertCircle, Sparkles, Volume2, CheckCircle2, Search } from 'lucide-react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Task, Goal, Note } from '@/lib/types'
import { GROQ_API_KEY } from '@/lib/config'

interface ParsedResult {
  type: 'task' | 'goal' | 'note' | 'project' | 'reminder' | 'completion'
  title: string
  summary: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate?: string | null
  dueTime?: string | null
  targetTitle?: string | null
  tags: string[]
  subtasks?: string[]
  milestones?: string[]
  motivation?: string
  rawText: string
}

interface VoiceRecorderProps {
  open: boolean
  onClose: () => void
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-emerald-500',
  low: 'bg-blue-400',
}

const TYPE_EMOJI: Record<string, string> = {
  task: '✅', goal: '🎯', note: '📌', project: '📁', reminder: '⏰', completion: '✔️',
}

export function VoiceRecorder({ open, onClose }: VoiceRecorderProps) {
  const { state, dispatch } = useApp()
  const [stage, setStage] = useState<'idle' | 'requesting' | 'recording' | 'processing' | 'result' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParsedResult | null>(null)
  const [completedTask, setCompletedTask] = useState<Task | null>(null)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const reset = useCallback(() => {
    setStage('idle')
    setError(null)
    setResult(null)
    setCompletedTask(null)
    setDuration(0)
    setAudioLevel(0)
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => { if (!open) reset() }, [open, reset])
  useEffect(() => { if (stage === 'recording' && duration >= 120) stopRecording() }, [duration, stage])

  const startRecording = async () => {
    setStage('requesting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(stream).connect(analyser)

      const trackLevel = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        setAudioLevel(data.reduce((a, b) => a + b, 0) / data.length / 128)
        animFrameRef.current = requestAnimationFrame(trackLevel)
      }
      trackLevel()

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        stream.getTracks().forEach(t => t.stop())
        await processAudio(new Blob(chunksRef.current, { type: mimeType }), mimeType)
      }
      recorder.start(100)
      setStage('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch {
      setStage('error')
      setError('Microphone access denied. Please allow it in browser settings.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setStage('processing')
    }
  }

  const processAudio = async (blob: Blob, mimeType: string) => {
    try {
      const ext = mimeType.includes('webm') ? 'webm' : 'ogg'
      const fd = new FormData()
      fd.append('file', blob, `voice.${ext}`)
      fd.append('apiKey', GROQ_API_KEY)

      const res = await fetch('/api/voice', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Processing failed')

      setResult(data.item)
      if (data.completedTask) setCompletedTask(data.completedTask)
      setStage('result')
    } catch (err: unknown) {
      setStage('error')
      setError(err instanceof Error ? err.message : 'Failed to process voice')
    }
  }

  const confirmResult = () => {
    if (!result) return
    const now = new Date().toISOString()
    const id = 'v_' + Math.random().toString(36).substring(2, 9)

    if (result.type === 'completion') {
      // Find and mark task done in local state too
      const targetTitle = result.targetTitle || result.title
      const found = state.tasks.find(t =>
        t.status !== 'done' &&
        (t.title.toLowerCase().includes(targetTitle.toLowerCase()) ||
         targetTitle.toLowerCase().includes(t.title.toLowerCase()))
      )
      if (found) {
        dispatch({ type: 'UPDATE_TASK', task: { ...found, status: 'done', completedAt: now } })
      }
      onClose()
      return
    }

    if (result.type === 'goal') {
      const goal: Goal = {
        id, title: result.title, description: result.summary,
        motivation: result.motivation, status: 'on_track',
        deadline: result.dueDate || undefined, progress: 0,
        milestones: (result.milestones || []).map((m, i) => ({ id: `m_${id}_${i}`, title: m, done: false })),
        projectIds: [], noteIds: [], createdAt: now, updatedAt: now, color: '#2d7a4f',
      }
      dispatch({ type: 'ADD_GOAL', goal })
    } else if (result.type === 'note') {
      const note: Note = {
        id, title: result.title,
        content: result.summary.includes('#') ? result.summary : `# ${result.title}\n\n${result.summary}`,
        originalText: result.rawText,
        type: 'note', tags: result.tags || [], taskIds: [],
        createdAt: now, updatedAt: now, aiGenerated: true,
      }
      dispatch({ type: 'ADD_NOTE', note })
    } else {
      const task: Task = {
        id, title: result.title, description: result.summary,
        priority: result.priority || 'medium', status: 'todo',
        dueDate: result.dueDate || new Date().toISOString().slice(0, 10),
        dueTime: result.dueTime || undefined,
        tags: result.tags || [], assignees: [], isShared: false,
        createdAt: now, updatedAt: now, aiGenerated: true,
        source: `🎙️ "${result.rawText.slice(0, 60)}${result.rawText.length > 60 ? '…' : ''}"`,
        subtasks: (result.subtasks || []).map((st, i) => ({ id: `st_${id}_${i}`, title: st, done: false })),
      }
      dispatch({ type: 'ADD_TASK', task })
    }

    onClose()
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="vr-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => { reset(); onClose() }} />

          <motion.div key="vr-modal" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Voice Command</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {stage === 'recording' ? `🔴 ${fmt(duration)}` : 'Groq Whisper AI'}
                    </p>
                  </div>
                </div>
                <button onClick={() => { reset(); onClose() }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 pb-5 pt-4 space-y-4">

                {/* IDLE */}
                {stage === 'idle' && (
                  <div className="flex flex-col items-center gap-4 py-3">
                    <p className="text-[12px] text-muted-foreground text-center leading-relaxed">
                      Say a task, goal, or note — or say <span className="text-primary font-medium">"I finished…"</span> to complete one.
                    </p>
                    <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }} onClick={startRecording}
                      className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30">
                      <Mic className="w-7 h-7" />
                    </motion.button>
                    <p className="text-[11px] text-muted-foreground">Tap to record</p>
                  </div>
                )}

                {/* REQUESTING */}
                {stage === 'requesting' && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-[13px] text-muted-foreground">Requesting microphone…</p>
                  </div>
                )}

                {/* RECORDING */}
                {stage === 'recording' && (
                  <div className="flex flex-col items-center gap-4 py-3">
                    <div className="relative flex items-center justify-center">
                      <motion.div animate={{ scale: 1 + audioLevel * 0.5, opacity: 0.25 }} transition={{ duration: 0.05 }}
                        className="absolute w-24 h-24 rounded-full bg-red-500/20" />
                      <motion.div animate={{ scale: 1 + audioLevel * 0.3 }} transition={{ duration: 0.05 }}
                        className="absolute w-20 h-20 rounded-full bg-red-500/15" />
                      <motion.button whileTap={{ scale: 0.95 }} onClick={stopRecording}
                        className="relative w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/40 z-10">
                        <Square className="w-6 h-6 fill-current" />
                      </motion.button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[14px] font-mono font-semibold">{fmt(duration)}</span>
                    </div>
                    <div className="flex items-end gap-0.5 h-6">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <motion.div key={i} className="w-1 rounded-full bg-primary"
                          animate={{ height: `${Math.max(3, Math.min(24, audioLevel * 20 * (0.5 + Math.sin(Date.now() / 180 + i) * 0.5)))}px` }}
                          transition={{ duration: 0.08 }} />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Recording… tap ■ to stop</p>
                  </div>
                )}

                {/* PROCESSING */}
                {stage === 'processing' && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    </div>
                    <p className="text-[13px] font-medium">Zerf AI is thinking…</p>
                    <p className="text-[11px] text-muted-foreground text-center">Transcribing · Classifying · Structuring</p>
                  </div>
                )}

                {/* RESULT — COMPLETION */}
                {stage === 'result' && result?.type === 'completion' && (
                  <div className="space-y-3">
                    <div className="flex flex-col items-center gap-3 py-3">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}
                        className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                      </motion.div>
                      <p className="text-[14px] font-semibold text-foreground">Task completed!</p>
                      {completedTask ? (
                        <div className="w-full p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                          <p className="text-[12px] text-muted-foreground">Matched task:</p>
                          <p className="text-[13px] font-semibold text-foreground mt-0.5 line-through decoration-emerald-500">
                            {completedTask.title}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border w-full">
                          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                          <p className="text-[12px] text-muted-foreground">
                            Looking for: <span className="text-foreground font-medium">{result.targetTitle || result.title}</span>
                          </p>
                        </div>
                      )}
                      {result.rawText && (
                        <p className="text-[11px] text-muted-foreground/60 italic text-center">
                          "{result.rawText.slice(0, 80)}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={reset}
                        className="flex-1 h-9 rounded-xl border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Record again
                      </button>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={confirmResult}
                        className="flex-1 h-9 rounded-xl bg-emerald-600 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:opacity-90">
                        <Check className="w-3.5 h-3.5" />
                        Confirm
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* RESULT — NORMAL */}
                {stage === 'result' && result && result.type !== 'completion' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{TYPE_EMOJI[result.type] || '✅'}</span>
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                          {result.type}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[result.priority])} />
                          <span className="text-[11px] font-semibold capitalize">{result.priority}</span>
                        </div>
                      </div>
                      <p className="text-[14px] font-semibold text-foreground leading-snug">{result.title}</p>
                      {result.type !== 'note' && (
                        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">{result.summary}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                        {result.dueDate && <span>📅 {result.dueDate}</span>}
                        {result.dueTime && <span className="text-primary font-semibold">⏰ {result.dueTime}</span>}
                      </div>
                      {result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {result.tags.map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">#{tag}</span>
                          ))}
                        </div>
                      )}
                      {result.subtasks && result.subtasks.length > 0 && (
                        <div className="space-y-0.5 pt-0.5">
                          {result.subtasks.map((st, i) => (
                            <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />{st}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50 italic">
                      <Volume2 className="w-3 h-3 shrink-0" />
                      <span className="line-clamp-1">"{result.rawText}"</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={reset}
                        className="flex-1 h-9 rounded-xl border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Discard
                      </button>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={confirmResult}
                        className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:opacity-90">
                        <Check className="w-3.5 h-3.5" />
                        Add to Zerf
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* ERROR */}
                {stage === 'error' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-foreground/80 leading-snug">{error}</p>
                    </div>
                    <button onClick={() => setStage('idle')}
                      className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90">
                      Try again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
