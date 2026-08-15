/**
 * VK Callback API Endpoint for Zerf AI Bot
 * Handles text messages, voice messages, commands, and VK Mini App shortcuts.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getVkConfirmationCode,
  getVkSecretKey,
  sendVkMessage,
  transcribeVkVoice,
} from '@/lib/backend/vk'
import { parseIntentWithGroq } from '@/lib/backend/groq'
import {
  saveParsedItemToDb,
  registerChatId,
  getAllTasks,
  getUserProductivityStats,
} from '@/lib/backend/db'
import { prisma } from '@/lib/backend/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text()
    let body: any = {}
    try {
      body = JSON.parse(rawText)
    } catch {
      body = {}
    }

    // 1. VK Callback API Confirmation (Highest Priority)
    if (body.type === 'confirmation' || rawText.includes('"confirmation"')) {
      const code = getVkConfirmationCode()
      return new Response(code, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    // 2. Secret Key check (if present in request and configured)
    const secretKey = getVkSecretKey()
    if (secretKey && body.secret && body.secret !== secretKey) {
      console.warn('[VK Callback] Secret mismatch:', body.secret, 'expected:', secretKey)
      return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // 3. New message from VK user
    if (body.type === 'message_new') {
      const message = body.object?.message || body.object
      if (!message) return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })

      const fromId = message.from_id || message.peer_id
      if (!fromId || Number(fromId) < 0) {
        // Ignore community or system messages
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      const text = (message.text || '').trim()
      let userVoiceText = ''

      // Check for voice/audio message attachment
      const attachments = message.attachments || []
      const audioMsg = attachments.find((a: any) => a.type === 'audio_message' || a.type === 'doc')
      if (audioMsg) {
        const audioUrl = audioMsg.audio_message?.link_ogg || audioMsg.audio_message?.link_mp3 || audioMsg.doc?.url
        if (audioUrl) {
          userVoiceText = await transcribeVkVoice(audioUrl)
        }
      }

      const effectiveText = userVoiceText || text
      if (!effectiveText) {
        return new NextResponse('ok', { status: 200 })
      }

      // Auto-register VK User in database
      const vkChatId = BigInt(fromId)
      await registerChatId(vkChatId, 'VK Пользователь')

      const miniAppUrl = `${APP_URL}/vk?vk_user_id=${fromId}`
      const keyboard = {
        inline: true,
        buttons: [
          [
            {
              action: {
                type: 'open_link',
                link: miniAppUrl,
                label: '📱 Открыть Zerf App',
              },
            },
          ],
        ],
      }

      // Command handling
      const lower = effectiveText.toLowerCase()
      if (lower === 'начать' || lower === '/start' || lower === 'привет') {
        const welcome =
          `👋 Привет! Я — Zerf AI, твой умный ассистент продуктивности во ВКонтакте.\n\n` +
          `✨ Что я умею:\n` +
          `• Отправь текст или голосовое: «Позвонить врачу завтра в 14:00», и я поставлю задачу с напоминанием.\n` +
          `• Напиши заметку или цель — я структурирую и сохраню в твоем профиле.\n` +
          `• Нажми кнопку ниже, чтобы открыть полноэкранный интерфейс в VK Mini Apps!`

        await sendVkMessage(fromId, welcome, keyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      if (lower === 'задачи' || lower === 'сегодня' || lower === '/today') {
        const tasks = await getAllTasks(vkChatId)
        const todayStr = new Date().toISOString().slice(0, 10)
        const todayTasks = tasks.filter(t => t.dueDate === todayStr || t.status === 'todo')

        if (todayTasks.length === 0) {
          await sendVkMessage(fromId, '✨ На сегодня все задачи выполнены! Отличная работа.', keyboard)
        } else {
          let list = `📋 Твои актуальные задачи (${todayTasks.length}):\n\n`
          todayTasks.slice(0, 10).forEach((t, i) => {
            const timeStr = t.dueTime ? ` (${t.dueTime})` : ''
            list += `${i + 1}. ${t.status === 'done' ? '✓' : '▫'} ${t.title}${timeStr}\n`
          })
          await sendVkMessage(fromId, list, keyboard)
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // Parse with AI
      const parsedItems = await parseIntentWithGroq(effectiveText)
      if (!parsedItems || parsedItems.length === 0) {
        await sendVkMessage(fromId, '💭 Зафиксировал, но не нашел конкретных задач. Отправь мне задачу или открой Zerf App!', keyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      let responseMsg = userVoiceText ? `🎙 Распознано: «${userVoiceText}»\n\n` : ''

      for (const item of parsedItems) {
        await saveParsedItemToDb(item, vkChatId)
        const typeLabel = item.type === 'note' ? '📝 Заметка' : item.type === 'goal' ? '🎯 Цель' : '✅ Задача'
        responseMsg += `${typeLabel}: «${item.title}»\n`
        if (item.dueDate) responseMsg += `📅 Дата: ${item.dueDate}\n`
        if (item.dueTime) responseMsg += `⏰ Время: ${item.dueTime}\n`
        responseMsg += `\n`
      }

      responseMsg += `Сохранено в твоем аккаунте Zerf AI!`
      await sendVkMessage(fromId, responseMsg, keyboard)

      return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (err) {
    console.error('VK Callback Error:', err)
    return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Zerf AI VK Callback API',
    endpoints: {
      callback: '/api/vk/callback',
      miniApp: '/vk',
    },
  })
}
