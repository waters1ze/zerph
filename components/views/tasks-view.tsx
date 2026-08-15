'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { cn, isBirthdayVisible } from '@/lib/utils'
import type { Priority, TaskStatus } from '@/lib/types'
import { CheckSquare } from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'

type FilterStatus = 'all' | TaskStatus
type SortKey = 'dueDate' | 'priority' | 'createdAt'

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function TasksView() {
  const { state } = useApp()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('dueDate')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')

  const FIXED_TAGS = [
    { id: 'all', label: 'Все' },
    { id: 'работа', label: '💼 Работа' },
    { id: 'личное', label: '👤 Личное' },
    { id: 'срочно', label: '⚡ Срочно' },
    { id: 'идеи', label: '💡 Идеи' },
    { id: 'учеба', label: '🎓 Учеба' },
    { id: 'спорт', label: '🏃 Спорт' },
  ]

  const matchesTag = (t: { tags?: string[]; priority?: string }) => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'срочно') {
      return t.priority === 'urgent' || t.tags?.some(tag => tag.toLowerCase().includes('срочн'))
    }
    return t.tags?.some(tag => tag.toLowerCase().includes(selectedTag))
  }

  const filtered = state.tasks
    .filter(t => filterStatus === 'all' || t.status === filterStatus)
    .filter(t => filterProject === 'all' || t.projectId === filterProject)
    .filter(matchesTag)
    .filter(isBirthdayVisible)
    .filter(t => {
      if (!state.searchQuery) return true
      return t.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.includes(state.searchQuery.toLowerCase()))
    })
    .sort((a, b) => {
      if (sortKey === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (sortKey === 'dueDate') {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      return b.createdAt.localeCompare(a.createdAt)
    })

  const statusTabs: { id: FilterStatus; label: string; count: number }[] = [
    { id: 'all', label: 'Все', count: state.tasks.filter(matchesTag).length },
    { id: 'todo', label: 'К выполнению', count: state.tasks.filter(t => t.status === 'todo').filter(matchesTag).length },
    { id: 'inprogress', label: 'В процессе', count: state.tasks.filter(t => t.status === 'inprogress').filter(matchesTag).length },
    { id: 'done', label: 'Готово', count: state.tasks.filter(t => t.status === 'done').filter(matchesTag).length },
    { id: 'overdue', label: 'Просрочено', count: state.tasks.filter(t => t.status === 'overdue').filter(matchesTag).length },
  ]

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Tag Filters Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar select-none">
        {FIXED_TAGS.map(tag => {
          const isActive = selectedTag === tag.id
          return (
            <button
              key={tag.id}
              onClick={() => setSelectedTag(tag.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                  : 'bg-card/70 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tag.label}
            </button>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border w-fit">
        {statusTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150',
              filterStatus === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('text-[10px] font-semibold min-w-[16px] text-center',
                filterStatus === tab.id ? 'text-primary' : 'text-muted-foreground'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2">
        <CustomSelect
          value={filterProject}
          onChange={setFilterProject}
          options={[
            { value: 'all', label: 'Все проекты' },
            ...state.projects.map(p => ({ value: p.id, label: p.title, color: p.color })),
          ]}
          placeholder="Все проекты"
          className="w-40"
        />
        <CustomSelect
          value={sortKey}
          onChange={v => setSortKey(v as SortKey)}
          options={[
            { value: 'dueDate',   label: 'По сроку' },
            { value: 'priority',  label: 'По приоритету' },
            { value: 'createdAt', label: 'По созданию' },
          ]}
          placeholder="Сортировка"
          className="w-36 ml-auto"
        />
      </div>

      {/* Task list */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-16 text-center"
          >
            <CheckSquare className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No tasks found</p>
            <p className="text-xs text-muted-foreground/60">Try adjusting your filters</p>
          </motion.div>
        ) : (
          <motion.div key="list" className="space-y-0.5">
            {filtered.map((t, i) => (
              <TaskItem key={t.id} task={t} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
