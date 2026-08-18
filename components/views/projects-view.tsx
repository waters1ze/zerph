'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Plus, ChevronLeft, Users, CheckCircle2,
  Circle, Clock, X, Edit3, Trash2, ArrowRight, GitBranch,
  Loader2, AlertCircle, Check, Mic, LayoutGrid,
  List, Network, ArrowDownRight, Sparkles, UserPlus, Link2,
  ZoomIn, ZoomOut, Maximize2, Move, HelpCircle, Calendar,
  ChevronDown, Layers, Zap, CheckSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, getAuthHeaders } from '@/lib/store'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { PLANS, normalizePlan } from '@/lib/plans'

interface ProjectMember { chatId: string; name: string }
interface ProjectTask {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  dueTime?: string
  authorChatId?: string
  parentTaskId?: string | null
  assignees?: string[]
  tags?: string[]
  subtasks?: Array<{ id: string; title: string; done: boolean }>
}

interface Project {
  id: string
  title: string
  description?: string
  color: string
  status: string
  ownerChatId: string
  memberIds: string[]
  members: ProjectMember[]
  tasks: ProjectTask[]
  createdAt: string
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']

const STATUS_COLUMNS = [
  { id: 'todo', label: 'Сделать', icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border/60' },
  { id: 'inprogress', label: 'В работе', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
  { id: 'done', label: 'Готово', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
]

function MemberAvatar({ member, size = 7 }: { member: ProjectMember; size?: number }) {
  return (
    <div
      title={member.name}
      className={cn(
        'rounded-full bg-muted border-2 border-background flex items-center justify-center shrink-0 text-[10px] font-bold text-foreground/70 shadow-xs',
        `w-${size} h-${size}`
      )}
    >
      {member.name[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ── Interactive Tree Canvas Component (Google Stitch Style with Pan & Zoom) ────

interface TreeCanvasProps {
  project: Project
  tasks: ProjectTask[]
  onOpenCreateTask: (parentTaskId?: string, defaultStatus?: string) => void
  onUpdateTaskStatus: (taskId: string, newStatus: string) => void
  onDeleteTask: (taskId: string) => void
  onLinkTasks: (childId: string, parentId: string | null) => void
  onOpenAiPlanner: () => void
}

function ProjectTreeCanvas({
  project,
  tasks,
  onOpenCreateTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onLinkTasks,
  onOpenAiPlanner,
}: TreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Node positions in canvas coordinate space
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  const [nodeStartPos, setNodeStartPos] = useState({ x: 0, y: 0 })

  // Connection wire dragging
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [connectingMousePos, setConnectingMousePos] = useState<{ x: number; y: number } | null>(null)
  const [hoveredLineChildId, setHoveredLineChildId] = useState<string | null>(null)

  // Load / Compute initial positions
  useEffect(() => {
    const storageKey = `zerf_canvas_pos_${project.id}`
    let saved: Record<string, { x: number; y: number }> = {}
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) saved = JSON.parse(raw)
    } catch {}

    const newPos: Record<string, { x: number; y: number }> = { ...saved }
    const rootTasks = tasks.filter(t => !t.parentTaskId)
    const cardWidth = 270
    const cardHeight = 150
    const colSpacing = 320
    const rowSpacing = 200

    rootTasks.forEach((rt, rIdx) => {
      if (!newPos[rt.id]) {
        newPos[rt.id] = {
          x: 200 + rIdx * colSpacing,
          y: 180,
        }
      }
      const children = tasks.filter(t => t.parentTaskId === rt.id)
      children.forEach((ct, cIdx) => {
        if (!newPos[ct.id]) {
          newPos[ct.id] = {
            x: newPos[rt.id].x + (cIdx - (children.length - 1) / 2) * (cardWidth + 30),
            y: newPos[rt.id].y + rowSpacing,
          }
        }
        // Sub-children
        const subChildren = tasks.filter(t => t.parentTaskId === ct.id)
        subChildren.forEach((sct, scIdx) => {
          if (!newPos[sct.id]) {
            newPos[sct.id] = {
              x: newPos[ct.id].x + (scIdx - (subChildren.length - 1) / 2) * (cardWidth + 20),
              y: newPos[ct.id].y + rowSpacing,
            }
          }
        })
      })
    })

    setPositions(newPos)
  }, [project.id, tasks])

  // Save positions
  const savePositions = (updated: Record<string, { x: number; y: number }>) => {
    setPositions(updated)
    try {
      localStorage.setItem(`zerf_canvas_pos_${project.id}`, JSON.stringify(updated))
    } catch {}
  }

  // Mouse wheel pan & zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(prev => Math.min(Math.max(prev + delta, 0.4), 2.0))
    } else {
      // Pan
      setPan(prev => ({
        x: prev.x - e.deltaX * 0.9,
        y: prev.y - e.deltaY * 0.9,
      }))
    }
  }

  // Mouse Down on Canvas Background (Middle click or LMB drag)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      // If clicking directly on the canvas container or grid
      const target = e.target as HTMLElement
      if (target.classList.contains('canvas-surface') || target.tagName === 'svg' || target.classList.contains('canvas-grid')) {
        setIsPanning(true)
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    }
  }

  // Mouse Move on Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    } else if (draggingNodeId) {
      const dx = (e.clientX - dragStartPos.x) / zoom
      const dy = (e.clientY - dragStartPos.y) / zoom
      const updated = {
        ...positions,
        [draggingNodeId]: {
          x: Math.round(nodeStartPos.x + dx),
          y: Math.round(nodeStartPos.y + dy),
        },
      }
      setPositions(updated)
    } else if (connectingFrom && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setConnectingMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      })
    }
  }

  // Mouse Up
  const handleCanvasMouseUp = () => {
    if (isPanning) setIsPanning(false)
    if (draggingNodeId) {
      savePositions(positions)
      setDraggingNodeId(null)
    }
    if (connectingFrom) {
      setConnectingFrom(null)
      setConnectingMousePos(null)
    }
  }

  // Start Node Drag
  const handleNodeMouseDown = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Don't drag if clicking buttons, ports, or interactive items
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('.connector-port')) return

    setDraggingNodeId(taskId)
    setDragStartPos({ x: e.clientX, y: e.clientY })
    setNodeStartPos(positions[taskId] || { x: 200, y: 180 })
  }

  // Start Connection Wire Drag from an anchor port
  const handleStartConnect = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConnectingFrom(taskId)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setConnectingMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      })
    }
  }

  // Drop Connection on another node or port
  const handleDropConnect = (targetTaskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (connectingFrom && connectingFrom !== targetTaskId) {
      // Connect connectingFrom (parent) -> targetTaskId (child)
      onLinkTasks(targetTaskId, connectingFrom)
    }
    setConnectingFrom(null)
    setConnectingMousePos(null)
  }

  // Reset Center
  const handleCenter = () => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  const doneCount = tasks.filter(t => t.status === 'done').length
  const totalCount = tasks.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      className={cn(
        'w-full h-[620px] sm:h-[720px] rounded-3xl bg-[#080c14] border border-border/80 relative overflow-hidden select-none shadow-2xl canvas-surface cursor-grab',
        isPanning && 'cursor-grabbing',
        draggingNodeId && 'cursor-move'
      )}
    >
      {/* Background Blueprint Grid */}
      <div
        className="absolute inset-0 pointer-events-none canvas-grid opacity-35"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.22) 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Floating Canvas HUD (Top-Left / Top-Right Controls) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-card/85 backdrop-blur-md border border-border/80 shadow-xl">
        <button
          onClick={() => setZoom(prev => Math.min(prev + 0.15, 2.0))}
          className="w-8 h-8 rounded-xl hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Приблизить"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.4))}
          className="w-8 h-8 rounded-xl hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer"
          title="Отдалить"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleCenter}
          className="px-2.5 h-8 rounded-xl hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1 transition-colors cursor-pointer"
          title="Сбросить масштаб и вернуть в центр"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>{Math.round(zoom * 100)}%</span>
        </button>
      </div>

      {/* Floating Quick Action HUD */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button
          onClick={() => onOpenCreateTask()}
          className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Задача в проект</span>
        </button>
        <button
          onClick={onOpenAiPlanner}
          className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>✨ ИИ-Декомпозиция</span>
        </button>
      </div>

      {/* Bottom Information Hint */}
      <div className="absolute bottom-4 left-4 z-30 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-muted-foreground/80">
        <Move className="w-3.5 h-3.5 text-primary" />
        <span>Колесико мыши: перемещение & масштаб • ЛКМ: перетаскивание задач • Кружочки: создание связей</span>
      </div>

      {/* Canvas Viewport Transform Container */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: '4000px',
          height: '3000px',
        }}
      >
        {/* Compact Root Project Pill Banner at Top Center */}
        <div
          className="absolute left-[360px] top-[40px] pointer-events-auto flex flex-col items-center z-20"
        >
          <div
            className="px-5 py-3 rounded-2xl bg-card/95 backdrop-blur-md border-2 shadow-2xl flex items-center gap-3.5 transition-all hover:scale-105"
            style={{ borderColor: project.color }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
              style={{ background: project.color + '25', color: project.color }}
            >
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Проект</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded" style={{ background: project.color + '18', color: project.color }}>
                  {doneCount}/{totalCount} ({pct}%)
                </span>
              </div>
              <h3 className="text-xs font-bold text-foreground truncate max-w-[200px]">{project.title}</h3>
            </div>

            <button
              onClick={() => onOpenCreateTask()}
              className="ml-2 w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-all cursor-pointer"
              title="Добавить задачу"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Stem Connector line dropping down to task board */}
          <div className="w-0.5 h-12 bg-gradient-to-b from-primary/80 to-primary/20" />
        </div>

        {/* Dynamic SVG Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
          <defs>
            <marker
              id="arrow-stitch"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={project.color || '#6366f1'} />
            </marker>
          </defs>

          {/* Render Parent -> Child Dependency Lines */}
          {tasks.map(task => {
            if (!task.parentTaskId) return null
            const parentPos = positions[task.parentTaskId]
            const childPos = positions[task.id]
            if (!parentPos || !childPos) return null

            // Calculate anchor points (parent bottom/right -> child top/left)
            const fromX = parentPos.x + 135
            const fromY = parentPos.y + 130
            const toX = childPos.x + 135
            const toY = childPos.y

            // Smooth cubic bezier curve
            const midY = (fromY + toY) / 2
            const d = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`
            const isHovered = hoveredLineChildId === task.id

            return (
              <g key={`link_${task.parentTaskId}_${task.id}`} className="pointer-events-auto cursor-pointer">
                {/* Thick invisible hit-target for hover & deletion */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  onMouseEnter={() => setHoveredLineChildId(task.id)}
                  onMouseLeave={() => setHoveredLineChildId(null)}
                  onClick={() => onLinkTasks(task.id, null)}
                />
                {/* Visible Animated Bezier Curve */}
                <path
                  d={d}
                  fill="none"
                  stroke={isHovered ? '#ef4444' : project.color || '#6366f1'}
                  strokeWidth={isHovered ? 2.5 : 2}
                  strokeDasharray={isHovered ? '4,4' : undefined}
                  markerEnd="url(#arrow-stitch)"
                  className="transition-colors"
                />

                {/* Delete / Unlink Button badge on line hover */}
                {isHovered && (
                  <g
                    transform={`translate(${(fromX + toX) / 2 - 10}, ${midY - 10})`}
                    onClick={() => onLinkTasks(task.id, null)}
                    className="cursor-pointer"
                  >
                    <circle r="10" cx="10" cy="10" fill="#ef4444" />
                    <text x="10" y="14" fill="#fff" fontSize="11" textAnchor="middle" fontWeight="bold">✕</text>
                  </g>
                )}
              </g>
            )
          })}

          {/* Active Drawing Wire while connecting */}
          {connectingFrom && connectingMousePos && positions[connectingFrom] && (
            <path
              d={`M ${positions[connectingFrom].x + 135} ${positions[connectingFrom].y + 130} C ${positions[connectingFrom].x + 135} ${(positions[connectingFrom].y + 130 + connectingMousePos.y) / 2}, ${connectingMousePos.x} ${(positions[connectingFrom].y + 130 + connectingMousePos.y) / 2}, ${connectingMousePos.x} ${connectingMousePos.y}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2.5}
              strokeDasharray="6,4"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Task Nodes Layer */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {tasks.map(task => {
            const pos = positions[task.id] || { x: 200, y: 180 }
            const isDone = task.status === 'done'
            const isInProgress = task.status === 'inprogress'
            const statusObj = STATUS_COLUMNS.find(c => c.id === task.status) || STATUS_COLUMNS[0]
            const isDragged = draggingNodeId === task.id
            const isTargeted = connectingFrom && connectingFrom !== task.id

            return (
              <div
                key={task.id}
                onMouseDown={e => handleNodeMouseDown(task.id, e)}
                onMouseUp={e => isTargeted && handleDropConnect(task.id, e)}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: '270px',
                }}
                className={cn(
                  'absolute pointer-events-auto rounded-2xl bg-card/95 backdrop-blur-md border p-4 shadow-xl flex flex-col gap-2.5 transition-shadow select-none group',
                  isDone ? 'border-emerald-500/40 bg-emerald-950/20' : isInProgress ? 'border-amber-500/40 bg-amber-950/15' : 'border-border hover:border-primary/50',
                  isDragged && 'shadow-2xl ring-2 ring-primary scale-[1.02] z-40',
                  isTargeted && 'hover:ring-2 hover:ring-indigo-400 hover:scale-105'
                )}
              >
                {/* 4 Connection Ports (Anchor circles) */}
                {/* Top Port */}
                <button
                  onMouseDown={e => handleStartConnect(task.id, e)}
                  onMouseUp={e => isTargeted && handleDropConnect(task.id, e)}
                  className="connector-port absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-card border-2 border-primary hover:bg-primary hover:scale-125 transition-all flex items-center justify-center cursor-crosshair z-30 shadow-sm opacity-60 group-hover:opacity-100"
                  title="Связать (родитель / подзадача)"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </button>

                {/* Bottom Port */}
                <button
                  onMouseDown={e => handleStartConnect(task.id, e)}
                  onMouseUp={e => isTargeted && handleDropConnect(task.id, e)}
                  className="connector-port absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-card border-2 border-primary hover:bg-primary hover:scale-125 transition-all flex items-center justify-center cursor-crosshair z-30 shadow-sm opacity-60 group-hover:opacity-100"
                  title="Связать (родитель / подзадача)"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </button>

                {/* Header row: Status + Priority */}
                <div className="flex items-center justify-between gap-2">
                  {/* Status Toggle Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextStatus = task.status === 'todo' ? 'inprogress' : task.status === 'inprogress' ? 'done' : 'todo'
                      onUpdateTaskStatus(task.id, nextStatus)
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer',
                      task.status === 'done' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                      task.status === 'inprogress' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                      'bg-muted/70 border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <statusObj.icon className="w-3 h-3" />
                    <span>{statusObj.label}</span>
                  </button>

                  <span className={cn(
                    'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                    task.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' :
                    task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-muted/40 text-muted-foreground'
                  )}>
                    {task.priority === 'urgent' ? 'Срочно' : task.priority === 'high' ? 'Высокий' : 'Средний'}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className={cn('text-xs font-bold text-foreground leading-snug', isDone && 'line-through text-muted-foreground')}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                  )}
                </div>

                {/* Subtasks Progress if any */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg border border-border/50">
                    <CheckSquare className="w-3 h-3 text-primary" />
                    <span>{task.subtasks.filter(s => s.done).length}/{task.subtasks.length} подзадач</span>
                  </div>
                )}

                {/* Footer details: Due date + Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1 truncate max-w-[140px]">
                    <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{task.dueDate || 'Без срока'} {task.dueTime ? `(${task.dueTime})` : ''}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onOpenCreateTask(task.id)}
                      title="Привязать подзадачу"
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      title="Удалить задачу"
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── AI Project Decomposition Modal ─────────────────────────────────────────────

function AiProjectDecomposeModal({
  project,
  onClose,
  onGenerated,
}: {
  project: Project
  onClose: () => void
  onGenerated: () => void
}) {
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const PRESETS = [
    '🚀 MVP запуск и ключевой функционал',
    '📱 Разработка Telegram-бота и админки',
    '🎨 UI/UX дизайн, вайрфреймы и прототипирование',
    '📢 Маркетинг, контент-план и привлечение клиентов',
  ]

  const handleGenerate = async (promptToUse?: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects/ai-decompose', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          customPrompt: promptToUse || customPrompt.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        onGenerated()
        onClose()
      } else {
        setError(data.error || 'Не удалось сгенерировать план')
      }
    } catch {
      setError('Ошибка соединения при обращении к ИИ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 font-sans"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">ИИ-Декомпозиция проекта</h3>
              <p className="text-[11px] text-muted-foreground">Генерация древовидного плана задач с дедлайнами</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Проект</span>
          <p className="text-xs font-bold text-foreground">{project.title}</p>
          {project.description && <p className="text-[11px] text-muted-foreground">{project.description}</p>}
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Быстрые шаблоны планирования:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setCustomPrompt(p); handleGenerate(p) }}
                disabled={loading}
                className="p-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:border-primary/40 border border-border text-left text-xs font-medium text-foreground transition-all cursor-pointer disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Дополнительные пожелания к задачам (опционально):
          </label>
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Например: сосредоточиться на интеграции Telegram WebApp и платежах..."
            rows={2}
            className="w-full px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border/60">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{loading ? 'Генерация плана...' : 'Сгенерировать дерево'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Modal: Create Task in Project (with Voice Support) ──────────────────────────

interface CreateProjectTaskModalProps {
  projectId: string
  projectTitle: string
  tasks: ProjectTask[]
  defaultParentId?: string
  defaultStatus?: string
  members: ProjectMember[]
  onClose: () => void
  onCreated: () => void
}

function CreateProjectTaskModal({
  projectId,
  projectTitle,
  tasks,
  defaultParentId = '',
  defaultStatus = 'todo',
  members,
  onClose,
  onCreated
}: CreateProjectTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueTime, setDueTime] = useState('')
  const [parentTaskId, setParentTaskId] = useState(defaultParentId)
  const [assignee, setAssignee] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState('')

  const recognitionRef = useRef<any>(null)

  const toggleVoice = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop()
      setIsRecording(false)
      return
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      alert('Голосовой ввод не поддерживается данным браузером')
      return
    }

    const rec = new SpeechRec()
    rec.lang = 'ru-RU'
    rec.continuous = false
    rec.interimResults = false

    rec.onstart = () => {
      setIsRecording(true)
      setVoiceNotice('🎙️ Слушаю... Назовите задачу')
    }

    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setTitle(transcript)
      setVoiceNotice(`Распознано: «${transcript}»`)
      const lower = transcript.toLowerCase()
      if (lower.includes('в работе') || lower.includes('делаю')) setStatus('inprogress')
      if (lower.includes('готово') || lower.includes('сделано')) setStatus('done')
      if (lower.includes('срочно')) setPriority('urgent')
    }

    rec.onerror = () => {
      setIsRecording(false)
      setVoiceNotice('Ошибка микрофона')
    }

    rec.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = rec
    rec.start()
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''

      await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          ...headers,
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
          projectId,
          parentTaskId: parentTaskId || null,
          assignees: assignee ? [assignee] : [],
        })
      })

      onCreated()
    } catch {
      alert('Ошибка при создании задачи')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl flex flex-col gap-4 font-sans max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Новая задача в проекте</h3>
              <p className="text-[11px] text-muted-foreground truncate">{projectTitle}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Voice Input Action Button */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/60">
          <div className="text-xs text-muted-foreground">
            {voiceNotice || 'Надиктуйте задачу голосом с микрофона:'}
          </div>
          <button
            type="button"
            onClick={toggleVoice}
            className={cn(
              'h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
              isRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
            )}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isRecording ? 'Слушаю...' : 'Голос'}</span>
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Название задачи *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Что необходимо сделать..."
              className="w-full h-10 px-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Описание / Критерии готовности
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Детали выполнения задачи..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground resize-none"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Статус
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              >
                <option value="todo">Сделать</option>
                <option value="inprogress">В работе</option>
                <option value="done">Готово</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Приоритет
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              >
                <option value="urgent">🔥 Срочный</option>
                <option value="high">⚡ Высокий</option>
                <option value="medium">🔷 Средний</option>
                <option value="low">☕ Низкий</option>
              </select>
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Дедлайн (дата)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Время дедлайна
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              />
            </div>
          </div>

          {/* Parent Task Binding */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Родительская задача в дереве
            </label>
            <select
              value={parentTaskId}
              onChange={e => setParentTaskId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
            >
              <option value="">(Корневой узел дерева)</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  ↳ {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Selection */}
          {members.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Исполнитель
              </label>
              <select
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              >
                <option value="">(Не назначен / Любой)</option>
                {members.map(m => (
                  <option key={m.chatId} value={m.chatId}>
                    👤 {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border/50">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors cursor-pointer">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || loading}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/20 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Создать задачу</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Modal: Project Settings / Create Project ───────────────────────────────────

function ProjectModal({
  project, onClose, onSave
}: {
  project?: Project | null
  onClose: () => void
  onSave: (savedProject?: Project) => void
}) {
  const { state } = useApp()
  const [title, setTitle] = useState(project?.title || '')
  const [description, setDescription] = useState(project?.description || '')
  const [color, setColor] = useState(project?.color || COLORS[0])
  const [memberInput, setMemberInput] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Candidates from teams & friends
  const [candidates, setCandidates] = useState<Array<{
    id: string
    name: string
    username: string | null
    tag: string
    teamName?: string
  }>>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadCandidates = async () => {
      setLoadingCandidates(true)
      const list: Array<{ id: string; name: string; username: string | null; tag: string; teamName?: string }> = []
      const seen = new Set<string>()

      // 1. Friends
      if (state.friends && Array.isArray(state.friends)) {
        for (const f of state.friends) {
          const cleanU = (f.username || '').replace(/^@/, '').trim()
          const key = cleanU ? cleanU.toLowerCase() : f.id
          if (!seen.has(key)) {
            seen.add(key)
            list.push({
              id: f.id,
              name: f.name || cleanU || 'Друг',
              username: cleanU || null,
              tag: '👤 Друг',
            })
          }
        }
      }

      // 2. Teams
      try {
        const teamsRes = await fetch('/api/teams', { headers: getAuthHeaders() })
        const teamsData = await teamsRes.json()
        if (teamsData.success && Array.isArray(teamsData.teams)) {
          const teamDetails = await Promise.all(
            teamsData.teams.slice(0, 8).map(async (t: any) => {
              try {
                const res = await fetch(`/api/teams/${t.id}`, { headers: getAuthHeaders() })
                const data = await res.json()
                return { teamName: t.name, members: data.team?.members || [] }
              } catch {
                return { teamName: t.name, members: [] }
              }
            })
          )

          for (const td of teamDetails) {
            for (const m of td.members) {
              if (m.isMe) continue
              const cleanU = (m.username || '').replace(/^@/, '').trim()
              const fullName = [m.firstName, m.lastName].filter(Boolean).join(' ') || cleanU || `ID ${m.chatId}`
              const key = cleanU ? cleanU.toLowerCase() : m.chatId
              if (!seen.has(key)) {
                seen.add(key)
                list.push({
                  id: m.chatId,
                  name: fullName,
                  username: cleanU || null,
                  tag: `🏢 ${td.teamName}`,
                  teamName: td.teamName,
                })
              }
            }
          }
        }
      } catch {}

      if (isMounted) {
        setCandidates(list)
        setLoadingCandidates(false)
      }
    }

    loadCandidates()
    return () => { isMounted = false }
  }, [state.friends])

  const handleAddMember = () => {
    const clean = memberInput.trim().replace(/^@/, '')
    if (clean && !members.includes(clean)) {
      setMembers([...members, clean])
      setMemberInput('')
    }
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }
    try {
      const res = project
        ? await fetch('/api/projects', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ id: project.id, title, description, color, memberUsernames: members }),
          })
        : await fetch('/api/projects', {
            method: 'POST',
            headers,
            body: JSON.stringify({ title, description, color, memberUsernames: members }),
          })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          alert('Требуется авторизация. Войдите через бота (/login) или Email.')
        } else {
          alert(data.error || 'Не удалось сохранить проект.')
        }
        return
      }

      onSave(data.project)
    } catch {
      alert('Ошибка сети при сохранении проекта')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h2 className="text-sm font-bold text-foreground">{project ? 'Редактировать проект' : 'Новый проект'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Название проекта *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Запуск нового стартапа..."
              className="w-full h-10 px-3.5 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Описание целей
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Цели, этапы и результаты..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Цветовая метка
            </label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform cursor-pointer',
                    color === c && 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card'
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Add Members */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Участники (Telegram username)
            </label>
            <div className="flex gap-2">
              <input
                value={memberInput}
                onChange={e => setMemberInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddMember())}
                placeholder="@username..."
                className="flex-1 h-9 px-3 rounded-xl bg-muted/60 border border-border text-xs focus:outline-none focus:border-primary transition-colors text-foreground"
              />
              <button
                type="button"
                onClick={handleAddMember}
                className="px-3 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold border border-border text-foreground transition-colors cursor-pointer"
              >
                Добавить
              </button>
            </div>

            {/* Quick Candidate Selector */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span>Выбрать из команды и друзей:</span>
                </p>
                {loadingCandidates && (
                  <span className="text-[10px] text-muted-foreground animate-pulse">Загрузка...</span>
                )}
              </div>

              {candidates.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 py-1">
                  {candidates.map(c => {
                    const valueToStore = c.username || c.name
                    const cleanValue = valueToStore.replace(/^@/, '').trim()
                    const isSelected = members.includes(cleanValue) || (c.username && members.includes(c.username))

                    return (
                      <button
                        key={c.id + (c.username || '')}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setMembers(members.filter(m => m !== cleanValue && m !== c.username))
                          } else {
                            setMembers([...members, cleanValue])
                          }
                        }}
                        className={cn(
                          'px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all cursor-pointer text-left',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold ring-1 ring-primary/40'
                            : 'bg-muted/40 border-border text-foreground hover:bg-muted hover:border-border/80'
                        )}
                      >
                        <span className={cn(
                          'w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0',
                          isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
                        )}>
                          {c.name[0]?.toUpperCase() || 'U'}
                        </span>
                        <div className="min-w-0 pr-1 leading-tight">
                          <p className="text-[11px] font-bold truncate max-w-[120px]">{c.name}</p>
                          <p className="text-[9px] opacity-75">{c.tag}</p>
                        </div>
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 shrink-0 ml-0.5 text-primary-foreground" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 shrink-0 ml-0.5 opacity-50" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : !loadingCandidates ? (
                <p className="text-[10px] text-muted-foreground/80 py-1">
                  💡 Участники ваших команд и друзья появятся здесь для выбора в 1 клик.
                </p>
              ) : null}
            </div>

            {members.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-border/50">
                {members.map(u => (
                  <span key={u} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-semibold text-primary flex items-center gap-1.5">
                    @{u.replace(/^@/, '')}
                    <button onClick={() => setMembers(members.filter(m => m !== u))} className="hover:text-destructive cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-border/50">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors cursor-pointer">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{project ? 'Сохранить' : 'Создать проект'}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Project Detail View ────────────────────────────────────────────────────────

function ProjectDetail({
  project, onBack, onEdit, onRefresh, onDelete
}: {
  project: Project
  onBack: () => void
  onEdit: () => void
  onRefresh: () => void
  onDelete: () => void
}) {
  const confirm = useConfirmDialog()
  const [viewMode, setViewMode] = useState<'tree' | 'kanban' | 'list'>('tree')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [modalParentId, setModalParentId] = useState<string | undefined>(undefined)
  const [modalStatus, setModalStatus] = useState<string>('todo')
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all')
  const [copiedLink, setCopiedLink] = useState(false)

  const myChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''

  const filteredTasks = useMemo(() => {
    if (selectedMemberFilter === 'all') return project.tasks
    if (selectedMemberFilter === 'mine') {
      return project.tasks.filter(t => (t.assignees && t.assignees.includes(myChatId)) || t.authorChatId === myChatId)
    }
    return project.tasks.filter(t => t.assignees && t.assignees.includes(selectedMemberFilter))
  }, [project.tasks, selectedMemberFilter, myChatId])

  const done = filteredTasks.filter(t => t.status === 'done').length
  const total = filteredTasks.length

  const handleOpenCreate = (parentId?: string, status = 'todo') => {
    setModalParentId(parentId)
    setModalStatus(status)
    setShowCreateModal(true)
  }

  const handleShareProject = () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/project/${project.id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ id: taskId, status: newStatus })
      })
      onRefresh()
    } catch {}
  }

  const handleLinkTasks = async (childId: string, parentId: string | null) => {
    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        },
        body: JSON.stringify({ id: childId, parentTaskId: parentId })
      })
      onRefresh()
    } catch {}
  }

  const handleDeleteTask = async (taskId: string) => {
    const ok = await confirm({
      title: 'Удалить эту задачу?',
      description: 'Задача будет удалена из дерева проекта.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const qChatId = typeof window !== 'undefined' ? localStorage.getItem('zerf_chat_id') || '' : ''
      await fetch(`/api/tasks?id=${taskId}&type=task`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          ...(qChatId ? { 'x-chat-id': qChatId } : {})
        }
      })
      onRefresh()
    } catch {}
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5 w-full font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-3.5">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: project.color + '25', borderColor: project.color }}>
            <FolderOpen className="w-6 h-6" style={{ color: project.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">{project.title}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-bold" style={{ background: project.color + '18', color: project.color }}>
                {total ? `${Math.round((done / total) * 100)}%` : '0%'}
              </span>
            </div>
            {project.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* View Switcher Pills */}
          <div className="flex items-center p-1 rounded-2xl bg-muted/60 border border-border/80">
            <button
              onClick={() => setViewMode('tree')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                viewMode === 'tree' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Дерево (Stitch)</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                viewMode === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Канбан</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Список</span>
            </button>
          </div>

          {/* AI Project Decompose Button */}
          <button
            onClick={() => setShowAiModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500/15 to-purple-500/15 hover:from-indigo-500/25 hover:to-purple-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">ИИ-Декомпозиция</span>
          </button>

          {/* Share Link Button */}
          <button
            onClick={handleShareProject}
            className="px-3 py-2 rounded-xl bg-muted/70 hover:bg-muted text-foreground text-xs font-semibold border border-border transition-all flex items-center gap-1.5 cursor-pointer"
            title="Скопировать ссылку на проект"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Скопировано!' : 'Поделиться'}</span>
          </button>

          {/* Create Task Button */}
          <button
            onClick={() => handleOpenCreate()}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Задача</span>
          </button>

          <button onClick={onEdit} className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border cursor-pointer" title="Настройки проекта">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors cursor-pointer" title="Удалить проект">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Members Bar with Filter Tabs */}
      {project.members.length > 0 && (
        <div className="px-5 py-3 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Исполнитель:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedMemberFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                  selectedMemberFilter === 'all' ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-muted/50 border-border text-foreground hover:bg-muted'
                )}
              >
                Все ({project.tasks.length})
              </button>
              <button
                onClick={() => setSelectedMemberFilter('mine')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                  selectedMemberFilter === 'mine' ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-muted/50 border-border text-foreground hover:bg-muted'
                )}
              >
                Мои задачи
              </button>
              {project.members.map(m => (
                <button
                  key={m.chatId}
                  onClick={() => setSelectedMemberFilter(m.chatId)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer',
                    selectedMemberFilter === m.chatId ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-muted/50 border-border text-foreground hover:bg-muted'
                  )}
                >
                  <MemberAvatar member={m} size={4} />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={onEdit} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Пригласить участника</span>
          </button>
        </div>
      )}

      {/* Main View Area */}
      {viewMode === 'tree' ? (
        <ProjectTreeCanvas
          project={project}
          tasks={filteredTasks}
          onOpenCreateTask={handleOpenCreate}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onDeleteTask={handleDeleteTask}
          onLinkTasks={handleLinkTasks}
          onOpenAiPlanner={() => setShowAiModal(true)}
        />
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUS_COLUMNS.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id)
            return (
              <div key={col.id} className={cn('rounded-3xl border p-4 flex flex-col gap-3 shadow-xs', col.bg, col.border)}>
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <col.icon className={cn('w-4 h-4', col.color)} />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">{col.label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <button
                    onClick={() => handleOpenCreate(undefined, col.id)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 min-h-[160px]">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground/40 italic">
                      Нет задач в колонке
                    </div>
                  ) : (
                    colTasks.map(t => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-2xl bg-card border border-border hover:border-primary/40 shadow-sm transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                            t.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' :
                            t.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-muted/40 text-muted-foreground'
                          )}>
                            {t.priority === 'urgent' ? 'Срочно' : t.priority === 'high' ? 'Высокий' : 'Средний'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{t.dueDate || 'Без срока'}</span>
                        </div>

                        <h4 className={cn('text-xs font-bold text-foreground', t.status === 'done' && 'line-through text-muted-foreground')}>
                          {t.title}
                        </h4>
                        {t.description && <p className="text-[10px] text-muted-foreground line-clamp-2">{t.description}</p>}

                        <div className="flex items-center justify-between pt-1 border-t border-border/40">
                          <div className="flex items-center gap-1">
                            {col.id !== 'todo' && (
                              <button
                                onClick={() => handleUpdateTaskStatus(t.id, 'todo')}
                                className="px-2 py-0.5 rounded bg-muted text-[9px] font-semibold hover:bg-muted/80 text-foreground cursor-pointer"
                              >
                                ← Сделать
                              </button>
                            )}
                            {col.id !== 'inprogress' && (
                              <button
                                onClick={() => handleUpdateTaskStatus(t.id, 'inprogress')}
                                className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-semibold hover:bg-amber-500/25 cursor-pointer"
                              >
                                В работу
                              </button>
                            )}
                            {col.id !== 'done' && (
                              <button
                                onClick={() => handleUpdateTaskStatus(t.id, 'done')}
                                className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold hover:bg-emerald-500/25 cursor-pointer"
                              >
                                Готово →
                              </button>
                            )}
                          </div>
                          <button onClick={() => handleDeleteTask(t.id)} className="p-1 text-muted-foreground hover:text-rose-400 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="p-5 rounded-3xl bg-card border border-border space-y-2 shadow-sm">
          {project.tasks.length === 0 ? (
            <p className="text-center py-10 text-xs text-muted-foreground">В этом проекте пока нет задач</p>
          ) : (
            project.tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-colors border border-border/50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUpdateTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                    className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {t.status === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <div>
                    <span className={cn('text-xs font-bold text-foreground block', t.status === 'done' && 'line-through text-muted-foreground')}>
                      {t.title}
                    </span>
                    {t.description && <p className="text-[10px] text-muted-foreground">{t.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                    t.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' :
                    t.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-muted/40 text-muted-foreground'
                  )}>
                    {t.priority === 'urgent' ? 'Срочно' : t.priority === 'high' ? 'Высокий' : 'Средний'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{t.dueDate || 'Без срока'}</span>
                  <button onClick={() => handleDeleteTask(t.id)} className="p-1 rounded-md text-muted-foreground hover:text-rose-400 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Task Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateProjectTaskModal
            projectId={project.id}
            projectTitle={project.title}
            tasks={project.tasks}
            defaultParentId={modalParentId}
            defaultStatus={modalStatus}
            members={project.members}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); onRefresh() }}
          />
        )}
      </AnimatePresence>

      {/* AI Decompose Modal */}
      <AnimatePresence>
        {showAiModal && (
          <AiProjectDecomposeModal
            project={project}
            onClose={() => setShowAiModal(false)}
            onGenerated={onRefresh}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main ProjectsView Component ────────────────────────────────────────────────

export function ProjectsView() {
  const { state } = useApp()
  const confirm = useConfirmDialog()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects', { headers: getAuthHeaders() })
      if (!res.ok) {
        setProjects([])
        setLoading(false)
        return
      }
      const data = await res.json()
      const list: Project[] = data.projects || []
      setProjects(list)

      // If viewing a project, keep updated
      if (selected) {
        const fresh = list.find(p => p.id === selected.id)
        if (fresh) setSelected(fresh)
      }
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [selected?.id])

  useEffect(() => {
    loadProjects()
    const timer = setTimeout(() => setLoading(false), 3000)
    return () => clearTimeout(timer)
  }, [loadProjects])

  // Instant optimistic save & immediate selection
  const handleModalSave = async (savedProject?: Project) => {
    setShowModal(false)
    setEditProject(null)

    if (savedProject) {
      setProjects(prev => {
        const exists = prev.some(p => p.id === savedProject.id)
        if (exists) {
          return prev.map(p => p.id === savedProject.id ? { ...p, ...savedProject } : p)
        }
        return [savedProject, ...prev]
      })
      // Immediately open the created project!
      setSelected(savedProject)
    }

    // Refresh in background to sync all members & tasks
    loadProjects()
  }

  const handleDeleteProject = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить этот проект?',
      description: 'Все связанные с проектом задачи и ветки будут удалены.',
      confirmText: 'Удалить проект',
      variant: 'danger',
    })
    if (!ok) return

    // Instantly remove from local UI state
    setProjects(prev => prev.filter(p => p.id !== id))
    if (selected?.id === id) {
      setSelected(null)
    }

    try {
      await fetch('/api/projects?id=' + id, { method: 'DELETE', headers: getAuthHeaders() })
    } catch {}
    loadProjects()
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full font-sans pb-16">
      {/* Top Header */}
      {!selected && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Проекты и Дерево задач</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Совместная работа, интерактивное древовидное полотно (Google Stitch style) и канбан-доски
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const userPlan = normalizePlan(state.settings.userPlan)
              const maxProjects = PLANS[userPlan]?.maxProjects ?? 5
              if (projects.length >= maxProjects) {
                alert(`В тарифе ${userPlan.toUpperCase()} доступно до ${maxProjects} проектов. Оформите тариф Plus/Pro в Настройках для расширения!`)
                return
              }
              setShowModal(true)
            }}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Создать проект</span>
          </button>
        </div>
      )}

      {loading && !selected && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Загрузка проектов и задач…</p>
        </div>
      ) : selected ? (
        <ProjectDetail
          project={selected}
          onBack={() => setSelected(null)}
          onEdit={() => { setEditProject(selected); setShowModal(true) }}
          onRefresh={loadProjects}
          onDelete={() => handleDeleteProject(selected.id)}
        />
      ) : projects.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 sm:p-12 rounded-3xl bg-card border border-border shadow-sm flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto w-full my-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <FolderOpen className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">Проекты ещё не созданы</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
              Пространство проектов объединяет связанные задачи в интерактивное древовидное полотно (Google Stitch style), позволяет строить связи, перемещать узлы мышью, назначать дедлайны и автоматически декомпозировать цели с помощью ИИ.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Создать первый проект</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-4 border-t border-border/60 text-left">
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Network className="w-3.5 h-3.5 text-primary" />
                <span>Холст & Дерево задач</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Свободное перемещение задач, зум колесиком и визуальные стрелочки связей.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>ИИ-Декомпозиция</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Автоматическая генерация дерева задач и этапов проекта через нейросеть.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Команда и друзья</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Быстрый выбор коллег из команд и друзей в 1 клик без ручного ввода.
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => {
            const done = p.tasks.filter(t => t.status === 'done').length
            const total = p.tasks.length
            const pct = total ? Math.round((done / total) * 100) : 0

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelected(p)}
                className="p-5 rounded-3xl bg-card border border-border hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: p.color + '22' }}>
                    <FolderOpen className="w-5 h-5" style={{ color: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{p.title}</h3>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{done}/{total} задач</span>
                    <span className="font-bold text-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                  {p.members.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="flex -space-x-1.5">
                        {p.members.slice(0, 4).map(m => (
                          <MemberAvatar key={m.chatId} member={m} size={6} />
                        ))}
                      </div>
                      {p.members.length > 4 && (
                        <span className="text-[10px] text-muted-foreground font-semibold">+{p.members.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}

          {/* New Project Dashed Card */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowModal(true)}
            className="flex flex-col items-center justify-center gap-2.5 h-44 rounded-3xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all cursor-pointer"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-bold">Создать новый проект</span>
          </motion.button>
        </div>
      )}

      {/* Project Modal */}
      <AnimatePresence>
        {showModal && (
          <ProjectModal
            project={editProject}
            onClose={() => { setShowModal(false); setEditProject(null) }}
            onSave={handleModalSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
