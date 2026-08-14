// Browser Web Notifications and Web Audio API synthesized chime/alarms

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission()
    return perm === 'granted'
  }

  return false
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
  if (typeof window === 'undefined' || !('Notification' in window)) return

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body: options?.body || 'Zerf AI Напоминание',
        icon: options?.icon || '/icon-192.png',
        tag: options?.tag || `zerf-${Date.now()}`,
        requireInteraction: options?.requireInteraction ?? true,
      })

      if (options?.onClick) {
        notif.onclick = () => {
          window.focus()
          options.onClick!()
          notif.close()
        }
      }
    } catch {
      // Fallback if ServiceWorker notification is required
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: options?.body || 'Zerf AI Напоминание',
            icon: options?.icon || '/icon-192.png',
            tag: options?.tag,
          })
        }).catch(() => {})
      }
    }
  }

  // Trigger sound alarm & vibration
  playAlarmChime()
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
