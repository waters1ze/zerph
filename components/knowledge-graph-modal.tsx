'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Note } from '@/lib/types'
import { 
  buildGraphData, GraphNode, GraphEdge, ColorGroup, DEFAULT_COLOR_PALETTE, getFolderColor 
} from '@/lib/wikilinks'
import { 
  X, ZoomIn, ZoomOut, RotateCcw, Search, Folder, 
  Layers, ExternalLink, Sparkles, Network, Maximize2, Minimize2, 
  Sliders, FileText, Tag, Plus, Trash2, Palette, Filter, Eye, RefreshCw, Compass
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface KnowledgeGraphModalProps {
  isOpen: boolean
  onClose?: () => void
  notes: Note[]
  initialFolder?: string | null
  initialNoteId?: string | null
  onSelectNote: (noteId: string) => void
  onCreateNoteWithTitle?: (title: string, linkedFromNoteId?: string) => void
  onDeleteNote?: (noteId: string) => void
  isFullView?: boolean
}

export function KnowledgeGraphModal({
  isOpen,
  onClose,
  notes,
  initialFolder = null,
  initialNoteId = null,
  onSelectNote,
  onCreateNoteWithTitle,
  onDeleteNote,
  isFullView = false,
}: KnowledgeGraphModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  
  // Filter Options State
  const [folderFilter, setFolderFilter] = useState<string | null>(initialFolder)
  const [localNoteId, setLocalNoteId] = useState<string | null>(initialNoteId)
  const [localDepth, setLocalDepth] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTags, setShowTags] = useState(true)
  const [showFolders, setShowFolders] = useState(false)
  const [showUnresolved, setShowUnresolved] = useState(true)
  const [showArrows, setShowArrows] = useState(true)

  // Color Groups State (Obsidian-Style)
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>([
    { id: 'cg_1', query: 'tag:#важное', color: '#ef4444', label: 'Важное (#важное)' },
    { id: 'cg_2', query: 'path:Школа', color: '#10b981', label: 'Школа (path:Школа)' },
    { id: 'cg_3', query: 'path:Проекты', color: '#f59e0b', label: 'Проекты (path:Проекты)' },
  ])
  const [newGroupQuery, setNewGroupQuery] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#6366f1')

  // Physics & Display Controls State
  const [activePanel, setActivePanel] = useState<'filters' | 'colors' | 'forces' | 'display' | null>('filters')
  const [repulsion, setRepulsion] = useState(130)
  const [linkDistance, setLinkDistance] = useState(65)
  const [centerGravity, setCenterGravity] = useState(0.0008)
  const [nodeSizeScale, setNodeSizeScale] = useState(1)
  const [linkThickness, setLinkThickness] = useState(1)
  const [isPhysicsPaused, setIsPhysicsPaused] = useState(false)

  // Node Selection & Context State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number; node: GraphNode } | null>(null)

  // Camera State (Pan and Zoom)
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const draggedNodeRef = useRef<GraphNode | null>(null)

  // Derive unique folders list for dropdown
  const foldersList = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => {
      if (n.folder && n.folder.trim()) set.add(n.folder.trim())
    })
    return Array.from(set).sort()
  }, [notes])

  // Build Graph Data with all filters
  const graphData = useMemo(() => {
    return buildGraphData(notes, {
      folderFilter,
      showTags,
      showFolders,
      showUnresolved,
      colorGroups,
      localNoteId,
      localDepth,
      searchQuery,
    })
  }, [notes, folderFilter, showTags, showFolders, showUnresolved, colorGroups, localNoteId, localDepth, searchQuery])

  // Simulation node positions
  const simNodesRef = useRef<GraphNode[]>([])
  const simEdgesRef = useRef<GraphEdge[]>([])
  const animFrameRef = useRef<number | null>(null)

  // Initialize or update node positions
  useEffect(() => {
    const width = canvasRef.current?.width || 900
    const height = canvasRef.current?.height || 650

    const prevMap = new Map(simNodesRef.current.map(n => [n.id, n]))

    const initialNodes = graphData.nodes.map((n, i) => {
      const prev = prevMap.get(n.id)
      if (prev && prev.x !== undefined && prev.y !== undefined) {
        return {
          ...n,
          x: prev.x,
          y: prev.y,
          vx: prev.vx || 0,
          vy: prev.vy || 0,
        }
      }
      const angle = i * 0.45
      const r = 35 + Math.sqrt(i) * 40
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
    if (isPhysicsPaused) return
    const nodes = simNodesRef.current
    const edges = simEdgesRef.current
    if (!nodes.length) return

    const width = canvasRef.current?.width || 900
    const height = canvasRef.current?.height || 650
    const centerX = width / 2
    const centerY = height / 2

    // 1. Center gravity
    for (const node of nodes) {
      if (node === draggedNodeRef.current) continue
      const dx = centerX - (node.x || centerX)
      const dy = centerY - (node.y || centerY)
      node.vx = (node.vx || 0) + dx * centerGravity
      node.vy = (node.vy || 0) + dy * centerGravity
    }

    // 2. Node Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = (b.x || 0) - (a.x || 0)
        const dy = (b.y || 0) - (a.y || 0)
        const distSq = dx * dx + dy * dy || 1
        const dist = Math.sqrt(distSq)

        if (dist < 400) {
          const force = (repulsion * 9) / distSq
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

    // 3. Link Spring Attraction
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    for (const edge of edges) {
      const a = nodeMap.get(edge.source)
      const b = nodeMap.get(edge.target)
      if (!a || !b) continue

      const dx = (b.x || 0) - (a.x || 0)
      const dy = (b.y || 0) - (a.y || 0)
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const delta = dist - linkDistance
      const force = delta * 0.035

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

    // 4. Update positions with Damping
    for (const node of nodes) {
      if (node === draggedNodeRef.current) continue
      node.vx = (node.vx || 0) * 0.86
      node.vy = (node.vy || 0) * 0.86

      const speed = Math.sqrt((node.vx || 0) ** 2 + (node.vy || 0) ** 2)
      if (speed > 12) {
        node.vx = (node.vx / speed) * 12
        node.vy = (node.vy / speed) * 12
      }

      node.x = (node.x || 0) + (node.vx || 0)
      node.y = (node.y || 0) + (node.vy || 0)
    }
  }, [repulsion, linkDistance, centerGravity, isPhysicsPaused])

  // Canvas Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.zoom, camera.zoom)

    const nodes = simNodesRef.current
    const edges = simEdgesRef.current
    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    // Highlighted neighbors
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
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)'
        ctx.lineWidth = (2.2 * linkThickness) / camera.zoom
      } else if (activeHoverOrSelect) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
        ctx.lineWidth = (0.5 * linkThickness) / camera.zoom
      } else {
        if (edge.type === 'unresolved') {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
          ctx.setLineDash([4, 4])
        } else if (edge.type === 'tag') {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)'
          ctx.setLineDash([])
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
          ctx.setLineDash([])
        }
        ctx.lineWidth = (1 * linkThickness) / camera.zoom
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Draw direction arrow if enabled
      if (showArrows && isConnected && edge.type === 'wikilink') {
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        const radiusB = (b.radius || 6) * nodeSizeScale
        const targetX = b.x - Math.cos(angle) * (radiusB + 3)
        const targetY = b.y - Math.sin(angle) * (radiusB + 3)

        ctx.save()
        ctx.translate(targetX, targetY)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-6 / camera.zoom, -3.5 / camera.zoom)
        ctx.lineTo(-6 / camera.zoom, 3.5 / camera.zoom)
        ctx.closePath()
        ctx.fillStyle = 'rgba(245, 158, 11, 0.9)'
        ctx.fill()
        ctx.restore()
      }
    }

    // 2. Draw Nodes
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue
      const isSelected = selectedNode?.id === node.id
      const isHovered = hoveredNode?.id === node.id
      const isConnected = connectedNodeIds.has(node.id)
      const radius = (node.radius || 6) * nodeSizeScale

      const isMatchingSearch = searchQuery && node.title.toLowerCase().includes(searchQuery.toLowerCase())

      // Glow halo
      if (isSelected || isHovered || isMatchingSearch) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2)
        ctx.fillStyle = isMatchingSearch ? 'rgba(236, 72, 153, 0.4)' : 'rgba(245, 158, 11, 0.38)'
        ctx.fill()
        ctx.restore()
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)

      if (activeHoverOrSelect && !isConnected && !isMatchingSearch) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.2)'
      } else {
        ctx.fillStyle = isMatchingSearch ? '#ec4899' : node.color
      }
      ctx.fill()

      if (node.type === 'unresolved') {
        ctx.strokeStyle = '#94a3b8'
        ctx.setLineDash([2, 2])
        ctx.lineWidth = 1.5 / camera.zoom
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0, 0, 0, 0.45)'
        ctx.lineWidth = isSelected ? 2 / camera.zoom : 1 / camera.zoom
        ctx.stroke()
      }

      // Labels
      const shouldRenderLabel = camera.zoom > 0.7 || isSelected || isHovered || isConnected || isMatchingSearch
      if (shouldRenderLabel) {
        ctx.font = `${Math.max(9, Math.min(13, 11 / camera.zoom))}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = isSelected || isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'
        ctx.fillText(node.title, node.x, node.y + radius + 11 / camera.zoom)
      }
    }

    ctx.restore()
  }, [camera, hoveredNode, selectedNode, searchQuery, linkThickness, nodeSizeScale, showArrows])

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

  // Find node under screen coordinates
  const getNodeAtCoords = (screenX: number, screenY: number): GraphNode | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mouseX = screenX - rect.left
    const mouseY = screenY - rect.top

    const worldX = (mouseX - camera.x) / camera.zoom
    const worldY = (mouseY - camera.y) / camera.zoom

    const nodes = simNodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]
      if (n.x === undefined || n.y === undefined) continue
      const dist = Math.sqrt((n.x - worldX) ** 2 + (n.y - worldY) ** 2)
      if (dist <= ((n.radius || 6) * nodeSizeScale) + 5) {
        return n
      }
    }
    return null
  }

  // Mouse & Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setContextMenuPos(null)
    const node = getNodeAtCoords(e.clientX, e.clientY)

    if (e.button === 2) {
      // Right Click Context Menu
      e.preventDefault()
      if (node) {
        setSelectedNode(node)
        setContextMenuPos({ x: e.clientX, y: e.clientY, node })
      }
      return
    }

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

  // Touch Handlers for Mobile & Tablets
  const touchStartDistRef = useRef<number | null>(null)
  const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null)
  const touchStartTimeRef = useRef<number>(0)
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setContextMenuPos(null)
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      touchStartTimeRef.current = Date.now()
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
      const node = getNodeAtCoords(touch.clientX, touch.clientY)
      if (node) {
        draggedNodeRef.current = node
        setSelectedNode(node)
      } else {
        isDraggingRef.current = true
        dragStartRef.current = { x: touch.clientX - camera.x, y: touch.clientY - camera.y }
      }
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      touchStartDistRef.current = dist
      touchStartCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      if (draggedNodeRef.current) {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const worldX = (touch.clientX - rect.left - camera.x) / camera.zoom
        const worldY = (touch.clientY - rect.top - camera.y) / camera.zoom
        draggedNodeRef.current.x = worldX
        draggedNodeRef.current.y = worldY
        draggedNodeRef.current.vx = 0
        draggedNodeRef.current.vy = 0
      } else if (isDraggingRef.current) {
        setCamera(prev => ({
          ...prev,
          x: touch.clientX - dragStartRef.current.x,
          y: touch.clientY - dragStartRef.current.y,
        }))
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      const factor = currentDist / touchStartDistRef.current
      touchStartDistRef.current = currentDist

      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left
      const centerY = (t1.clientY + t2.clientY) / 2 - rect.top

      setCamera(prev => {
        const newZoom = Math.max(0.15, Math.min(3.5, prev.zoom * factor))
        return {
          zoom: newZoom,
          x: centerX - (centerX - prev.x) * (newZoom / prev.zoom),
          y: centerY - (centerY - prev.y) * (newZoom / prev.zoom),
        }
      })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      const duration = Date.now() - touchStartTimeRef.current
      if (duration < 300) {
        const touch = e.changedTouches[0]
        if (touch) {
          const moveDist = Math.hypot(touch.clientX - touchStartPosRef.current.x, touch.clientY - touchStartPosRef.current.y)
          if (moveDist < 12) {
            const node = getNodeAtCoords(touch.clientX, touch.clientY)
            if (node) {
              setSelectedNode(node)
            }
          }
        }
      }
      draggedNodeRef.current = null
      isDraggingRef.current = false
      touchStartDistRef.current = null
      touchStartCenterRef.current = null
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88
    const newZoom = Math.max(0.15, Math.min(3.5, camera.zoom * zoomFactor))

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

  const handleAddColorGroup = () => {
    if (!newGroupQuery.trim()) return
    const newGroup: ColorGroup = {
      id: 'cg_' + Date.now(),
      query: newGroupQuery.trim(),
      color: newGroupColor,
      label: newGroupQuery.trim(),
    }
    setColorGroups(prev => [...prev, newGroup])
    setNewGroupQuery('')
  }

  const handleRemoveColorGroup = (id: string) => {
    setColorGroups(prev => prev.filter(g => g.id !== id))
  }

  const handleNodePrimaryAction = (node: GraphNode) => {
    if (node.type === 'unresolved') {
      if (onCreateNoteWithTitle) {
        onCreateNoteWithTitle(node.title)
        if (onClose) onClose()
      }
    } else if (node.type === 'note') {
      onSelectNote(node.id)
      if (onClose) onClose()
    } else if (node.type === 'folder') {
      setFolderFilter(node.folder || null)
    }
  }

  if (!isOpen) return null

  return (
    <div className={cn(
      isFullView 
        ? 'w-full h-full flex flex-col overflow-hidden bg-[#0a0d14] text-foreground rounded-none sm:rounded-3xl border-0 sm:border border-border/80 shadow-2xl'
        : 'fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200'
    )}>
      <div className={cn(
        isFullView
          ? 'relative w-full h-full flex flex-col overflow-hidden'
          : 'relative w-full sm:max-w-7xl h-[100dvh] sm:h-[92vh] bg-[#090c14] border-0 sm:border border-border/80 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground'
      )}>
        
        {/* ── Top Header Bar (Responsive for Mobile & Desktop) ── */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border/70 bg-muted/20 z-10 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm shrink-0">
              <Network className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-bold text-foreground truncate">Граф знаний</h2>
                {localNoteId && (
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 shrink-0">
                    Локальный
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                {graphData.nodes.length} узлов • {graphData.edges.length} связей
              </p>
            </div>
          </div>

          {/* Quick Controls Row */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative w-24 sm:w-44">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск…"
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl text-xs bg-card border border-border/80 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Scope Switcher */}
            <select
              value={folderFilter || 'all'}
              onChange={e => {
                setFolderFilter(e.target.value === 'all' ? null : e.target.value)
                setLocalNoteId(null)
              }}
              className="px-2 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[85px] sm:max-w-[140px] truncate"
            >
              <option value="all">🌐 Вся база</option>
              {foldersList.map(f => (
                <option key={f} value={f}>📁 {f}</option>
              ))}
            </select>

            {/* Panel Buttons */}
            <div className="flex items-center bg-card border border-border rounded-xl p-0.5">
              <button
                onClick={() => setActivePanel(activePanel === 'filters' ? null : 'filters')}
                className={cn('p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activePanel === 'filters' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Фильтры узлов и связей"
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Фильтры</span>
              </button>

              <button
                onClick={() => setActivePanel(activePanel === 'colors' ? null : 'colors')}
                className={cn('p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activePanel === 'colors' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Цветовые группы"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Группы</span>
              </button>

              <button
                onClick={() => setActivePanel(activePanel === 'forces' ? null : 'forces')}
                className={cn('p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activePanel === 'forces' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Силы физики"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Физика</span>
              </button>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Закрыть граф"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Main Canvas Viewport ── */}
        <div className="relative flex-1 w-full h-full overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onWheel={handleWheel}
            onContextMenu={e => e.preventDefault()}
            className="w-full h-full cursor-grab active:cursor-grabbing block select-none touch-none"
          />

          {/* Floating Zoom & Physics Control Bar */}
          <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 flex items-center gap-1 p-1 rounded-2xl bg-card/90 border border-border shadow-2xl backdrop-blur-md z-20">
            <button
              onClick={() => setCamera(prev => ({ ...prev, zoom: Math.min(3.5, prev.zoom * 1.2) }))}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Приблизить"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCamera(prev => ({ ...prev, zoom: Math.max(0.15, prev.zoom * 0.8) }))}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Отдалить"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetCamera}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Сбросить центрирование"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-border/60 mx-1" />
            <button
              onClick={() => setIsPhysicsPaused(!isPhysicsPaused)}
              className={cn(
                'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer',
                isPhysicsPaused ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Пауза/продолжение физической симуляции"
            >
              {isPhysicsPaused ? 'Пауза' : 'Живой'}
            </button>
          </div>

          {/* ── Collapsible Control Drawers (Obsidian Style - Mobile Responsive) ── */}
          <AnimatePresence>
            {activePanel === 'filters' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-3 left-3 right-3 sm:right-auto sm:left-4 sm:top-4 w-auto sm:w-80 max-h-[65vh] overflow-y-auto p-4 rounded-2xl bg-card/95 border border-border shadow-2xl backdrop-blur-md space-y-3 z-30 text-xs"
              >
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-primary" />
                    <span>Фильтры отображения</span>
                  </h4>
                  <button onClick={() => setActivePanel(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Tag className="w-3 h-3 text-purple-400" />
                      <span>Узлы тегов (#хэштеги)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showTags}
                      onChange={e => setShowTags(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Folder className="w-3 h-3 text-amber-400" />
                      <span>Узлы папок (Кластеры)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showFolders}
                      onChange={e => setShowFolders(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      <span>Несозданные ссылки [[...]]</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showUnresolved}
                      onChange={e => setShowUnresolved(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Compass className="w-3 h-3 text-emerald-400" />
                      <span>Стрелки направления связей</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showArrows}
                      onChange={e => setShowArrows(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  </label>
                </div>
              </motion.div>
            )}

            {activePanel === 'colors' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-3 left-3 right-3 sm:right-auto sm:left-4 sm:top-4 w-auto sm:w-80 max-h-[65vh] overflow-y-auto p-4 rounded-2xl bg-card/95 border border-border shadow-2xl backdrop-blur-md space-y-3 z-30 text-xs"
              >
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-primary" />
                    <span>Цветовые группы (Obsidian)</span>
                  </h4>
                  <button onClick={() => setActivePanel(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Existing Groups List */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                  {colorGroups.map(grp => (
                    <div key={grp.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: grp.color }} />
                        <span className="font-mono text-[11px] truncate text-foreground">{grp.query}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveColorGroup(grp.id)}
                        className="text-muted-foreground hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add New Color Group */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Добавить правило цвета:</span>
                  <input
                    type="text"
                    value={newGroupQuery}
                    onChange={e => setNewGroupQuery(e.target.value)}
                    placeholder="tag:#физика или path:Школа..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {DEFAULT_COLOR_PALETTE.slice(0, 6).map(c => (
                        <button
                          key={c}
                          onClick={() => setNewGroupColor(c)}
                          className={cn('w-4 h-4 rounded-full transition-transform cursor-pointer', newGroupColor === c && 'ring-2 ring-foreground scale-110')}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleAddColorGroup}
                      disabled={!newGroupQuery.trim()}
                      className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
                    >
                      + Добавить
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activePanel === 'forces' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-3 left-3 right-3 sm:right-auto sm:left-4 sm:top-4 w-auto sm:w-80 max-h-[65vh] overflow-y-auto p-4 rounded-2xl bg-card/95 border border-border shadow-2xl backdrop-blur-md space-y-3 z-30 text-xs"
              >
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span>Силы физики</span>
                  </h4>
                  <button onClick={() => setActivePanel(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3 pt-1">
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
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Длина связей:</span>
                      <span>{linkDistance}px</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="250"
                      value={linkDistance}
                      onChange={e => setLinkDistance(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Центральное притяжение:</span>
                      <span>{centerGravity}</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="0.3"
                      step="0.01"
                      value={centerGravity}
                      onChange={e => setCenterGravity(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Масштаб узлов:</span>
                      <span>{nodeSizeScale}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.6"
                      max="2"
                      step="0.1"
                      value={nodeSizeScale}
                      onChange={e => setNodeSizeScale(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Selected Node Inspector Drawer (Mobile Responsive) ── */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 w-80 p-4 rounded-2xl bg-card/95 border border-border shadow-2xl backdrop-blur-md space-y-3 z-30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedNode.color }}
                    />
                    <h4 className="text-xs font-bold text-foreground truncate">
                      {selectedNode.title}
                    </h4>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Folder className="w-3 h-3 text-primary" />
                    <span>Папка: <strong>{selectedNode.folder || 'Общее'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3 h-3 text-amber-400" />
                    <span>Связей: <strong>{selectedNode.connectionCount}</strong></span>
                  </div>
                  {selectedNode.type === 'unresolved' && (
                    <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px]">
                      Эта заметка еще не создана. Нажмите кнопку ниже, чтобы создать её.
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleNodePrimaryAction(selectedNode)}
                  className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {selectedNode.type === 'unresolved' ? 'Создать эту заметку' : 'Открыть заметку'}
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Right-Click Context Menu on Node ── */}
          {contextMenuPos && (
            <div
              style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
              className="fixed z-50 w-56 rounded-2xl bg-card border border-border shadow-2xl p-1.5 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground border-b border-border/50 truncate">
                {contextMenuPos.node.title}
              </div>

              <button
                onClick={() => {
                  handleNodePrimaryAction(contextMenuPos.node)
                  setContextMenuPos(null)
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-left"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Открыть заметку</span>
              </button>

              <button
                onClick={() => {
                  setLocalNoteId(contextMenuPos.node.id)
                  setContextMenuPos(null)
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-left"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Локальный граф этого узла</span>
              </button>

              {contextMenuPos.node.type === 'note' && onDeleteNote && (
                <button
                  onClick={() => {
                    onDeleteNote(contextMenuPos.node.id)
                    setContextMenuPos(null)
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
