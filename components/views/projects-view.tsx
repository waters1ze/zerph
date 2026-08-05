'use client'

import { motion } from 'framer-motion'
import { useApp } from '@/lib/store'
import { TaskItem } from '@/components/task-item'
import { cn } from '@/lib/utils'
import { FolderKanban, Target, CheckSquare, FileText } from 'lucide-react'

export function ProjectsView() {
  const { state } = useApp()

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {state.projects.map((project, pi) => {
        const tasks = state.tasks.filter(t => t.projectId === project.id)
        const done = tasks.filter(t => t.status === 'done')
        const progress = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0
        const goal = project.goalId ? state.goals.find(g => g.id === project.goalId) : null

        return (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pi * 0.08, duration: 0.22 }}
            className="rounded-2xl bg-card border border-border overflow-hidden"
          >
            {/* Project header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: project.color + '25' }}>
                  <FolderKanban className="w-4 h-4" style={{ color: project.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground">{project.title}</h3>
                    <span className="text-[12px] font-semibold text-muted-foreground">{progress}%</span>
                  </div>
                  {project.description && (
                    <p className="text-[13px] text-muted-foreground mt-0.5">{project.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: project.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.7, delay: pi * 0.1 + 0.2 }}
                      />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CheckSquare className="w-3 h-3" />{done.length}/{tasks.length}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <FileText className="w-3 h-3" />{project.noteIds.length}
                      </span>
                    </div>
                  </div>
                  {goal && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Target className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Goal: {goal.title}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="px-3 py-2">
                {tasks.slice(0, 4).map((task, ti) => (
                  <TaskItem key={task.id} task={task} index={ti} compact />
                ))}
                {tasks.length > 4 && (
                  <p className="text-[12px] text-muted-foreground px-3.5 py-1.5">+{tasks.length - 4} more tasks</p>
                )}
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
