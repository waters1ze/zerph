'use client'

import { useEffect, useState } from 'react'
import { AppProvider } from '@/lib/store'
import { AppShell } from '@/app/page'
import { ZerficLiveProvider } from '@/lib/zerfic-live-context'

export default function VkPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (typeof window !== 'undefined') {
      try {
        // 1. Immediately signal VK Bridge initialization
        const initBridge = () => {
          const vkBridge = (window as any).vkBridge
          if (vkBridge && typeof vkBridge.send === 'function') {
            vkBridge.send('VKWebAppInit').catch(() => {})
          }
          if (window.parent && window.parent !== window) {
            try {
              window.parent.postMessage(JSON.stringify({ type: 'VKWebAppInit', data: {} }), '*')
              window.parent.postMessage({ type: 'VKWebAppInit', data: {} }, '*')
            } catch {}
          }
        }

        initBridge()
        // Retry shortly in case script loaded async
        setTimeout(initBridge, 100)
        setTimeout(initBridge, 500)

        // 2. Parse launch parameters from URL search / hash.
        //    vk_user_id is only accepted together with VK's cryptographic sign —
        //    the server verifies it via VK_APP_SECRET.
        const urlParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

        const vkUserId = urlParams.get('vk_user_id') || hashParams.get('vk_user_id')
        const vkSign = urlParams.get('sign') || hashParams.get('sign')

        if (vkUserId && /^\d+$/.test(vkUserId) && vkSign) {
          const allEntries = [
            ...Array.from(urlParams.entries()),
            ...Array.from(hashParams.entries()),
          ]
          const fullLaunch = allEntries
            .filter(([k]) => k.startsWith('vk_') || k === 'sign')
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&')
          localStorage.setItem('zerf_chat_id', vkUserId)
          localStorage.setItem('zerf_vk_launch', fullLaunch)
          document.cookie = `zerf_chat_id=${vkUserId}; path=/; max-age=31536000`
        }

        // 3. Subscribe to VK Bridge events for appearance/theme
        const vkBridge = (window as any).vkBridge
        if (vkBridge && typeof vkBridge.subscribe === 'function') {
          vkBridge.subscribe((e: any) => {
            if (e.detail?.type === 'VKWebAppUpdateConfig') {
              const scheme = e.detail?.data?.scheme
              if (scheme && (scheme.includes('dark') || scheme.includes('space'))) {
                document.documentElement.classList.add('dark')
              }
            }
          })
        }
      } catch (e) {
        console.error('VK Mini App initialization error:', e)
      }
    }
  }, [])

  if (!mounted) return null

  return (
    <AppProvider>
      {/* AppShell renders the Zerfic Live floating pill, which requires the
          provider context — without it the /vk page crashed with
          "useZerficLive must be used within a ZerficLiveProvider". */}
      <ZerficLiveProvider>
        <AppShell />
      </ZerficLiveProvider>
    </AppProvider>
  )
}
