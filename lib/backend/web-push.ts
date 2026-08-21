/**
 * Zerf Web Push Notification Engine
 * Sends background push notifications to Desktop/Mobile browsers even when tab is closed.
 * Supports multiple registered devices per user (PC, iOS Safari PWA, Android Chrome, etc.)
 */

import webpush from 'web-push'
import { prisma } from './prisma'

interface VapidKeys {
  publicKey: string
  privateKey: string
}

const DEFAULT_VAPID_PUBLIC_KEY = 'BCrELgMn65bAWDnsnFk28O3v-JEtpBhJCOo8daLvAg15I0azzSCjZc-MDCndR3AJ9H3y3FCpfZtZ3tIZoNXd_fU'
const DEFAULT_VAPID_PRIVATE_KEY = 'k9j28Oxa5yCUQaEadBqExJoHLTAEo5XQlj5VCtlhGAU'

let cachedVapidKeys: VapidKeys | null = null

/**
 * Retrieves VAPID keys (from Env vars, DB, or stable system defaults).
 */
export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedVapidKeys) return cachedVapidKeys

  // 1. Check environment variables first
  const envPublic = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const envPrivate = process.env.VAPID_PRIVATE_KEY
  if (envPublic && envPrivate) {
    cachedVapidKeys = { publicKey: envPublic, privateKey: envPrivate }
    webpush.setVapidDetails('mailto:admin@zerf.app', envPublic, envPrivate)
    return cachedVapidKeys
  }

  // 2. Check Database config
  try {
    const row = await prisma.config.findUnique({ where: { key: 'system_vapid_keys' } })
    if (row?.value) {
      const parsed = JSON.parse(row.value) as VapidKeys
      if (parsed.publicKey && parsed.privateKey) {
        cachedVapidKeys = parsed
        webpush.setVapidDetails('mailto:admin@zerf.app', parsed.publicKey, parsed.privateKey)
        return cachedVapidKeys
      }
    }
  } catch {}

  // 3. Fallback to stable system VAPID keys
  const stableKeys: VapidKeys = {
    publicKey: DEFAULT_VAPID_PUBLIC_KEY,
    privateKey: DEFAULT_VAPID_PRIVATE_KEY,
  }
  cachedVapidKeys = stableKeys

  try {
    await prisma.config.upsert({
      where: { key: 'system_vapid_keys' },
      update: { value: JSON.stringify(stableKeys) },
      create: { key: 'system_vapid_keys', value: JSON.stringify(stableKeys) },
    })
  } catch {}

  webpush.setVapidDetails('mailto:admin@zerf.app', stableKeys.publicKey, stableKeys.privateKey)
  return stableKeys
}

/**
 * Returns public VAPID key for browser subscription
 */
export async function getVapidPublicKey(): Promise<string> {
  const keys = await getVapidKeys()
  return keys.publicKey
}

export interface WebPushPayload {
  title: string
  body?: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  data?: any
}

export interface StoredSubscription {
  endpoint: string
  keys?: {
    p256dh?: string
    auth?: string
  }
  expirationTime?: number | null
  addedAt?: number
}

/**
 * Retrieves all registered push subscriptions for a user across all their devices
 */
export async function getUserPushSubscriptions(chatId: string | number | bigint): Promise<StoredSubscription[]> {
  const cid = String(chatId)
  const subscriptions: StoredSubscription[] = []
  const seenEndpoints = new Set<string>()

  try {
    const [multiRow, singleRow] = await Promise.all([
      prisma.config.findUnique({ where: { key: `user_push_subscriptions_${cid}` } }),
      prisma.config.findUnique({ where: { key: `user_push_subscription_${cid}` } }),
    ])

    if (multiRow?.value) {
      try {
        const list = JSON.parse(multiRow.value)
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item?.endpoint && !seenEndpoints.has(item.endpoint)) {
              subscriptions.push(item)
              seenEndpoints.add(item.endpoint)
            }
          }
        }
      } catch {}
    }

    if (singleRow?.value) {
      try {
        const single = JSON.parse(singleRow.value)
        if (single?.endpoint && !seenEndpoints.has(single.endpoint)) {
          subscriptions.push(single)
          seenEndpoints.add(single.endpoint)
        }
      } catch {}
    }
  } catch (err) {
    console.error('[WebPush] Error fetching subscriptions for user:', cid, err)
  }

  return subscriptions
}

/**
 * Saves or updates a device push subscription for a user
 */
export async function saveUserPushSubscription(
  chatId: string | number | bigint,
  sub: StoredSubscription
): Promise<boolean> {
  if (!sub || !sub.endpoint) return false
  const cid = String(chatId)

  try {
    const existing = await getUserPushSubscriptions(cid)
    const updated = existing.filter(s => s.endpoint !== sub.endpoint)
    updated.push({
      ...sub,
      addedAt: Date.now(),
    })

    // Keep at most 10 active devices per user
    const capped = updated.slice(-10)

    await Promise.all([
      prisma.config.upsert({
        where: { key: `user_push_subscriptions_${cid}` },
        update: { value: JSON.stringify(capped) },
        create: { key: `user_push_subscriptions_${cid}`, value: JSON.stringify(capped) },
      }),
      prisma.config.upsert({
        where: { key: `user_push_subscription_${cid}` },
        update: { value: JSON.stringify(sub) },
        create: { key: `user_push_subscription_${cid}`, value: JSON.stringify(sub) },
      }),
    ])

    return true
  } catch (err) {
    console.error('[WebPush] Failed to save push subscription:', err)
    return false
  }
}

/**
 * Removes a specific device endpoint from a user's subscription list
 */
export async function removeUserPushSubscription(
  chatId: string | number | bigint,
  endpoint: string
): Promise<void> {
  const cid = String(chatId)
  try {
    const existing = await getUserPushSubscriptions(cid)
    const filtered = existing.filter(s => s.endpoint !== endpoint)

    await prisma.config.upsert({
      where: { key: `user_push_subscriptions_${cid}` },
      update: { value: JSON.stringify(filtered) },
      create: { key: `user_push_subscriptions_${cid}`, value: JSON.stringify(filtered) },
    })

    if (filtered.length === 0) {
      await prisma.config.delete({ where: { key: `user_push_subscription_${cid}` } }).catch(() => {})
    } else {
      await prisma.config.upsert({
        where: { key: `user_push_subscription_${cid}` },
        update: { value: JSON.stringify(filtered[filtered.length - 1]) },
        create: { key: `user_push_subscription_${cid}`, value: JSON.stringify(filtered[filtered.length - 1]) },
      }).catch(() => {})
    }
  } catch {}
}

/**
 * Sends a web push notification to ALL registered devices of a user by chatId.
 * Automatically cleans up expired/revoked device subscriptions.
 */
export async function sendWebPushNotification(
  chatId: string | number | bigint,
  payload: WebPushPayload
): Promise<{ success: boolean; delivered?: number; total?: number; error?: string }> {
  try {
    await getVapidKeys()
    const cid = String(chatId)
    const subscriptions = await getUserPushSubscriptions(cid)

    if (subscriptions.length === 0) {
      return { success: false, error: 'No active device push subscriptions found for user' }
    }

    const dataToSend = JSON.stringify({
      title: payload.title || 'Zerf Note',
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      url: payload.url || '/',
      tag: payload.tag || `zerf-push-${Date.now()}`,
      data: {
        url: payload.url || '/',
        timestamp: Date.now(),
        ...(payload.data || {}),
      },
    })

    const deadEndpoints: string[] = []
    let deliveredCount = 0

    await Promise.allSettled(
      subscriptions.map(async sub => {
        try {
          await webpush.sendNotification(sub as any, dataToSend, {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: 'high',
          })
          deliveredCount++
        } catch (err: any) {
          // If subscription expired or was revoked (HTTP 410 / 404 / 400), queue for cleanup
          if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 400) {
            deadEndpoints.push(sub.endpoint)
          } else {
            console.warn('[WebPush] Delivery warning to endpoint:', sub.endpoint.slice(0, 30), err.message || err)
          }
        }
      })
    )

    // Clean up dead endpoints
    if (deadEndpoints.length > 0) {
      for (const dead of deadEndpoints) {
        await removeUserPushSubscription(cid, dead).catch(() => {})
      }
    }

    return {
      success: deliveredCount > 0,
      delivered: deliveredCount,
      total: subscriptions.length,
    }
  } catch (err: any) {
    console.error('[WebPush] Error during sendWebPushNotification:', err)
    return { success: false, error: err.message || String(err) }
  }
}
