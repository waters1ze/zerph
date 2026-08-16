'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, MoreVertical, Flame, Edit3, Trash2, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import { useApp, getTgChatId } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { HabitDetailsModal } from '@/components/habit-details-modal'
import { HabitEditModal } from '@/components/habit-edit-modal'
import type { Habit } from '@/lib/types'

interface HabitsWidgetProps {
  selectedHabitId?: string | null
  onSelectHabit?: (habitId: string | null) => void
}

export function HabitsWidget({ selectedHabitId, onSelectHabit }: HabitsWidgetProps = {}) {
  const { state, dispatch } = useApp()
  const confirm = useConfirmDialog()
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newIcon, setNewIcon] = useState('💧')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  
  // Modals state
  const [selectedHabitForDetails, setSelectedHabitForDetails] = useState<Habit | null>(null)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [activeMenuHabitId, setActiveMenuHabitId] = useState<string | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuHabitId(null)
      }
    }
    if (activeMenuHabitId) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeMenuHabitId])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const tempId = 'h-' + Date.now()
    const newHabit: Habit = {
      id: tempId,
      title: newTitle.trim(),
      icon: newIcon,
      streak: 0,
      frequency: 'daily',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    dispatch({ type: 'ADD_HABIT', habit: newHabit })
    setNewTitle('')
    setIsAdding(false)
  }

  const toggleHabit = (e: React.MouseEvent, habit: Habit) => {
    e.stopPropagation()
    const isCompletedToday = habit.lastCompletedAt === todayStr
    const newCompletedAt = isCompletedToday ? undefined : todayStr

    let newStreak = habit.streak
    if (isCompletedToday) {
      newStreak = Math.max(0, habit.streak - 1)
    } else {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toISOString().slice(0, 10)
      if (habit.lastCompletedAt === yStr) {
        newStreak += 1
      } else if (!habit.lastCompletedAt || habit.lastCompletedAt < yStr) {
        newStreak = 1
      }
    }

    dispatch({ type: 'UPDATE_HABIT', id: habit.id, updates: { lastCompletedAt: newCompletedAt, streak: newStreak } })
  }

  const handleDelete = async (id: string) => {
    setActiveMenuHabitId(null)
    const habit = state.habits.find(h => h.id === id)
    const ok = await confirm({
      title: `Удалить привычку «${habit?.title || 'Привычка'}»?`,
      description: 'Вся история выполнения и стрик будут безвозвратно удалены.',
      confirmText: 'Удалить привычку',
      variant: 'danger',
    })
    if (!ok) return

    dispatch({ type: 'DELETE_HABIT', id })
    if (selectedHabitForDetails?.id === id) {
      setSelectedHabitForDetails(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 font-sans">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] uppercase tracking-widest font-semibold text-muted-foreground flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          Привычки
        </h3>
        <button
          onClick={() => {
            const chatId = getTgChatId()
            if (!chatId || chatId.startsWith('guest_')) {
              window.open('https://t.me/Zerph_bot?start=login', '_blank')
              return
            }
            if (state.settings.userPlan === 'free' && state.habits.length >= 3) {
              confirm({
                title: 'Лимит привычек',
                description: 'В бесплатной версии доступно максимум 3 привычки. Пожалуйста, приобретите Premium через бота.',
                confirmText: 'Понятно',
                variant: 'primary',
              })
              return
            }
            setIsAdding(!isAdding)
          }}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="Добавить привычку"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="flex flex-col gap-2 mb-2"
          >
            <div className="flex gap-2 relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(p => !p)}
                className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-lg hover:border-primary transition-colors shrink-0 shadow-inner"
              >
                {newIcon}
              </button>
              
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute top-12 left-0 z-50 bg-popover border border-border shadow-2xl rounded-2xl p-2.5 w-64"
                  >
                    <div className="grid grid-cols-5 gap-1">
                      {['💧','🏃‍♂️','🧘‍♀️','📚','💪','🍏','💊','🛌','🔥','🎵','🧠','🌿','✍️','💰','🚫','📅','🏆','🚗','🛒','🍳'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setNewIcon(emoji)
                            setShowEmojiPicker(false)
                          }}
                          className="flex items-center justify-center text-xl w-10 h-10 rounded-xl hover:bg-accent transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Название привычки..."
                className="flex-1 h-10 px-3 rounded-xl bg-card border border-border text-[13px] outline-none focus:border-primary"
                autoFocus
              />
              <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:brightness-110 transition-all">
                Добавить
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {state.habits.map(habit => {
          const isDone = habit.lastCompletedAt === todayStr
          const isMenuOpen = activeMenuHabitId === habit.id
          const isSelected = selectedHabitId === habit.id

          return (
            <motion.div
              key={habit.id}
              layout
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 group',
                isSelected
                  ? 'bg-primary/20 border-primary ring-2 ring-primary/40 shadow-sm'
                  : isDone
                  ? 'bg-primary/10 border-primary/25 shadow-xs'
                  : 'bg-card border-border/60 hover:border-primary/40'
              )}
              onClick={() => {
                if (onSelectHabit) {
                  onSelectHabit(isSelected ? null : habit.id)
                } else {
                  setSelectedHabitForDetails(habit)
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{habit.icon || '📌'}</span>
                
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  {habit.streak > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                      <Flame className="w-3 h-3" /> {habit.streak}
                    </span>
                  )}

                  {/* 3 Dots Menu Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuHabitId(isMenuOpen ? null : habit.id)
                      }}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg p-1 transition-colors"
                      title="Действия с привычкой"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {isMenuOpen && (
                        <motion.div
                          ref={menuRef}
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-7 z-50 w-36 bg-popover border border-border rounded-xl shadow-2xl p-1 font-sans flex flex-col gap-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setActiveMenuHabitId(null)
                              setSelectedHabitForDetails(habit)
                            }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-accent transition-colors text-left"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span>Подробнее</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuHabitId(null)
                              setEditingHabit(habit)
                            }}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-accent transition-colors text-left"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-primary" />
                            <span>Изменить</span>
                          </button>
                          <button
                            onClick={() => handleDelete(habit.id)}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            <span>Удалить</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1 mt-0.5">
                <p className={cn('text-[13px] font-medium leading-tight truncate flex-1', isDone ? 'text-primary font-semibold' : 'text-foreground')}>
                  {habit.title}
                </p>

                {/* Quick Checkmark Toggle */}
                <button
                  onClick={(e) => toggleHabit(e, habit)}
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all',
                    isDone 
                      ? 'bg-primary text-primary-foreground shadow-xs' 
                      : 'border border-border/80 hover:border-primary text-transparent'
                  )}
                  title={isDone ? 'Отменить выполнение' : 'Выполнить за сегодня'}
                >
                  <Check className="w-3 h-3" strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          )
        })}

        {state.habits.length === 0 && !isAdding && (
          <div className="col-span-full py-4 text-center border border-dashed border-border/50 rounded-2xl bg-muted/20">
            <p className="text-[12px] text-muted-foreground">Нет привычек. Нажмите + чтобы добавить.</p>
          </div>
        )}
      </div>

      {/* Habit Details Modal */}
      {selectedHabitForDetails && (
        <HabitDetailsModal
          habit={selectedHabitForDetails}
          isOpen={!!selectedHabitForDetails}
          onClose={() => setSelectedHabitForDetails(null)}
          onEdit={(h) => {
            setSelectedHabitForDetails(null)
            setEditingHabit(h)
          }}
          onDelete={(id) => handleDelete(id)}
        />
      )}

      {/* Habit Edit Modal */}
      {editingHabit && (
        <HabitEditModal
          habit={editingHabit}
          isOpen={!!editingHabit}
          onClose={() => setEditingHabit(null)}
        />
      )}
    </div>
  )
}

