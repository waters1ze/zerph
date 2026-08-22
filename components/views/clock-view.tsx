'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { playAlarmChime, showWebNotification, requestNotificationPermission } from '@/lib/notifications'
import {
  Clock, Timer, Play, Pause, RotateCcw, CheckCircle2,
  Bell, Volume2, Sparkles, Flame, Flag, AlertCircle, ArrowRight,
  Briefcase, Coffee, ChevronDown, Search, Cake, Calendar as CalendarIcon,
  Tag, X, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'

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
        body: 'Zerf Note будет присылать звуковые сигналы и напоминания о задачах и таймерах.'
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12 w-full">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            Часы, Таймеры и Отсчет
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Живой отсчет времени до дедлайнов задач, дней рождения и универсальный таймер
          </p>
        </div>

        {/* Browser Notifications Permission Pill */}
        {!notifGranted && (
          <button
            onClick={handleEnableNotifs}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-all self-start sm:self-auto shadow-xs"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Включить звуковые пуши</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border/80 rounded-2xl w-full sm:w-max select-none">
        {[
          { id: 'task_countdown', label: '⏳ Отсчет до события', icon: Clock },
          { id: 'timer',          label: '⏱️ Таймер',            icon: Timer },
          { id: 'stopwatch',      label: '⏲️ Секундомер',        icon: Flag },
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

// ── Helpers for Task Countdown ──────────────────────────────────────────────

interface CalculatedTaskInfo {
  task: Task
  ts: number
  isBirthday: boolean
  isTimed: boolean
  isDated: boolean
  dateLabel: string
  relativeText: string
}

function calculateTaskInfo(t: Task, nowMs: number): CalculatedTaskInfo {
  const now = new Date(nowMs)
  const currentYear = now.getFullYear()
  const todayStr = now.toISOString().slice(0, 10)

  const isBirthday = Boolean(
    t.repeat === 'yearly' ||
    /(?:^|[^а-яёa-z0-9])(?:день\s*рождения|д\.?\s*р\.?)(?:[^а-яёa-z0-9]|$)/i.test(t.title || '') ||
    t.tags?.includes('день рождения')
  )

  const isTimed = Boolean(t.dueTime && t.dueTime !== '00:00')
  const isDated = Boolean(t.dueDate && !isBirthday)

  let targetTs = nowMs
  let dateLabel = ''

  if (isBirthday && t.dueDate && t.dueDate.includes('-')) {
    const [, tm, td] = t.dueDate.split('-').map(Number)
    if (!isNaN(tm) && !isNaN(td)) {
      // Calculate occurrence in this year
      const thisYearOccur = new Date(currentYear, tm - 1, td, 0, 0, 0, 0)
      // If it has already passed this year (by more than 1 day), use next year's occurrence
      const targetDate = (thisYearOccur.getTime() >= now.getTime() - 86400000)
        ? thisYearOccur
        : new Date(currentYear + 1, tm - 1, td, 0, 0, 0, 0)

      targetTs = targetDate.getTime()
      const y = targetDate.getFullYear()
      dateLabel = `${String(td).padStart(2, '0')}.${String(tm).padStart(2, '0')}.${y}`
    }
  } else {
    const d = t.dueDate || todayStr
    const tm = t.dueTime && t.dueTime !== '00:00' ? t.dueTime : '23:59'
    const [h, m] = tm.split(':').map(Number)
    const date = new Date(d)
    date.setHours(isNaN(h) ? 23 : h, isNaN(m) ? 59 : m, 0, 0)
    targetTs = date.getTime()

    if (t.dueDate) {
      const [dy, dm, dd] = t.dueDate.split('-')
      dateLabel = `${dd}.${dm}.${dy}`
    }
    if (t.dueTime && t.dueTime !== '00:00') {
      dateLabel = dateLabel ? `${dateLabel} в ${t.dueTime}` : `в ${t.dueTime}`
    }
  }

  // Calculate relative text
  const diffMs = targetTs - nowMs
  let relativeText = ''

  if (diffMs < 0) {
    const absSec = Math.floor(Math.abs(diffMs) / 1000)
    if (absSec < 3600) relativeText = `Просрочено на ${Math.floor(absSec / 60)}м`
    else if (absSec < 86400) relativeText = `Просрочено на ${Math.floor(absSec / 3600)}ч`
    else relativeText = `Просрочено на ${Math.floor(absSec / 86400)}д`
  } else {
    const totalSec = Math.floor(diffMs / 1000)
    const totalDays = Math.floor(totalSec / 86400)
    const months = Math.floor(totalDays / 30)
    const days = totalDays % 30
    const hrs = Math.floor((totalSec % 86400) / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)

    if (months > 0) {
      relativeText = days > 0 ? `через ${months} мес ${days} д` : `через ${months} мес`
    } else if (totalDays > 1) {
      relativeText = `через ${totalDays} д`
    } else if (totalDays === 1) {
      relativeText = `Завтра (${hrs}ч ${mins}м)`
    } else if (hrs > 0) {
      relativeText = `Сегодня (${hrs}ч ${mins}м)`
    } else if (mins > 0) {
      relativeText = `через ${mins} мин`
    } else {
      relativeText = `через ${totalSec} сек`
    }
  }

  return {
    task: t,
    ts: targetTs,
    isBirthday,
    isTimed,
    isDated,
    dateLabel,
    relativeText
  }
}

// ── Modern Category Selector Component ─────────────────────────────────────

type CategoryFilter = 'all' | 'birthdays' | 'timed' | 'dated'

function TaskCountdownSelector({
  items,
  selectedTaskId,
  onSelectTask,
}: {
  items: CalculatedTaskInfo[]
  selectedTaskId: string
  onSelectTask: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedItem = items.find(x => x.task.id === selectedTaskId) || items[0]

  // Filter items by category tab & search query
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Category check
      if (activeCategory === 'birthdays' && !item.isBirthday) return false
      if (activeCategory === 'timed' && !item.isTimed) return false
      if (activeCategory === 'dated' && !item.isDated) return false

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const titleMatch = item.task.title.toLowerCase().includes(q)
        const dateMatch = item.dateLabel.toLowerCase().includes(q)
        return titleMatch || dateMatch
      }
      return true
    })
  }, [items, activeCategory, searchQuery])

  const bdayCount = items.filter(x => x.isBirthday).length
  const timedCount = items.filter(x => x.isTimed).length
  const datedCount = items.filter(x => x.isDated).length

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-card border transition-all select-none text-left group',
          isOpen
            ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5 bg-card/95'
            : 'border-border/80 hover:border-primary/50 hover:bg-card/90 shadow-sm'
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Category Icon Badge */}
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-xs',
            selectedItem?.isBirthday
              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
              : selectedItem?.isTimed
                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                : 'bg-primary/15 text-primary border border-primary/30'
          )}>
            {selectedItem?.isBirthday ? (
              <Cake className="w-5 h-5" />
            ) : selectedItem?.isTimed ? (
              <Clock className="w-5 h-5" />
            ) : (
              <CalendarIcon className="w-5 h-5" />
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Текущий отсчет:</span>
              {selectedItem?.isBirthday ? (
                <span className="text-rose-500 font-semibold lowercase flex items-center gap-1">
                  <span className="mono-emoji">🎂</span> день рождения
                </span>
              ) : selectedItem?.isTimed ? (
                <span className="text-amber-500 font-semibold lowercase flex items-center gap-1">
                  <span className="mono-emoji">⏰</span> точное время
                </span>
              ) : (
                <span className="text-primary font-semibold lowercase flex items-center gap-1">
                  <span className="mono-emoji">📅</span> задача
                </span>
              )}
            </span>
            <span className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
              {selectedItem ? selectedItem.task.title : 'Выберите событие для отсчета'}
            </span>
          </div>
        </div>

        {/* Right Info Pill & Chevron */}
        <div className="flex items-center gap-2.5 shrink-0">
          {selectedItem && (
            <span className={cn(
              "hidden md:flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border",
              selectedItem.isBirthday
                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                : selectedItem.isTimed
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-primary/10 text-primary border-primary/20"
            )}>
              {selectedItem.relativeText}
            </span>
          )}
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center bg-muted/60 text-muted-foreground group-hover:text-foreground transition-transform duration-200',
            isOpen && 'rotate-180 bg-primary/15 text-primary'
          )}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Animated Dropdown Menu with Tabs & Search */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[460px]"
          >
            {/* Header / Tabs */}
            <div className="p-3 border-b border-border/70 flex flex-col gap-2.5 bg-muted/30">
              {/* Category Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar select-none">
                {[
                  { id: 'all',       label: 'Все вместе', icon: Sparkles, count: items.length },
                  { id: 'birthdays', label: 'Дни рождения', icon: Cake, count: bdayCount },
                  { id: 'timed',     label: 'С временем',   icon: Clock, count: timedCount },
                  { id: 'dated',     label: 'По дате',      icon: CalendarIcon, count: datedCount },
                ].map(tab => {
                  const active = activeCategory === tab.id
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCategory(tab.id as CategoryFilter)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all',
                        active
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-card/70 border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.2 rounded-full',
                        active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Quick Search */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Поиск по названию или имени..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-8.5 pl-8.5 pr-8 rounded-xl text-xs bg-muted/70 border border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none text-foreground placeholder:text-muted-foreground transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List of Tasks with Color Coding */}
            <div className="overflow-y-auto p-2 space-y-1 flex-1">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => {
                  const isSelected = item.task.id === selectedTaskId
                  return (
                    <button
                      key={item.task.id}
                      type="button"
                      onClick={() => {
                        onSelectTask(item.task.id)
                        setIsOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl text-left transition-all group border',
                        isSelected
                          ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                          : item.isBirthday
                            ? 'bg-rose-500/[0.04] hover:bg-rose-500/10 border-rose-500/20 text-foreground'
                            : item.isTimed
                              ? 'bg-amber-500/[0.04] hover:bg-amber-500/10 border-amber-500/20 text-foreground'
                              : 'bg-card/40 hover:bg-muted/60 border-border/40 text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Icon badge */}
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border',
                          item.isBirthday
                            ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                            : item.isTimed
                              ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                              : 'bg-primary/10 text-primary border-primary/20'
                        )}>
                          {item.isBirthday ? (
                            <Cake className="w-4 h-4" />
                          ) : item.isTimed ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <CalendarIcon className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={cn(
                            "text-[13px] font-bold truncate",
                            item.isBirthday ? "text-rose-400 dark:text-rose-300" : "text-foreground"
                          )}>
                            {item.task.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                            {item.dateLabel && <span>{item.dateLabel}</span>}
                            {item.task.tags && item.task.tags.length > 0 && (
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.2 rounded-md font-semibold border",
                                item.isBirthday
                                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                  : "bg-muted text-muted-foreground border-border/40"
                              )}>
                                {item.task.tags[0]}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Relative time indicator & Checkmark */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className={cn(
                          'text-[11px] font-semibold px-2.5 py-0.8 rounded-full border',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : item.isBirthday
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                              : item.isTimed
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'bg-muted/80 text-muted-foreground border-border/50'
                        )}>
                          {item.relativeText}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="text-xs font-medium">Ничего не найдено по этому фильтру</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── 1. Task Countdown Tab ──────────────────────────────────────────────────

function TaskCountdownTab() {
  const { state, dispatch } = useApp()
  const [nowMs, setNowMs] = useState<number>(Date.now())

  // Keep live time updated every second
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate & chronologically sort all tasks (closest upcoming task is always FIRST)
  const calculatedItems = useMemo(() => {
    return state.tasks
      .filter(t => t.status !== 'done')
      .map(t => calculateTaskInfo(t, nowMs))
      .sort((a, b) => {
        const diffA = a.ts - nowMs
        const diffB = b.ts - nowMs
        // Both in the future: smallest positive diff (closest) first!
        if (diffA >= 0 && diffB >= 0) return diffA - diffB
        // Future upcoming before overdue
        if (diffA >= 0 && diffB < 0) return -1
        if (diffA < 0 && diffB >= 0) return 1
        // Both overdue: most recently overdue first
        return diffB - diffA
      })
  }, [state.tasks, nowMs])

  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    calculatedItems[0]?.task.id || ''
  )

  // Ensure selected task is always valid
  useEffect(() => {
    if ((!selectedTaskId || !calculatedItems.some(x => x.task.id === selectedTaskId)) && calculatedItems[0]?.task.id) {
      setSelectedTaskId(calculatedItems[0].task.id)
    }
  }, [calculatedItems, selectedTaskId])

  const activeItem = calculatedItems.find(x => x.task.id === selectedTaskId) || calculatedItems[0]

  const timeLeft = useMemo(() => {
    if (!activeItem) {
      return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: false, totalSec: 0 }
    }
    const diffMs = activeItem.ts - nowMs
    const isOverdue = diffMs < 0
    const absDiff = Math.abs(diffMs)

    const totalSec = Math.floor(absDiff / 1000)
    const totalDays = Math.floor(totalSec / 86400)
    const months = Math.floor(totalDays / 30)
    const days = totalDays % 30
    const hours = Math.floor((totalSec % 86400) / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60

    return { months, days, hours, minutes, seconds, isOverdue, totalSec }
  }, [activeItem, nowMs])

  const handleComplete = () => {
    if (!activeItem) return
    playAlarmChime('complete')
    dispatch({ type: 'TOGGLE_TASK', id: activeItem.task.id, status: 'done' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-6 w-full"
    >
      {/* Modern Target Task Selector with Categories & Search */}
      <TaskCountdownSelector
        items={calculatedItems}
        selectedTaskId={selectedTaskId}
        onSelectTask={id => setSelectedTaskId(id)}
      />

      {activeItem ? (
        <div className="flex flex-col items-center justify-center p-6 sm:p-12 rounded-3xl bg-gradient-to-b from-card to-card/60 border border-border shadow-xl text-center relative overflow-hidden w-full">
          {/* Subtle glow circle */}
          <div className="absolute w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none -top-10" />

          {/* Status Badge */}
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border ${
            timeLeft.isOverdue
              ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
              : activeItem.isBirthday
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
          }`}>
            {timeLeft.isOverdue
              ? '⚠️ Время вышло / Просрочено'
              : activeItem.isBirthday
                ? '🎂 До Дня рождения осталось:'
                : '⏳ До наступления срока осталось:'}
          </span>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground max-w-2xl mb-2 tracking-tight">
            {activeItem.task.title}
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground mb-8">
            Срок наступления:{' '}
            <strong className="text-foreground font-semibold">
              {activeItem.dateLabel || 'Сегодня'}
            </strong>
          </p>

          {/* Big Clock Digits: Months, Days, Hours, Minutes, Seconds */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 my-4 max-w-full">
            {timeLeft.months > 0 && (
              <>
                <div className="flex flex-col items-center">
                  <div className="text-3xl sm:text-6xl lg:text-7xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl sm:rounded-3xl w-18 sm:w-28 lg:w-32 py-3 sm:py-5 lg:py-6 shadow-inner text-foreground">
                    {String(timeLeft.months).padStart(2, '0')}
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Месяцев</span>
                </div>
                <span className="text-2xl sm:text-5xl lg:text-6xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>
              </>
            )}

            {(timeLeft.months > 0 || timeLeft.days > 0) && (
              <>
                <div className="flex flex-col items-center">
                  <div className="text-3xl sm:text-6xl lg:text-7xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl sm:rounded-3xl w-18 sm:w-28 lg:w-32 py-3 sm:py-5 lg:py-6 shadow-inner text-foreground">
                    {String(timeLeft.days).padStart(2, '0')}
                  </div>
                  <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Дней</span>
                </div>
                <span className="text-2xl sm:text-5xl lg:text-6xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>
              </>
            )}

            <div className="flex flex-col items-center">
              <div className="text-3xl sm:text-6xl lg:text-7xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl sm:rounded-3xl w-18 sm:w-28 lg:w-32 py-3 sm:py-5 lg:py-6 shadow-inner text-foreground">
                {String(timeLeft.hours).padStart(2, '0')}
              </div>
              <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Часов</span>
            </div>

            <span className="text-2xl sm:text-5xl lg:text-6xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>

            <div className="flex flex-col items-center">
              <div className="text-3xl sm:text-6xl lg:text-7xl font-mono font-extrabold tracking-tight bg-muted/60 border border-border/80 rounded-2xl sm:rounded-3xl w-18 sm:w-28 lg:w-32 py-3 sm:py-5 lg:py-6 shadow-inner text-foreground">
                {String(timeLeft.minutes).padStart(2, '0')}
              </div>
              <span className="text-[10px] sm:text-xs uppercase font-semibold text-muted-foreground mt-1.5 sm:mt-2">Минут</span>
            </div>

            <span className="text-2xl sm:text-5xl lg:text-6xl font-mono font-bold text-muted-foreground/40 self-center -mt-4 sm:-mt-6">:</span>

            <div className="flex flex-col items-center">
              <div className="text-3xl sm:text-6xl lg:text-7xl font-mono font-extrabold tracking-tight bg-primary/10 border border-primary/30 rounded-2xl sm:rounded-3xl w-18 sm:w-28 lg:w-32 py-3 sm:py-5 lg:py-6 shadow-inner text-primary">
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
        <div className="text-center p-14 rounded-3xl bg-card border border-border text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-40 text-primary" />
          <p className="font-bold text-lg text-foreground">Нет активных событий</p>
          <p className="text-xs sm:text-sm mt-1 text-muted-foreground">Создайте новую задачу со временем или добавьте день рождения друга, чтобы включить живой отсчет!</p>
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

// ── 3. Stopwatch Tab ───────────────────────────────────────────────────────
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
