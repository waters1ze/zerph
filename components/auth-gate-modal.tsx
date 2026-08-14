'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Sparkles, Send, Lock, ArrowRight, ExternalLink } from 'lucide-react'
import { getTgChatId } from '@/lib/store'

export function AuthGateModal({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const [isAuth, setIsAuth] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      const chatId = getTgChatId()
      const hasAuth = Boolean(chatId && !chatId.startsWith('guest_'))
      setIsAuth(hasAuth)
    }
    checkAuth()
    window.addEventListener('storage', checkAuth)
    return () => window.removeEventListener('storage', checkAuth)
  }, [])

  const shouldOpen = open !== undefined ? open : (!isAuth && showModal)

  if (isAuth && open === undefined) return null

  return (
    <AnimatePresence>
      {shouldOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md bg-card border border-border/80 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-5 z-10"
          >
            {/* Background Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Icon */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-foreground flex items-center gap-1.5">
                  Вход в Zerf AI
                  <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Требуется авторизация через Telegram
                </p>
              </div>
            </div>

            {/* Explanatory text */}
            <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 text-[13px] text-muted-foreground leading-relaxed flex flex-col gap-2.5">
              <p>
                🔒 <strong className="text-foreground">Безопасность данных:</strong> создание и управление задачами доступно только авторизованным пользователям через Telegram-бота.
              </p>
              <div className="flex flex-col gap-1.5 text-[12px]">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  Откройте бота @Zerph_bot
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  Напишите команду <code className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono text-[11px]">/login</code>
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                  Нажмите кнопку «🔑 Войти в Zerf на устройстве»
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              <a
                href="https://t.me/Zerph_bot?start=login"
                target="_blank"
                rel="noreferrer"
                className="h-12 rounded-2xl bg-[#229ED9] hover:bg-[#1e8dbf] text-white font-medium text-[14px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#229ED9]/25 hover:shadow-xl"
              >
                <Send className="w-4 h-4" />
                <span>Войти через @Zerph_bot</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              {onClose && (
                <button
                  onClick={onClose}
                  className="h-10 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-[13px] font-medium transition-colors"
                >
                  Закрыть
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
