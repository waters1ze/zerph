function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function getStoredCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'))
  return matches ? decodeURIComponent(matches[1]) : null
}

function getClientAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window === 'undefined') return headers

  const chatId = localStorage.getItem('zerf_chat_id') || sessionStorage.getItem('zerf_chat_id') || getStoredCookie('zerf_chat_id')
  const authToken = localStorage.getItem('zerf_auth_token') || getStoredCookie('zerf_auth_token')
  const initData = (window as any).Telegram?.WebApp?.initData || ''
  const vkLaunch = localStorage.getItem('zerf_vk_launch') || ''

  if (chatId) headers['x-chat-id'] = chatId
  if (authToken) headers['x-auth-token'] = authToken
  if (initData) headers['x-tg-init-data'] = initData
  if (vkLaunch) headers['x-vk-launch'] = vkLaunch

  return headers
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  // Register service worker if supported
  let swReg: ServiceWorkerRegistration | null = null
  if ('serviceWorker' in navigator) {
    try {
      swReg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
    } catch {}
  }

  let granted = Notification.permission === 'granted'

  if (!granted && Notification.permission !== 'denied') {
    try {
      const perm = await Notification.requestPermission()
      granted = perm === 'granted'
    } catch {
      granted = false
    }
  }

  if (granted && swReg && 'pushManager' in swReg) {
    try {
      let sub = await swReg.pushManager.getSubscription()
      
      if (!sub) {
        // Fetch VAPID public key from backend
        const res = await fetch('/api/push/subscribe').catch(() => null)
        const data = await res?.json().catch(() => null)
        if (data?.publicKey) {
          const convertedKey = urlBase64ToUint8Array(data.publicKey)
          try {
            sub = await swReg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey,
            })
          } catch {
            const oldSub = await swReg.pushManager.getSubscription().catch(() => null)
            if (oldSub) await oldSub.unsubscribe().catch(() => {})
            sub = await swReg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey,
            }).catch(() => null)
          }
        }
      }

      const chatId =
        localStorage.getItem('zerf_chat_id') ||
        sessionStorage.getItem('zerf_chat_id') ||
        getStoredCookie('zerf_chat_id') ||
        null

      if (sub && chatId) {
        const headers = getClientAuthHeaders()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers,
          body: JSON.stringify({ subscription: sub.toJSON(), chatId }),
        }).catch(() => {})
        console.log('[WebPush] Device push subscription registered for chatId:', chatId)
      }
    } catch (err) {
      console.warn('Web push subscription failed:', err)
    }
  }

  return granted
}

/**
 * Ensures background push subscription is healthy without triggering permission prompts
 */
export async function ensurePushSubscribedOnBoot(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    if ('serviceWorker' in navigator) {
      const swReg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      if ('pushManager' in swReg) {
        let sub = await swReg.pushManager.getSubscription()
        if (!sub) {
          const res = await fetch('/api/push/subscribe').catch(() => null)
          const data = await res?.json().catch(() => null)
          if (data?.publicKey) {
            const convertedKey = urlBase64ToUint8Array(data.publicKey)
            try {
              sub = await swReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey,
              })
            } catch {
              const oldSub = await swReg.pushManager.getSubscription().catch(() => null)
              if (oldSub) await oldSub.unsubscribe().catch(() => {})
              sub = await swReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey,
              }).catch(() => null)
            }
          }
        }

        const chatId =
          localStorage.getItem('zerf_chat_id') ||
          sessionStorage.getItem('zerf_chat_id') ||
          getStoredCookie('zerf_chat_id') ||
          null

        if (sub && chatId) {
          const headers = getClientAuthHeaders()
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({ subscription: sub.toJSON(), chatId }),
          }).catch(() => {})
          console.log('[WebPush] Device push subscription verified for chatId:', chatId)
        }
      }
    }
  } catch (e) {
    console.warn('[Push] Background sync notice:', e)
  }
}

export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') return { success: false, message: 'Окно недоступно' }
  if (!('Notification' in window)) {
    return { success: false, message: 'Ваш браузер не поддерживает Push-уведомления' }
  }

  const granted = await requestNotificationPermission()
  // Double-check the actual browser permission state — some browsers report
  // 'default' even after the request resolves
  const effectiveGranted = granted && typeof Notification !== 'undefined' && Notification.permission === 'granted'
  if (!effectiveGranted) {
    return {
      success: false,
      message: Notification.permission === 'denied'
        ? 'Уведомления ЗАБЛОКИРОВАНЫ браузером. Нажмите на значок замка в адресной строке → Уведомления → Разрешить, затем перезагрузите страницу.'
        : 'Разрешение на уведомления не выдано. Разрешите уведомления во всплывающем окне браузера и попробуйте снова.'
    }
  }

  showWebNotification('🔔 Тестовый Пуш от Zerf Note', {
    body: 'Ура! Пуш-уведомления успешно работают на вашем устройстве (ПК и телефон)! 🎉',
    tag: 'zerf-test-push',
    requireInteraction: true,
  })

  // Hit the backend push test endpoint with full credentials
  const chatId =
    localStorage.getItem('zerf_chat_id') ||
    sessionStorage.getItem('zerf_chat_id') ||
    getStoredCookie('zerf_chat_id') ||
    null

  try {
    const headers = getClientAuthHeaders()
    await fetch('/api/push/test', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: '🔔 Тестовый пуш Zerf Note',
        message: 'Пуш-уведомление успешно доставлено на ваше устройство! 🚀',
        chatId,
      }),
    })
  } catch {}

  return { success: true, message: 'Тестовый пуш успешно отправлен на ваши устройства!' }
}

export function showWebNotification(
  title: string,
  options?: {
    body?: string
    icon?: string
    tag?: string
    requireInteraction?: boolean
    onClick?: () => void
  }
) {
  if (typeof window === 'undefined') return

  const defaultBody = 'Zerf Note — Умное напоминание'
  const defaultIcon = options?.icon || '/icon-192.png'
  const tag = options?.tag || `zerf-${Date.now()}`

  let shown = false

  if ('Notification' in window && Notification.permission === 'granted') {
    shown = true
    // Show via service worker when available; fall back to the Notification
    // constructor ONLY if the SW path fails — otherwise the user gets duplicates.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => {
          reg.showNotification(title, {
            body: options?.body || defaultBody,
            icon: defaultIcon,
            badge: defaultIcon,
            tag,
            renotify: true,
            vibrate: [200, 100, 200, 100, 300],
            requireInteraction: options?.requireInteraction ?? true,
          } as any)
        })
        .catch(() => {
          try {
            const notif = new Notification(title, {
              body: options?.body || defaultBody,
              icon: defaultIcon,
              tag,
              requireInteraction: options?.requireInteraction ?? true,
            })
            if (options?.onClick) {
              notif.onclick = () => {
                window.focus()
                options.onClick!()
                notif.close()
              }
            }
          } catch {}
        })
    } else {
      try {
        const notif = new Notification(title, {
          body: options?.body || defaultBody,
          icon: defaultIcon,
          tag,
          requireInteraction: options?.requireInteraction ?? true,
        })
        if (options?.onClick) {
          notif.onclick = () => {
            window.focus()
            options.onClick!()
            notif.close()
          }
        }
      } catch {}
    }
  }

  // Trigger audio alarm & vibration only when notification is active
  if (shown) {
    playAlarmChime('alarm')
    vibrateDevice([200, 100, 200, 100, 300])
  }
}

export function vibrateDevice(pattern: number[] = [200, 100, 200]) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {}
  }
}

// Reuse a single AudioContext — browsers cap the number of live contexts (~6),
// and creating one per chime eventually silences all alarms.
let sharedAudioCtx: AudioContext | null = null

/** Synthesize a pleasant high-quality chime using Web Audio API (no external file needed) */
export function playAlarmChime(type: 'chime' | 'alarm' | 'complete' | 'tick' = 'alarm') {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx()
    }
    const ctx = sharedAudioCtx

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    if (type === 'tick') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.05)
      return
    }

    if (type === 'complete') {
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const startTime = ctx.currentTime + idx * 0.12

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(startTime)
        osc.stop(startTime + 0.6)
      })
      return
    }

    if (type === 'alarm') {
      // 3 double-beeps
      const freqs = [880, 1174.66]
      for (let r = 0; r < 3; r++) {
        freqs.forEach((freq, fIdx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          const startTime = ctx.currentTime + r * 0.5 + fIdx * 0.15

          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, startTime)
          gain.gain.setValueAtTime(0, startTime)
          gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25)

          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(startTime)
          osc.stop(startTime + 0.25)
        })
      }
      return
    }

    // Default gentle chime
    const notes = [587.33, 880] // D5, A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const startTime = ctx.currentTime + idx * 0.15

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + 0.5)
    })
  } catch (e) {
    console.error('Audio chime error:', e)
  }
}
