'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { Inbox, Users, Briefcase, User, Zap, Lightbulb, GraduationCap, Activity, Calendar } from 'lucide-react'
import { cn, isBirthdayTask, groupTasksByDate } from '@/lib/utils'

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

  // All inbox items (not in a specific project or goal, and not birthday cards)
  const allInboxTasks = state.tasks.filter(t => !t.projectId && !t.goalId && !isBirthdayTask(t))
  
  // Shared / delegated tasks
  const rawSharedWithMe = allInboxTasks.filter(t => t.isShared || t.tags?.includes('поручение'))
  // Standard personal inbox tasks
  const rawPersonal = allInboxTasks.filter(t => !t.isShared && !t.tags?.includes('поручение'))

  const sharedWithMe = rawSharedWithMe.filter(matchesTag)
  const personalTasks = rawPersonal.filter(matchesTag)

  const sharedDateGroups = groupTasksByDate(sharedWithMe)
  const personalDateGroups = groupTasksByDate(personalTasks)

  const totalInboxCount = personalTasks.length + sharedWithMe.length

  return (
    <div className="w-full max-w-none grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Main Left/Center Column ── */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
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

        {/* Shared tasks / Поручения */}
        {sharedWithMe.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                Поручения и совместные задачи
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                {sharedWithMe.length}
              </span>
            </div>

            <div className="space-y-4">
              {sharedDateGroups.map(group => (
                <div key={group.dateKey} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 px-1 py-1 select-none">
                    <div className={cn(
                      'flex items-center gap-1.5 text-[12px] font-bold tracking-tight uppercase',
                      group.isToday ? 'text-primary' : group.isOverdue ? 'text-[var(--status-overdue)]' : 'text-muted-foreground'
                    )}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{group.label}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                      {group.tasks.length}
                    </span>
                    <div className="flex-1 h-[1px] bg-border/40 ml-2" />
                  </div>
                  <div className="space-y-0.5">
                    {group.tasks.map((t, i) => (
                      <TaskItem key={t.id} task={t} index={i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Uncategorized tasks */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Inbox className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
              Личные входящие задачи
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-muted text-muted-foreground border border-border/50">
              {personalTasks.length}
            </span>
          </div>

          {personalTasks.length === 0 && sharedWithMe.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-16 text-center bg-card/40 rounded-2xl border border-dashed border-border"
            >
              <Inbox className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm font-bold text-foreground">Входящие чисты!</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {selectedTag !== 'all' ? 'Нет входящих с выбранным тегом' : 'Все задачи привязаны к проектам или выполнены. Отличная организация!'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {personalDateGroups.map(group => (
                <div key={group.dateKey} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 px-1 py-1 select-none">
                    <div className={cn(
                      'flex items-center gap-1.5 text-[12px] font-bold tracking-tight uppercase',
                      group.isToday ? 'text-primary' : group.isOverdue ? 'text-[var(--status-overdue)]' : 'text-muted-foreground'
                    )}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{group.label}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                      {group.tasks.length}
                    </span>
                    <div className="flex-1 h-[1px] bg-border/40 ml-2" />
                  </div>
                  <div className="space-y-0.5">
                    {group.tasks.map((t, i) => (
                      <TaskItem key={t.id} task={t} index={i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Sidebar Desktop Dashboard Panel ── */}
      <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col gap-5 sticky top-2">
        {/* Zero Inbox Status Card */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                <Inbox className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground leading-tight">Статус Входящих</p>
                <p className="text-[11px] text-muted-foreground">Методология Zero Inbox</p>
              </div>
            </div>
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              totalInboxCount === 0 
                ? 'bg-[var(--status-done)]/15 text-[var(--status-done)] border-[var(--status-done)]/25'
                : 'bg-primary/15 text-primary border-primary/25'
            )}>
              {totalInboxCount === 0 ? 'Входящие разобраны' : `${totalInboxCount} на разбор`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            {totalInboxCount === 0 ? (
              <p className="text-[var(--status-done)] font-medium">
                🎉 У вас нет необработанных задач! Все дела распределены по проектам или выполнены.
              </p>
            ) : (
              <p>
                Во входящих находятся новые мысли, поручения и задачи без проекта. Назначьте им дедлайн или перенесите в проект для четкого фокуса.
              </p>
            )}
          </div>
        </div>

        {/* Team Collaboration Snapshot */}
        {sharedWithMe.length > 0 && (
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">Совместные дела</h2>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">{sharedWithMe.length} задач</span>
            </div>

            <div className="space-y-2">
              {sharedWithMe.slice(0, 4).map((t) => (
                <div key={t.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground truncate">{t.title}</span>
                  <span className="text-[10px] font-semibold text-primary shrink-0">
                    {t.dueTime || 'Сегодня'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GTD 2-Minute Rule Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 flex items-start gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-foreground">Правило 2 минут</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Если задачу из входящих можно выполнить быстрее, чем за 2 минуты — сделайте её прямо сейчас, не откладывая.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
