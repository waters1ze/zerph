import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { ImageResponse } from 'next/og'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { cardSignature } from '@/lib/backend/cards'
import {
  collectWeeklyStats,
  collectYearlyStats,
  buildPortrait,
  WeeklyCardStats,
  YearlyCardStats,
  Portrait,
} from '@/lib/backend/cards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Viral share-cards (PNG). Auth: verified session OR signed capability link
 * (?chatId=&sig=) so the Telegram bot can fetch the image server-side.
 * Every card carries a watermark -> free distribution loop.
 */

const WATERMARK = '@Zerph_bot · zerfnote.app'

const CARD_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  padding: '48px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  background: 'linear-gradient(135deg, #090d16 0%, #101a33 60%, #0d1226 100%)',
  color: '#e8ecf7',
  fontFamily: 'sans-serif',
  borderRadius: 0,
}

const Stat = ({ value, label }: { value: string | number; label: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ fontSize: 64, fontWeight: 700, color: '#38bdf8' }}>{value}</div>
    <div style={{ fontSize: 22, opacity: 0.7 }}>{label}</div>
  </div>
)

const Header = ({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div style={{ fontSize: 26, letterSpacing: 2, color: '#818cf8', textTransform: 'uppercase' }}>
      {emoji} Zerf Note
    </div>
    <div style={{ fontSize: 52, fontWeight: 700, marginTop: 8 }}>{title}</div>
    {subtitle ? <div style={{ fontSize: 24, opacity: 0.65, marginTop: 4 }}>{subtitle}</div> : null}
  </div>
)

const Footer = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, opacity: 0.5 }}>
    <div>Создано в Zerf Note</div>
    <div>{WATERMARK}</div>
  </div>
)

function WeeklyCard({ s }: { s: WeeklyCardStats }) {
  return (
    <div style={CARD_STYLE}>
      <Header emoji="📊" title="Моя неделя" subtitle={s.weekLabel} />
      <div style={{ display: 'flex', justifyContent: 'space-around', margin: '32px 0' }}>
        <Stat value={s.tasksCompleted} label="выполнено" />
        <Stat value={s.tasksCreated} label="создано" />
        <Stat value={s.notesCreated} label="заметок" />
      </div>
      <div style={{ fontSize: 28, display: 'flex', justifyContent: 'space-between', opacity: 0.85 }}>
        <div>🔥 Streak: {s.streakDays} дн.</div>
        <div>📅 Лучший день: {s.bestDay}{s.bestDayCount ? ` (${s.bestDayCount})` : ''}</div>
      </div>
      <Footer />
    </div>
  )
}

function PortraitCard({ p }: { p: Portrait & { stats: WeeklyCardStats } }) {
  const axisRows: Array<[string, number]> = [
    ['Фокус', Math.round(p.axes.focus)],
    ['Стабильность', Math.round(p.axes.consistency)],
    ['Завершение', Math.round(p.axes.completion)],
    ['Планирование', Math.round(p.axes.planning)],
    ['Командность', Math.round(p.axes.social)],
  ]
  return (
    <div style={CARD_STYLE}>
      <Header emoji={p.emoji} title={`Вы — ${p.title}`} />
      <div style={{ fontSize: 26, lineHeight: 1.4, opacity: 0.9, margin: '20px 0' }}>{p.tagline}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {axisRows.map(([label, v]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 190, fontSize: 22, opacity: 0.75 }}>{label}</div>
            <div style={{ flex: 1, height: 18, background: '#1c2540', borderRadius: 9, display: 'flex' }}>
              <div style={{
                width: `${v}%`,
                height: '100%',
                borderRadius: 9,
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
              }} />
            </div>
            <div style={{ width: 56, textAlign: 'right', fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  )
}

function YearlyCard({ y }: { y: YearlyCardStats }) {
  return (
    <div style={CARD_STYLE}>
      <Header emoji="🏆" title={`${y.year} в цифрах`} subtitle="Ваш год в Zerf Note" />
      <div style={{ display: 'flex', justifyContent: 'space-around', margin: '28px 0' }}>
        <Stat value={y.totalCompleted} label="задач закрыто" />
        <Stat value={y.activeDays} label="активных дней" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 27 }}>
        <div>🔥 Топ-стрик: <b>{y.topHabitStreak}</b>{y.topHabitName ? ` — «${y.topHabitName}»` : ''}</div>
        <div>📈 Лучший месяц: <b>{y.bestMonth}</b>{y.bestMonthCount ? ` (${y.bestMonthCount})` : ''}</div>
      </div>
      <Footer />
    </div>
  )
}

function MilestoneCard({ streak, name }: { streak: number; name: string }) {
  return (
    <div style={CARD_STYLE}>
      <Header emoji="🔥" title={`${streak} дней подряд!`} subtitle={name || undefined} />
      <div style={{ fontSize: 30, lineHeight: 1.45, opacity: 0.9 }}>
        Вы держите темп день за днём.
        {'\n'}Такая стабильность — редкость.
      </div>
      <div style={{ fontSize: 40 }}>🔥🔥🔥</div>
      <Footer />
    </div>
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params
  const url = new URL(req.url)
  const sig = url.searchParams.get('sig')

  // Identity: verified session OR capability signature (bot/Telegram fetch).
  let chatIdStr: string | null = null
  const authUser = await getAuthenticatedUser(req).catch(() => null)
  if (authUser) {
    chatIdStr = authUser.chatId
  } else if (sig) {
    const qChat = url.searchParams.get('chatId')
    const expected = qChat && /^\d+$/.test(qChat.trim()) ? cardSignature(kind, qChat.trim()) : null
    if (
      expected &&
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      chatIdStr = qChat!.trim()
    }
  }

  if (!chatIdStr || !/^\d+$/.test(chatIdStr)) {
    return new Response('Unauthorized', { status: 401 })
  }
  const chatId = BigInt(chatIdStr)

  try {
    let card: React.ReactNode
    switch (kind) {
      case 'weekly': {
        card = <WeeklyCard s={await collectWeeklyStats(chatId)} />
        break
      }
      case 'portrait': {
        card = <PortraitCard p={await buildPortrait(chatId)} />
        break
      }
      case 'yearly': {
        card = <YearlyCard y={await collectYearlyStats(chatId)} />
        break
      }
      case 'milestone': {
        const chat = await (await import('@/lib/backend/prisma')).prisma.telegramChat.findUnique({
          where: { chatId },
          select: { streakDays: true, firstName: true },
        })
        card = <MilestoneCard streak={chat?.streakDays || 0} name={chat?.firstName || ''} />
        break
      }
      default:
        return Response.json({ error: 'Unknown kind' }, { status: 404 })
    }

    return new ImageResponse(card as any, {
      width: 1080,
      height: 1080,
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    console.error(`[cards:${kind}] render error:`, err)
    return Response.json({ error: 'Render failed' }, { status: 500 })
  }
}
