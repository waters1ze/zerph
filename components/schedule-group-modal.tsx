'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ScheduleGroup, ScheduleLesson, DaySchedule } from '@/lib/types'
import { 
  X, Plus, Trash2, Copy, Check, Clock, GraduationCap, BookOpen, 
  Activity, Dumbbell, Palette, Music, Sparkles, Trophy, Calendar, MapPin, User, FileText, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduleGroupModalProps {
  isOpen: boolean
  onClose: () => void
  groups: ScheduleGroup[]
  onSaveGroup: (group: ScheduleGroup) => void
  onDeleteGroup: (groupId: string) => void
}

const ICONS = [
  { id: 'GraduationCap', icon: GraduationCap, label: 'Школа / Учеба' },
  { id: 'BookOpen', icon: BookOpen, label: 'Университет / Книги' },
  { id: 'Activity', icon: Activity, label: 'Спорт / Тренировки' },
  { id: 'Dumbbell', icon: Dumbbell, label: 'Фитнес / Зал' },
  { id: 'Palette', icon: Palette, label: 'Творчество / Курсы' },
  { id: 'Music', icon: Music, label: 'Музыка / Вокал' },
  { id: 'Trophy', icon: Trophy, label: 'Секции / Соревнования' },
  { id: 'Sparkles', icon: Sparkles, label: 'Развитие / Языки' },
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
    title: 'Школа',
    icon: 'GraduationCap',
    color: '#f59e0b',
    description: 'Расписание уроков по дням недели',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    days: DAYS_OF_WEEK.map(d => ({
      dayOfWeek: d.id,
      enabled: d.id <= 5, // Mon-Fri enabled by default
      lessons: d.id <= 5 ? [
        { id: 'les_1', name: 'Математика', startTime: '08:30', endTime: '09:15', room: 'каб. 201' },
        { id: 'les_2', name: 'Русский язык', startTime: '09:25', endTime: '10:10', room: 'каб. 104' },
        { id: 'les_3', name: 'Литература', startTime: '10:20', endTime: '11:05', room: 'каб. 104' },
        { id: 'les_4', name: 'Физика', startTime: '11:20', endTime: '12:05', room: 'каб. 302' },
        { id: 'les_5', name: 'История', startTime: '12:20', endTime: '13:05', room: 'каб. 210' },
      ] : [],
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
                Создавайте группы («Школа», «Курсы», «Тренировки») с сеткой уроков по дням
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
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 bg-muted/40 px-2 py-1 rounded-md border border-border"
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
                      'flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all',
                      isSelected
                        ? 'bg-card text-foreground shadow-sm border border-border font-bold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                      !isEnabled && 'opacity-40'
                    )}
                  >
                    <span>{d.short}</span>
                    <span className="text-[10px] font-normal opacity-70">
                      {isEnabled ? `${count} ур.` : 'вых.'}
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
                  ({currentDaySchedule.lessons?.length || 0} занятий)
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
                <span>Занятия в этот день:</span>
                <input
                  type="checkbox"
                  checked={currentDaySchedule.enabled}
                  onChange={e => handleToggleDay(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
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

                    {/* Lesson Title */}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={lesson.name}
                        onChange={e => handleUpdateLesson(lesson.id, 'name', e.target.value)}
                        placeholder="Название предмета или занятия"
                        className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      />
                    </div>

                    {/* Room / Cabinet & Teacher */}
                    <div className="flex items-center gap-2">
                      <div className="relative w-28 shrink-0">
                        <MapPin className="w-3 h-3 text-muted-foreground absolute left-2 top-2.5" />
                        <input
                          type="text"
                          value={lesson.room || ''}
                          onChange={e => handleUpdateLesson(lesson.id, 'room', e.target.value)}
                          placeholder="Каб. 201"
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="relative w-32 shrink-0">
                        <User className="w-3 h-3 text-muted-foreground absolute left-2 top-2.5" />
                        <input
                          type="text"
                          value={lesson.teacher || ''}
                          onChange={e => handleUpdateLesson(lesson.id, 'teacher', e.target.value)}
                          placeholder="Преподаватель"
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteLesson(lesson.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        title="Удалить урок"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add Lesson Button */}
                <button
                  type="button"
                  onClick={handleAddLesson}
                  className="w-full py-2.5 border border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  <span>Добавить урок / занятие</span>
                </button>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-xs">
                <span>В этот день занятия отключены (выходной). Нажмите галочку выше, чтобы добавить уроки.</span>
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
