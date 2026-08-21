/**
 * Zerfic Live — Neural Speech Synthesis (TTS) Engine
 * POST /api/extensions/zerfic-live/tts
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateTtsAudio } from '@/lib/backend/tts'

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId = 'zerfik_original', rate = '1.0' } = await req.json()

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text parameter is required.' }, { status: 400 })
    }

    // Clean SSML and markup for high quality pronunciation
    const cleanText = text
      .replace(/[*_#`~\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Generate neural audio buffer with voiceId timbre profiling
    const audioBuffer = await generateTtsAudio(cleanText, 'ru', voiceId)
    if (!audioBuffer) {
      return NextResponse.json({ error: 'Failed to synthesize speech.' }, { status: 500 })
    }

    const uint8 = new Uint8Array(audioBuffer)
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(uint8.length),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
