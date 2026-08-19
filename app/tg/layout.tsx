import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Zerf — Telegram Mini App',
  description: 'Zerf AI Personal Command Center — Telegram Mini App',
}

export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="telegram-webapp-container min-h-screen w-full bg-background text-foreground">
      {children}
    </div>
  )
}
