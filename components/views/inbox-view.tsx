'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import {
  Inbox,
  Users,
  Briefcase,
  User,
  Zap,
  Lightbulb,
  GraduationCap,
  Activity,
  Calendar,
  UserCheck,
  Sparkles,
  Hash,
  Plus,
  X,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FolderPlus
} from 'lucide-react'
import { cn, isYearlyEventTask, groupTasksByDate } from '@/lib/utils'

// System sections for Inbox
const SYSTEM_TAGS = [
  { id: 'all', label: 'Все входящие', system: true },
  { id: 'общая', label: 'Общие', icon: Users, system: true },
  { id: 'поручение', label: 'Порученные мне', icon: UserCheck, system: true },
  { id: 'команда', label: 'Командные', icon: Sparkles, system: true },
]

const DEFAULT_TAGS = [
  { id: 'работа', label: 'Работа', icon: Briefcase },
  { id: 'срочно', label: 'Срочно', icon: Zap },
  { id: 'идеи', label: 'Идеи', icon: Lightbulb },
  { id: 'учеба', label: 'Учеба', icon: GraduationCap },
]

const LS_CUSTOM = 'zerf_inbox_custom_sections'
const LS_HIDDEN = 'zerf_inbox_hidden_sections'

function loadCustomSections(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM) || '[]') } catch { return [] }
}
function loadHiddenDefaults(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_HIDDEN) || '[]') } catch { return [] }
}

export function InboxView() {
  const { state, dispatch } = useApp()
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [customSections, setCustomSections] = useState<string[]>([])
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>([])
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')

  useEffect(() => {
    setCustomSections(loadCustomSections())
    setHiddenDefaults(loadHiddenDefaults())
  }, [])

  const addSection = () => {
    const name = newSectionName.trim().toLowerCase()
    if (!name) return
    const all = [...SYSTEM_TAGS.map(t => t.id), ...DEFAULT_TAGS.map(t => t.id), ...customSections]
    if (all.includes(name)) {
      if (hiddenDefaults.includes(name)) {
        const next = hiddenDefaults.filter(x => x !== name)
        setHiddenDefaults(next)
        localStorage.setItem(LS_HIDDEN, JSON.stringify(next))
      }
      setAddingSection(false)
      setNewSectionName('')
      return
    }
    const next = [...customSections, name]
    setCustomSections(next)
    localStorage.setItem(LS_CUSTOM, JSON.stringify(next))
    setAddingSection(false)
    setNewSectionName('')
    setSelectedTag(name)
  }

  const removeSection = (id: string) => {
    if (customSections.includes(id)) {
      const next = customSections.filter(x => x !== id)
      setCustomSections(next)
      localStorage.setItem(LS_CUSTOM, JSON.stringify(next))
    } else {
      const next = [...hiddenDefaults, id]
      setHiddenDefaults(next)
      localStorage.setItem(LS_HIDDEN, JSON.stringify(next))
    }
    if (selectedTag === id) setSelectedTag('all')
  }

  const sections = useMemo(() => [
    ...SYSTEM_TAGS,
    ...DEFAULT_TAGS.filter(t => !hiddenDefaults.includes(t.id)),
    ...customSections.map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1), icon: Hash })),
  ], [customSections, hiddenDefaults])

  const isCommonSharedTask = (t: any) => {
    const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
    const hasAssignees = Array.isArray(t.assignees) && t.assignees.length > 1
    return tags.includes('общая') || tags.includes('совместная') || tags.includes('совместно') || tags.includes('общие') || hasAssignees
  }

  const isDelegatedTask = (t: any) => {
    const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
    const hasDelegatedTag = tags.includes('поручение') || tags.includes('делегировано') || tags.includes('поручено')
    const isFromOtherAuthor = Boolean(t.authorChatId && t.ownerChatId && String(t.authorChatId) !== String(t.ownerChatId))
    return (t.isShared || hasDelegatedTag || isFromOtherAuthor) && !isCommonSharedTask(t)
  }

  const isIncomingTask = (t: any) => {
    if (t.status === 'done' || t.isDeleted || isYearlyEventTask(t)) return false
    const tags = (t.tags || []).map((x: string) => String(x).toLowerCase())
    const isSharedOrDelegated = t.isShared || tags.includes('общая') || tags.includes('общие') || tags.includes('совместная') || tags.includes('поручение') || tags.includes('делегировано') || tags.includes('поручено') || tags.includes('входящие') || tags.includes('inbox') || tags.includes('команда')
    const hasMultipleAssignees = Array.isArray(t.assignees) && t.assignees.length > 1
    const isFromOtherAuthor = Boolean(t.authorChatId && t.ownerChatId && String(t.authorChatId) !== String(t.ownerChatId))
    return isSharedOrDelegated || hasMultipleAssignees || isFromOtherAuthor
  }

  const matchesTag = (t: { tags?: string[]; priority?: string; isShared?: boolean }) => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'срочно') {
      return t.priority === 'urgent' || t.tags?.some(tag => tag.toLowerCase().includes('срочн'))
    }
    if (selectedTag === 'общая') {
      return isCommonSharedTask(t)
    }
    if (selectedTag === 'поручение') {
      return isDelegatedTask(t)
    }
    if (selectedTag === 'команда') {
      return t.tags?.some(tag => ['команда', 'командная', 'team'].includes(tag.toLowerCase()))
    }
    return t.tags?.some(tag => tag.toLowerCase().includes(selectedTag))
  }

  // Filter ONLY inbound/incoming tasks (no personal self-created tasks)
  const allInboundTasks = useMemo(() => {
    return state.tasks.filter(isIncomingTask)
  }, [state.tasks])

  const rawCommonShared = useMemo(() => allInboundTasks.filter(isCommonSharedTask), [allInboundTasks])
  const rawDelegated = useMemo(() => allInboundTasks.filter(isDelegatedTask), [allInboundTasks])
  const rawOtherInbound = useMemo(() => allInboundTasks.filter(t => !isCommonSharedTask(t) && !isDelegatedTask(t)), [allInboundTasks])

  const commonSharedTasks = useMemo(() => rawCommonShared.filter(matchesTag), [rawCommonShared, selectedTag])
  const delegatedTasks = useMemo(() => rawDelegated.filter(matchesTag), [rawDelegated, selectedTag])
  const otherInboundTasks = useMemo(() => rawOtherInbound.filter(matchesTag), [rawOtherInbound, selectedTag])

  const commonDateGroups = useMemo(() => groupTasksByDate(commonSharedTasks), [commonSharedTasks])
  const delegatedDateGroups = useMemo(() => groupTasksByDate(delegatedTasks), [delegatedTasks])
  const otherDateGroups = useMemo(() => groupTasksByDate(otherInboundTasks), [otherInboundTasks])

  const totalInboxCount = commonSharedTasks.length + delegatedTasks.length + otherInboundTasks.length

  return (
    <div className="w-full max-w-none grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Main Left/Center Column ── */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
        
        {/* Header Title & Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" />
              <span>Входящие поручения & совместные дела</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Сюда поступают задачи от друзей, совместные поручения и командные запросы. Личные дела находятся в разделе «Задачи».
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'tasks' })}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-semibold text-foreground border border-border/70 transition-all cursor-pointer"
          >
            <span>Все задачи ({state.tasks.filter(t => t.status !== 'done' && !(t as any).isDeleted).length})</span>
            <ArrowRight className="w-3.5 h-3.5 text-primary" />
          </button>
        </div>

        {/* Tag Filters Bar (Responsive flex-wrap, no scrollbars) */}
        <div className="flex flex-wrap items-center gap-1.5 no-scrollbar select-none">
          {sections.map(tag => {
            const isActive = selectedTag === tag.id
            const Icon = (tag as any).icon
            const isSystem = (tag as any).system
            return (
              <div key={tag.id} className="relative group/chip shrink-0">
                <button
                  onClick={() => setSelectedTag(tag.id)}
                  className={cn(
                    'flex items-center gap-1.5 pl-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border',
                    isSystem ? 'pr-3' : 'pr-7',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                      : 'bg-card/70 border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {Icon && <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />}
                  <span>{tag.label}</span>
                </button>
                {!isSystem && (
                  <button
                    onClick={e => { e.stopPropagation(); removeSection(tag.id) }}
                    title="Удалить раздел"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}

          {addingSection ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                autoFocus
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addSection()
                  if (e.key === 'Escape') { setAddingSection(false); setNewSectionName('') }
                }}
                placeholder="Название раздела"
                className="px-2.5 py-1.5 rounded-xl text-xs bg-card border border-primary/50 text-foreground focus:outline-none focus:border-primary w-36"
              />
              <button
                onClick={addSection}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground border border-primary"
              >
                ОК
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAddingSection(true); setNewSectionName('') }}
              title="Добавить свой раздел"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/60 hover:bg-primary/5 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Раздел</span>
            </button>
          )}
        </div>

        {/* 1. Общие совместные задачи */}
        {commonSharedTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                  Общие задачи
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                  {commonSharedTasks.length}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
                Синхронные напоминания обоим участникам
              </span>
            </div>

            <div className="space-y-4">
              {commonDateGroups.map(group => (
                <div key={group.dateKey} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 px-1 py-1 select-none">
                    <div className={cn(
                      'flex items-center gap-1.5 text-[12px] font-bold tracking-tight uppercase',
                      group.isToday ? 'text-foreground' : group.isOverdue ? 'text-[var(--status-overdue)]' : 'text-muted-foreground'
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

        {/* 2. Порученные задачи (делегировано вам) */}
        {delegatedTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                  Порученные задачи
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                  {delegatedTasks.length}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
                Поручено лично вам от других пользователей
              </span>
            </div>

            <div className="space-y-4">
              {delegatedDateGroups.map(group => (
                <div key={group.dateKey} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 px-1 py-1 select-none">
                    <div className={cn(
                      'flex items-center gap-1.5 text-[12px] font-bold tracking-tight uppercase',
                      group.isToday ? 'text-foreground' : group.isOverdue ? 'text-[var(--status-overdue)]' : 'text-muted-foreground'
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

        {/* 3. Другие входящие / командные запросы */}
        {otherInboundTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                Входящие командные задачи
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                {otherInboundTasks.length}
              </span>
            </div>

            <div className="space-y-4">
              {otherDateGroups.map(group => (
                <div key={group.dateKey} className="flex flex-col gap-1.5">
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

        {/* ZERO INBOX EMPTY STATE (When no incoming tasks) */}
        {totalInboxCount === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-16 px-6 text-center bg-card/60 rounded-3xl border border-dashed border-border/80 shadow-xs"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base font-bold text-foreground">
                Входящие пусты (Zero Inbox)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                В этот раздел попадают только поручения от других людей, совместные задачи и командные дела. Все ваши личные задачи находятся в основном разделе «Задачи».
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'tasks' })}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Перейти ко всем задачам</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'friends' })}
                className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Друзья и контакты</span>
              </button>
            </div>
          </motion.div>
        )}
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
                <p className="text-[13px] font-bold text-foreground leading-tight">Центр Входящих</p>
                <p className="text-[11px] text-muted-foreground">Inbound Inbox Workflow</p>
              </div>
            </div>
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              totalInboxCount === 0 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                : 'bg-primary/15 text-primary border-primary/25'
            )}>
              {totalInboxCount === 0 ? 'Zero Inbox' : `${totalInboxCount} на разбор`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            {totalInboxCount === 0 ? (
              <p className="text-emerald-400 font-medium">
                <span className="mono-emoji mr-1">✨</span> Все входящие разобраны! Новые поручения и совместные дела от друзей появятся здесь автоматически.
              </p>
            ) : (
              <p>
                Во входящих находятся только совместные дела и поручения, назначенные вам. Примите их, назначьте срок или перенесите в проект.
              </p>
            )}
          </div>
        </div>

        {/* 1. ОБЩИЕ ЗАДАЧИ Snapshot */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">Общие задачи</h2>
                <p className="text-[11px] text-muted-foreground">Совместные дела с друзьями</p>
              </div>
            </div>
            <span className={cn(
              'text-[11px] font-bold px-2 py-0.5 rounded-full border',
              commonSharedTasks.length > 0
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted text-muted-foreground border-border'
            )}>
              {commonSharedTasks.length} {commonSharedTasks.length === 1 ? 'задача' : 'задач'}
            </span>
          </div>

          {commonSharedTasks.length > 0 ? (
            <div className="space-y-2">
              {commonSharedTasks.slice(0, 4).map((t) => (
                <div key={t.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground truncate font-medium">{t.title}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-primary shrink-0">
                    {t.dueTime || 'Сегодня'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-center">
              <p className="text-[11px] text-muted-foreground">
                Нет общих дел. Назначьте тег <span className="font-mono text-primary font-bold">#общая</span> при создании задачи для двоих.
              </p>
            </div>
          )}
        </div>

        {/* 2. ПОРУЧЕННЫЕ ЗАДАЧИ Snapshot */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide">Порученные задачи</h2>
                <p className="text-[11px] text-muted-foreground">Делегировано вам</p>
              </div>
            </div>
            <span className={cn(
              'text-[11px] font-bold px-2 py-0.5 rounded-full border',
              delegatedTasks.length > 0
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted text-muted-foreground border-border'
            )}>
              {delegatedTasks.length} {delegatedTasks.length === 1 ? 'задача' : 'задач'}
            </span>
          </div>

          {delegatedTasks.length > 0 ? (
            <div className="space-y-2">
              {delegatedTasks.slice(0, 4).map((t) => (
                <div key={t.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground truncate font-medium">{t.title}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-primary shrink-0">
                    {t.dueTime || 'Сегодня'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-center">
              <p className="text-[11px] text-muted-foreground">
                Нет поручений. Назначьте тег <span className="font-mono text-primary font-bold">#поручение</span> или поручите задачу другу через бота.
              </p>
            </div>
          )}
        </div>

        {/* GTD 2-Minute Rule Card */}
        <div className="p-4 rounded-2xl bg-card border border-border flex items-start gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0 mt-0.5">
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
