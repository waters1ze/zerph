import { NextRequest, NextResponse } from 'next/server'
import { getLiveGroqModels, isModelAllowedForPlan, VERIFIED_GROQ_MODELS } from '@/lib/backend/groq-pool'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { normalizePlan } from '@/lib/plans'

import { getUserUsageAndLimits } from '@/lib/backend/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ai/models
 * Returns the dynamic list of available Groq models, classified by user subscription plan tier:
 * - Free: models <= 20B
 * - Plus: models <= 70B
 * - Pro: models <= 120B
 * - Corp: ALL models (unlimited)
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const limits = authUser ? await getUserUsageAndLimits(authUser.chatId) : null
    const userPlan = normalizePlan(limits?.plan || 'free')

    // 1. Fetch live models (with automatic cache and dynamic discovery of newly released Groq models)
    const rawLiveModels = await getLiveGroqModels()
    const allModels = rawLiveModels.filter(m => 
      !m.isExcluded && 
      !m.isGuard && 
      !m.id.toLowerCase().includes('guard') && 
      !m.id.toLowerCase().includes('safeguard') && 
      !m.id.toLowerCase().includes('orpheus') && 
      !m.id.toLowerCase().includes('arabic') &&
      !m.id.toLowerCase().includes('allam')
    )

    // 2. Filter allowed models for the active user's plan
    const allowedForUser = allModels.filter(m => isModelAllowedForPlan(m.id, userPlan))

    return NextResponse.json({
      success: true,
      userPlan,
      models: allModels.map(m => ({
        id: m.id,
        name: m.name,
        paramsBillions: m.paramsBillions,
        category: m.category,
        minTier: m.minTier,
        desc: m.desc,
        speedTps: m.speedTps,
        contextTokens: m.contextTokens,
        maxCompletionTokens: m.maxCompletionTokens,
        isAllowedForPlan: isModelAllowedForPlan(m.id, userPlan),
      })),
      userAllowedModels: allowedForUser,
    })
  } catch (err: unknown) {
    console.error('Error fetching AI models:', err)
    return NextResponse.json({
      success: true,
      models: VERIFIED_GROQ_MODELS.filter(m => !m.isExcluded),
      error: 'Failed to query live models, using verified fallback list',
    })
  }
}
