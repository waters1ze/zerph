/**
 * POST /api/telegram/process-group
 *
 * Called by the main webhook handler (fire-and-forget) to do the heavy
 * group-add processing: voice download, transcription, AI parsing, DB save,
 * and editing the status message in the group chat.
 *
 * Runs as its OWN serverless invocation → gets its own execution budget.
 */

import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudioWithGroq, parseIntentWithGroq } from '@/lib/backend/groq'
import {
  saveParsedItemToDb,
  registerChatId,
  getExistingItemsContext,
  autoAddFriends,
  deductGroupUsage,
} from '@/lib/backend/db'
import { prisma } from '@/lib/backend/prisma'
import { GROQ_API_KEY } from '@/lib/config'

export const maxDuration = 60

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''
const MINIAPP_URL = `${APP_URL}/tg`

async function tgApi(method: string, body: object) {
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await res.json()
  } catch {
    return null
  }
}

function miniAppKeyboard(chatId: number) {
  // The Mini App authenticates via Telegram's signed initData, so no token in URL is needed.
  return {
    inline_keyboard: [
      [{ text: 'Open Zerf App', web_app: { url: MINIAPP_URL } }],
      [{ text: 'Open Full Web Site', url: APP_URL } ],
    ],
  }
}

/** Edit in-place, fall back to new message (plain text always works) */
async function safeEditOrSend(
  chatId: number,
  messageId: number | undefined,
  text: string,
  extra?: object
) {
  if (messageId) {
    const r1 = await tgApi('editMessageText', { chat_id: chatId, message_id: messageId, text, ...extra })
    if (r1?.ok) return
    const r2 = await tgApi('editMessageText', { chat_id: chatId, message_id: messageId, text })
    if (r2?.ok) return
  }
  await tgApi('sendMessage', { chat_id: chatId, text, ...extra })
}

export async function POST(req: NextRequest) {
  try {
    // Internal endpoint: only callable with the server admin secret
    const { getAdminSecret, secretsMatch } = await import('@/lib/backend/auth')
    const adminSecret = getAdminSecret()
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const headerSecret = req.headers.get('x-admin-secret') || ''
    if (!adminSecret || !(secretsMatch(bearer, adminSecret) || secretsMatch(headerSecret, adminSecret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      groupChatId,
      senderId,
      senderName,
      statusMsgId,
      replySenderId,
      replySenderName,
      fileId,          // voice file_id (optional)
      directText,      // already-known text (optional)
      allAssignees,    // string[] of chatIds
    } = body as {
      groupChatId: number
      senderId: number
      senderName: string
      statusMsgId?: number
      replySenderId?: number
      replySenderName?: string
      fileId?: string
      directText?: string
      allAssignees: string[]
    }

    const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
    if (!key) {
      await safeEditOrSend(groupChatId, statusMsgId, 'Groq API key не настроен.')
      return NextResponse.json({ ok: true })
    }

    // Step 1: Transcribe voice if needed
    let targetText = directText || ''
    if (fileId) {
      try {
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
        const fileData = await fileRes.json()
        const filePath = fileData.result?.file_path
        if (!filePath) throw new Error('Cannot get file path')
        const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
        targetText = await transcribeAudioWithGroq(audioBuffer, 'group_voice.ogg', key)
        const estimatedDuration = Math.max(5, Math.ceil(audioBuffer.length / 4000))
        await deductGroupUsage(senderId, groupChatId, allAssignees, 'voice', estimatedDuration)
      } catch (err) {
        await safeEditOrSend(groupChatId, statusMsgId, `Ошибка при расшифровке голосового: ${String(err).slice(0, 100)}`)
        return NextResponse.json({ ok: true })
      }
    }

    if (!targetText.trim()) {
      await safeEditOrSend(groupChatId, statusMsgId, 'В выбранном сообщении нет текста или речи для создания задачи.')
      return NextResponse.json({ ok: true })
    }

    // Step 2: AI parsing
    const context = await getExistingItemsContext(senderId)
    let items = await parseIntentWithGroq(targetText, key, undefined, context)

    if (!items || items.length === 0) {
      items = [{
        type: 'task',
        action: 'create',
        title: targetText.trim().slice(0, 100),
        summary: targetText.trim(),
        priority: 'medium',
        dueDate: new Date().toISOString().slice(0, 10),
        tags: ['группа'],
        rawText: targetText,
      }]
    }

    // Step 3: Get ALL known human group members from DB (excluding bots and negative chat IDs)
    let knownMemberIds: number[] = []
    try {
      const memberships = await prisma.groupMembership.findMany({
        where: { groupChatId: BigInt(groupChatId) },
      })
      knownMemberIds = memberships
        .map(m => Number(m.memberChatId))
        .filter(id => id > 0)
    } catch {}

    // Ensure sender + reply-to are in assignee list (filtering positive IDs)
    const assigneeSet = new Set<string>()
    if (senderId > 0) assigneeSet.add(String(senderId))
    if (replySenderId && replySenderId > 0) assigneeSet.add(String(replySenderId))
    knownMemberIds.forEach(id => {
      if (id > 0) assigneeSet.add(String(id))
    })
    const finalAssignees = Array.from(assigneeSet)

    // Step 4: Auto-friend all group members with each other
    for (const mid of knownMemberIds) {
      if (mid !== senderId && mid > 0) autoAddFriends(senderId, mid).catch(() => {})
      if (replySenderId && mid !== replySenderId && mid > 0) autoAddFriends(replySenderId, mid).catch(() => {})
    }

    // Step 5: Save task ONCE for creator with all assignees and group chat source (no duplicate items created!)
    for (const item of items) {
      item.isShared = true
      item.assignees = finalAssignees
      item.source = `group:${groupChatId}`
      item.type = 'task' // Force task, never note!
      try { await saveParsedItemToDb(item, senderId) } catch {}
    }

    // Step 6: Build response card (plain text - guaranteed no parse errors)
    let card = `Групповая задача создана в Zerf\n\n`
    card += `Участники: ${senderName}`
    if (replySenderName && replySenderId && replySenderId !== senderId) {
      card += `, ${replySenderName}`
    }
    const othersCount = knownMemberIds.filter(id => id !== senderId && id !== replySenderId).length
    if (othersCount > 0) card += ` и ещё ${othersCount} уч.`
    card += `\n\n`

    items.forEach((item, idx) => {
      const prefix = items.length > 1 ? `${idx + 1}. ` : ''
      card += `${prefix}Задача: ${item.title}\n`
      if (item.dueDate) card += `Дата: ${item.dueDate}\n`
      if (item.dueTime) card += `Время: ${item.dueTime}\n`
      card += `\n`
    })
    card += `Синхронизировано для ${finalAssignees.length} участников.`

    // Step 7: Edit the status message → user sees the result!
    await safeEditOrSend(groupChatId, statusMsgId, card, {
      reply_markup: miniAppKeyboard(senderId),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('process-group error:', err)
    return NextResponse.json({ ok: true })
  }
}
