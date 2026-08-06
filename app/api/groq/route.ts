/**
 * Next.js API Route — Groq Text Parser & Task Extractor
 * POST /api/groq
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseIntentWithGroq } from '@/lib/backend/groq'
import { saveParsedItemToDb } from '@/lib/backend/db'

export async function POST(req: NextRequest) {
  try {
    const { text, apiKey } = await req.json()
    const groqApiKey = apiKey || req.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text string is required' }, { status: 400 })
    }
    if (!groqApiKey) {
      return NextResponse.json({ error: 'Groq API Key is missing' }, { status: 400 })
    }

    const parsedItems = await parseIntentWithGroq(text, groqApiKey)
    for (const item of parsedItems) {
      await saveParsedItemToDb(item)
    }

    return NextResponse.json({ success: true, items: parsedItems, item: parsedItems[0] || null })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
