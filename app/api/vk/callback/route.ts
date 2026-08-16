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
  callVkApi,
} from '@/lib/backend/vk'
import { parseIntentWithGroq, extractCleanRecipientAndSharing } from '@/lib/backend/groq'
import {
  saveParsedItemToDb,
  registerChatId,
  getAllTasks,
  getUserProductivityStats,
  findFriendMatches,
} from '@/lib/backend/db'
import { prisma } from '@/lib/backend/prisma'
import { parseTimezoneInput } from '@/lib/backend/timezone'

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

    // 2. Secret Key check — REQUIRED when VK_SECRET_KEY is configured.
    //    Requests without a valid secret are dropped.
    const secretKey = getVkSecretKey()
    if (secretKey) {
      if (!body.secret || body.secret !== secretKey) {
        console.warn('[VK Callback] Dropped request: missing or invalid secret')
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
    }

    // 3. Inline Button Callback (message_event)
    if (body.type === 'message_event') {
      const obj = body.object || {}
      const userId = obj.user_id || obj.peer_id
      const eventId = obj.event_id
      let payload = obj.payload
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload) } catch {}
      }

      const rawAction = typeof payload === 'object' ? (payload.command || payload.button || payload.action || '') : String(payload || '')

      if (rawAction.startsWith('rem_done_') || rawAction.startsWith('done_')) {
        const taskId = rawAction.replace('rem_done_', '').replace('done_', '')
        try {
          const { completeTask } = await import('@/lib/backend/db')
          // Only the owner/author/assignee may complete the task
          await completeTask(taskId, userId)
          await callVkApi('messages.sendMessageEventAnswer', {
            event_id: eventId,
            user_id: userId,
            peer_id: obj.peer_id || userId,
            event_data: JSON.stringify({ type: 'show_snackbar', text: '✅ Задача отмечена выполненной!' }),
          })
        } catch {
          await callVkApi('messages.sendMessageEventAnswer', {
            event_id: eventId,
            user_id: userId,
            peer_id: obj.peer_id || userId,
            event_data: JSON.stringify({ type: 'show_snackbar', text: 'Задача недоступна' }),
          }).catch(() => {})
        }
      } else {
        await callVkApi('messages.sendMessageEventAnswer', {
          event_id: eventId,
          user_id: userId,
          peer_id: obj.peer_id || userId,
          event_data: JSON.stringify({ type: 'show_snackbar', text: '👌 Действие выполнено' }),
        }).catch(() => {})
      }

      return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // 4. New message from VK user
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

      // Auto-register VK User in database & fetch name if possible
      const vkChatId = BigInt(fromId)
      let vkFirstName = 'VK Пользователь'
      let vkLastName: string | undefined = undefined

      try {
        const vkUserRes = await callVkApi('users.get', { user_ids: fromId, fields: 'first_name,last_name' })
        const vkUser = vkUserRes?.response?.[0]
        if (vkUser?.first_name) {
          vkFirstName = vkUser.first_name
          vkLastName = vkUser.last_name || undefined
        }
      } catch {}

      await registerChatId(vkChatId, vkFirstName, undefined, vkLastName)

      // Default Reply Keyboard (Persistent Menu at bottom of chat)
      const miniAppUrl = `${APP_URL}/vk?vk_user_id=${fromId}`
      const mainKeyboard = {
        one_time: false,
        buttons: [
          [
            {
              action: {
                type: 'text',
                label: '📋 Задачи на сегодня',
                payload: JSON.stringify({ button: 'today' }),
              },
              color: 'primary',
            },
            {
              action: {
                type: 'text',
                label: '📊 Продуктивность',
                payload: JSON.stringify({ button: 'stats' }),
              },
              color: 'secondary',
            },
          ],
          [
            {
              action: {
                type: 'text',
                label: '🎯 Мои цели',
                payload: JSON.stringify({ button: 'goals' }),
              },
              color: 'secondary',
            },
            {
              action: {
                type: 'text',
                label: '📝 Заметки',
                payload: JSON.stringify({ button: 'notes' }),
              },
              color: 'secondary',
            },
          ],
          [
            {
              action: {
                type: 'text',
                label: '❓ Все команды',
                payload: JSON.stringify({ button: 'help' }),
              },
              color: 'secondary',
            },
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

      const lower = effectiveText.toLowerCase()
      const parts = effectiveText.trim().split(/\s+/)
      const cmd = parts[0].toLowerCase()

      // ── 1. /start & /login ───────────────────────────────────────────────────
      if (
        cmd === '/start' ||
        cmd === '/login' ||
        lower === 'начать' ||
        lower === 'старт' ||
        lower === 'привет' ||
        lower === 'start' ||
        lower === 'hello' ||
        lower === 'hi' ||
        lower === 'меню' ||
        lower === 'войти'
      ) {
        const { generateOnetimeToken } = await import('@/lib/backend/auth')
        const token = generateOnetimeToken()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

        await prisma.loginToken.create({
          data: {
            chatId: vkChatId,
            token,
            expiresAt,
          },
        })

        const loginUrl = `${APP_URL}/api/auth/login-token?token=${token}&redirect=true`

        const welcome =
          `👋 Привет, ${vkFirstName}! Я — Zerf AI, твой умный ассистент продуктивности во ВКонтакте.\n\n` +
          `✨ Твой аккаунт успешно подключен!\n\n` +
          `✨ *Новые возможности и фичи:*\n` +
          `📸 *Vision OCR* — отправь фото или скриншот расписания/уроков, и ИИ всё занесет сам!\n` +
          `⏱ *Диапазоны «от и до»* — пиши «уроки с 8 до 15» или «тренировка с 18:00 до 19:30» с автозавершением.\n` +
          `🏫 *Группы расписания* — школьные уроки аккуратно группируются и не загромождают личные дела.\n` +
          `🌴 *Выходные дни* — скажи «в этот день выходной», чтобы снять уроки без вреда праздникам.\n` +
          `🔁 *Регулярные занятия* — «каждую пятницу бассейн» с умной отменой и сохранением истории.\n` +
          `🎂 *Дни рождения и праздники* — напоминание за 7 дней до события.\n\n` +
          `📌 *БЫСТРЫЕ КОМАНДЫ:*\n` +
          `• /today — Задачи на сегодня\n` +
          `• /week — План на 7 дней\n` +
          `• /goals — Мои цели\n` +
          `• /notes — Заметки и идеи\n` +
          `• /stats — Аналитика и стрик\n` +
          `• /matrix — Матрица Эйзенхауэра\n` +
          `• /send @username [текст] — Дать задачу другу\n` +
          `• /help — Полное руководство\n\n` +
          `🌐 Ссылка для моментального входа на сайте (Safari / Chrome):\n` +
          `${loginUrl}\n` +
          `⏱ Действует 10 минут.\n\n` +
          `💡 Ты можешь просто прислать голосовое 🎙 или текст в свободной форме: «Позвонить врачу завтра в 14:00»!`

        await sendVkMessage(fromId, welcome, mainKeyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 2. /help ─────────────────────────────────────────────────────────────
      if (cmd === '/help' || cmd === '/commands' || lower === 'помощь' || lower === 'команды' || lower === '❓ все команды') {
        const helpText =
          `📋 *ПОЛНЫЙ СПИСОК КОМАНД ZERF AI:*\n\n` +
          `✨ *Новые функции:*\n` +
          `• 📸 Vision OCR по фото/скриншотам дневника\n` +
          `• ⏱ Диапазоны времени (с 8 до 15) с автозавершением\n` +
          `• 🏫 Умное групповое расписание («Школа»)\n` +
          `• 🌴 «В этот день выходной» (отмена уроков на дату)\n` +
          `• 🔁 Регулярные занятия (плавание, секции) с историей\n` +
          `• 🎂 Дни рождения и праздники за 7 дней\n\n` +
          `📌 *Управление задачами:*\n` +
          `• /today или /tasks — Задачи на сегодня\n` +
          `• /week — План задач на ближайшие 7 дней\n` +
          `• /inbox — Входящие задачи без даты\n` +
          `• /matrix — Матрица Эйзенхауэра (Срочно / Важно)\n\n` +
          `🎯 *Цели и Заметки:*\n` +
          `• /goals — Мои активные цели с прогрессом\n` +
          `• /notes — Последние сохраненные заметки\n\n` +
          `📊 *Аналитика и Профиль:*\n` +
          `• /stats — Аналитика продуктивности и стрик\n` +
          `• /name [Имя Фамилия] — Сменить имя во всей системе\n` +
          `• /bday [ДД.ММ.ГГГГ] — Установить день рождения\n` +
          `• /login — Получить ссылку для входа в браузере\n` +
          `• /link [Telegram_ID] — Связать аккаунт VK с Telegram\n\n` +
          `👥 *Команда и друзья (работает между VK и Telegram):*\n` +
          `• /send [@username/Имя] [текст] — Передать задачу другу\n` +
          `• /schedule [Имя] — Узнать занятость друга на сегодня\n` +
          `• /friends — Список друзей\n\n` +
          `🎙 *Голосовой ввод:* Просто отправь голосовое сообщение, и ИИ сам расставит даты, приоритеты и теги!`

        await sendVkMessage(fromId, helpText, mainKeyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 2.2 /timezone ────────────────────────────────────────────────────────
      if (cmd === '/timezone' || cmd === '/tz' || lower.startsWith('часовой пояс') || lower.startsWith('мой часовой пояс') || lower.startsWith('установи часовой пояс') || lower.startsWith('поставь часовой пояс')) {
        const isCmd = cmd === '/timezone' || cmd === '/tz'
        const tzArg = isCmd
          ? parts.slice(1).join(' ').trim()
          : effectiveText.replace(/^(?:мой\s+|установи\s+|поставь\s+|смени\s+|измени\s+)?часовой\s+пояс\s*(?:на|:)?\s*/i, '').trim()

        if (!tzArg) {
          const current = await prisma.telegramChat.findUnique({
            where: { chatId: BigInt(vkChatId) },
            select: { timezone: true }
          })
          const currentTz = current?.timezone || 'Europe/Moscow'
          await sendVkMessage(fromId, `⏱ *Настройка часового пояса*\n\n▪ *Текущий пояс:* ${currentTz}\n\nДля изменения отправь:\n• /timezone +3 (Москва, СПб)\n• /timezone +5 (Екатеринбург)\n• /timezone +7 (Новосибирск, Красноярск)\n• /timezone Europe/Moscow\n\nЛибо напиши: «мой часовой пояс +3»`, mainKeyboard)
        } else {
          const matched = parseTimezoneInput(tzArg)
          if (matched) {
            await prisma.telegramChat.upsert({
              where: { chatId: BigInt(vkChatId) },
              update: { timezone: matched },
              create: { chatId: BigInt(vkChatId), timezone: matched },
            })
            await sendVkMessage(fromId, `⏱ *Часовой пояс успешно установлен: ${matched}* ▪\nВсе напоминания и задачи будут приходить строго по твоему местному времени.`, mainKeyboard)
          } else {
            await sendVkMessage(fromId, `▫ Не удалось определить часовой пояс. Примеры:\n/timezone +3 (МСК)\n/timezone +5 (Екатеринбург)\n/timezone Europe/Moscow`, mainKeyboard)
          }
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 2.5 /listen & /озвучь ─────────────────────────────────────────────────
      if (cmd === '/listen' || cmd === '/audio' || cmd === '/voice' || cmd === '/озвучь' || cmd === '/голос' || cmd === '/брифинг') {
        const { generateUserDailyAudioBriefing } = await import('@/lib/backend/tts')
        const briefing = await generateUserDailyAudioBriefing(vkChatId, vkFirstName)
        await sendVkMessage(fromId, `🔊 *Твой персональный аудио-брифинг Zerf AI:*\n\n${briefing.text}`, mainKeyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 3. /today & /tasks ───────────────────────────────────────────────────
      if (cmd === '/today' || cmd === '/tasks' || lower === 'задачи' || lower === 'сегодня' || lower === '📋 задачи на сегодня') {
        const tasks = await getAllTasks(vkChatId)
        const todayStr = new Date().toISOString().slice(0, 10)
        const todayTasks = tasks.filter(t => t.dueDate === todayStr || (!t.dueDate && t.status === 'todo'))

        if (todayTasks.length === 0) {
          await sendVkMessage(fromId, '✨ На сегодня все задачи выполнены! Отличная работа.', mainKeyboard)
        } else {
          let list = `📋 Твои актуальные задачи на сегодня (${todayTasks.length}):\n\n`
          todayTasks.slice(0, 15).forEach((t, i) => {
            const timeStr = t.dueTime ? ` ⏰ ${t.dueTime}` : ''
            const statusIcon = t.status === 'done' ? '✅' : '▫️'
            list += `${i + 1}. ${statusIcon} ${t.title}${timeStr}\n`
          })
          await sendVkMessage(fromId, list, mainKeyboard)
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 4. /week ─────────────────────────────────────────────────────────────
      if (cmd === '/week' || lower === 'неделя') {
        const tasks = await getAllTasks(vkChatId)
        const today = new Date()
        const nextWeek = new Date(Date.now() + 7 * 86400000)
        const todayStr = today.toISOString().slice(0, 10)
        const nextWeekStr = nextWeek.toISOString().slice(0, 10)

        const weekTasks = tasks.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= nextWeekStr)

        if (weekTasks.length === 0) {
          await sendVkMessage(fromId, '📅 На ближайшие 7 дней задач не запланировано. Отправь мне задачу!', mainKeyboard)
        } else {
          let list = `📅 План задач на 7 дней (${weekTasks.length}):\n\n`
          weekTasks.slice(0, 15).forEach((t, i) => {
            const timeStr = t.dueTime ? ` (${t.dueTime})` : ''
            list += `${i + 1}. [${t.dueDate}] ${t.status === 'done' ? '✓' : '▫'} ${t.title}${timeStr}\n`
          })
          await sendVkMessage(fromId, list, mainKeyboard)
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 5. /stats ────────────────────────────────────────────────────────────
      if (cmd === '/stats' || lower === 'статистика' || lower === '📊 продуктивность') {
        const stats = await getUserProductivityStats(vkChatId)
        const user = await prisma.telegramChat.findUnique({ where: { chatId: vkChatId } })
        const notesCount = await prisma.note.count({ where: { ownerChatId: vkChatId } })
        const goalsCount = await prisma.goal.count({ where: { ownerChatId: vkChatId } })

        const msg =
          `📊 *ТВОЯ СТАТИСТИКА ПРОДУКТИВНОСТИ*\n\n` +
          `🔥 Стрик продуктивности: ${user?.streakDays || stats.streak || 0} дней подряд\n` +
          `✅ Выполнено задач: ${stats.completedCount} из ${stats.totalTasks} (${stats.completionRate}%)\n` +
          `📝 Всего заметок: ${notesCount}\n` +
          `🎯 Активных целей: ${goalsCount}\n\n` +
          `⚡ Держи темп и не сбавляй обороты!`

        await sendVkMessage(fromId, msg, mainKeyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 6. /goals ────────────────────────────────────────────────────────────
      if (cmd === '/goals' || lower === 'цели' || lower === '🎯 мои цели') {
        const { getAllGoals } = await import('@/lib/backend/db')
        const goals = await getAllGoals(vkChatId)

        if (goals.length === 0) {
          await sendVkMessage(fromId, '🎯 У тебя пока нет активных целей. Напиши: «Моя цель — выучить TypeScript до декабря»!', mainKeyboard)
        } else {
          let list = `🎯 Твои цели (${goals.length}):\n\n`
          goals.forEach((g, i) => {
            const progress = g.progress || 0
            const bar = '▓'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10))
            list += `${i + 1}. *${g.title}*\n   [${bar}] ${progress}%\n\n`
          })
          await sendVkMessage(fromId, list, mainKeyboard)
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 7. /notes ────────────────────────────────────────────────────────────
      if (cmd === '/notes' || lower === 'заметки' || lower === '📝 заметки') {
        const { getAllNotes } = await import('@/lib/backend/db')
        const notes = await getAllNotes(vkChatId)

        if (notes.length === 0) {
          await sendVkMessage(fromId, '📝 У тебя пока нет заметок. Отправь мне любую мысль или текст!', mainKeyboard)
        } else {
          let list = `📝 Твои последние заметки (${Math.min(notes.length, 10)}):\n\n`
          notes.slice(0, 10).forEach((n, i) => {
            list += `${i + 1}. *${n.title}*\n`
            if (n.content && n.content !== n.title) {
              list += `   _${n.content.slice(0, 80).replace(/\n/g, ' ')}_\n`
            }
            list += `\n`
          })
          await sendVkMessage(fromId, list, mainKeyboard)
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 8. /matrix ───────────────────────────────────────────────────────────
      if (cmd === '/matrix' || cmd === '/eisenhower' || lower === 'матрица') {
        const tasks = await getAllTasks(vkChatId)
        const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done')
        const high = tasks.filter(t => t.priority === 'high' && t.status !== 'done')
        const normal = tasks.filter(t => (t.priority === 'medium' || t.priority === 'low') && t.status !== 'done')

        let msg = `🗂 *МАТРИЦА ЭЙЗЕНХАУЭРА*\n\n`
        msg += `🔥 *Срочно и важно (${urgent.length}):*\n`
        urgent.slice(0, 5).forEach(t => msg += ` • ${t.title}\n`)
        if (urgent.length === 0) msg += ` • (пусто)\n`

        msg += `\n⭐️ *Важно, не срочно (${high.length}):*\n`
        high.slice(0, 5).forEach(t => msg += ` • ${t.title}\n`)
        if (high.length === 0) msg += ` • (пусто)\n`

        msg += `\n▫️ *Текущие дела (${normal.length}):*\n`
        normal.slice(0, 5).forEach(t => msg += ` • ${t.title}\n`)

        await sendVkMessage(fromId, msg, mainKeyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 9. /name [Имя Фамилия] [ДД.ММ.ГГГГ] ──────────────────────────────────
      if (cmd === '/name' || cmd === '/setname') {
        const rawInput = parts.slice(1).join(' ').trim()
        if (!rawInput) {
          await sendVkMessage(fromId, '👤 Использование: /name Ваше Имя Фамилия [ДД.ММ.ГГГГ]\n\nПример: /name Кирилл Перекатнов 03.04.2010', mainKeyboard)
        } else {
          const { parseBirthday, broadcastMyBirthdayToFriends, updateUserNameCascade } = await import('@/lib/backend/db')
          const dateMatch = rawInput.match(/\b(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/)
          const parsedBday = dateMatch ? parseBirthday(dateMatch[1]) : null
          const cleanName = rawInput.replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, '').trim()

          const nameParts = cleanName.split(/\s+/).filter(Boolean)
          const first = nameParts[0] || vkFirstName
          const last = nameParts.slice(1).join(' ') || null

          await updateUserNameCascade(vkChatId, first, last)

          if (parsedBday) {
            await prisma.telegramChat.update({
              where: { chatId: vkChatId },
              data: { birthday: parsedBday.iso },
            }).catch(() => {})
            await broadcastMyBirthdayToFriends(String(vkChatId))
          }

          let respText = `✅ Твой профиль успешно обновлен во всей системе!\n• Имя: ${first}${last ? ' ' + last : ''}`
          if (parsedBday) {
            respText += `\n• День рождения: ${String(parsedBday.day).padStart(2, '0')}.${String(parsedBday.month).padStart(2, '0')}${parsedBday.year ? `.${parsedBday.year}` : ''} 🎉`
          }
          await sendVkMessage(fromId, respText, mainKeyboard)
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 10. /bday [ДД.ММ.ГГГГ] ───────────────────────────────────────────────
      if (cmd === '/bday' || cmd === '/birthday') {
        const dateArg = parts.slice(1).join(' ').trim()
        if (!dateArg) {
          await sendVkMessage(fromId, '🎂 Использование: /bday ДД.ММ.ГГГГ\n\nПример: /bday 03.04.2010', mainKeyboard)
        } else {
          const { parseBirthday, broadcastMyBirthdayToFriends } = await import('@/lib/backend/db')
          const parsed = parseBirthday(dateArg)
          if (parsed) {
            await prisma.telegramChat.upsert({
              where: { chatId: vkChatId },
              update: { birthday: parsed.iso },
              create: { chatId: vkChatId, birthday: parsed.iso },
            })
            await broadcastMyBirthdayToFriends(String(vkChatId))
            await sendVkMessage(fromId, `🎉 Твой День рождения (${String(parsed.day).padStart(2, '0')}.${String(parsed.month).padStart(2, '0')}${parsed.year ? `.${parsed.year}` : ''}) сохранен!\nДрузья увидят напоминание в календаре.`, mainKeyboard)
          } else {
            await sendVkMessage(fromId, '⚠️ Не удалось распознать дату. Попробуй: 03.04.2010', mainKeyboard)
          }
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 11. /friends ─────────────────────────────────────────────────────────
      if (cmd === '/friends' || lower === 'друзья') {
        const { getFriends } = await import('@/lib/backend/db')
        const friends = await getFriends(vkChatId)
        if (friends.length === 0) {
          await sendVkMessage(fromId, '👥 В твоем списке друзей пока никого нет.\nТы можешь добавить друзей в разделе «Команда» на сайте или поручить задачу по имени!', mainKeyboard)
        } else {
          let list = `👥 Твои друзья в Zerf AI (${friends.length}):\n\n`
          friends.forEach((f, i) => {
            const allowStr = f.allowTasks ? '✅ обмен задачами разрешен' : '🔒 задачи отключены'
            list += `${i + 1}. *${f.name}* (${allowStr})\n`
          })
          await sendVkMessage(fromId, list, mainKeyboard)
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 12. /send [@username/ID/Имя] [текст задачи] — Cross-Platform Delegation ──
      if (cmd === '/send') {
        const target = parts[1]
        const taskText = parts.slice(2).join(' ')
        if (!target || !taskText) {
          await sendVkMessage(fromId, '📨 Использование: /send @username текст задачи\n\nПример: /send @vasya купить молоко до 18:00', mainKeyboard)
        } else {
          const cleanUsername = target.replace('@', '').trim()
          let targetUser = await prisma.telegramChat.findFirst({
            where: {
              OR: [
                { username: { equals: cleanUsername, mode: 'insensitive' } },
                { firstName: { equals: cleanUsername, mode: 'insensitive' } },
              ],
            },
          })
          if (!targetUser && !isNaN(Number(cleanUsername))) {
            targetUser = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(cleanUsername) } })
          }

          if (!targetUser) {
            await sendVkMessage(fromId, `🔍 Пользователь «${cleanUsername}» не найден в Zerf.\nУбедись, что он запустил бота в Telegram или ВКонтакте!`, mainKeyboard)
          } else {
            const targetId = targetUser.chatId
            const parsedItems = await parseIntentWithGroq(taskText)
            const item = parsedItems[0] || {
              title: taskText.slice(0, 80),
              summary: taskText,
              priority: 'medium',
              dueDate: new Date().toISOString().slice(0, 10),
              tags: [],
            }

            const newTask = await prisma.task.create({
              data: {
                title: item.title,
                description: item.summary,
                priority: item.priority || 'medium',
                status: 'todo',
                dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
                dueTime: item.dueTime || null,
                tags: item.tags || [],
                ownerChatId: targetId,
                authorChatId: vkChatId,
                assignees: [String(vkChatId)],
                isShared: true,
              } as any,
            })

            // Notify recipient in Telegram or VK
            const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
            const notifyMsg = `📨 *${vkFirstName}* передал(а) тебе задачу из ВКонтакте!\n\n` +
              `📌 *«${item.title}»*\n` +
              (item.dueDate ? `📅 Срок: ${item.dueDate}${item.dueTime ? ` в ${item.dueTime}` : ''}\n` : '')

            let tgDelivered = false
            if (BOT_TOKEN) {
              try {
                const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: String(targetId),
                    text: notifyMsg,
                    parse_mode: 'Markdown',
                  }),
                })
                const tgData = await tgRes.json()
                if (tgData?.ok) tgDelivered = true
              } catch {}
            }

            if (!tgDelivered) {
              await sendVkMessage(String(targetId), notifyMsg.replace(/\*/g, ''))
            }

            await sendVkMessage(fromId, `✅ Задача «${item.title}» успешно передана пользователю ${targetUser.firstName || cleanUsername}!`, mainKeyboard)
          }
        }
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      // ── 13. Natural Language AI Parsing (Single & Delegated Tasks) ────────────
      const parsedItems = await parseIntentWithGroq(effectiveText)
      if (!parsedItems || parsedItems.length === 0) {
        await sendVkMessage(fromId, '💭 Зафиксировал, но не нашел конкретных задач. Напиши задачу или нажми /help!', mainKeyboard)
        return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }

      let responseMsg = userVoiceText ? `🎙 Распознано: «${userVoiceText}»\n\n` : ''

      for (const item of parsedItems) {
        const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(
          effectiveText,
          item.recipientName,
          item.isBothShared
        )

        if (cleanRecName || item.type === 'delegate') {
          const recName = cleanRecName || item.recipientName
          if (recName) {
            const matches = await findFriendMatches(vkChatId, recName)
            const allowedMatch = matches.find(m => m.isAllowed) || matches[0]

            if (allowedMatch && String(allowedMatch.friend.chatId) !== String(vkChatId)) {
              const friendUser = allowedMatch.friend
              const isBothShared = cleanIsBothShared

              await prisma.task.create({
                data: {
                  title: item.title,
                  description: item.summary,
                  priority: item.priority || 'medium',
                  status: 'todo',
                  dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
                  dueTime: item.dueTime || null,
                  tags: isBothShared ? ['общая', ...(item.tags || [])] : ['поручение', ...(item.tags || [])],
                  ownerChatId: friendUser.chatId,
                  authorChatId: vkChatId,
                  assignees: [String(vkChatId)],
                  isShared: true,
                } as any,
              })

              if (isBothShared) {
                await prisma.task.create({
                  data: {
                    title: item.title,
                    description: item.summary,
                    priority: item.priority || 'medium',
                    status: 'todo',
                    dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
                    dueTime: item.dueTime || null,
                    tags: ['общая', ...(item.tags || [])],
                    ownerChatId: vkChatId,
                    authorChatId: vkChatId,
                    assignees: [String(friendUser.chatId)],
                    isShared: true,
                  } as any,
                })
              }

              const notifyMsg = isBothShared
                ? `🤝 *${vkFirstName}* создал(а) общую задачу для вас двоих:\n📌 *«${item.title}»*\n` + (item.dueDate ? `📅 Срок: ${item.dueDate}${item.dueTime ? ` в ${item.dueTime}` : ''}\n` : '')
                : `📨 *${vkFirstName}* передал(а) тебе задачу:\n📌 *«${item.title}»*\n` + (item.dueDate ? `📅 Срок: ${item.dueDate}${item.dueTime ? ` в ${item.dueTime}` : ''}\n` : '')

              const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
              let tgDelivered = false
              if (BOT_TOKEN && friendUser.chatId) {
                try {
                  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: String(friendUser.chatId), text: notifyMsg, parse_mode: 'Markdown' }),
                  })
                  const tgData = await tgRes.json()
                  if (tgData?.ok) tgDelivered = true
                } catch {}
              }
              if (!tgDelivered) {
                await sendVkMessage(String(friendUser.chatId), notifyMsg.replace(/\*/g, ''))
              }

              responseMsg += isBothShared
                ? `🤝 Общая задача создана для вас и ${friendUser.firstName || recName}: «${item.title}»\n`
                : `👥 Поручено ${friendUser.firstName || recName}: «${item.title}»\n`
              continue
            }
          }
        }

        await saveParsedItemToDb(item, vkChatId)
        const typeLabel = item.type === 'note' ? '📝 Заметка' : item.type === 'goal' ? '🎯 Цель' : '✅ Задача'
        responseMsg += `${typeLabel}: «${item.title}»\n`
        if (item.dueDate) responseMsg += `📅 Дата: ${item.dueDate}\n`
        if (item.dueTime) responseMsg += `⏰ Время: ${item.dueTime}\n`
        responseMsg += `\n`
      }

      responseMsg += `Сохранено в твоем профиле Zerf AI!`
      await sendVkMessage(fromId, responseMsg, mainKeyboard)

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
