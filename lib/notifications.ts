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
          sub = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
          })
        }
      }

      const chatId =
        localStorage.getItem('zerf_chat_id') ||
        sessionStorage.getItem('zerf_chat_id') ||
        null

      if (sub) {
        const authToken = localStorage.getItem('zerf_auth_token') || ''
        const initData = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData || ''
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (chatId) headers['x-chat-id'] = chatId
        if (authToken) headers['x-auth-token'] = authToken
        if (initData) headers['x-tg-init-data'] = initData

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers,
          body: JSON.stringify({ subscription: sub.toJSON(), chatId }),
        }).catch(() => {})
      }
    } catch (err) {
      console.warn('Web push subscription failed:', err)
    }
  }

  return granted
}

export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') return { success: false, message: 'Окно недоступно' }
  if (!('Notification' in window)) {
    return { success: false, message: 'Ваш браузер не поддерживает Push-уведомления' }
  }

  const granted = await requestNotificationPermission()
  if (!granted) {
    return {
      success: false,
      message: 'Уведомления заблокированы. Разрешите их в настройках браузера или сайта (значок замка в адресной строке).'
    }
  }

  showWebNotification('🔔 Тестовый Пуш от Zerf Note', {
    body: 'Ура! Пуш-уведомления успешно работают на вашем устройстве (ПК и телефон)! 🎉',
    tag: 'zerf-test-push',
    requireInteraction: true,
  })

  // Also hit the test endpoint for analytics
  fetch('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Тестовый пуш', message: 'Успешно доставлено' }),
  }).catch(() => {})

  return { success: true, message: 'Тестовый пуш успешно отправлен!' }
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

  if ('Notification' in window && Notification.permission === 'granted') {
    let shown = false

    // 1. Try service worker notification first (best background support on mobile & desktop)
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
          shown = true
        })
        .catch(() => {})
    }

    if (!shown) {
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

  // Trigger synthesized audio alarm & vibration
  playAlarmChime('alarm')
  vibrateDevice([200, 100, 200, 100, 300])
}

export function vibrateDevice(pattern: number[] = [200, 100, 200]) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {}
  }
}

/** Synthesize a pleasant high-quality chime using Web Audio API (no external file needed) */
export function playAlarmChime(type: 'chime' | 'alarm' | 'complete' | 'tick' = 'alarm') {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

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
