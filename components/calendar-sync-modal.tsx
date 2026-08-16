'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Copy, Check, X, RefreshCw, Smartphone, ExternalLink, ShieldCheck } from 'lucide-react'
import { getAuthHeaders } from '@/lib/store'
import { cn } from '@/lib/utils'

interface CalendarSyncModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CalendarSyncModal({ isOpen, onClose }: CalendarSyncModalProps) {
  const [calFeedUrl, setCalFeedUrl] = useState('')
  const [webcalUrl, setWebcalUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchToken = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar/token', {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setCalFeedUrl(data.httpsUrl || '')
        setWebcalUrl(data.webcalUrl || '')
      }
    } catch {}
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchToken()
    }
  }, [isOpen])

  const copyUrl = () => {
    const link = webcalUrl || calFeedUrl
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Синхронизация с Календарями</h3>
                <p className="text-xs text-muted-foreground">
                  Apple Календарь, Google Calendar, Outlook
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Ваша персональная ссылка подписки (iCal / Webcal):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webcalUrl || calFeedUrl || 'Загрузка ссылки…'}
                  className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs text-foreground font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано!' : 'Скопировать'}</span>
                </button>
              </div>
            </div>

            {/* Instruction Tabs */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-3 text-xs">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Инструкция по подключению:</span>
              </div>
              
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <div>
                  <span className="font-semibold text-foreground">🍏 iPhone / iPad / Mac:</span>
                  <p className="pl-3 mt-0.5">
                    Откройте приложение «Календарь» → «Файл» (или «Календари» внизу) → «Новая подписка на календарь» → вставьте скопированную ссылку.
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-foreground">📅 Google Календарь:</span>
                  <p className="pl-3 mt-0.5">
                    Откройте Google Календарь на компьютере → слева найдите «Другие календари» → нажмите «+» → «Добавить по URL» → вставьте ссылку.
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-foreground">⚡ Автоматическое обновление:</span>
                  <p className="pl-3 mt-0.5">
                    Все ваши созданные задачи и дедлайны появляются в календаре автоматически с напоминаниями.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 cursor-pointer"
            >
              Готово
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
