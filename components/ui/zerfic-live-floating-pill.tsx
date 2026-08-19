'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Square, Maximize2, Sparkles, Volume2 } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useZerficLive } from '@/lib/zerfic-live-context'
import { cn } from '@/lib/utils'

export function ZerficLiveFloatingPill() {
  const { state, dispatch } = useApp()
  const live = useZerficLive()

  const {
    isActive,
    isListening,
    isThinking,
    isSpeaking,
    isMuted,
    statusText,
    interimText,
    audioLevel,
    setIsMuted,
    stopListeningSession,
  } = live

  // Do not show the floating pill when not in an active call or when on the full 'live' view
  if (!isActive || state.currentView === 'live') {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 25, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 25, scale: 0.92 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-card/95 backdrop-blur-2xl border border-primary/40 shadow-2xl shadow-primary/25 select-none"
      >
        {/* Animated Status Indicator */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'live' })}
        >
          <span className="relative flex h-3 w-3">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                isSpeaking ? 'bg-cyan-400' : isListening ? 'bg-emerald-400' : isThinking ? 'bg-amber-400' : 'bg-primary'
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-3 w-3',
                isSpeaking ? 'bg-cyan-500' : isListening ? 'bg-emerald-500' : isThinking ? 'bg-amber-500' : 'bg-primary'
              )}
            />
          </span>

          {/* Soundwave Bars */}
          <div className="flex items-center gap-0.5 h-4">
            {[0.4, 0.8, 1, 0.6, 0.3].map((h, i) => (
              <motion.span
                key={i}
                animate={{
                  scaleY: isSpeaking
                    ? [0.3, 1.2, 0.4]
                    : isListening
                    ? [0.2, 0.4 + audioLevel * 2, 0.2]
                    : 0.3,
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.1,
                }}
                className={cn(
                  'w-0.75 h-full rounded-full',
                  isSpeaking ? 'bg-cyan-400' : isListening ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                )}
              />
            ))}
          </div>

          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-xs font-bold text-foreground leading-tight flex items-center gap-1">
              <span>Зерфик Live</span>
              <span className="text-[10px] text-primary/80 font-normal">в эфире</span>
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[130px] leading-tight">
              {isSpeaking ? 'Говорит...' : isThinking ? 'Думает...' : interimText || statusText}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 border-l border-border/80 pl-2">
          {/* Mute Mic Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsMuted(!isMuted)
            }}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              isMuted
                ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
            title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              stopListeningSession()
            }}
            className="p-1.5 rounded-full bg-destructive/15 hover:bg-destructive text-destructive hover:text-destructive-foreground transition-all"
            title="Завершить разговор"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Maximize to full 3D Live view */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'SET_VIEW', view: 'live' })
            }}
            className="p-1.5 rounded-full bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground transition-all"
            title="Развернуть на весь экран"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
