'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { Inbox, Users, Tag, Briefcase, User, Zap, Lightbulb, GraduationCap, Activity } from 'lucide-react'
import { cn, isBirthdayTask } from '@/lib/utils'

const FIXED_TAGS = [
  { id: 'all', label: 'Все' },
  { id: 'работа', label: 'Работа', icon: Briefcase },
  { id: 'личное', label: 'Личное', icon: User },
  { id: 'срочно', label: 'Срочно', icon: Zap },
  { id: 'идеи', label: 'Идеи', icon: Lightbulb },
  { id: 'учеба', label: 'Учеба', icon: GraduationCap },
  { id: 'спорт', label: 'Спорт', icon: Activity },
]

export function InboxView() {
  const { state } = useApp()
  const [selectedTag, setSelectedTag] = useState<string>('all')

  const matchesTag = (t: { tags?: string[]; priority?: string }) => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'срочно') {
      return t.priority === 'urgent' || t.tags?.some(tag => tag.toLowerCase().includes('срочн'))
    }
    return t.tags?.some(tag => tag.toLowerCase().includes(selectedTag))
  }

  const rawUncategorized = state.tasks.filter(t => !t.projectId && !t.goalId && !isBirthdayTask(t))
  const rawSharedWithMe = state.tasks.filter(t => t.isShared && !isBirthdayTask(t))

  const uncategorized = rawUncategorized.filter(matchesTag)
  const sharedWithMe = rawSharedWithMe.filter(matchesTag)

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Tag Filters Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
        {FIXED_TAGS.map(tag => {
          const isActive = selectedTag === tag.id
          const Icon = (tag as any).icon
          return (
            <button
              key={tag.id}
              onClick={() => setSelectedTag(tag.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                  : 'bg-card/70 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {Icon && <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />}
              <span>{tag.label}</span>
            </button>
          )
        })}
      </div>

      {/* Shared tasks */}
      {sharedWithMe.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              Поручения и совместные задачи — {sharedWithMe.length}
            </h2>
          </div>
          <div className="space-y-0.5">
            {sharedWithMe.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        </div>
      )}

      {/* Uncategorized tasks */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Inbox className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
            Входящие задачи — {uncategorized.length}
          </h2>
        </div>
        {uncategorized.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-12 text-center"
          >
            <Inbox className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">Входящие чисты</p>
            <p className="text-xs text-muted-foreground/60">
              {selectedTag !== 'all' ? 'Нет задач с выбранным тегом' : 'Все задачи привязаны к проектам или выполнены'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {uncategorized.map((t, i) => <TaskItem key={t.id} task={t} index={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}
