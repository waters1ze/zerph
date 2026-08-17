/**
 * Next.js API Route — Groq Text Parser & Task Extractor
 * POST /api/groq
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseIntentWithGroq } from '@/lib/backend/groq'
import { groqPool, getHuggingFaceTokens, getModelForUserPlan } from '@/lib/backend/groq-pool'
import { processParsedItemWithDelegation, getExistingItemsContext, getFriends, getUserUsageAndLimits } from '@/lib/backend/db'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    const ownerChatId = authUser.chatId

    const { text, apiKey, model } = await req.json()
    const groqApiKey = apiKey || req.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY
    const hasKeys = groqPool.getKeysCount() > 0 || getHuggingFaceTokens().length > 0 || Boolean(groqApiKey)

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text string is required' }, { status: 400 })
    }
    if (!hasKeys) {
      return NextResponse.json({ error: 'Groq API Key is missing' }, { status: 400 })
    }

    const limits = ownerChatId ? await getUserUsageAndLimits(ownerChatId) : null
    const effectiveModel = getModelForUserPlan(limits?.plan, model, 'parser')

    const context = ownerChatId ? await getExistingItemsContext(ownerChatId) : undefined
    const friends = ownerChatId ? await getFriends(ownerChatId) : []
    const friendsContext = friends.length > 0 ? friends.map((f: any) => `Имя: ${f.name} (@${f.username || 'no_username'})`).join('\n') : undefined

    const parsedItems = await parseIntentWithGroq(text, groqApiKey, effectiveModel, context, friendsContext)
    const results = []
    for (const item of parsedItems) {
      const res = await processParsedItemWithDelegation(item, ownerChatId)
      results.push(res)
    }

    return NextResponse.json({
      success: true,
      items: results.map(r => r.item),
      item: results[0]?.item || null,
      delegated: results.some(r => r.delegated),
      isBothShared: results.some(r => r.isBothShared),
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
