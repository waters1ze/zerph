'use client'

import { useEffect, useState } from 'react'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/app/page'

export default function TgPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Initialize Telegram WebApp SDK with dark theme matching the site
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp
      if (tg) {
        try {
          tg.ready?.()
          tg.expand?.()
          if (tg.setHeaderColor) tg.setHeaderColor('#090d16')
          if (tg.setBackgroundColor) tg.setBackgroundColor('#090d16')
        } catch (e) {
          console.error('Tg WebApp initialization error:', e)
        }
      }
    }
  }, [])

  if (!mounted) return null

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
