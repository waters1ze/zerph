import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chatIdStr = authUser.chatId
    const configKey = `cal_feed_token_${chatIdStr}`

    let feedConfig = await prisma.config.findUnique({
      where: { key: configKey },
    })

    if (!feedConfig) {
      const token = crypto.randomBytes(16).toString('hex')
      feedConfig = await prisma.config.create({
        data: {
          key: configKey,
          value: token,
        },
      })
    }

    const token = feedConfig.value
    const origin = req.nextUrl.origin || 'https://zerph.ru'
    const httpsUrl = `${origin}/api/calendar/feed/${token}.ics`
    const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://')

    return NextResponse.json({
      success: true,
      token,
      httpsUrl,
      webcalUrl,
    })
  } catch (error: any) {
    console.error('[Calendar Token GET] Error:', error)
    return NextResponse.json({ error: 'Ошибка получения токена календаря' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chatIdStr = authUser.chatId
    const configKey = `cal_feed_token_${chatIdStr}`

    // Reset/regenerate token
    const newToken = crypto.randomBytes(16).toString('hex')
    await prisma.config.upsert({
      where: { key: configKey },
      update: { value: newToken },
      create: { key: configKey, value: newToken },
    })

    const origin = req.nextUrl.origin || 'https://zerph.ru'
    const httpsUrl = `${origin}/api/calendar/feed/${newToken}.ics`
    const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://')

    return NextResponse.json({
      success: true,
      token: newToken,
      httpsUrl,
      webcalUrl,
      message: 'Токен синхронизации обновлён',
    })
  } catch (error: any) {
    console.error('[Calendar Token POST] Error:', error)
    return NextResponse.json({ error: 'Ошибка генерации нового токена' }, { status: 500 })
  }
}
