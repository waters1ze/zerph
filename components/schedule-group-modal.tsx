'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ScheduleGroup, ScheduleLesson, DaySchedule } from '@/lib/types'
import { 
  X, Plus, Trash2, Copy, Check, Clock, GraduationCap, BookOpen, 
  Activity, Dumbbell, Palette, Music, Sparkles, Trophy, Calendar, MapPin, User, FileText, ChevronRight,
  Mic, MicOff, Loader2, Wand2, AlertTriangle, CheckCircle2, Briefcase
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'

interface ScheduleGroupModalProps {
  isOpen: boolean
  onClose: () => void
  groups: ScheduleGroup[]
  onSaveGroup: (group: ScheduleGroup) => void
  onDeleteGroup: (groupId: string) => void
}

export type ScheduleTypeKey = 'general' | 'school' | 'sport' | 'business' | 'courses'

export interface ScheduleTypeConfig {
  id: ScheduleTypeKey
  label: string
  icon: any
  description: string
  actionLabel: string
  actionPlaceholder: string
  addButtonText: string
  secondaryLabel?: string
  secondaryPlaceholder?: string
  tertiaryLabel?: string
  tertiaryPlaceholder?: string
}

export const SCHEDULE_TYPES: ScheduleTypeConfig[] = [
  {
    id: 'general',
    label: 'Обычно',
    icon: Sparkles,
    description: 'Время и действие для напоминания (без лишних полей)',
    actionLabel: 'Действие',
    actionPlaceholder: 'Действие для выполнения (например: Принять витамины, Чтение, Пробежка...)',
    addButtonText: 'Добавить действие',
  },
  {
    id: 'school',
    label: 'Школа / Учеба',
    icon: GraduationCap,
    description: 'Уроки, кабинеты и преподаватели',
    actionLabel: 'Предмет',
    actionPlaceholder: 'Предмет (например: Математика)',
    addButtonText: 'Добавить урок',
    secondaryLabel: 'Кабинет',
    secondaryPlaceholder: 'Каб. 201',
    tertiaryLabel: 'Преподаватель',
    tertiaryPlaceholder: 'Преподаватель',
  },
  {
    id: 'sport',
    label: 'Спорт',
    icon: Dumbbell,
    description: 'Упражнения, зал и тренер/нагрузка',
    actionLabel: 'Упражнение',
    actionPlaceholder: 'Упражнение (например: Жим лежа, Бег, Плавание)',
    addButtonText: 'Добавить упражнение',
    secondaryLabel: 'Зал / Зона',
    secondaryPlaceholder: 'Зал / Зона',
    tertiaryLabel: 'Тренер / Нагрузка',
    tertiaryPlaceholder: 'Тренер / Нагрузка',
  },
  {
    id: 'business',
    label: 'Бизнес / Работа',
    icon: Briefcase,
    description: 'Задачи, встречи, проекты и платформы',
    actionLabel: 'Задача / Встреча',
    actionPlaceholder: 'Задача (например: Daily Standup, Ревью макетов)',
    addButtonText: 'Добавить задачу / встречу',
    secondaryLabel: 'Проект / Клиент',
    secondaryPlaceholder: 'Проект / Клиент',
    tertiaryLabel: 'Платформа / Ссылка',
    tertiaryPlaceholder: 'Zoom / Meet / Офис',
  },
  {
    id: 'courses',
    label: 'Курсы / Развитие',
    icon: BookOpen,
    description: 'Уроки, материалы и наставники',
    actionLabel: 'Урок / Тема',
    actionPlaceholder: 'Урок (например: English Speaking, Лекция 4)',
    addButtonText: 'Добавить занятие',
    secondaryLabel: 'Модуль / Материалы',
    secondaryPlaceholder: 'Модуль / Ссылка',
    tertiaryLabel: 'Куратор / Платформа',
    tertiaryPlaceholder: 'Куратор',
  },
]

const ICONS = [
  { id: 'Sparkles', icon: Sparkles, label: 'Обычно / Развитие' },
  { id: 'GraduationCap', icon: GraduationCap, label: 'Школа / Учеба' },
  { id: 'BookOpen', icon: BookOpen, label: 'Университет / Книги' },
  { id: 'Activity', icon: Activity, label: 'Работа / Процессы' },
  { id: 'Dumbbell', icon: Dumbbell, label: 'Фитнес / Зал' },
  { id: 'Palette', icon: Palette, label: 'Творчество / Курсы' },
  { id: 'Music', icon: Music, label: 'Музыка / Вокал' },
  { id: 'Trophy', icon: Trophy, label: 'Секции / Соревнования' },
]

const COLORS = [
  '#f59e0b', // Amber / Gold
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#06b6d4', // Cyan
]

const DAYS_OF_WEEK = [
  { id: 1, name: 'Понедельник', short: 'Пн' },
  { id: 2, name: 'Вторник', short: 'Вт' },
  { id: 3, name: 'Среда', short: 'Ср' },
  { id: 4, name: 'Четверг', short: 'Чт' },
  { id: 5, name: 'Пятница', short: 'Пт' },
  { id: 6, name: 'Суббота', short: 'Сб' },
  { id: 7, name: 'Воскресенье', short: 'Вс' },
]

const DEFAULT_SCHOOL_BELLS = [
  { start: '08:30', end: '09:15' },
  { start: '09:25', end: '10:10' },
  { start: '10:20', end: '11:05' },
  { start: '11:20', end: '12:05' },
  { start: '12:20', end: '13:05' },
  { start: '13:15', end: '14:00' },
  { start: '14:10', end: '14:55' },
]

function createEmptyGroup(): ScheduleGroup {
  return {
    id: 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title: '',
    icon: 'Sparkles',
    color: '#6366f1',
    description: '',
    scheduleType: 'general', // Default mode: "Обычно"
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    days: DAYS_OF_WEEK.map(d => ({
      dayOfWeek: d.id,
      enabled: d.id <= 5,
      lessons: [],
    })),
  }
}

export function ScheduleGroupModal({
  isOpen,
  onClose,
  groups,
  onSaveGroup,
  onDeleteGroup,
}: ScheduleGroupModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    groups.length > 0 ? groups[0].id : null
  )
  const [editingGroup, setEditingGroup] = useState<ScheduleGroup>(() => {
    return groups.length > 0 ? JSON.parse(JSON.stringify(groups[0])) : createEmptyGroup()
  })
  const [activeDay, setActiveDay] = useState<number>(1)
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null)

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiStatusMessage, setAiStatusMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)
  const [isAiListening, setIsAiListening] = useState(false)

  if (!isOpen) return null

  const handleGenerateWithAi = async (promptToUse?: string) => {
    const query = (promptToUse || aiPrompt).trim()
    if (!query) return

    setIsAiGenerating(true)
    setAiStatusMessage(null)

    try {
      const res = await fetch('/api/schedule/ai-generate', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: query }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Ошибка при генерации расписания')
      }

      if (data.understood && data.group) {
        setEditingGroup(data.group)
        setSelectedGroupId(data.group.id)
        setAiStatusMessage({ type: 'success', text: data.replyMessage })
        const firstEnabled = data.group.days.find((d: any) => d.enabled && d.lessons?.length > 0)
        if (firstEnabled) setActiveDay(firstEnabled.dayOfWeek)
      } else {
        setAiStatusMessage({
          type: 'warning',
          text: data.replyMessage || 'Не совсем понял, какое расписание требуется составить. Укажите день недели, список предметов или время занятий.',
        })
      }
    } catch (err: any) {
      setAiStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Не удалось связаться с ИИ. Попробуйте еще раз.',
      })
    } finally {
      setIsAiGenerating(false)
    }
  }

  const handleToggleAiVoice = () => {
    if (isAiListening) {
      setIsAiListening(false)
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Голосовой ввод не поддерживается в этом браузере.')
      return
    }
    try {
      const rec = new SpeechRecognition()
      rec.lang = 'ru-RU'
      rec.continuous = false
      rec.interimResults = false
      setIsAiListening(true)
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript
        setAiPrompt(text)
        setIsAiListening(false)
        handleGenerateWithAi(text)
      }
      rec.onerror = () => setIsAiListening(false)
      rec.onend = () => setIsAiListening(false)
      rec.start()
    } catch {
      setIsAiListening(false)
    }
  }

  if (!isOpen) return null

  const handleSelectGroup = (group: ScheduleGroup) => {
    setSelectedGroupId(group.id)
    setEditingGroup(JSON.parse(JSON.stringify(group)))
  }

  const handleCreateNew = () => {
    const newGrp = createEmptyGroup()
    setSelectedGroupId(newGrp.id)
    setEditingGroup(newGrp)
  }

  const currentDaySchedule: DaySchedule = editingGroup.days.find(d => d.dayOfWeek === activeDay) || {
    dayOfWeek: activeDay,
    enabled: true,
    lessons: [],
  }

  const handleToggleDay = (enabled: boolean) => {
    setEditingGroup(prev => ({
      ...prev,
      days: prev.days.map(d => (d.dayOfWeek === activeDay ? { ...d, enabled } : d)),
    }))
  }

  const handleAddLesson = () => {
    const lessons = currentDaySchedule.lessons || []
    const nextIndex = lessons.length
    const defaultTime = DEFAULT_SCHOOL_BELLS[nextIndex] || {
      start: `${(8 + nextIndex).toString().padStart(2, '0')}:00`,
      end: `${(8 + nextIndex).toString().padStart(2, '0')}:45`,
    }

    const newLesson: ScheduleLesson = {
      id: 'les_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      name: '',
      startTime: defaultTime.start,
      endTime: defaultTime.end,
      room: '',
      teacher: '',
      note: '',
    }

    setEditingGroup(prev => ({
      ...prev,
      days: prev.days.map(d =>
        d.dayOfWeek === activeDay ? { ...d, lessons: [...(d.lessons || []), newLesson] } : d
      ),
    }))
  }

  const handleUpdateLesson = (lessonId: string, field: keyof ScheduleLesson, value: string) => {
    setEditingGroup(prev => ({
      ...prev,
      days: prev.days.map(d =>
        d.dayOfWeek === activeDay
          ? {
              ...d,
              lessons: d.lessons.map(l => (l.id === lessonId ? { ...l, [field]: value } : l)),
            }
          : d
      ),
    }))
  }

  const handleDeleteLesson = (lessonId: string) => {
    setEditingGroup(prev => ({
      ...prev,
      days: prev.days.map(d =>
        d.dayOfWeek === activeDay
          ? { ...d, lessons: d.lessons.filter(l => l.id !== lessonId) }
          : d
      ),
    }))
  }

  const handleCopyDayToOthers = (targetDays: number[]) => {
    setEditingGroup(prev => ({
      ...prev,
      days: prev.days.map(d => {
        if (targetDays.includes(d.dayOfWeek) && d.dayOfWeek !== activeDay) {
          return {
            ...d,
            enabled: true,
            lessons: JSON.parse(JSON.stringify(currentDaySchedule.lessons)),
          }
        }
        return d
      }),
    }))
    setCopiedNotification('Расписание скопировано на выбранные дни')
    setTimeout(() => setCopiedNotification(null), 2500)
  }

  const handleSave = () => {
    if (!editingGroup.title.trim()) return
    onSaveGroup({
      ...editingGroup,
      updatedAt: new Date().toISOString(),
    })
    onClose()
  }

  const handleDeleteCurrent = () => {
    if (!selectedGroupId) return
    onDeleteGroup(selectedGroupId)
    const remaining = groups.filter(g => g.id !== selectedGroupId)
    if (remaining.length > 0) {
      setSelectedGroupId(remaining[0].id)
      setEditingGroup(JSON.parse(JSON.stringify(remaining[0])))
    } else {
      const fresh = createEmptyGroup()
      setSelectedGroupId(fresh.id)
      setEditingGroup(fresh)
    }
  }

  const SelectedIconComp = ICONS.find(i => i.id === editingGroup.icon)?.icon || GraduationCap

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: editingGroup.color }}
            >
              <SelectedIconComp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Группы расписания и уроков
              </h2>
              <p className="text-xs text-muted-foreground">
                Создавайте группы для уроков, занятий и расписания по дням
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 no-scrollbar">
          
          {/* AI Schedule Generator Card */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span>ИИ-генератор расписания</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-primary/20 text-primary">Любые фразы</span>
                  </h3>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleGenerateWithAi()
                  }}
                  placeholder="Например: сделай группу расписание для понедельника, или 4 урока во вторник..."
                  className="w-full pl-3 pr-9 py-2 rounded-xl text-xs sm:text-sm bg-background/90 border border-border/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleToggleAiVoice}
                  className={cn(
                    'absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center transition-colors',
                    isAiListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                  title={isAiListening ? 'Слушаю... нажмите для остановки' : 'Голосовой ввод'}
                >
                  {isAiListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleGenerateWithAi()}
                disabled={isAiGenerating || !aiPrompt.trim()}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:brightness-110 disabled:opacity-50 transition-all shrink-0 cursor-pointer shadow-xs"
              >
                {isAiGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Думаю...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Создать</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <span className="text-[10px] text-muted-foreground shrink-0 font-medium">Примеры:</span>
              {[
                'Расписание на понедельник',
                '5 уроков на каждый будний день',
                'Тренировки: Пн, Ср, Пт в 19:00',
                'Университет: пары Вт и Чт',
                'Обобщи расписание',
              ].map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setAiPrompt(chip)
                    handleGenerateWithAi(chip)
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-background/80 hover:bg-primary/15 hover:text-primary border border-border/60 text-muted-foreground transition-colors shrink-0 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* AI Status Banner */}
            {aiStatusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-2.5 rounded-xl text-xs flex items-start gap-2 border',
                  aiStatusMessage.type === 'success' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                  aiStatusMessage.type === 'warning' && 'bg-amber-500/10 border-amber-500/30 text-amber-300',
                  aiStatusMessage.type === 'error' && 'bg-red-500/10 border-red-500/30 text-red-300'
                )}
              >
                {aiStatusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                {aiStatusMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                {aiStatusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                <span className="leading-snug">{aiStatusMessage.text}</span>
              </motion.div>
            )}
          </div>

          {/* Groups Switcher Bar */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-1.5">
              {groups.map(grp => {
                const IconC = ICONS.find(i => i.id === grp.icon)?.icon || GraduationCap
                const isSel = selectedGroupId === grp.id
                return (
                  <button
                    key={grp.id}
                    onClick={() => handleSelectGroup(grp)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0',
                      isSel
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <IconC className="w-3.5 h-3.5" />
                    <span>{grp.title}</span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Новая группа</span>
            </button>
          </div>

          {/* Group Config (Title, Color, Icon) */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Название группы расписания
                </label>
                <input
                  type="text"
                  value={editingGroup.title}
                  onChange={e => setEditingGroup(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="например: Школа (10 класс) или Секция плавания"
                  className="w-full px-3 py-2 rounded-xl text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Описание / Заметка
                </label>
                <input
                  type="text"
                  value={editingGroup.description || ''}
                  onChange={e => setEditingGroup(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="например: Корпус на Ленина, 2-я смена"
                  className="w-full px-3 py-2 rounded-xl text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Colors & Icons Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-border/40">
              {/* Color Picker */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium mr-1">Цвет:</span>
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditingGroup(prev => ({ ...prev, color: c }))}
                    className={cn(
                      'w-6 h-6 rounded-full transition-transform',
                      editingGroup.color === c ? 'ring-2 ring-foreground ring-offset-2 scale-110' : 'opacity-80 hover:opacity-100'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Icon Picker */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-xs text-muted-foreground font-medium mr-1">Иконка:</span>
                {ICONS.map(i => {
                  const IconC = i.icon
                  const isSel = editingGroup.icon === i.id
                  return (
                    <button
                      key={i.id}
                      onClick={() => setEditingGroup(prev => ({ ...prev, icon: i.id }))}
                      title={i.label}
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center border transition-all',
                        isSel
                          ? 'bg-foreground text-background border-foreground font-bold shadow-sm'
                          : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <IconC className="w-3.5 h-3.5" />
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Schedule Mode Selector (Обычно / Школа / Спорт / Бизнес / Курсы) */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">
                  Режим расписания:
                </label>
                <span className="text-[11px] text-muted-foreground font-normal hidden sm:inline-block">
                  {SCHEDULE_TYPES.find(st => st.id === (editingGroup.scheduleType || 'general'))?.description}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {SCHEDULE_TYPES.map(st => {
                  const StIcon = st.icon
                  const isSel = (editingGroup.scheduleType || 'general') === st.id
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setEditingGroup(prev => ({ ...prev, scheduleType: st.id }))}
                      className={cn(
                        'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none',
                        isSel
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-background/80 hover:bg-muted text-muted-foreground border-border/70'
                      )}
                    >
                      <StIcon className="w-3.5 h-3.5" />
                      <span>{st.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Days of Week Navigation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Расписание по дням недели
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyDayToOthers([1, 2, 3, 4, 5])}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 bg-muted/40 px-2 py-1 rounded-md border border-border cursor-pointer"
                  title="Скопировать расписание текущего дня на Пн–Пт"
                >
                  <Copy className="w-3 h-3" />
                  <span>Дублировать на будни (Пн-Пт)</span>
                </button>
              </div>
            </div>

            {/* Day Tabs */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 p-1 bg-muted/40 border border-border rounded-xl">
              {DAYS_OF_WEEK.map(d => {
                const isSelected = activeDay === d.id
                const daySched = editingGroup.days.find(x => x.dayOfWeek === d.id)
                const isEnabled = daySched?.enabled ?? false
                const count = daySched?.lessons?.length || 0

                return (
                  <button
                    key={d.id}
                    onClick={() => setActiveDay(d.id)}
                    className={cn(
                      'flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      isSelected
                        ? 'bg-card text-foreground shadow-sm border border-border font-bold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                      !isEnabled && 'opacity-40'
                    )}
                  >
                    <span>{d.short}</span>
                    <span className="text-[10px] font-normal opacity-70">
                      {isEnabled ? `${count} зап.` : 'вых.'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active Day Lessons Editor */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            {/* Day Header Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  {DAYS_OF_WEEK.find(d => d.id === activeDay)?.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({currentDaySchedule.lessons?.length || 0} пунктов)
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
                <span>Занятия в этот день:</span>
                <input
                  type="checkbox"
                  checked={currentDaySchedule.enabled}
                  onChange={e => handleToggleDay(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                />
              </label>
            </div>

            {/* Notification if copied */}
            {copiedNotification && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-3.5 h-3.5" />
                <span>{copiedNotification}</span>
              </div>
            )}

            {/* Lessons List */}
            {currentDaySchedule.enabled ? (
              <div className="space-y-2.5">
                {(() => {
                  const currentScheduleType: ScheduleTypeKey = (editingGroup.scheduleType as ScheduleTypeKey) || 'general'
                  const currentTypeConfig = SCHEDULE_TYPES.find(st => st.id === currentScheduleType) || SCHEDULE_TYPES[0]
                  const isGeneralMode = currentScheduleType === 'general'

                  return (
                    <>
                      {currentDaySchedule.lessons?.map((lesson, idx) => (
                        <div
                          key={lesson.id}
                          className="p-3 rounded-xl border border-border/80 bg-muted/20 hover:border-border transition-colors flex flex-col sm:flex-row sm:items-center gap-2.5"
                        >
                          {/* Index Badge & Times */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="w-6 h-6 rounded-lg bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {idx + 1}
                            </span>
                            <div className="flex items-center gap-1 text-xs font-mono">
                              <input
                                type="time"
                                value={lesson.startTime}
                                onChange={e => handleUpdateLesson(lesson.id, 'startTime', e.target.value)}
                                className="px-1.5 py-1 rounded bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-muted-foreground">–</span>
                              <input
                                type="time"
                                value={lesson.endTime}
                                onChange={e => handleUpdateLesson(lesson.id, 'endTime', e.target.value)}
                                className="px-1.5 py-1 rounded bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </div>

                          {/* Action / Subject Title Input */}
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={lesson.name}
                              onChange={e => handleUpdateLesson(lesson.id, 'name', e.target.value)}
                              placeholder={currentTypeConfig.actionPlaceholder}
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs sm:text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                            />
                          </div>

                          {/* Extra Clarification Fields (Only for School, Sport, Business, Courses — Hidden in General/Обычно mode) */}
                          {!isGeneralMode && (
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              {currentTypeConfig.secondaryPlaceholder && (
                                <div className="relative w-28 shrink-0">
                                  <MapPin className="w-3 h-3 text-muted-foreground absolute left-2 top-2.5" />
                                  <input
                                    type="text"
                                    value={lesson.room || ''}
                                    onChange={e => handleUpdateLesson(lesson.id, 'room', e.target.value)}
                                    placeholder={currentTypeConfig.secondaryPlaceholder}
                                    className="w-full pl-6 pr-2 py-1.5 rounded-lg text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              )}

                              {currentTypeConfig.tertiaryPlaceholder && (
                                <div className="relative w-32 shrink-0">
                                  <User className="w-3 h-3 text-muted-foreground absolute left-2 top-2.5" />
                                  <input
                                    type="text"
                                    value={lesson.teacher || ''}
                                    onChange={e => handleUpdateLesson(lesson.id, 'teacher', e.target.value)}
                                    placeholder={currentTypeConfig.tertiaryPlaceholder}
                                    className="w-full pl-6 pr-2 py-1.5 rounded-lg text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                            title="Удалить строку"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add Lesson Button */}
                      <button
                        type="button"
                        onClick={handleAddLesson}
                        className="w-full py-2.5 border border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-primary" />
                        <span>+ {currentTypeConfig.addButtonText}</span>
                      </button>
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-xs">
                <span>В этот день занятия отключены (выходной). Нажмите галочку выше, чтобы добавить пункты.</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/20">
          <div>
            {groups.length > 0 && selectedGroupId && (
              <button
                type="button"
                onClick={handleDeleteCurrent}
                className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              >
                Удалить эту группу
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
            >
              Сохранить группу
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
