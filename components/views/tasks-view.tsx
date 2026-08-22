'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { cn, isTaskVisibleInMainList, groupTasksByDate } from '@/lib/utils'
import type { Priority, TaskStatus, ScheduleGroup, Friend, FriendGroup } from '@/lib/types'
import {
  CheckSquare, Briefcase, User, Zap, Lightbulb, GraduationCap,
  Activity, Calendar, Users, UserCheck, Settings2, Plus, Clock, Layers, X, Inbox,
  ChevronDown, ChevronUp, CheckCircle2
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
  // Completed tasks are grouped into a clean collapsible section per date group,
  // hidden by default so only active tasks are in focus.
  const [openDoneGroups, setOpenDoneGroups] = useState<Record<string, boolean>>({})
  const [showFlatDone, setShowFlatDone] = useState<boolean>(false)

  const toggleGroupDone = (dateKey: string) => {
    setOpenDoneGroups(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }))
  }
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterFriend, setFilterFriend] = useState<string>('all')
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false)

  // Listen to navigation events from task details / friend groups / notifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFriend = localStorage.getItem('zerf_task_filter_friend')
      const savedGroup = localStorage.getItem('zerf_task_filter_group')
      const savedTag = localStorage.getItem('zerf_task_filter_tag')
      if (savedFriend) setFilterFriend(savedFriend)
      if (savedGroup) setFilterGroup(savedGroup)
      if (savedTag) setSelectedTag(savedTag)

      const handleFilterEvent = (e: any) => {
        if (e.detail?.friendId !== undefined) setFilterFriend(e.detail.friendId)
        if (e.detail?.groupId !== undefined) setFilterGroup(e.detail.groupId)
        if (e.detail?.tag !== undefined) setSelectedTag(e.detail.tag)
      }

      window.addEventListener('zerf_filter_tasks', handleFilterEvent)
      return () => window.removeEventListener('zerf_filter_tasks', handleFilterEvent)
    }
  }, [])

  const FIXED_TAGS = [
    { id: 'all', label: 'Все' },
    { id: 'inbox', label: 'Входящие от друзей', icon: Inbox },
    { id: 'общая', label: 'Общие', icon: Users },
    { id: 'поручение', label: 'Порученные', icon: UserCheck },
    { id: 'работа', label: 'Работа', icon: Briefcase },
    { id: 'личное', label: 'Личное', icon: User },
    { id: 'срочно', label: 'Срочно', icon: Zap },
    { id: 'идеи', label: 'Идеи', icon: Lightbulb },
    { id: 'учеба', label: 'Учеба / Школа', icon: GraduationCap },
    { id: 'спорт', label: 'Спорт', icon: Activity },
  ]

  const matchesTag = (t: { tags?: string[]; priority?: string; isShared?: boolean; authorChatId?: string | number | bigint | null; assignees?: string[] }) => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'inbox') {
      const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null
      const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
      const isFriendTag = tags.includes('входящая') || tags.includes('входящие') || tags.includes('поручено мне') || tags.includes('от друга') || tags.includes('поручение')
      const isAuthoredByOther = t.authorChatId && currentChatId && String(t.authorChatId) !== String(currentChatId)
      const isAssignedToMe = (t.assignees || []).some(a => a === currentChatId)
      return isFriendTag || Boolean(isAuthoredByOther) || isAssignedToMe || Boolean(t.isShared)
    }
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

  const visibleTasks = state.tasks.filter(t => isTaskVisibleInMainList(t, 7, filterStatus === 'done'))

  const filtered = visibleTasks
    .filter(t => {
      if (filterStatus === 'all') return true
      if (filterStatus === 'todo') return t.status === 'todo' || t.status === 'inprogress'
      return t.status === filterStatus
    })
    .filter(t => filterProject === 'all' || t.projectId === filterProject)
    .filter(t => {
      if (filterFriend === 'all') return true
      const friend = state.friends.find(f => f.id === filterFriend || f.chatId === filterFriend)
      const friendId = friend?.id || filterFriend
      const friendCid = friend?.chatId || filterFriend
      const uname = friend?.username ? friend.username.replace(/^@/, '').toLowerCase() : ''
      const fname = friend?.name ? friend.name.toLowerCase() : ''

      const isAssignee = (t.assignees || []).some(a => a === friendId || a === friendCid)
      const isAuthor = String(t.authorChatId) === friendCid || String(t.authorChatId) === friendId
      const isTarget = Boolean(uname && t.targetContact && t.targetContact.replace(/^@/, '').toLowerCase() === uname)
      const isRecip = Boolean(fname && t.recipientName && t.recipientName.toLowerCase() === fname)

      return isAssignee || isAuthor || isTarget || isRecip
    })
    .filter(t => {
      if (filterGroup === 'all') return true
      const group = (state.friendGroups || []).find(g => g.id === filterGroup)
      if (!group) return true

      const memberIds = group.memberIds || []
      const hasMemberAssignee = (t.assignees || []).some(a => memberIds.includes(a))
      const hasGroupTag = (t.tags || []).some(tag => tag.toLowerCase() === group.name.toLowerCase())
      const inTitle = t.title.toLowerCase().includes(group.name.toLowerCase())
      const isProjectGroup = t.projectId === group.id

      return hasMemberAssignee || hasGroupTag || inTitle || isProjectGroup
    })
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
            const currentChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') : null
            const count = visibleTasks.filter(t => {
              if (tag.id === 'all') return true
              if (tag.id === 'inbox') {
                const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
                const isFriendTag = tags.includes('входящая') || tags.includes('входящие') || tags.includes('поручено мне') || tags.includes('от друга') || tags.includes('поручение')
                const isAuthoredByOther = t.authorChatId && currentChatId && String(t.authorChatId) !== String(currentChatId)
                const isAssignedToMe = (t.assignees || []).some(a => a === currentChatId)
                return isFriendTag || Boolean(isAuthoredByOther) || isAssignedToMe || Boolean(t.isShared)
              }
              if (tag.id === 'срочно') return t.priority === 'urgent' || t.tags?.some(x => x.toLowerCase().includes('срочн'))
              if (tag.id === 'общая') {
                const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
                return tags.includes('общая') || tags.includes('совместная') || tags.includes('совместно') || tags.includes('общие')
              }
              if (tag.id === 'поручение') {
                const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
                const isCommon = tags.includes('общая') || tags.includes('совместная') || tags.includes('совместно') || tags.includes('общие')
                const hasDel = tags.includes('поручение') || tags.includes('делегировано') || tags.includes('поручено')
                return (t.isShared || hasDel) && !isCommon
              }
              if (tag.id === 'учеба') return t.tags?.some(x => x.includes('учеб') || x.includes('школ') || x.includes('урок') || x.includes('дз'))
              return t.tags?.some(x => x.toLowerCase().includes(tag.id))
            }).length

            return (
              <button
                key={tag.id}
                onClick={() => {
                  setSelectedTag(tag.id)
                  try { localStorage.setItem('zerf_task_filter_tag', tag.id) } catch {}
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border shrink-0 cursor-pointer',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                    : 'bg-card/70 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {Icon && <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />}
                <span>{tag.label}</span>
                {count > 0 && tag.id !== 'all' && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.2 rounded-full',
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : (tag.id === 'inbox' ? 'bg-amber-500/15 text-amber-400 font-bold' : 'bg-muted text-muted-foreground')
                  )}>
                    {count}
                  </span>
                )}
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
          {/* Project selector */}
          <CustomSelect
            value={filterProject}
            onChange={setFilterProject}
            options={[
              { value: 'all', label: 'Все проекты' },
              ...state.projects.map(p => ({ value: p.id, label: p.title, color: p.color })),
            ]}
            placeholder="Все проекты"
            className="w-36 sm:w-40"
          />

          {/* Friend selector */}
          <CustomSelect
            value={filterFriend}
            onChange={v => {
              setFilterFriend(v)
              if (v !== 'all') setFilterGroup('all')
              try { localStorage.setItem('zerf_task_filter_friend', v) } catch {}
            }}
            options={[
              { value: 'all', label: '👤 Все друзья' },
              ...state.friends.map(f => ({
                value: f.chatId || f.id,
                label: f.name || f.username || `Друг #${f.id.slice(-4)}`,
              })),
            ]}
            placeholder="Фильтр по другу"
            className="w-36 sm:w-40"
          />

          {/* Group selector */}
          <CustomSelect
            value={filterGroup}
            onChange={v => {
              setFilterGroup(v)
              if (v !== 'all') setFilterFriend('all')
              try { localStorage.setItem('zerf_task_filter_group', v) } catch {}
            }}
            options={[
              { value: 'all', label: '👥 Все группы' },
              ...(state.friendGroups || []).map(g => ({
                value: g.id,
                label: `${g.emoji || '👥'} ${g.name}`,
                color: g.color,
              })),
            ]}
            placeholder="Фильтр по группе"
            className="w-36 sm:w-40"
          />

          {/* Sort selector */}
          <CustomSelect
            value={sortKey}
            onChange={v => setSortKey(v as SortKey)}
            options={[
              { value: 'dueDate',   label: 'По сроку' },
              { value: 'priority',  label: 'По приоритету' },
              { value: 'createdAt', label: 'По созданию' },
            ]}
            placeholder="Сортировка"
            className="w-32 sm:w-36 ml-auto"
          />
        </div>

        {/* Active Friend / Group Filter Indicator Banner */}
        {(filterFriend !== 'all' || filterGroup !== 'all') && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-primary truncate">
                {filterFriend !== 'all'
                  ? `Показаны задачи с: ${state.friends.find(f => f.id === filterFriend || f.chatId === filterFriend)?.name || 'другом'}`
                  : `Показаны задачи группы: ${(state.friendGroups || []).find(g => g.id === filterGroup)?.name || 'группы'}`
                }
              </span>
            </div>
            <button
              onClick={() => {
                setFilterFriend('all')
                setFilterGroup('all')
                try {
                  localStorage.setItem('zerf_task_filter_friend', 'all')
                  localStorage.setItem('zerf_task_filter_group', 'all')
                } catch {}
              }}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground underline cursor-pointer shrink-0 ml-2"
            >
              Сбросить фильтр ✕
            </button>
          </motion.div>
        )}

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
              {dateGroups.map(group => {
                // Active first; completed sink into a collapsible sub-section.
                // On the «Готово» tab everything is done — no split needed.
                const separateDone = filterStatus !== 'done'
                const active = separateDone ? group.tasks.filter(t => t.status !== 'done') : group.tasks
                const done = separateDone ? group.tasks.filter(t => t.status === 'done') : []
                return (
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
                        {active.length}
                      </span>
                      <div className="flex-1 h-[1px] bg-border/40 ml-2" />
                    </div>
                    <div className="space-y-1">
                      {active.map((t, i) => (
                        <TaskItem key={t.id} task={t} index={i} />
                      ))}
                    </div>
                    {done.length > 0 && (
                      <div className="mt-0.5">
                        <button
                          onClick={() => toggleGroupDone(group.dateKey)}
                          className="w-full flex items-center gap-2 px-1 py-1.5 group select-none cursor-pointer hover:bg-muted/30 rounded-xl transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-done)]/70 shrink-0" />
                          <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            Выполненные ({done.length})
                          </span>
                          {openDoneGroups[group.dateKey]
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          <div className="flex-1 h-[1px] bg-border/25" />
                        </button>
                        {openDoneGroups[group.dateKey] && (
                          <div className="space-y-1 opacity-75 pt-0.5">
                            {done.map((t, i) => (
                              <TaskItem key={t.id} task={t} index={i} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div key="flat-list" className="space-y-1">
              {(() => {
                const separateDone = filterStatus !== 'done'
                const activeFlat = separateDone ? filtered.filter(t => t.status !== 'done') : filtered
                const doneFlat = separateDone ? filtered.filter(t => t.status === 'done') : []
                return (
                  <>
                    {activeFlat.map((t, i) => (
                      <TaskItem key={t.id} task={t} index={i} />
                    ))}
                    {doneFlat.length > 0 && (
                      <div className="pt-2">
                        <button
                          onClick={() => setShowFlatDone(prev => !prev)}
                          className="w-full flex items-center gap-2 px-1 py-1.5 group select-none cursor-pointer hover:bg-muted/30 rounded-xl transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-done)]/70 shrink-0" />
                          <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            Выполненные ({doneFlat.length})
                          </span>
                          {showFlatDone
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          <div className="flex-1 h-[1px] bg-border/25" />
                        </button>
                        {showFlatDone && (
                          <div className="space-y-1 opacity-75 pt-1">
                            {doneFlat.map((t, i) => (
                              <TaskItem key={t.id} task={t} index={i} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
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
