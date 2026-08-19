'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Mic, MicOff, Square, Maximize2, Sparkles } from 'lucide-react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

export function ZerficLiveFloatingPill() {
  const { state, dispatch } = useApp()
  const [isLiveActive, setIsLiveActive] = useState(false)
  const [liveStatus, setLiveStatus] = useState<'listening' | 'speaking' | 'thinking' | 'idle'>('idle')

  useEffect(() => {
    const handleLiveState = (e: any) => {
      if (e.detail?.active !== undefined) {
        setIsLiveActive(Boolean(e.detail.active))
      }
      if (e.detail?.status) {
        setLiveStatus(e.detail.status)
      }
    }
    window.addEventListener('zerf_live_state_changed', handleLiveState)
    return () => window.removeEventListener('zerf_live_state_changed', handleLiveState)
  }, [])

  // Do not show the floating pill when the user is already on the 'live' view
  if (!isLiveActive || state.currentView === 'live') {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-card/90 backdrop-blur-xl border border-primary/40 shadow-2xl shadow-primary/20 select-none cursor-pointer"
        onClick={() => dispatch({ type: 'SET_VIEW', view: 'live' })}
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">Зерфик Live</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {liveStatus === 'speaking' ? 'говорит...' : liveStatus === 'thinking' ? 'обдумывает...' : 'слушает...'}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'SET_VIEW', view: 'live' })
          }}
          className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors ml-1"
          title="Открыть Зерфик Live"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
