'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  color?: string
  icon?: React.ReactNode
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  icon?: React.ReactNode
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  triggerClassName,
  icon,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg',
          'bg-muted/50 border border-border text-[12px] font-medium text-foreground',
          'hover:bg-muted/80 hover:border-border/80 transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-primary/40 bg-muted/80',
          triggerClassName
        )}
      >
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        {selected?.color && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selected.color }} />
        )}
        {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
        <span className={cn('flex-1 text-left truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute top-[calc(100%+4px)] left-0 z-[200]',
              'min-w-full w-max max-w-[240px]',
              'rounded-xl bg-popover border border-border',
              'shadow-xl shadow-black/20 backdrop-blur-sm',
              'py-1.5 overflow-hidden'
            )}
          >
            {options.map(opt => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium',
                    'transition-colors duration-100 cursor-pointer text-left',
                    isSelected
                      ? 'bg-primary/15 text-primary'
                      : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  {opt.color && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                  )}
                  {opt.icon && <span className="shrink-0 opacity-60">{opt.icon}</span>}
                  <span className="flex-1">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
