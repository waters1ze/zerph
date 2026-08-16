'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
}

type ConfirmContextType = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmContextType | null>(null)

let globalConfirmHandler: ((options: ConfirmOptions) => Promise<boolean>) | null = null

/**
 * Universal confirm function that works in components and event handlers
 */
export function appConfirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string'
    ? { title: options, variant: 'danger' }
    : options

  if (globalConfirmHandler) {
    return globalConfirmHandler(opts)
  }
  // Fallback if provider not mounted
  return Promise.resolve(window.confirm(opts.description ? `${opts.title}\n\n${opts.description}` : opts.title))
}

export function useConfirmDialog() {
  const context = useContext(ConfirmContext)
  if (!context) {
    return appConfirm
  }
  return context
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    options: ConfirmOptions
  }>({
    isOpen: false,
    options: { title: '' },
  })

  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setDialogState({
        isOpen: true,
        options: {
          confirmText: options.variant === 'danger' ? 'Удалить' : 'Подтвердить',
          cancelText: 'Отмена',
          variant: 'danger',
          ...options,
        },
      })
    })
  }, [])

  globalConfirmHandler = confirm

  const handleClose = (result: boolean) => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
    }
  }

  const { title, description, confirmText, cancelText, variant } = dialogState.options

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <AnimatePresence>
        {dialogState.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleClose(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-md"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md bg-card border border-border/80 shadow-2xl rounded-2xl p-5 overflow-hidden font-sans"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                  variant === 'danger' && 'bg-destructive/15 text-destructive border border-destructive/20',
                  variant === 'warning' && 'bg-amber-500/15 text-amber-500 border border-amber-500/20',
                  variant === 'primary' && 'bg-primary/15 text-primary border border-primary/20'
                )}>
                  {variant === 'danger' && <Trash2 className="w-5 h-5" />}
                  {variant === 'warning' && <AlertTriangle className="w-5 h-5" />}
                  {variant === 'primary' && <HelpCircle className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground leading-snug">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleClose(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 mt-6 pt-2 border-t border-border/40">
                <button
                  onClick={() => handleClose(false)}
                  className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  {cancelText || 'Отмена'}
                </button>
                <button
                  autoFocus
                  onClick={() => handleClose(true)}
                  className={cn(
                    'h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95',
                    variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                    variant === 'warning' && 'bg-amber-500 text-black hover:bg-amber-600',
                    variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {confirmText || 'Подтвердить'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}
