'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { LayoutGrid, AlertTriangle, Star, Clock, Coffee, Sparkles } from 'lucide-react'
import { cn, isBirthdayVisible } from '@/lib/utils'

export function EisenhowerView() {
  const { state } = useApp()
  const today = new Date().toISOString().slice(0, 10)

  // Categorize active tasks into 4 Eisenhower quadrants (Birthdays only 2 days before)
  const activeTasks = state.tasks.filter(t => t.status !== 'done' && isBirthdayVisible(t, 2))

  const q1 = activeTasks.filter(t => {
    const isUrgent = t.priority === 'urgent' || (t.dueDate && t.dueDate <= today)
    const isImportant = t.priority === 'urgent' || t.priority === 'high'
    return isUrgent && isImportant
  })

  const q2 = activeTasks.filter(t => {
    const isUrgent = t.priority === 'urgent' || (t.dueDate && t.dueDate <= today)
    const isImportant = t.priority === 'urgent' || t.priority === 'high'
    return !isUrgent && isImportant
  })

  const q3 = activeTasks.filter(t => {
    const isUrgent = t.priority === 'urgent' || (t.dueDate && t.dueDate <= today)
    const isImportant = t.priority === 'urgent' || t.priority === 'high'
    return isUrgent && !isImportant
  })

  const q4 = activeTasks.filter(t => {
    const isUrgent = t.priority === 'urgent' || (t.dueDate && t.dueDate <= today)
    const isImportant = t.priority === 'urgent' || t.priority === 'high'
    return !isUrgent && !isImportant
  })

  const QUADRANTS = [
    {
      id: 'q1',
      title: 'Сделать срочно',
      subtitle: 'Срочно и Важно (Делать сразу)',
      icon: AlertTriangle,
      color: 'border-red-500/30 bg-red-500/5 text-red-400',
      badge: 'bg-red-500/20 text-red-300',
      tasks: q1,
    },
    {
      id: 'q2',
      title: 'Запланировать',
      subtitle: 'Важно, но не срочно (Стратегия)',
      icon: Star,
      color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300',
      tasks: q2,
    },
    {
      id: 'q3',
      title: 'Делегировать',
      subtitle: 'Срочно, но не важно (Рутина)',
      icon: Clock,
      color: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
      badge: 'bg-amber-500/20 text-amber-300',
      tasks: q3,
    },
    {
      id: 'q4',
      title: 'Минимизировать',
      subtitle: 'Не срочно и не важно (Отложить)',
      icon: Coffee,
      color: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300',
      tasks: q4,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            Матрица Эйзенхауэра
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            ИИ-сортировка задач по важности и срочности
          </p>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANTS.map((quad, qi) => {
          const Icon = quad.icon
          return (
            <motion.div
              key={quad.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: qi * 0.08, duration: 0.22 }}
              className={cn('rounded-2xl border p-4 flex flex-col min-h-[220px]', quad.color)}
            >
              {/* Quadrant header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <div>
                    <h3 className="text-[14px] font-bold text-foreground leading-none">{quad.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{quad.subtitle}</p>
                  </div>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold', quad.badge)}>
                  {quad.tasks.length}
                </span>
              </div>

              {/* Tasks list */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[300px]">
                {quad.tasks.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-[12px] text-muted-foreground/40 italic">
                    Задач нет
                  </div>
                ) : (
                  quad.tasks.map((task, ti) => (
                    <TaskItem key={task.id} task={task} index={ti} compact />
                  ))
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
