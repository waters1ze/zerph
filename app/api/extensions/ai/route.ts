import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getExtensionById } from '@/lib/backend/extensions'
import { checkInMemoryRateLimit } from '@/lib/backend/rate-limit'
import { getUserUsageAndLimits } from '@/lib/backend/db'
import { getDailyCount, incrementDailyCount, COUNTERS, EXTENSION_AI_LIMITS } from '@/lib/backend/plans'
import crypto from 'crypto'

import { validateOutboundUrl as validateExtensionEndpoint } from '@/lib/backend/ssrf'

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
      return NextResponse.json({ error: 'Р Р°СЃС€РёСЂРµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ' }, { status: 404 })
    }

    const aiEndpoint = ext.content?.aiEndpoint || ext.content?.endpoint
    if (!aiEndpoint) {
      return NextResponse.json({ error: 'РЈ СЌС‚РѕРіРѕ СЂР°СЃС€РёСЂРµРЅРёСЏ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ РІРЅРµС€РЅРёР№ AI-СЃРµСЂРІРµСЂ (aiEndpoint)' }, { status: 400 })
    }

    // Strict SSRF validation
    const ssrfCheck = await validateExtensionEndpoint(aiEndpoint)
    if (!ssrfCheck.safe) {
      return NextResponse.json({ error: ssrfCheck.error }, { status: 400 })
    }

    // Global daily extension AI limits to prevent abuse (Free: 10, Plus: 50, Pro: 150, Corp: 300)
    const userLimits = await getUserUsageAndLimits(user.chatId)
    const userPlan = (userLimits?.plan || 'free').toLowerCase()
    const dailyLimit = EXTENSION_AI_LIMITS[userPlan] ?? EXTENSION_AI_LIMITS.free
    const dailyUsed = await getDailyCount(COUNTERS.extensionAi, user.chatId)

    if (dailyLimit !== -1 && dailyUsed >= dailyLimit) {
      return NextResponse.json({
        error: `РСЃС‡РµСЂРїР°РЅ РґРЅРµРІРЅРѕР№ Р»РёРјРёС‚ Р·Р°РїСЂРѕСЃРѕРІ Рє РР РґР»СЏ СЂР°СЃС€РёСЂРµРЅРёР№ (${dailyUsed}/${dailyLimit}). РџРµСЂРµР№РґРёС‚Рµ РЅР° С‚Р°СЂРёС„ Plus (50/РґРµРЅСЊ) РёР»Рё Pro (150/РґРµРЅСЊ) РґР»СЏ СѓРІРµР»РёС‡РµРЅРёСЏ РєРІРѕС‚С‹.`,
        limitReached: true,
        limit: dailyLimit,
        used: dailyUsed,
      }, { status: 429 })
    }

    // Rate limiting: max 15 requests per minute per user per extension
    if (!checkInMemoryRateLimit(`ext_ai:${user.chatId}:${extensionId}`, 15, 60 * 1000)) {
      return NextResponse.json({ error: 'РџСЂРµРІС‹С€РµРЅ Р»РёРјРёС‚ Р·Р°РїСЂРѕСЃРѕРІ Рє РР-СЃРµСЂРІРµСЂСѓ СЂР°СЃС€РёСЂРµРЅРёСЏ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїРѕРґРѕР¶РґРёС‚Рµ РјРёРЅСѓС‚Сѓ.' }, { status: 429 })
    }

    const hashedUserId = crypto.createHash('sha256').update(String(user.chatId)).digest('hex').slice(0, 16)

    const payload = {
      userId: `u_${hashedUserId}`,
      message,
      action: action || undefined,
      extensionId,
      context: {
        ...(context || {}),
        plan: userPlan,
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
        error: `AI-СЃРµСЂРІРµСЂ СЂР°СЃС€РёСЂРµРЅРёСЏ РІРµСЂРЅСѓР» РѕС€РёР±РєСѓ (${response.status})`,
      }, { status: 502 })
    }

    const rawText = await response.text()
    if (rawText.length > 50_000) {
      return NextResponse.json({ error: 'РћС‚РІРµС‚ AI-СЃРµСЂРІРµСЂР° СЂР°СЃС€РёСЂРµРЅРёСЏ РїСЂРµРІС‹С€Р°РµС‚ РґРѕРїСѓСЃС‚РёРјС‹Р№ СЂР°Р·РјРµСЂ (50 РљР‘)' }, { status: 502 })
    }

    // Increment daily AI counter for extensions
    await incrementDailyCount(COUNTERS.extensionAi, user.chatId)

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
