/**
 * Next.js API Route — Voice Processing
 * POST /api/voice — multipart/form-data with 'file' audio
 */

import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudioWithGroq, parseIntentWithGroq } from '@/lib/backend/groq'
import { getModelForUserPlan } from '@/lib/backend/groq-pool'
import { processParsedItemWithDelegation, getUserUsageAndLimits, incrementUserUsage, getExistingItemsContext, getFriends } from '@/lib/backend/db'
import { GROQ_API_KEY } from '@/lib/config'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { planAtLeast } from '@/lib/backend/plans'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    const ownerChatId = authUser.chatId
    if (ownerChatId) {
      const limits = await getUserUsageAndLimits(ownerChatId)
      if (!limits.canSendVoice) {
        return NextResponse.json({
          error: planAtLeast(limits.plan, 'plus')
            ? `❌ Достигнут дневной лимит голосового ввода (${Math.round(limits.voice.maxSeconds / 60)} мин). Оформите Zerf Pro для безлимита!`
            : '❌ Достигнут дневной лимит голосового ввода (1:30 мин в день на бесплатном тарифе). Оформите Zerf Plus (15 мин/день) или Pro (безлимит) в Настройках!',
          limitReached: true,
        }, { status: 403 })
      }
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const textInput = formData.get('text') as string | null  // allow text-only mode
    const apiKey =
      (formData.get('apiKey') as string) ||
      req.headers.get('x-groq-api-key') ||
      process.env.GROQ_API_KEY ||
      undefined

    let transcript = ''

    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      transcript = await transcribeAudioWithGroq(buffer, file.name || 'voice.webm', apiKey)
      if (!transcript.trim()) {
        return NextResponse.json({ error: 'No speech detected.' }, { status: 400 })
      }
    } else if (textInput) {
      transcript = textInput
    } else {
      return NextResponse.json({ error: 'Provide audio file or text input.' }, { status: 400 })
    }

    // Parse intent — detects task/goal/note/completion/reminder/shared (can extract multiple items)
    const context = ownerChatId ? await getExistingItemsContext(ownerChatId) : undefined
    const friends = ownerChatId ? await getFriends(ownerChatId) : []
    const friendsContext = friends.length > 0 ? friends.map((f: any) => `Имя: ${f.name} (@${f.username || 'no_username'})`).join('\n') : undefined

    const userPlan = ownerChatId ? (await getUserUsageAndLimits(ownerChatId)).plan : 'free'
    const effectiveModel = getModelForUserPlan(userPlan)

    const parsedItems = await parseIntentWithGroq(transcript, apiKey, effectiveModel, context, friendsContext)
    const results = []

    for (const item of parsedItems) {
      const savedResult = await processParsedItemWithDelegation(item, ownerChatId)
      results.push(savedResult)
    }

    const clientDuration = Number(formData.get('duration')) || 15
    const maxDuration = file ? Math.ceil(file.size / 4000) : 15 // Roughly 4KB/s WebM
    const actualDuration = file ? Math.min(clientDuration, maxDuration) : 0

    if (ownerChatId && file) {
      await incrementUserUsage(ownerChatId, 'voice', actualDuration)
    }

    return NextResponse.json({
      success: true,
      transcript,
      items: results.map(r => r.item),
      completedTask: results.find(r => r.completedTask)?.completedTask || null,
      isCompletion: results.some(r => r.item.type === 'completion'),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
