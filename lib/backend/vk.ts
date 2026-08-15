/**
 * VK (ВКонтакте) Integration Library for Zerf AI
 * 
 * Capabilities:
 * 1. VK Bot messaging (messages.send)
 * 2. VK Community wall posting (wall.post) for daily news & digests
 * 3. VK Audio Message transcription (Groq Whisper)
 * 4. VK Mini Apps launch params validation & authentication
 */

import { GROQ_API_KEY } from '@/lib/config'

const VK_API_VERSION = '5.199'
const VK_API_BASE = 'https://api.vk.com/method'

export function getVkGroupToken(): string | null {
  return process.env.VK_GROUP_TOKEN || process.env.VK_API_KEY || null
}

export function getVkGroupId(): string | null {
  const raw = process.env.VK_GROUP_ID || null
  if (!raw) return null
  return raw.replace(/^-/, '') // ensure positive group id
}

export function getVkConfirmationCode(): string {
  return process.env.VK_CONFIRMATION_CODE || 'zerf_vk_confirm_code'
}

export function getVkSecretKey(): string | null {
  return process.env.VK_SECRET_KEY || null
}

/** Call any VK API method */
export async function callVkApi(method: string, params: Record<string, any>): Promise<any> {
  const token = getVkGroupToken()
  if (!token) {
    console.warn(`[VK API] Cannot call ${method}: VK_GROUP_TOKEN is not configured`)
    return null
  }

  const formData = new URLSearchParams()
  formData.append('access_token', token)
  formData.append('v', VK_API_VERSION)

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      if (typeof v === 'object') {
        formData.append(k, JSON.stringify(v))
      } else {
        formData.append(k, String(v))
      }
    }
  }

  try {
    const res = await fetch(`${VK_API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })
    const data = await res.json()
    if (data.error) {
      console.error(`[VK API] Error in ${method}:`, data.error)
    }
    return data
  } catch (err) {
    console.error(`[VK API] Network error in ${method}:`, err)
    return null
  }
}

/** Send message to a VK User */
export async function sendVkMessage(
  userId: number | string,
  message: string,
  keyboard?: any
): Promise<boolean> {
  const randomId = Math.floor(Math.random() * 2147483647)
  const params: Record<string, any> = {
    user_id: Number(userId),
    random_id: randomId,
    message: message,
    dont_parse_links: 0,
  }

  if (keyboard) {
    params.keyboard = keyboard
  }

  const res = await callVkApi('messages.send', params)
  return Boolean(res && !res.error)
}

/** Post an article/digest to VK Community Wall */
export async function postToVkWall(
  text: string,
  groupId?: string | number
): Promise<boolean> {
  const gid = groupId || getVkGroupId()
  if (!gid) {
    console.warn('[VK Wall] Cannot post: VK_GROUP_ID is not configured')
    return false
  }

  // Clean HTML tags into clean VK wall text
  const cleanText = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<b>(.*?)<\/b>/gi, '$1')
    .replace(/<i>(.*?)<\/i>/gi, '$1')
    .replace(/<code>(.*?)<\/code>/gi, '$1')
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, '«$1»\n')
    .replace(/<a\s+href="([^"]+)">([^<]+)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]*>/g, '')

  const ownerId = -Math.abs(Number(gid)) // Community wall owner_id is negative in VK
  const params = {
    owner_id: ownerId,
    from_group: 1,
    message: cleanText,
  }

  const res = await callVkApi('wall.post', params)
  if (res?.response?.post_id) {
    console.log(`[VK Wall] Successfully posted to VK community #${gid}, post_id: ${res.response.post_id}`)
    return true
  }
  return false
}

/** Transcribe VK voice message / audio attachment using Groq Whisper */
export async function transcribeVkVoice(audioUrl: string): Promise<string> {
  if (!GROQ_API_KEY) return ''

  try {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) return ''
    const arrayBuffer = await audioRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const formData = new FormData()
    const blob = new Blob([buffer], { type: 'audio/ogg' })
    formData.append('file', blob, 'voice.ogg')
    formData.append('model', 'whisper-large-v3')
    formData.append('language', 'ru')
    formData.append('response_format', 'json')

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    })

    if (!whisperRes.ok) return ''
    const data = await whisperRes.json()
    return data?.text?.trim() || ''
  } catch (err) {
    console.error('[VK Voice] Transcription error:', err)
    return ''
  }
}
