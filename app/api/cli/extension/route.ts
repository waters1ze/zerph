import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { callGroqChatCompletion } from '@/lib/backend/groq-pool'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }

    const { prompt, name, template = 'widget' } = await req.json().catch(() => ({}))
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const systemPrompt = `You are the Zerf Note Extension Generator AI.
You create standalone, beautiful, modern micro-applications/extensions for Zerf Note.
Technology: Vanilla HTML, CSS, JavaScript.
Theme: Dark mode (#090d16), smooth animations, glassmorphism, accent colors (#38bdf8, #818cf8).

Output MUST be a strict JSON object with this format:
{
  "manifest": {
    "id": "kebab-case-id",
    "name": "Extension Name in Russian",
    "version": "1.0.0",
    "description": "Short description in Russian",
    "icon": "Emoji icon e.g. 📊 or ⚡",
    "author": "Zerf AI CLI",
    "category": "productivity | utility | finance | health | education"
  },
  "html": "<!DOCTYPE html><html>...complete HTML structure...</html>",
  "css": "/* complete modern styles */",
  "js": "// complete interactive logic with localStorage persistence"
}`

    const result = await callGroqChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a Zerf Note extension for: "${prompt}" (Name hint: ${name || 'auto'})` }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })

    const clean = (result.content || '{}').trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json({
      success: true,
      extension: parsed,
      createdVia: 'Zerf CLI AI Engine'
    })
  } catch (err: unknown) {
    console.error('Extension generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
