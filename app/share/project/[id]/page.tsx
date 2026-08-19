'use client'

import React, { useState, useEffect, use } from 'react'
import { motion } from 'framer-motion'
import {
  FolderOpen, Circle, Clock, CheckCircle2,
  Network, LayoutGrid, List, Sparkles, ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  dueTime?: string
  parentTaskId?: string
}

interface Project {
  id: string
  title: string
  description?: string
  color: string
  status: string
  members: Array<{ chatId: string; name: string }>
  tasks: ProjectTask[]
}

const STATUS_COLUMNS = [
  { id: 'todo', label: 'Сделать', icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border/60' },
  { id: 'inprogress', label: 'В работе', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
  { id: 'done', label: 'Готово', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
]

export default function SharedProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const projectId = resolvedParams.id

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'tree' | 'kanban'>('tree')

  useEffect(() => {
    fetch(`/api/projects/share?id=${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.project) setProject(data.project)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d14] text-white flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Загрузка проекта Zerf AI...</span>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#090d14] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <FolderOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
        <h1 className="text-lg font-bold">Проект не найден</h1>
        <p className="text-xs text-muted-foreground mt-1">Возможно, ссылка устарела или проект был удален.</p>
        <a href="https://zerph.vercel.app" className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold">
          Перейти в Zerf AI
        </a>
      </div>
    )
  }

  const doneCount = project.tasks.filter(t => t.status === 'done').length
  const totalCount = project.tasks.length
  const rootTasks = project.tasks.filter(t => !t.parentTaskId)

  return (
    <div className="min-h-screen bg-[#090d14] text-white font-sans flex flex-col items-center p-4 sm:p-8">
      {/* Top Banner */}
      <div className="max-w-5xl w-full flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-card/80 border border-border/80 backdrop-blur-md mb-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md" style={{ background: project.color + '25', borderColor: project.color }}>
            <FolderOpen className="w-5 h-5" style={{ color: project.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary">
                Публичный просмотр
              </span>
              <h1 className="text-base font-bold truncate">{project.title}</h1>
            </div>
            {project.description && <p className="text-xs text-muted-foreground mt-0.5">{project.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View switcher */}
          <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border">
            <button
              onClick={() => setViewMode('tree')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                viewMode === 'tree' ? 'bg-card text-white shadow-xs' : 'text-muted-foreground'
              )}
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Дерево (Stitch)</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                viewMode === 'kanban' ? 'bg-card text-white shadow-xs' : 'text-muted-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Канбан</span>
            </button>
          </div>

          <a
            href="https://t.me/Zerph_bot"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
          >
            <span>Открыть в Zerf AI</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="max-w-5xl w-full">
        {viewMode === 'tree' ? (
          <div className="w-full rounded-2xl border border-border/80 bg-[#090d14] relative overflow-x-auto min-h-[500px] p-6 sm:p-10 shadow-inner">
            {/* Dot grid background */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />

            <div className="relative z-10 flex items-start gap-12 min-w-[700px]">
              {/* Root Project Node */}
              <div className="w-64 rounded-2xl bg-card/90 backdrop-blur-md border-2 p-4 shadow-xl flex flex-col gap-2 shrink-0" style={{ borderColor: project.color }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: project.color + '25' }}>
                    <FolderOpen className="w-4 h-4" style={{ color: project.color }} />
                  </div>
                  <h3 className="text-sm font-bold truncate">{project.title}</h3>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                  <span>{doneCount}/{totalCount} выполнено</span>
                  <span>{totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%</span>
                </div>
              </div>

              {/* Connected Tasks Tree */}
              <div className="flex-1 flex flex-col gap-6">
                {rootTasks.map(rootTask => {
                  const children = project.tasks.filter(t => t.parentTaskId === rootTask.id)
                  return (
                    <div key={rootTask.id} className="relative flex items-start gap-8">
                      <div className="absolute -left-8 top-8 w-8 h-[2px] bg-border/80" />
                      <div className="w-64 rounded-2xl bg-card/95 border border-border p-3.5 shadow-lg flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-[10px] font-bold uppercase px-2 py-0.5 rounded',
                            rootTask.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                            rootTask.status === 'inprogress' ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'
                          )}>
                            {rootTask.status === 'done' ? 'Готово' : rootTask.status === 'inprogress' ? 'В работе' : 'Сделать'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{rootTask.dueDate || ''}</span>
                        </div>
                        <h4 className={cn('text-xs font-semibold leading-snug', rootTask.status === 'done' && 'line-through text-muted-foreground')}>
                          {rootTask.title}
                        </h4>
                      </div>

                      {children.length > 0 && (
                        <div className="flex flex-col gap-3 pl-4 border-l-2 border-border/80">
                          {children.map(child => (
                            <div key={child.id} className="relative flex items-center gap-3">
                              <div className="absolute -left-4 top-1/2 w-4 h-[2px] bg-border/80" />
                              <div className="w-60 rounded-xl bg-card/95 border border-border p-3 shadow-md flex flex-col gap-1">
                                <span className={cn(
                                  'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded w-max',
                                  child.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'
                                )}>
                                  {child.status === 'done' ? 'Готово' : 'Сделать'}
                                </span>
                                <p className={cn('text-xs font-semibold', child.status === 'done' && 'line-through text-muted-foreground')}>
                                  {child.title}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Kanban View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUS_COLUMNS.map(col => {
              const colTasks = project.tasks.filter(t => t.status === col.id)
              return (
                <div key={col.id} className={cn('rounded-2xl border p-4 flex flex-col gap-3', col.bg, col.border)}>
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <col.icon className={cn('w-4 h-4', col.color)} />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">{col.label}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map(t => (
                      <div key={t.id} className="p-3 rounded-xl bg-card/80 border border-border/80 shadow-xs">
                        <p className={cn('text-xs font-semibold', t.status === 'done' && 'line-through text-muted-foreground')}>{t.title}</p>
                        {t.dueDate && <p className="text-[10px] text-muted-foreground mt-1">{t.dueDate}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
