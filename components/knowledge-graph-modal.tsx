'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Note } from '@/lib/types'
import { 
  buildGraphData, GraphNode, GraphEdge, getFolderColor 
} from '@/lib/wikilinks'
import { 
  X, ZoomIn, ZoomOut, RotateCcw, Search, Folder, 
  Layers, ExternalLink, Sparkles, Network, Maximize2, Minimize2, Sliders, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface KnowledgeGraphModalProps {
  isOpen: boolean
  onClose: () => void
  notes: Note[]
  initialFolder?: string | null
  onSelectNote: (noteId: string) => void
}

export function KnowledgeGraphModal({
  isOpen,
  onClose,
  notes,
  initialFolder = null,
  onSelectNote,
}: KnowledgeGraphModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [folderFilter, setFolderFilter] = useState<string | null>(initialFolder)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [repulsion, setRepulsion] = useState(120)
  const [linkDistance, setLinkDistance] = useState(60)

  // Camera State (Pan and Zoom)
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const draggedNodeRef = useRef<GraphNode | null>(null)

  // Derive unique folders list for filter dropdown
  const foldersList = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => {
      if (n.folder && n.folder.trim()) set.add(n.folder.trim())
    })
    return Array.from(set).sort()
  }, [notes])

  // Build Graph Data
  const graphData = useMemo(() => {
    return buildGraphData(notes, folderFilter)
  }, [notes, folderFilter])

  // Simulation node positions state
  const simNodesRef = useRef<GraphNode[]>([])
  const simEdgesRef = useRef<GraphEdge[]>([])
  const animFrameRef = useRef<number | null>(null)

  // Initialize simulation positions when graphData changes
  useEffect(() => {
    const width = canvasRef.current?.width || 800
    const height = canvasRef.current?.height || 600

    const initialNodes = graphData.nodes.map((n, i) => {
      // Position nodes in a spiral/circle layout initially
      const angle = i * 0.5
      const r = 30 + Math.sqrt(i) * 35
      return {
        ...n,
        x: (width / 2) + Math.cos(angle) * r + (Math.random() - 0.5) * 20,
        y: (height / 2) + Math.sin(angle) * r + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
      }
    })

    simNodesRef.current = initialNodes
    simEdgesRef.current = graphData.edges
  }, [graphData])

  // Physics Simulation Step
  const stepPhysics = useCallback(() => {
    const nodes = simNodesRef.current
    const edges = simEdgesRef.current
    if (!nodes.length) return

    const width = canvasRef.current?.width || 800
    const height = canvasRef.current?.height || 600
    const centerX = width / 2
    const centerY = height / 2

    // 1. Center gravity
    for (const node of nodes) {
      if (node === draggedNodeRef.current) continue
      const dx = centerX - (node.x || centerX)
      const dy = centerY - (node.y || centerY)
      node.vx = (node.vx || 0) + dx * 0.0008
      node.vy = (node.vy || 0) + dy * 0.0008
    }

    // 2. Node Repulsion (Coulomb force)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = (b.x || 0) - (a.x || 0)
        const dy = (b.y || 0) - (a.y || 0)
        const distSq = dx * dx + dy * dy || 1
        const dist = Math.sqrt(distSq)

        if (dist < 350) {
          const force = (repulsion * 8) / distSq
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force

          if (a !== draggedNodeRef.current) {
            a.vx = (a.vx || 0) - fx
            a.vy = (a.vy || 0) - fy
          }
          if (b !== draggedNodeRef.current) {
            b.vx = (b.vx || 0) + fx
            b.vy = (b.vy || 0) + fy
          }
        }
      }
    }

    // 3. Link Spring Attraction (Hooke force)
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    for (const edge of edges) {
      const a = nodeMap.get(edge.source)
      const b = nodeMap.get(edge.target)
      if (!a || !b) continue

      const dx = (b.x || 0) - (a.x || 0)
      const dy = (b.y || 0) - (a.y || 0)
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const delta = dist - linkDistance
      const force = delta * 0.03

      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      if (a !== draggedNodeRef.current) {
        a.vx = (a.vx || 0) + fx
        a.vy = (a.vy || 0) + fy
      }
      if (b !== draggedNodeRef.current) {
        b.vx = (b.vx || 0) - fx
        b.vy = (b.vy || 0) - fy
      }
    }

    // 4. Damping & Update positions
    for (const node of nodes) {
      if (node === draggedNodeRef.current) continue
      node.vx = (node.vx || 0) * 0.85
      node.vy = (node.vy || 0) * 0.85

      // Velocity cap
      const speed = Math.sqrt((node.vx || 0) ** 2 + (node.vy || 0) ** 2)
      if (speed > 10) {
        node.vx = (node.vx / speed) * 10
        node.vy = (node.vy / speed) * 10
      }

      node.x = (node.x || 0) + (node.vx || 0)
      node.y = (node.y || 0) + (node.vy || 0)
    }
  }, [repulsion, linkDistance])

  // Canvas Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    // Apply camera transform
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.zoom, camera.zoom)

    const nodes = simNodesRef.current
    const edges = simEdgesRef.current
    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    // Highlighted neighbors set
    const activeHoverOrSelect = hoveredNode || selectedNode
    const connectedNodeIds = new Set<string>()
    if (activeHoverOrSelect) {
      connectedNodeIds.add(activeHoverOrSelect.id)
      edges.forEach(e => {
        if (e.source === activeHoverOrSelect.id) connectedNodeIds.add(e.target)
        if (e.target === activeHoverOrSelect.id) connectedNodeIds.add(e.source)
      })
    }

    // 1. Draw Edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source)
      const b = nodeMap.get(edge.target)
      if (!a || !b || a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) continue

      const isConnected = activeHoverOrSelect && (
        (edge.source === activeHoverOrSelect.id && connectedNodeIds.has(edge.target)) ||
        (edge.target === activeHoverOrSelect.id && connectedNodeIds.has(edge.source))
      )

      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)

      if (isConnected) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)' // Glowing accent line
        ctx.lineWidth = 2 / camera.zoom
      } else if (activeHoverOrSelect) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)' // Dimmed line
        ctx.lineWidth = 0.6 / camera.zoom
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
        ctx.lineWidth = 1 / camera.zoom
      }
      ctx.stroke()
    }

    // 2. Draw Nodes
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue
      const isSelected = selectedNode?.id === node.id
      const isHovered = hoveredNode?.id === node.id
      const isConnected = connectedNodeIds.has(node.id)
      const radius = node.radius || 6

      const isMatchingSearch = searchQuery && node.title.toLowerCase().includes(searchQuery.toLowerCase())

      // Glow effect for selected / searched / connected
      if (isSelected || isHovered || isMatchingSearch) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2)
        ctx.fillStyle = isMatchingSearch ? 'rgba(236, 72, 153, 0.35)' : 'rgba(245, 158, 11, 0.35)'
        ctx.fill()
        ctx.restore()
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)

      if (activeHoverOrSelect && !isConnected && !isMatchingSearch) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.25)' // Dimmed
      } else {
        ctx.fillStyle = isMatchingSearch ? '#ec4899' : node.color
      }
      ctx.fill()

      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0, 0, 0, 0.4)'
      ctx.lineWidth = isSelected ? 2 / camera.zoom : 1 / camera.zoom
      ctx.stroke()

      // Node Labels (render if zoom is high enough or if hovered/selected)
      const shouldRenderLabel = camera.zoom > 0.75 || isSelected || isHovered || isConnected || isMatchingSearch
      if (shouldRenderLabel) {
        ctx.font = `${Math.max(9, Math.min(12, 11 / camera.zoom))}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = isSelected || isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.75)'
        ctx.fillText(node.title, node.x, node.y + radius + 11 / camera.zoom)
      }
    }

    ctx.restore()
  }, [camera, hoveredNode, selectedNode, searchQuery])

  // Animation Loop
  useEffect(() => {
    if (!isOpen) return

    const loop = () => {
      stepPhysics()
      render()
      animFrameRef.current = requestAnimationFrame(loop)
    }

    loop()
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isOpen, stepPhysics, render])

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width
        canvas.height = rect.height
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  // Find node under cursor
  const getNodeAtCoords = (screenX: number, screenY: number): GraphNode | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mouseX = screenX - rect.left
    const mouseY = screenY - rect.top

    // Convert screen coordinates to world coordinates
    const worldX = (mouseX - camera.x) / camera.zoom
    const worldY = (mouseY - camera.y) / camera.zoom

    const nodes = simNodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      if (n.x === undefined || n.y === undefined) continue
      const dist = Math.sqrt((n.x - worldX) ** 2 + (n.y - worldY) ** 2)
      if (dist <= (n.radius || 6) + 4) {
        return n
      }
    }
    return null
  }

  // Mouse / Touch Handlers for Drag & Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = getNodeAtCoords(e.clientX, e.clientY)
    if (node) {
      draggedNodeRef.current = node
      setSelectedNode(node)
    } else {
      isDraggingRef.current = true
      dragStartRef.current = { x: e.clientX - camera.x, y: e.clientY - camera.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const worldX = (e.clientX - rect.left - camera.x) / camera.zoom
      const worldY = (e.clientY - rect.top - camera.y) / camera.zoom
      draggedNodeRef.current.x = worldX
      draggedNodeRef.current.y = worldY
      draggedNodeRef.current.vx = 0
      draggedNodeRef.current.vy = 0
    } else if (isDraggingRef.current) {
      setCamera(prev => ({
        ...prev,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      }))
    } else {
      const node = getNodeAtCoords(e.clientX, e.clientY)
      setHoveredNode(node)
    }
  }

  const handleMouseUp = () => {
    draggedNodeRef.current = null
    isDraggingRef.current = false
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    const newZoom = Math.max(0.2, Math.min(3, camera.zoom * zoomFactor))

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    setCamera(prev => ({
      zoom: newZoom,
      x: mouseX - (mouseX - prev.x) * (newZoom / prev.zoom),
      y: mouseY - (mouseY - prev.y) * (newZoom / prev.zoom),
    }))
  }

  const handleResetCamera = () => {
    setCamera({ x: 0, y: 0, zoom: 1 })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[90vh] bg-[#0c0f17] border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground">
        
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/60 bg-muted/20 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                Интерактивный граф знаний
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Визуализация связей через <code>[[заметки]]</code> и структуру папок ({graphData.nodes.length} узлов, {graphData.edges.length} связей)
              </p>
            </div>
          </div>

          {/* Controls: Search, Folder Switcher, Buttons */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-36 sm:w-48">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск узла..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Folder Scope Dropdown */}
            <select
              value={folderFilter || 'all'}
              onChange={e => setFolderFilter(e.target.value === 'all' ? null : e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">🌐 Вся база (Глобальный)</option>
              {foldersList.map(f => (
                <option key={f} value={f}>📁 Папка: {f}</option>
              ))}
            </select>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center border transition-colors',
                showSettings ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
              )}
              title="Физика графа"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="relative flex-1 w-full h-full overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />

          {/* Floating Zoom & Reset Toolbar */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 p-1 rounded-2xl bg-card/90 border border-border shadow-lg backdrop-blur-sm">
            <button
              onClick={() => setCamera(prev => ({ ...prev, zoom: Math.min(3, prev.zoom * 1.2) }))}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Приблизить"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCamera(prev => ({ ...prev, zoom: Math.max(0.2, prev.zoom * 0.8) }))}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Отдалить"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetCamera}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Сбросить вид"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Selected Node Inspector Drawer */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 w-72 p-4 rounded-2xl bg-card/95 border border-border shadow-2xl backdrop-blur-md space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedNode.color }}
                    />
                    <h4 className="text-xs font-bold text-foreground truncate max-w-[180px]">
                      {selectedNode.title}
                    </h4>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Folder className="w-3 h-3 text-primary" />
                    <span>Папка: <strong>{selectedNode.folder}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3 h-3 text-amber-400" />
                    <span>Связей: <strong>{selectedNode.connectionCount}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectNote(selectedNode.id)
                    onClose()
                  }}
                  className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Открыть эту заметку</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Physics Settings Drawer */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-4 w-64 p-4 rounded-2xl bg-card/95 border border-border shadow-xl backdrop-blur-md space-y-3 text-xs"
              >
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-primary" />
                  <span>Настройки физики</span>
                </h4>
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Сила отталкивания:</span>
                    <span>{repulsion}</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="300"
                    value={repulsion}
                    onChange={e => setRepulsion(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Длина связей:</span>
                    <span>{linkDistance}px</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="180"
                    value={linkDistance}
                    onChange={e => setLinkDistance(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
