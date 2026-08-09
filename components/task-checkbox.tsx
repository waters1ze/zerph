'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Priority } from '@/lib/types'

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'var(--priority-urgent)',
  high:   'var(--priority-high)',
  medium: 'var(--priority-medium)',
  low:    'var(--priority-low)',
}

interface Props {
  checked: boolean
  onChange: () => void
  priority?: Priority
  size?: number
}

export function TaskCheckbox({ checked, onChange, priority = 'medium', size = 18 }: Props) {
  const color = PRIORITY_COLORS[priority]
  const r = size / 2
  const strokeW = 2

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange() }}
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center shrink-0 group/cb before:absolute before:-inset-3 before:content-['']"
      aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Track circle */}
        <circle
          cx={r}
          cy={r}
          r={r - strokeW / 2}
          stroke={checked ? color : `oklch(from var(--border) l c h / 80%)`}
          strokeWidth={strokeW}
          fill={checked ? color : 'transparent'}
          style={{ transition: 'stroke 0.18s, fill 0.18s' }}
          className="group-hover/cb:stroke-[oklch(from_var(--primary)_l_c_h)] transition-colors"
        />

        {/* Checkmark */}
        <AnimatePresence>
          {checked && (
            <motion.path
              key="check"
              d={size <= 16
                ? `M ${r * 0.4} ${r} L ${r * 0.78} ${r * 1.35} L ${r * 1.6} ${r * 0.65}`
                : `M ${r * 0.35} ${r} L ${r * 0.75} ${r * 1.38} L ${r * 1.65} ${r * 0.60}`
              }
              stroke="white"
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </AnimatePresence>
      </svg>
    </button>
  )
}
