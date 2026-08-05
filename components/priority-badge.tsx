'use client'

import { cn } from '@/lib/utils'
import type { Priority } from '@/lib/types'

const config: Record<Priority, { label: string; dot: string; text: string }> = {
  urgent: { label: 'Urgent', dot: 'bg-[var(--priority-urgent)]', text: 'text-[var(--priority-urgent)]' },
  high:   { label: 'High',   dot: 'bg-[var(--priority-high)]',   text: 'text-[var(--priority-high)]' },
  medium: { label: 'Medium', dot: 'bg-[var(--priority-medium)]', text: 'text-[var(--priority-medium)]' },
  low:    { label: 'Low',    dot: 'bg-[var(--priority-low)]',    text: 'text-[var(--priority-low)]' },
}

interface Props {
  priority: Priority
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function PriorityBadge({ priority, showLabel = true, size = 'sm' }: Props) {
  const c = config[priority]
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', size === 'sm' ? 'text-[11px]' : 'text-xs', c.text)}>
      <span className={cn('rounded-full shrink-0', c.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {showLabel && c.label}
    </span>
  )
}
