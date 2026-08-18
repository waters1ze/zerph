'use client'

import { useEffect, useState } from 'react'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/app/page'

export default function TgPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Initialize Telegram WebApp SDK
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        try {
          tg.ready?.()
          tg.expand?.()
          if (typeof tg.enableClosingConfirmation === 'function') {
            try { tg.enableClosingConfirmation() } catch {}
          }
          const isDark = !document.documentElement.classList.contains('light')
          const bgHex = isDark ? '#090d16' : '#ffffff'
          if (tg.setHeaderColor) tg.setHeaderColor(bgHex)
          if (tg.setBackgroundColor) tg.setBackgroundColor(bgHex)
          if (tg.setBottomBarColor) tg.setBottomBarColor(bgHex)
        } catch (e) {
          console.error('Tg WebApp initialization error:', e)
        }
      }
      document.body.classList.add('telegram-webapp-mode')
    }

    return () => {
      if (typeof window !== 'undefined') {
        document.body.classList.remove('telegram-webapp-mode')
      }
    }
  }, [])

  if (!mounted) return null

  return (
    <div className="w-full h-full min-h-[100dvh] max-w-full overflow-hidden flex justify-center bg-background">
      <AppProvider>
        <AppShell forceMobileLayout={true} />
      </AppProvider>
    </div>
  )
}
