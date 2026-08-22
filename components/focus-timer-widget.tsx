'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { playAlarmChime, showWebNotification } from '@/lib/notifications'
import { Zap, Play, Pause, RotateCcw, Plus, CheckCircle2, Volume2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const DURATIONS = [
  { label: '15м', value: 15 * 60 },
  { label: '25м', value: 25 * 60 },
  { label: '45м', value: 45 * 60 },
  { label: '60м', value: 60 * 60 },
]

export function FocusTimerWidget() {
  const { dispatch } = useApp()
  const [totalSeconds, setTotalSeconds] = useState(25 * 60)
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Restore saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zerf_focus_widget_state')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.isRunning && parsed.targetTimestamp) {
          const now = Date.now()
          const left = Math.max(0, Math.floor((parsed.targetTimestamp - now) / 1000))
          setTotalSeconds(parsed.totalSeconds || 25 * 60)
          setRemainingSeconds(left)
          if (left > 0) {
            setIsRunning(true)
          } else {
            setIsCompleted(true)
          }
        } else if (parsed.remainingSeconds) {
          setTotalSeconds(parsed.totalSeconds || 25 * 60)
          setRemainingSeconds(parsed.remainingSeconds)
          setIsRunning(false)
        }
      }
    } catch {}
  }, [])

  // Save state on change
  useEffect(() => {
    try {
      if (isRunning) {
        localStorage.setItem('zerf_focus_widget_state', JSON.stringify({
          isRunning: true,
          totalSeconds,
          targetTimestamp: Date.now() + remainingSeconds * 1000,
        }))
      } else {
        localStorage.setItem('zerf_focus_widget_state', JSON.stringify({
          isRunning: false,
          totalSeconds,
          remainingSeconds,
        }))
      }
    } catch {}
  }, [isRunning, remainingSeconds, totalSeconds])

  // Timer tick
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            setIsRunning(false)
            setIsCompleted(true)
            playAlarmChime('complete')
            showWebNotification('🎉 Фокус-сессия завершена!', {
              body: 'Отличная работа! Сделайте короткий перерыв на 5 минут.'
            })
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning])

  const handleStart = () => {
    setIsCompleted(false)
    if (remainingSeconds === 0) {
      setRemainingSeconds(totalSeconds)
    }
    setIsRunning(true)
  }

  const handlePause = () => {
    setIsRunning(false)
  }

  const handleReset = () => {
    setIsRunning(false)
    setIsCompleted(false)
    setRemainingSeconds(totalSeconds)
  }

  const handleSelectDuration = (sec: number) => {
    setIsRunning(false)
    setIsCompleted(false)
    setTotalSeconds(sec)
    setRemainingSeconds(sec)
  }

  const handleAddFiveMinutes = () => {
    setRemainingSeconds(prev => prev + 5 * 60)
    setTotalSeconds(prev => prev + 5 * 60)
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const progressPercent = Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))

  return (
    <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-4 shadow-xs relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
            isRunning ? 'bg-amber-500/20 text-amber-500 animate-pulse' : 'bg-primary/15 text-primary'
          )}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground leading-tight flex items-center gap-1.5">
              <span>Фокус-сессия</span>
              {isRunning && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isRunning ? 'Сессия в процессе...' : isCompleted ? 'Сессия завершена' : 'Таймер глубокой работы'}
            </p>
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'clock' })}
          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
        >
          Все таймеры →
        </button>
      </div>

      {/* Main Clock Card */}
      <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/40 border border-border/60 relative overflow-hidden">
        {/* Progress Bar background */}
        <div
          className="absolute left-0 bottom-0 top-0 bg-primary/10 transition-all duration-1000 ease-linear pointer-events-none"
          style={{ width: `${progressPercent}%` }}
        />

        {isCompleted ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center py-2 text-center z-10"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-foreground">Сессия завершена!</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Время отдохнуть 5 минут</p>
            <button
              onClick={handleReset}
              className="mt-3 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-xs"
            >
              Начать новую сессию
            </button>
          </motion.div>
        ) : (
          <>
            {/* Live Clock Display */}
            <p className={cn(
              'text-4xl font-mono font-black tracking-wider mb-1 z-10 transition-colors',
              isRunning ? 'text-primary' : 'text-foreground'
            )}>
              {formattedTime}
            </p>
            <p className="text-[11px] text-muted-foreground z-10">
              {isRunning
                ? `Осталось ${minutes} мин ${seconds} сек`
                : 'Интервал продуктивности Помодоро'}
            </p>

            {/* Quick preset selector when idle */}
            {!isRunning && remainingSeconds === totalSeconds && (
              <div className="flex items-center gap-1.5 mt-3 z-10">
                {DURATIONS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => handleSelectDuration(d.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                      totalSeconds === d.value
                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                        : 'bg-card text-muted-foreground hover:text-foreground border border-border/60'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3 w-full z-10">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{remainingSeconds < totalSeconds ? 'Продолжить' : 'Запустить фокус'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Пауза</span>
                </button>
              )}

              {/* Reset button if started */}
              {remainingSeconds < totalSeconds && (
                <button
                  type="button"
                  onClick={handleReset}
                  title="Сбросить таймер"
                  className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {/* +5 min button when running */}
              {isRunning && (
                <button
                  type="button"
                  onClick={handleAddFiveMinutes}
                  title="Добавить 5 минут"
                  className="px-2.5 py-2.5 rounded-xl bg-card border border-border text-foreground text-[11px] font-semibold hover:bg-muted active:scale-95 transition-all cursor-pointer flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3 text-primary" />
                  <span>5м</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
