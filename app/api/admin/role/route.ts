import { NextRequest, NextResponse } from 'next/server'
import { isCallerAdmin, ROOT_ADMIN_IDS } from '@/lib/backend/admin'
import { prisma } from '@/lib/backend/prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function sendTgMessage(chatId: string | number, text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, isRoot, callerChatId } = await isCallerAdmin(req)
    if (!isAdmin || !isRoot) {
      return NextResponse.json({ error: 'Access Denied: Only Owner / Root Admin can change admin roles' }, { status: 403 })
    }

    const body = await req.json()
    const { targetChatId, makeAdmin } = body

    if (!targetChatId) {
      return NextResponse.json({ error: 'targetChatId is required' }, { status: 400 })
    }

    const targetStr = String(targetChatId).trim()
    const cid = BigInt(targetStr)

    // Cannot remove root admin
    if (ROOT_ADMIN_IDS.includes(targetStr) && !makeAdmin) {
      return NextResponse.json({ error: 'Cannot remove role from system root admin' }, { status: 400 })
    }

    const targetUser = await prisma.telegramChat.findUnique({ where: { chatId: cid } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.telegramChat.update({
      where: { chatId: cid },
      data: {
        isAdmin: Boolean(makeAdmin),
      },
    })

    if (makeAdmin) {
      await sendTgMessage(
        targetStr,
        `👑 *Поздравляем! Вам выданы права Администратора Zerf AI!*\n\n` +
        `Теперь вам открыт специальный раздел *Админ-панель* в веб-приложении для управления пользователями, подписками и аналитикой системы.`
      )
    } else {
      await sendTgMessage(
        targetStr,
        `ℹ️ *Ваши права Администратора в Zerf AI были отозваны.*`
      )
    }

    return NextResponse.json({
      success: true,
      message: makeAdmin ? 'Пользователь назначен администратором' : 'Права администратора сняты',
      isAdmin: Boolean(makeAdmin),
    })
  } catch (err: unknown) {
    console.error('Role update error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
