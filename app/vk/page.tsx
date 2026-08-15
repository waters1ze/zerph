'use client'

import { useEffect, useState } from 'react'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/app/page'

export default function VkPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (typeof window !== 'undefined') {
      try {
        // Parse VK Mini App launch parameters from search or hash
        const urlParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

        const vkUserId = urlParams.get('vk_user_id') || hashParams.get('vk_user_id') || urlParams.get('userId')
        const vkAppId = urlParams.get('vk_app_id') || hashParams.get('vk_app_id')

        if (vkUserId) {
          localStorage.setItem('zerf_chat_id', vkUserId)
          document.cookie = `zerf_chat_id=${vkUserId}; path=/; max-age=31536000`
        }

        // Initialize VK Bridge if available
        const vkBridge = (window as any).vkBridge
        if (vkBridge) {
          vkBridge.send('VKWebAppInit').catch(() => {})
        }
      } catch (e) {
        console.error('VK Mini App initialization error:', e)
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
