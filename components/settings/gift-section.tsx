'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Copy, Check, ExternalLink, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthHeaders } from '@/lib/store'
import { PlanId } from '@/lib/plans'

interface UserGift {
  id: string
  code: string
  targetPlan: string
  durationDays: number
  isUsed: boolean
  usedCount: number
  createdAt: string
  activationUrl: string
}

export function GiftSection() {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('plus')
  const [selectedDays, setSelectedDays] = useState<30 | 365>(30)
  const [loading, setLoading] = useState(false)
  const [giftsLoading, setGiftsLoading] = useState(false)
  const [gifts, setGifts] = useState<UserGift[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchGifts = async () => {
    setGiftsLoading(true)
    try {
      const res = await fetch('/api/gift', {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setGifts(data.gifts || [])
      }
    } catch {}
    finally {
      setGiftsLoading(false)
    }
  }

  useEffect(() => {
    fetchGifts()
  }, [])

  const handleBuyGift = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gift', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: selectedPlan,
          days: selectedDays,
        }),
      })
      const data = await res.json()
      if (data.success && data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank')
      } else {
        setNotification({ type: 'error', text: data.error || 'Ошибка создания подарка' })
        setTimeout(() => setNotification(null), 4000)
      }
    } catch {
      setNotification({ type: 'error', text: 'Ошибка соединения' })
      setTimeout(() => setNotification(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  const copyLink = (text: string, code: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  const giftPrice = selectedPlan === 'plus'
    ? (selectedDays === 30 ? '99 ₽' : '1 009 ₽')
    : (selectedDays === 30 ? '299 ₽' : '3 049 ₽')

  return (
    <div className="space-y-4 font-sans">
      <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Подарить подписку другу</h4>
              <p className="text-xs text-muted-foreground">
                Оплатите подарочный промокод и отправьте красивую ссылку для мгновенной активации в боте
              </p>
            </div>
          </div>
        </div>

        {/* Plan Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setSelectedPlan('plus'); setSelectedDays(30); }}
            className={cn(
              'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
              selectedPlan === 'plus' && selectedDays === 30
                ? 'bg-primary/10 border-primary text-foreground shadow-xs font-bold'
                : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40'
            )}
          >
            <span className="text-xs">Plus • 1 месяц</span>
            <span className="text-sm font-bold text-primary mt-1">99 ₽</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedPlan('plus'); setSelectedDays(365); }}
            className={cn(
              'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
              selectedPlan === 'plus' && selectedDays === 365
                ? 'bg-primary/10 border-primary text-foreground shadow-xs font-bold'
                : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40'
            )}
          >
            <span className="text-xs">Plus • 1 год ⭐</span>
            <span className="text-sm font-bold text-primary mt-1">1 009 ₽</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedPlan('pro'); setSelectedDays(30); }}
            className={cn(
              'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
              selectedPlan === 'pro' && selectedDays === 30
                ? 'bg-primary/10 border-primary text-foreground shadow-xs font-bold'
                : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40'
            )}
          >
            <span className="text-xs">Pro • 1 месяц</span>
            <span className="text-sm font-bold text-amber-500 mt-1">299 ₽</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedPlan('pro'); setSelectedDays(365); }}
            className={cn(
              'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
              selectedPlan === 'pro' && selectedDays === 365
                ? 'bg-primary/10 border-primary text-foreground shadow-xs font-bold'
                : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40'
            )}
          >
            <span className="text-xs">Pro • 1 год 🚀</span>
            <span className="text-sm font-bold text-amber-500 mt-1">3 049 ₽</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            К оплате: <span className="font-bold text-foreground text-sm">{giftPrice}</span>
          </div>
          <button
            type="button"
            onClick={handleBuyGift}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
            <span>Оформить подарок ({giftPrice})</span>
          </button>
        </div>
      </div>

      {/* Purchased / Created Gifts History */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Ваши купленные подарки ({gifts.length})
          </h5>
          <button
            type="button"
            onClick={fetchGifts}
            disabled={giftsLoading}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={cn('w-3 h-3', giftsLoading && 'animate-spin')} />
            <span>Обновить</span>
          </button>
        </div>

        {gifts.length === 0 ? (
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 text-center text-xs text-muted-foreground">
            У вас пока нет купленных подарков
          </div>
        ) : (
          <div className="space-y-2">
            {gifts.map(g => (
              <div
                key={g.id}
                className="p-3.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-foreground bg-muted px-2 py-0.5 rounded-md border">
                      {g.code}
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {g.targetPlan.toUpperCase()} • {g.durationDays} дн.
                    </span>
                    {g.isUsed ? (
                      <span className="px-2 py-0.2 text-[10px] font-bold rounded-full bg-muted text-muted-foreground">
                        Активирован
                      </span>
                    ) : (
                      <span className="px-2 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Готов к отправке
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Создан: {new Date(g.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(g.activationUrl, g.code)}
                    className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium border border-border transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode === g.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === g.code ? 'Ссылка скопирована!' : 'Скопировать ссылку'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
