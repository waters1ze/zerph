import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Zerf — Telegram',
  description: 'Zerf AI Personal Command Center — Telegram Mini App',
}

export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="bg-background text-foreground font-sans antialiased min-h-screen overflow-x-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
