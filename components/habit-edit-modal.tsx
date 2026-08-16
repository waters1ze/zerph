'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { X, Sparkles, Flame, Check } from 'lucide-react'
import type { Habit } from '@/lib/types'

interface HabitEditModalProps {
  habit: Habit | null
  isOpen: boolean
  onClose: () => void
}

const EMOJI_LIST = ['💧','🏃‍♂️','🧘‍♀️','📚','💪','🍏','💊','🛌','🔥','🎵','🧠','🌿','✍️','💰','🚫','📅','🏆','🚗','🛒','🍳','🎯','💻','🚴','🎨','🍵']

export function HabitEditModal({ habit, isOpen, onClose }: HabitEditModalProps) {
  const { dispatch } = useApp()
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('🔥')
  const [frequency, setFrequency] = useState('daily')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  useEffect(() => {
    if (habit) {
      setTitle(habit.title)
      setIcon(habit.icon || '🔥')
      setFrequency(habit.frequency || 'daily')
    }
  }, [habit])

  if (!isOpen || !habit) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    dispatch({
      type: 'UPDATE_HABIT',
      id: habit.id,
      updates: {
        title: title.trim(),
        icon,
        frequency,
        updatedAt: new Date().toISOString(),
      },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl p-6 overflow-hidden font-sans"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              Редактировать привычку
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Название и иконка:</label>
            <div className="flex gap-2 relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(p => !p)}
                className="w-11 h-11 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-xl hover:border-primary transition-colors shrink-0 shadow-inner"
              >
                {icon}
              </button>

              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    className="absolute top-12 left-0 z-50 bg-popover border border-border shadow-2xl rounded-2xl p-2.5 w-64"
                  >
                    <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
                      {EMOJI_LIST.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setIcon(emoji)
                            setShowEmojiPicker(false)
                          }}
                          className="flex items-center justify-center text-lg w-10 h-10 rounded-xl hover:bg-accent transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Название привычки..."
                className="flex-1 h-11 px-3.5 rounded-2xl bg-muted/50 border border-border/80 text-[13px] text-foreground font-medium outline-none focus:border-primary transition-colors"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Регулярность:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFrequency('daily')}
                className={`h-9 rounded-xl border text-xs font-semibold transition-all ${
                  frequency === 'daily'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Каждый день
              </button>
              <button
                type="button"
                onClick={() => setFrequency('weekly')}
                className={`h-9 rounded-xl border text-xs font-semibold transition-all ${
                  frequency === 'weekly'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Еженедельно
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex items-center gap-1.5 h-9 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
