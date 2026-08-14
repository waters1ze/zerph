'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, MoreVertical, Flame } from 'lucide-react'
import { useApp, getTgChatId } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Habit } from '@/lib/types'

export function HabitsWidget() {
  const { state, dispatch } = useApp()
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newIcon, setNewIcon] = useState('💧')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)

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

    // enhancedDispatch will POST to API and REPLACE_HABIT with real DB id
    dispatch({ type: 'ADD_HABIT', habit: newHabit })
    setNewTitle('')
    setIsAdding(false)
  }

  const toggleHabit = (habit: Habit) => {
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

    // enhancedDispatch will PATCH to API
    dispatch({ type: 'UPDATE_HABIT', id: habit.id, updates: { lastCompletedAt: newCompletedAt, streak: newStreak } })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Удалить привычку?')) return
    // enhancedDispatch will DELETE from API
    dispatch({ type: 'DELETE_HABIT', id })
  }

  return (
    <div className="flex flex-col gap-3">
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
              alert('В бесплатной версии доступно максимум 3 привычки. Пожалуйста, приобретите Premium через бота.')
              return
            }
            setIsAdding(!isAdding)
          }}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
                className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-lg hover:border-primary transition-colors shrink-0"
              >
                {newIcon}
              </button>
              
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute top-12 left-0 z-50 bg-popover border border-border shadow-xl rounded-xl p-2 w-64"
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
                          className="flex items-center justify-center text-xl w-10 h-10 rounded-lg hover:bg-accent transition-colors"
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
              <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium">
                Добавить
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {state.habits.map(habit => {
          const isDone = habit.lastCompletedAt === todayStr
          return (
            <motion.div
              key={habit.id}
              layout
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2',
                isDone
                  ? 'bg-primary/15 border-primary/30 shadow-sm'
                  : 'bg-card border-border/60 hover:border-primary/40'
              )}
              onClick={() => toggleHabit(habit)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{habit.icon || '📌'}</span>
                <div className="flex items-center gap-2">
                  {habit.streak > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                      <Flame className="w-3 h-3" /> {habit.streak}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(habit.id) }}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors p-1"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className={cn('text-[13px] font-medium leading-tight', isDone ? 'text-primary font-semibold' : 'text-foreground')}>
                {habit.title}
              </p>
              {isDone && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                </div>
              )}
            </motion.div>
          )
        })}
        {state.habits.length === 0 && !isAdding && (
          <div className="col-span-full py-4 text-center border border-dashed border-border/50 rounded-2xl bg-muted/20">
            <p className="text-[12px] text-muted-foreground">Нет привычек. Нажмите + чтобы добавить.</p>
          </div>
        )}
      </div>
    </div>
  )
}
