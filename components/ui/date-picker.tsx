'use client'

import { useRef } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: string      // ISO date string "YYYY-MM-DD" or undefined = no date
  onChange: (value: string | undefined) => void
  className?: string
  placeholder?: string
}

export function DatePicker({ value, onChange, className, placeholder = 'No date' }: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const formatted = value
    ? format(parseISO(value), 'dd.MM.yyyy')
    : null

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer',
        'bg-muted/50 border border-border text-[12px] font-medium',
        'hover:bg-muted/80 hover:border-border/80 transition-all duration-150',
        className
      )}
      onClick={() => inputRef.current?.showPicker?.()}
    >
      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

      {/* Hidden native date input — positioned over the trigger for picker */}
      <input
        ref={inputRef}
        type="date"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || undefined)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        tabIndex={-1}
      />

      {/* Display text */}
      <span className={cn('flex-1 pointer-events-none', !formatted && 'text-muted-foreground')}>
        {formatted ?? placeholder}
      </span>

      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onChange(undefined) }}
          className={cn(
            'pointer-events-auto flex items-center justify-center',
            'w-4 h-4 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground',
            'transition-colors duration-100 shrink-0'
          )}
          title="Clear date"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
