import fs from 'fs'
import path from 'path'

const filePath = path.join(__dirname, '../app/api/telegram/route.ts')
let content = fs.readFileSync(filePath, 'utf-8')

// 1. Add handleFriendRequestIntent before handleInviteCommand
const targetFunc = 'async function handleInviteCommand('
const newFuncCode = `async function handleFriendRequestIntent(chatId: number, targetUsername: string, senderName: string) {
  const cleanUsername = targetUsername.replace(/^@/, '').trim()
  if (!cleanUsername) {
    await send(chatId, 'Укажите @username пользователя, например: \`кинь @username запрос в друзья\`')
    return
  }

  const targetUser = await prisma.telegramChat.findFirst({
    where: { username: { equals: cleanUsername, mode: 'insensitive' } }
  })

  const myUser = await prisma.telegramChat.findUnique({
    where: { chatId: BigInt(chatId) }
  })
  const myName = senderName || myUser?.firstName || 'Пользователь'

  if (targetUser && Number(targetUser.chatId) === chatId) {
    await send(chatId, 'Вы не можете отправить запрос в друзья самому себе.')
    return
  }

  if (targetUser) {
    const friendId = Number(targetUser.chatId)
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userChatId: BigInt(chatId), friendChatId: targetUser.chatId },
          { userChatId: targetUser.chatId, friendChatId: BigInt(chatId) },
        ]
      }
    })

    if (existing && existing.status === 'accepted') {
      await send(chatId, \`🤝 Вы и *\${escMd(targetUser.firstName || \`@\${targetUser.username}\`)}* уже являетесь друзьями в Zerf!\`, { reply_markup: miniAppKeyboard(chatId) })
      return
    }

    await prisma.friendship.upsert({
      where: { userChatId_friendChatId: { userChatId: BigInt(chatId), friendChatId: targetUser.chatId } },
      update: { status: 'pending' },
      create: { userChatId: BigInt(chatId), friendChatId: targetUser.chatId, status: 'pending' }
    })

    await send(friendId,
      \`🤝 *Новый запрос в друзья в Zerf AI!*\\n\\n\` +
      \`Пользователь *\${escMd(myName)}*\${myUser?.username ? \` (@\${myUser.username})\` : ''} отправил(а) вам запрос в друзья!\`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Принять', callback_data: \`friend_accept_\${chatId}\` },
              { text: '❌ Отклонить', callback_data: \`friend_decline_\${chatId}\` }
            ]
          ]
        }
      }
    )

    await send(chatId,
      \`🤝 *Запрос в друзья успешно отправлен @\${targetUser.username || cleanUsername} (\${escMd(targetUser.firstName || '')})!* 🎉\\n\\n\` +
      \`Пользователь получил уведомление в Telegram с кнопками подтверждения. Как только он нажмет «Принять», он появится в вашем списке друзей на сайте и в CLI!\`,
      { reply_markup: miniAppKeyboard(chatId) }
    )
  } else {
    const inviteUrl = \`https://t.me/Zerph_bot?start=invite_\${chatId}\`
    await send(chatId,
      \`🤝 *Пользователь @\${cleanUsername} пока не зарегистрирован в Zerf.*\\n\\n\` +
      \`Отправьте ему персональную ссылку-приглашение:\\n\` +
      \`\` + inviteUrl + \`\` + \`\\n\\n\` +
      \`_Как только @\${cleanUsername} перейдет по ссылке и нажмет Start, вы автоматически станете друзьями!_\`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: \`↗ Переслать приглашение @\${cleanUsername}\`,
                url: \`https://t.me/share/url?url=\${encodeURIComponent(inviteUrl)}&text=\${encodeURIComponent('Привет! Добавляйся ко мне в друзья в Zerf AI:')}\`
              }
            ]
          ]
        }
      }
    )
  }
}

async function handleInviteCommand(`

if (content.includes(targetFunc) && !content.includes('handleFriendRequestIntent')) {
  content = content.replace(targetFunc, newFuncCode)
}

// 2. Add natural language matching in processText
const naturalMatcherAnchor = 'const tzNaturalMatch = trimmed.match('
const friendIntentMatcher = `// Natural language Friend Request
        const friendReqMatch = trimmed.match(/(?:кинь|отправь|пошли|сделай|подай|добавь|пригласи|подружись\\s+с|подружи\\s+меня\\s+с|запрос\\s+в\\s+друзья)\\s+(?:запрос\\s+в\\s+друзья\\s+)?(?:пользователю\\s+|пользователя\\s+|друга\\s+|контакт\\s+)?@?([a-zA-Z0-9_]{3,32})(?:\\s+запрос\\s+в\\s+друзья|\\s+в\\s+друзья|\\s+в\\s+команду)?/i) ||
                               trimmed.match(/@([a-zA-Z0-9_]{3,32})\\s+(?:в\\s+друзья|запрос\\s+в\\s+друзья|добавь\\s+в\\s+друзья)/i)
        if (friendReqMatch && (lowerText.includes('друг') || lowerText.includes('друзья') || lowerText.includes('запрос') || lowerText.includes('добавь') || lowerText.includes('кинь'))) {
          const targetUsername = friendReqMatch[1]
          await handleFriendRequestIntent(chatId, targetUsername, firstName)
          return NextResponse.json({ ok: true })
        }

        const tzNaturalMatch = trimmed.match(`

if (content.includes(naturalMatcherAnchor) && !content.includes('friendReqMatch')) {
  content = content.replace(naturalMatcherAnchor, friendIntentMatcher)
}

// 3. Add /friend and /invite commands
const cmdAnchor = "} else if (cmd === '/start' || cmd === '/help') {"
const cmdAddition = `} else if (cmd === '/invite' || cmd === '/friend' || cmd === '/addfriend') {
        const targetUsername = parts[1] || ''
        await handleFriendRequestIntent(chatId, targetUsername, firstName)
      } else if (cmd === '/start' || cmd === '/help') {`

if (content.includes(cmdAnchor) && !content.includes("cmd === '/friend'")) {
  content = content.replace(cmdAnchor, cmdAddition)
}

fs.writeFileSync(filePath, content, 'utf-8')
console.log('Successfully updated app/api/telegram/route.ts!')
