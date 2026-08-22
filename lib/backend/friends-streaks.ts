import { prisma } from './prisma'

/**
 * Social streak layer (feature: friends streaks).
 * Privacy: a user's streak is visible only when their `streakVisible` flag
 * is ON (default). Self is always included.
 */

export interface LeaderboardEntry {
  chatId: string
  name: string
  streak: number | null // null = hidden by privacy
  rank: number | null
  isMe: boolean
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** Leaderboard among the caller's accepted friends + self. */
export async function getFriendsLeaderboard(myChatId: bigint): Promise<{
  entries: LeaderboardEntry[]
  nudges: string[]
}> {
  const friendships = await prisma.friendship.findMany({
    where: { userChatId: myChatId, status: 'accepted' },
    select: { friendChatId: true },
  })
  const friendIds = friendships.map(f => f.friendChatId)

  const ids = [...new Set([myChatId, ...friendIds])]
  const users = await prisma.telegramChat.findMany({
    where: { chatId: { in: ids } },
    select: { chatId: true, firstName: true, lastName: true, streakDays: true, streakVisible: true },
  })

  const entries: LeaderboardEntry[] = users
    .map(u => {
      const isMe = u.chatId === myChatId
      const visible = isMe || u.streakVisible
      return {
        chatId: String(u.chatId),
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Пользователь Zerf',
        streak: visible ? (u.streakDays || 0) : null,
        rank: null as number | null,
        isMe,
      }
    })
    .sort((a, b) => (b.streak ?? -1) - (a.streak ?? -1))

  let displayRank = 1
  for (const e of entries) {
    if (e.streak !== null) {
      e.rank = displayRank
      displayRank++
    }
  }

  return { entries, nudges: buildStreakNudges(entries) }
}

/** Pure function — deterministic social-pressure copy. */
export function buildStreakNudges(entries: LeaderboardEntry[]): string[] {
  const me = entries.find(e => e.isMe)
  if (!me || me.streak === null) return []

  const nudges: string[] = []
  const ahead = entries.filter(e => !e.isMe && (e.streak ?? -1) > (me.streak ?? -1))
  const behind = entries.filter(e => !e.isMe && (e.streak ?? -1) < (me.streak ?? -1))

  if (ahead.length > 0 && me.streak > 0) {
    const top = ahead[0]
    nudges.push(`У ${top.name} стрик ${top.streak} дн., у тебя ${me.streak} — не отставай!`)
  } else if (ahead.length > 0 && me.streak === 0) {
    nudges.push(`${ahead[0].name} уже на огоньке — начни сегодня и обгони!`)
  }

  if (behind.length > 0 && (me.streak ?? 0) >= 3) {
    nudges.push(`Ты впереди ${behind.length} ${plural(behind.length, 'друга', 'друзей', 'друзей')} по стрику. Держи темп!`)
  }

  return nudges
}
