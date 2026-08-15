'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { playAlarmChime, showWebNotification, requestNotificationPermission } from '@/lib/notifications'
import {
  Clock, Timer, Play, Pause, RotateCcw, CheckCircle2,
  Bell, Volume2, Sparkles, Flame, Flag, AlertCircle, ArrowRight
} from 'lucide-react'

type ClockTab = 'task_countdown' | 'timer' | 'stopwatch'

export function ClockView() {
  const { state, dispatch } = useApp()
  const [activeTab, setActiveTab] = useState<ClockTab>('task_countdown')
  const [notifGranted, setNotifGranted] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifGranted(Notification.permission === 'granted')
    }
  }, [])

  const handleEnableNotifs = async () => {
    const granted = await requestNotificationPermission()
    setNotifGranted(granted)
    if (granted) {
      playAlarmChime('complete')
      showWebNotification('✅ Уведомления включены!', {
        body: 'Zerf AI будет присылать звуковые сигналы и напоминания о задачах и таймерах.'
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-primary" />
            Часы, Таймеры и Отсчет
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Живой отсчет времени до дедлайнов задач, универсальный таймер и точный секундомер
          </p>
        </div>

        {/* Browser Notifications Permission Pill */}
        {!notifGranted && (
          <button
            onClick={handleEnableNotifs}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-all self-start sm:self-auto"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Включить звуковые пуши</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border/80 rounded-2xl w-full sm:w-max">
        {[
          { id: 'task_countdown', label: '⏳ Отсчет до задачи', icon: Clock },
          { id: 'timer',          label: '⏱️ Таймер',           icon: Timer },
          { id: 'stopwatch',      label: '⏲️ Секундомер',       icon: Flag },
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ClockTab)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                active
                  ? 'bg-card text-foreground shadow-md border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'task_countdown' && <TaskCountdownTab key="task_countdown" />}
        {activeTab === 'timer' && <CustomTimerTab key="timer" />}
        {activeTab === 'stopwatch' && <StopwatchTab key="stopwatch" />}
      </AnimatePresence>
    </div>
  )
}

// ── 1. Task Countdown Tab ──────────────────────────────────────────────────

function getTaskDueTimestamp(t: { dueDate?: string; dueTime?: string }): number {
  const todayStr = new Date().toISOString().slice(0, 10)
  const d = t.dueDate || todayStr
  const tm = t.dueTime || '23:59'
  const [h, m] = tm.split(':').map(Number)
  const date = new Date(d)
  date.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0)
  return date.getTime()
}

function TaskCountdownTab() {
  const { state, dispatch } = useApp()
  const nowMs = Date.now()

  // Chronologically sort all non-done tasks so the closest upcoming task is FIRST
  const sortedTasks = useMemo(() => {
    return [...state.tasks]
      .filter(t => t.status !== 'done')
      .map(t => ({
        task: t,
        ts: getTaskDueTimestamp(t),
      }))
      .sort((a, b) => {
        const diffA = a.ts - nowMs
        const diffB = b.ts - nowMs
        // Both in the future: smallest positive diff (closest) first
        if (diffA >= 0 && diffB >= 0) return diffA - diffB
        // Upcoming future tasks before overdue tasks
        if (diffA >= 0 && diffB < 0) return -1
        if (diffA < 0 && diffB >= 0) return 1
        // Both overdue: most recently overdue first
        return diffB - diffA
      })
      .map(x => x.task)
  }, [state.tasks, nowMs])

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    sortedTasks[0]?.id || ''
  )

  useEffect(() => {
    if ((!selectedTaskId || !state.tasks.some(t => t.id === selectedTaskId && t.status !== 'done')) && sortedTasks[0]?.id) {
      setSelectedTaskId(sortedTasks[0].id)
    }
  }, [sortedTasks, selectedTaskId, state.tasks])

  const [timeLeft, setTimeLeft] = useState<{
    months: number
    days: number
    hours: number
    minutes: number
    seconds: number
    isOverdue: boolean
    totalSec: number
  }>({
    months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: false, totalSec: 0
  })

  const targetTask = state.tasks.find(t => t.id === selectedTaskId) || sortedTasks[0]

  useEffect(() => {
    if (!targetTask) return

    const updateCountdown = () => {
      const now = new Date()
      const targetTs = getTaskDueTimestamp(targetTask)

      const diffMs = targetTs - now.getTime()
      const isOverdue = diffMs < 0
      const absDiff = Math.abs(diffMs)

      const totalSec = Math.floor(absDiff / 1000)
      const totalDays = Math.floor(totalSec / 86400)
      const months = Math.floor(totalDays / 30)
      const days = totalDays % 30
      const hours = Math.floor((totalSec % 86400) / 3600)
      const minutes = Math.floor((totalSec % 3600) / 60)
      const seconds = totalSec % 60

      setTimeLeft({ months, days, hours, minutes, seconds, isOverdue, totalSec })
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [targetTask])

  const handleComplete = () => {
    if (!targetTask) return
    playAlarmChime('complete')
    dispatch({ type: 'TOGGLE_TASK', id: targetTask.id })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-6"
    >
      {/* Target Task Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border/80 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Выберите задачу для отсчета:
        </label>
        <select
          value={selectedTaskId}
          onChange={e => setSelectedTaskId(e.target.value)}
          className="bg-muted/80 border border-border text-foreground text-sm font-medium rounded-xl px-3 py-2 outline-none cursor-pointer max-w-full sm:max-w-md"
        >
          {sortedTasks.map(t => (
            <option key={t.id} value={t.id}>
              {t.dueTime ? `⏰ ${t.dueTime} — ` : ''}{t.dueDate ? `(${t.dueDate}) ` : ''}{t.title.slice(0, 45)}
            </option>
          ))}
        </select>
      </div>

      {targetTask ? (
        <div className="flex flex-col items-center justify-center p-6 sm:p-12 rounded-3xl bg-gradient-to-b from-card to-card/60 border border-border shadow-xl text-center relative overflow-hidden">
          {/* Subtle glow circle */}
          <div className="absolute w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none -top-10" />

          {/* Status Badge */}
          <span className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border ${
            timeLeft.isOverdue
              ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
          }`}>
            {timeLeft.isOverdue ? '⚠️ Время вышло / Просрочено' : '⏳ До наступления срока осталось:'}
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-foreground max-w-lg mb-2">
            {targetTask.title}
          </h2>
          {targetTask.dueTime && (
            <p className="text-sm text-muted-foreground mb-8">
              Запланировано на: <strong className="text-foreground">{targetTask.dueTime}</strong> {targetTask.dueDate ? `(${targetTask.dueDate})` : ''}
            </p>
          )}

          {/* Big Clock Digits: Months, Days, Hours, Minutes, Seconds */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 my-4 max-w-full">
            {timeLeft.months > 0 && (
              <>
                <div className="flex flex-col items-center">
                  <div className="text-3xl sm:text-6xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl w-18 sm:w-28 py-3 sm:py-5 shadow-inner text-foreground">
                    {String(timeLeft.months).padStart(2, '0')}
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Месяцев</span>
                </div>
                <span className="text-2xl sm:text-5xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>
              </>
            )}

            {(timeLeft.months > 0 || timeLeft.days > 0) && (
              <>
                <div className="flex flex-col items-center">
                  <div className="text-3xl sm:text-6xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl w-18 sm:w-28 py-3 sm:py-5 shadow-inner text-foreground">
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Дней</span>
                </div>
                <span className="text-2xl sm:text-5xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>
              </>
            )}

            <div className="flex flex-col items-center">
              <div className="text-3xl sm:text-6xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl w-18 sm:w-28 py-3 sm:py-5 shadow-inner text-foreground">
                {String(timeLeft.hours).padStart(2, '0')}
              </div>
              <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Часов</span>
            </div>

            <span className="text-2xl sm:text-5xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>

            <div className="flex flex-col items-center">
              <div className="text-3xl sm:text-6xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl w-18 sm:w-28 py-3 sm:py-5 shadow-inner text-foreground">
                {String(timeLeft.minutes).padStart(2, '0')}
              </div>
              <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Минут</span>
            </div>

            <span className="text-2xl sm:text-5xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>

            <div className="flex flex-col items-center">
              <div className="text-3xl sm:text-6xl font-mono font-extrabold tracking-tight bg-primary/10 border border-primary/30 rounded-2xl w-18 sm:w-28 py-3 sm:py-5 shadow-inner text-primary">
                {String(timeLeft.seconds).padStart(2, '0')}
              </div>
              <span className="text-[10px] sm:text-xs uppercase font-semibold text-primary/80 mt-1.5 sm:mt-2">Секунд</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Отметить выполненной</span>
            </button>
            <button
              onClick={() => playAlarmChime('chime')}
              title="Проверить звуковой сигнал"
              className="p-3.5 rounded-2xl bg-muted border border-border hover:bg-muted/80 text-foreground transition-all"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 rounded-3xl bg-card border border-border text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-foreground">Нет активных задач</p>
          <p className="text-xs mt-1">Создайте новую задачу со временем (например, 18:00), чтобы включить живой отсчет!</p>
        </div>
      )}
    </motion.div>
  )
}

// ── 2. Universal Custom Timer Tab ──────────────────────────────────────────
function CustomTimerTab() {
  const [durationSec, setDurationSec] = useState<number>(25 * 60)
  const [remainingSec, setRemainingSec] = useState<number>(25 * 60)
  const [isRunning, setIsRunning] = useState<boolean>(false)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRunning && remainingSec > 0) {
      interval = setInterval(() => {
        setRemainingSec(prev => {
          if (prev <= 1) {
            setIsRunning(false)
            playAlarmChime('alarm')
            showWebNotification('⏰ Таймер завершен!', {
              body: 'Заданное время истекло. Отличная работа!'
            })
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, remainingSec])

  const setPreset = (mins: number) => {
    setIsRunning(false)
    setDurationSec(mins * 60)
    setRemainingSec(mins * 60)
  }

  const mins = Math.floor(remainingSec / 60)
  const secs = remainingSec % 60
  const progressPercent = durationSec > 0 ? ((durationSec - remainingSec) / durationSec) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-3xl bg-card border border-border shadow-xl text-center"
    >
      {/* Presets */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        {[1, 5, 10, 15, 25, 45, 60].map(m => (
          <button
            key={m}
            onClick={() => setPreset(m)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              durationSec === m * 60
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-muted/70 hover:bg-muted text-muted-foreground border-border'
            }`}
          >
            {m} мин
          </button>
        ))}
      </div>

      {/* Big Circular Display */}
      <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center my-4">
        {/* SVG Progress Ring */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="42%"
            className="stroke-muted/40 fill-none"
            strokeWidth="8"
          />
          <circle
            cx="50%"
            cy="50%"
            r="42%"
            className="stroke-primary fill-none transition-all duration-500"
            strokeWidth="8"
            strokeDasharray="264"
            strokeDashoffset={264 - (264 * progressPercent) / 100}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl sm:text-6xl font-mono font-extrabold tracking-tight text-foreground">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span className="text-xs uppercase font-semibold text-muted-foreground mt-2">
            {isRunning ? 'Таймер идет...' : remainingSec === 0 ? 'Завершено 🎉' : 'Нажмите Старт'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={() => {
            if (!isRunning && remainingSec === 0) setRemainingSec(durationSec)
            setIsRunning(!isRunning)
          }}
          className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all text-white ${
            isRunning
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
              : 'bg-primary hover:bg-primary/90 shadow-primary/25'
          }`}
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          <span>{isRunning ? 'Пауза' : 'Старт'}</span>
        </button>

        <button
          onClick={() => {
            setIsRunning(false)
            setRemainingSec(durationSec)
          }}
          className="p-4 rounded-2xl bg-muted hover:bg-muted/80 text-foreground border border-border transition-all active:scale-95"
          title="Сбросить"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  )
}

// ── 3. Pomodoro Focus Tab ──────────────────────────────────────────────────
function PomodoroTab() {
  const [mode, setMode] = useState<'work' | 'break'>('work')
  const [seconds, setSeconds] = useState<number>(25 * 60)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [sessionsCompleted, setSessionsCompleted] = useState<number>(0)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRunning && seconds > 0) {
      interval = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            setIsRunning(false)
            playAlarmChime('alarm')
            if (mode === 'work') {
              setSessionsCompleted(c => c + 1)
              showWebNotification('🍅 Фокус-спринт завершен!', {
                body: 'Время для 5-минутного отдыха! Сделайте разминку.'
              })
              setMode('break')
              return 5 * 60
            } else {
              showWebNotification('⚡ Перерыв окончен!', {
                body: 'Готовы к следующему рабочему спринту?'
              })
              setMode('work')
              return 25 * 60
            }
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, seconds, mode])

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-3xl bg-card border border-border shadow-xl text-center"
    >
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => { setIsRunning(false); setMode('work'); setSeconds(25 * 60) }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mode === 'work' ? 'bg-rose-500 text-white shadow-md' : 'bg-muted text-muted-foreground'
          }`}
        >
          🍅 Работа (25 мин)
        </button>
        <button
          onClick={() => { setIsRunning(false); setMode('break'); setSeconds(5 * 60) }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mode === 'break' ? 'bg-emerald-500 text-white shadow-md' : 'bg-muted text-muted-foreground'
          }`}
        >
          ☕ Перерыв (5 мин)
        </button>
      </div>

      <div className="text-6xl sm:text-8xl font-mono font-extrabold text-foreground my-6">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>

      <p className="text-xs font-semibold text-muted-foreground mb-8">
        Завершено помодоро-сессий сегодня: <strong className="text-primary font-bold text-sm">🔥 {sessionsCompleted}</strong>
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/20 active:scale-95 transition-all"
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          <span>{isRunning ? 'Пауза' : 'Начать фокус'}</span>
        </button>
        <button
          onClick={() => {
            setIsRunning(false)
            setSeconds(mode === 'work' ? 25 * 60 : 5 * 60)
          }}
          className="p-4 rounded-2xl bg-muted hover:bg-muted/80 text-foreground border border-border transition-all"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  )
}

// ── 4. Stopwatch Tab ───────────────────────────────────────────────────────
function StopwatchTab() {
  const [ms, setMs] = useState<number>(0)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [laps, setLaps] = useState<number[]>([])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRunning) {
      const start = Date.now() - ms
      interval = setInterval(() => {
        setMs(Date.now() - start)
      }, 10)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning])

  const formatStopwatch = (timeMs: number) => {
    const totalSec = Math.floor(timeMs / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    const hundredths = Math.floor((timeMs % 1000) / 10)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-3xl bg-card border border-border shadow-xl text-center"
    >
      <div className="text-6xl sm:text-8xl font-mono font-extrabold text-foreground my-8">
        {formatStopwatch(ms)}
      </div>

      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all text-white ${
            isRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
          <span>{isRunning ? 'Стоп' : 'Старт'}</span>
        </button>

        {isRunning && (
          <button
            onClick={() => setLaps(prev => [ms, ...prev])}
            className="px-6 py-4 rounded-2xl bg-muted hover:bg-muted/80 text-foreground border border-border font-semibold text-sm transition-all"
          >
            Круг (Lap)
          </button>
        )}

        <button
          onClick={() => { setIsRunning(false); setMs(0); setLaps([]) }}
          className="p-4 rounded-2xl bg-muted hover:bg-muted/80 text-foreground border border-border transition-all"
          title="Сброс"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Lap list */}
      {laps.length > 0 && (
        <div className="w-full max-w-sm border-t border-border pt-4 mt-2 space-y-2 max-h-48 overflow-y-auto">
          {laps.map((lapMs, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 font-mono">
              <span className="text-muted-foreground font-sans">Круг {laps.length - idx}</span>
              <span className="font-bold text-foreground">{formatStopwatch(lapMs)}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
