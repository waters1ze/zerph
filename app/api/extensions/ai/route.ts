import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getExtensionById } from '@/lib/backend/extensions'
import { checkInMemoryRateLimit } from '@/lib/backend/rate-limit'
import dns from 'dns/promises'
import crypto from 'crypto'

function isPrivateIp(ip: string): boolean {
  // IPv4 private & link-local ranges
  if (
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.') ||
    ip === '0.0.0.0'
  ) {
    return true
  }

  // 172.16.0.0 - 172.31.255.255
  const parts = ip.split('.').map(Number)
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true
  }

  // IPv6 loopback & unique local
  const lower = ip.toLowerCase()
  if (
    lower === '::1' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc00:') ||
    lower.startsWith('fd00:') ||
    lower.startsWith('::ffff:127.') ||
    lower.startsWith('::ffff:10.') ||
    lower.startsWith('::ffff:192.168.')
  ) {
    return true
  }

  return false
}

async function validateExtensionEndpoint(urlStr: string): Promise<{ safe: boolean; error?: string }> {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { safe: false, error: 'Невалидный URL' }
  }

  if (parsed.protocol !== 'https:') {
    return { safe: false, error: 'Разрешены только защищённые HTTPS адреса для AI-эндпоинтов' }
  }

  const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal', 'instance-data']
  if (BLOCKED_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return { safe: false, error: 'Локальные и служебные хосты запрещены' }
  }

  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true })
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: 'Не удалось разрезолвить хост эндпоинта' }
    }
    for (const { address } of addresses) {
      if (isPrivateIp(address)) {
        return { safe: false, error: 'Обращение к приватным IP-адресам заблокировано системой безопасности (SSRF Protection)' }
      }
    }
  } catch {
    return { safe: false, error: 'Хост недоступен или не существует' }
  }

  return { safe: true }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { extensionId, message, action, context } = body

    if (!extensionId || !message) {
      return NextResponse.json({ error: 'extensionId and message are required' }, { status: 400 })
    }

    const ext = await getExtensionById(extensionId)
    if (!ext) {
      return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })
    }

    const aiEndpoint = ext.content?.aiEndpoint || ext.content?.endpoint
    if (!aiEndpoint) {
      return NextResponse.json({ error: 'У этого расширения не настроен внешний AI-сервер (aiEndpoint)' }, { status: 400 })
    }

    // Strict SSRF validation
    const ssrfCheck = await validateExtensionEndpoint(aiEndpoint)
    if (!ssrfCheck.safe) {
      return NextResponse.json({ error: ssrfCheck.error }, { status: 400 })
    }

    // Rate limiting: max 15 requests per minute per user per extension
    if (!checkInMemoryRateLimit(`ext_ai:${user.chatId}:${extensionId}`, 15, 60 * 1000)) {
      return NextResponse.json({ error: 'Превышен лимит запросов к ИИ-серверу расширения. Пожалуйста, подождите минуту.' }, { status: 429 })
    }

    const hashedUserId = crypto.createHash('sha256').update(String(user.chatId)).digest('hex').slice(0, 16)

    const payload = {
      userId: `u_${hashedUserId}`,
      message,
      action: action || undefined,
      extensionId,
      context: {
        ...(context || {}),
        plan: (user as any).plan || 'free',
      },
    }

    const response = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Zerf-Extension-AI-Proxy/2.0',
        ...(ext.content?.aiEndpointSecret ? { 'X-Zerf-Secret': ext.content.aiEndpointSecret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8 seconds timeout
    })

    if (!response.ok) {
      return NextResponse.json({
        error: `AI-сервер расширения вернул ошибку (${response.status})`,
      }, { status: 502 })
    }

    const rawText = await response.text()
    if (rawText.length > 50_000) {
      return NextResponse.json({ error: 'Ответ AI-сервера расширения превышает допустимый размер (50 КБ)' }, { status: 502 })
    }

    try {
      const data = JSON.parse(rawText)
      return NextResponse.json({ success: true, ...data })
    } catch {
      return NextResponse.json({ success: true, reply: rawText })
    }
  } catch (err: unknown) {
    console.error('Extension AI proxy error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
