'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { cn, isTaskVisibleInMainList, groupTasksByDate } from '@/lib/utils'
import type { Priority, TaskStatus, ScheduleGroup } from '@/lib/types'
import { 
  CheckSquare, Briefcase, User, Zap, Lightbulb, GraduationCap, 
  Activity, Calendar, Users, UserCheck, Settings2, Plus, Clock
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { ScheduleWidget } from '@/components/schedule-widget'
import { ScheduleGroupModal } from '@/components/schedule-group-modal'

type FilterStatus = 'all' | TaskStatus
type SortKey = 'dueDate' | 'priority' | 'createdAt'

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function TasksView() {
  const { state, dispatch } = useApp()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('dueDate')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false)

  const FIXED_TAGS = [
    { id: 'all', label: 'Все' },
    { id: 'общая', label: 'Общие', icon: Users },
    { id: 'поручение', label: 'Порученные', icon: UserCheck },
    { id: 'работа', label: 'Работа', icon: Briefcase },
    { id: 'личное', label: 'Личное', icon: User },
    { id: 'срочно', label: 'Срочно', icon: Zap },
    { id: 'идеи', label: 'Идеи', icon: Lightbulb },
    { id: 'учеба', label: 'Учеба / Школа', icon: GraduationCap },
    { id: 'спорт', label: 'Спорт', icon: Activity },
  ]

  const matchesTag = (t: { tags?: string[]; priority?: string; isShared?: boolean }) => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'срочно') {
      return t.priority === 'urgent' || t.tags?.some(tag => tag.toLowerCase().includes('срочн'))
    }
    const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
    if (selectedTag === 'общая') {
      return tags.includes('общая') || tags.includes('совместная') || tags.includes('совместно') || tags.includes('общие')
    }
    if (selectedTag === 'поручение') {
      const isCommon = tags.includes('общая') || tags.includes('совместная') || tags.includes('совместно') || tags.includes('общие')
      const hasDel = tags.includes('поручение') || tags.includes('делегировано') || tags.includes('поручено')
      return (t.isShared || hasDel) && !isCommon
    }
    if (selectedTag === 'учеба') {
      return tags.some(tag => tag.includes('учеб') || tag.includes('школ') || tag.includes('урок') || tag.includes('дз'))
    }
    return t.tags?.some(tag => tag.toLowerCase().includes(selectedTag))
  }

  const visibleTasks = state.tasks.filter(t => isTaskVisibleInMainList(t, 7))

  const filtered = visibleTasks
    .filter(t => {
      if (filterStatus === 'all') return true
      if (filterStatus === 'todo') return t.status === 'todo' || t.status === 'inprogress'
      return t.status === filterStatus
    })
    .filter(t => filterProject === 'all' || t.projectId === filterProject)
    .filter(matchesTag)
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
    { id: 'all', label: 'Все', count: visibleTasks.filter(matchesTag).length },
    { id: 'todo', label: 'К выполнению', count: visibleTasks.filter(t => t.status !== 'done').filter(matchesTag).length },
    { id: 'inprogress', label: 'В процессе', count: visibleTasks.filter(t => t.status === 'inprogress').filter(matchesTag).length },
    { id: 'done', label: 'Готово', count: visibleTasks.filter(t => t.status === 'done').filter(matchesTag).length },
    { id: 'overdue', label: 'Просрочено', count: visibleTasks.filter(t => t.status === 'overdue').filter(matchesTag).length },
  ]

  const dateGroups = groupTasksByDate(filtered)

  const totalTasks = visibleTasks.length
  const urgentCount = visibleTasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length
  const highCount = visibleTasks.filter(t => t.priority === 'high' && t.status !== 'done').length
  const mediumCount = visibleTasks.filter(t => t.priority === 'medium' && t.status !== 'done').length
  const lowCount = visibleTasks.filter(t => t.priority === 'low' && t.status !== 'done').length

  const handleSaveGroup = (group: ScheduleGroup) => {
    const exists = state.scheduleGroups?.some(g => g.id === group.id)
    if (exists) {
      dispatch({ type: 'UPDATE_SCHEDULE_GROUP', id: group.id, updates: group })
    } else {
      dispatch({ type: 'ADD_SCHEDULE_GROUP', group })
    }
  }

  const handleDeleteGroup = (groupId: string) => {
    dispatch({ type: 'DELETE_SCHEDULE_GROUP', id: groupId })
  }

  return (
    <div className="w-full max-w-none grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Main Left/Center Column ── */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
        
        {/* Tag Filters Bar (Responsive flex-wrap, no scrollbars) */}
        <div className="flex flex-wrap items-center gap-1.5 no-scrollbar select-none">
          {FIXED_TAGS.map(tag => {
            const isActive = selectedTag === tag.id
            const Icon = (tag as any).icon
            return (
              <button
                key={tag.id}
                onClick={() => setSelectedTag(tag.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border shrink-0',
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

        {/* Smart Schedule Group Widget (Compact Single Card for School / Classes) */}
        <ScheduleWidget
          groups={state.scheduleGroups || []}
          onOpenManager={() => setIsScheduleModalOpen(true)}
          mode="compact"
        />

        {/* Tabs — single line with smooth pill styling */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border w-full sm:w-fit overflow-x-auto no-scrollbar flex-nowrap shrink-0">
          {statusTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={cn(
                'flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11.5px] sm:text-[12px] font-medium transition-all duration-150 shrink-0 whitespace-nowrap',
                filterStatus === tab.id
                  ? 'bg-card text-foreground shadow-sm border border-border/50 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={cn('text-[10px] font-semibold min-w-[16px] text-center px-1 rounded-full',
                  filterStatus === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
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

        {/* Task list grouped by dates */}
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-16 text-center bg-card/30 rounded-2xl border border-dashed border-border"
            >
              <CheckSquare className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Задачи не найдены</p>
              <p className="text-xs text-muted-foreground/60">Попробуйте изменить параметры фильтра</p>
            </motion.div>
          ) : sortKey === 'dueDate' ? (
            <motion.div key="grouped-list" className="space-y-4">
              {dateGroups.map(group => (
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
                  <div className="space-y-1">
                    {group.tasks.map((t, i) => (
                      <TaskItem key={t.id} task={t} index={i} />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="flat-list" className="space-y-1">
              {filtered.map((t, i) => (
                <TaskItem key={t.id} task={t} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right Sidebar Column ── */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
        
        {/* Schedule Groups Card */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                Расписание уроков / групп
              </h2>
            </div>
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Настроить</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {(state.scheduleGroups && state.scheduleGroups.length > 0) ? (
              state.scheduleGroups.map(grp => (
                <div
                  key={grp.id}
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: grp.color }}
                    />
                    <span className="text-xs font-bold text-foreground truncate">{grp.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {grp.days.filter(d => d.enabled).length} дн./нед.
                  </span>
                </div>
              ))
            ) : (
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="w-full py-3 border border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span>Создать группу (Школа / Секция)</span>
              </button>
            )}
          </div>
        </div>

        {/* Project Matrix / Summary */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">Проекты</h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">{state.projects.length} активных</span>
          </div>

          <div className="space-y-1.5 pt-1">
            <button
              onClick={() => setFilterProject('all')}
              className={cn(
                'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left font-medium',
                filterProject === 'all'
                  ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                  : 'bg-muted/30 border-border/40 text-foreground hover:bg-muted/60'
              )}
            >
              <span className="text-xs">Все проекты</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-bold">{state.tasks.length}</span>
            </button>

            {state.projects.map(p => {
              const count = state.tasks.filter(t => t.projectId === p.id).length
              const isSelected = filterProject === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setFilterProject(p.id)}
                  className={cn(
                    'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left',
                    isSelected
                      ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                      : 'bg-muted/30 border-border/40 text-foreground hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || 'var(--primary)' }} />
                    <span className="text-xs truncate">{p.title}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-bold shrink-0">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Priority Breakdown Matrix Card */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">Активные приоритеты</h2>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">{state.tasks.filter(t => t.status !== 'done').length} активных</span>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-[var(--priority-urgent)]">
                <span className="w-2 h-2 rounded-full bg-[var(--priority-urgent)]" /> Срочные
              </span>
              <span className="font-extrabold text-foreground">{urgentCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-[var(--priority-high)]">
                <span className="w-2 h-2 rounded-full bg-[var(--priority-high)]" /> Высокие
              </span>
              <span className="font-extrabold text-foreground">{highCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-[var(--priority-medium)]">
                <span className="w-2 h-2 rounded-full bg-[var(--priority-medium)]" /> Средние
              </span>
              <span className="font-extrabold text-foreground">{mediumCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" /> Низкие
              </span>
              <span className="font-extrabold text-foreground">{lowCount}</span>
            </div>
          </div>
        </div>

        {/* Quick Productivity Tip Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 flex items-start gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-foreground">Голосовые и общие задачи</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Скажи боту или Siri: <i>«Создай нам общую задачу согласовать проект к 19:00»</i> — и Zerf автоматически создаст задачу у обоих участников и пришлет синхронное напоминание.
            </p>
          </div>
        </div>
      </div>

      {/* Schedule Group Manager Modal */}
      <ScheduleGroupModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        groups={state.scheduleGroups || []}
        onSaveGroup={handleSaveGroup}
        onDeleteGroup={handleDeleteGroup}
      />
    </div>
  )
}
