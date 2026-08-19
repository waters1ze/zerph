/**
 * Zerf Web Push Notification Engine
 * Sends background push notifications to Desktop/Mobile browsers even when tab is closed.
 */

import webpush from 'web-push'
import { prisma } from './prisma'

interface VapidKeys {
  publicKey: string
  privateKey: string
}

let cachedVapidKeys: VapidKeys | null = null

/**
 * Retrieves or auto-generates VAPID keys, persisting them to Prisma Config table.
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

  // 3. Auto-generate new VAPID key pair once and store in Database
  const generated = webpush.generateVAPIDKeys()
  cachedVapidKeys = generated

  try {
    await prisma.config.upsert({
      where: { key: 'system_vapid_keys' },
      update: { value: JSON.stringify(generated) },
      create: { key: 'system_vapid_keys', value: JSON.stringify(generated) },
    })
  } catch (err) {
    console.error('Failed to save generated VAPID keys to DB:', err)
  }

  webpush.setVapidDetails('mailto:admin@zerf.app', generated.publicKey, generated.privateKey)
  return generated
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

/**
 * Sends a web push notification to a registered user by chatId
 */
export async function sendWebPushNotification(
  chatId: string | number | bigint,
  payload: WebPushPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await getVapidKeys()
    const cid = String(chatId)

    const row = await prisma.config.findUnique({
      where: { key: `user_push_subscription_${cid}` },
    })

    if (!row?.value) {
      return { success: false, error: 'No subscription found' }
    }

    const subscription = JSON.parse(row.value)
    if (!subscription.endpoint) {
      return { success: false, error: 'Invalid subscription object' }
    }

    const dataToSend = JSON.stringify({
      title: payload.title || 'Zerf Note',
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      url: payload.url || '/',
      tag: payload.tag || `zerf-push-${Date.now()}`,
      data: payload.data || {},
    })

    await webpush.sendNotification(subscription, dataToSend, {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: 'high',
    })

    return { success: true }
  } catch (err: any) {
    // If subscription expired or was revoked (HTTP 410 / 404), clean it up from DB
    if (err.statusCode === 410 || err.statusCode === 404) {
      const cid = String(chatId)
      await prisma.config.delete({
        where: { key: `user_push_subscription_${cid}` },
      }).catch(() => {})
      return { success: false, error: 'Subscription expired and removed' }
    }

    console.error('Web Push delivery error:', err)
    return { success: false, error: err.message || String(err) }
  }
}
