'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: React.ReactNode
  className?: string
}

const PULL_THRESHOLD = 65
const MAX_PULL = 95

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return
    const container = containerRef.current
    // Only allow pull-down if container or window is at the top
    if (container && container.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY
      isPullingRef.current = true
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || startYRef.current === null || isRefreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current

    if (diff > 0) {
      // Apply elastic resistance
      const distance = Math.min(MAX_PULL, Math.pow(diff, 0.82))
      setPullDistance(distance)
    } else {
      setPullDistance(0)
      isPullingRef.current = false
    }
  }

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return
    isPullingRef.current = false
    startYRef.current = null

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(48)
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(12)
        }
        await Promise.resolve(onRefresh())
      } catch {}
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 350)
    } else {
      setPullDistance(0)
    }
  }

  const isReadyToRelease = pullDistance >= PULL_THRESHOLD

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn('relative w-full h-full flex flex-col', className)}
    >
      {/* Pull Indicator Floating Pill */}
      <AnimatePresence>
        {(pullDistance > 5 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{
              opacity: 1,
              y: pullDistance,
              transition: { type: 'spring', damping: 25, stiffness: 300 }
            }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.18 } }}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-lg border text-xs font-semibold backdrop-blur-md transition-colors',
              isReadyToRelease || isRefreshing
                ? 'bg-primary text-primary-foreground border-primary/40'
                : 'bg-card/90 text-foreground border-border/80'
            )}>
              <RefreshCw className={cn(
                'w-3.5 h-3.5',
                isRefreshing ? 'animate-spin' : isReadyToRelease ? 'rotate-180 transition-transform' : ''
              )} />
              <span>
                {isRefreshing
                  ? 'Синхронизация…'
                  : isReadyToRelease
                  ? 'Отпустите для обновления'
                  : 'Потяните для обновления'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content with subtle push-down physics */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : undefined,
          transition: isPullingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 1, 0.3, 1)',
        }}
        className="w-full flex-1 flex flex-col min-h-0"
      >
        {children}
      </div>
    </div>
  )
}
