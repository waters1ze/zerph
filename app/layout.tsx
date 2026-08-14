import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zerph.vercel.app'

export const viewport: Viewport = {
  themeColor: '#090d16',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Zerf AI — Умный Планировщик Задач, Тайм-Менеджер и ИИ Ассистент',
    template: '%s | Zerf AI'
  },
  description: 'Экосистема персональной продуктивности: голосовые задачи, умные таймеры с обратным отсчетом, трекер целей, помодоро и синхронизация с Apple/Google Календарем.',
  keywords: [
    'планировщик задач',
    'таск менеджер',
    'умный таймер',
    'обратный отсчет до задачи',
    'помодоро таймер онлайн',
    'ИИ ассистент',
    'голосовые напоминания',
    'тайм менеджмент',
    'AI productivity',
    'Zerf AI',
    'Zerph',
    'синхронизация с календарем'
  ],
  authors: [{ name: 'Zerf AI Team' }],
  creator: 'Zerf AI',
  publisher: 'Zerf AI',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    alternateLocale: 'en_US',
    url: APP_URL,
    title: 'Zerf AI — Интеллектуальный Планировщик и Тайм-Менеджер',
    description: 'Управляйте делами голосом, ставьте живые таймеры до дедлайнов, отслеживайте стрики продуктивности и синхронизируйте задачи с календарями.',
    siteName: 'Zerf AI',
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Zerf AI Command Center',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zerf AI — Умный Планировщик Задач',
    description: 'Голосовые команды, таймеры обратного отсчета, умные списки и цели.',
    images: [`${APP_URL}/og-image.png`],
  },
  alternates: {
    canonical: APP_URL,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Zerf AI',
  operatingSystem: 'All',
  applicationCategory: 'ProductivityApplication',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'RUB',
  },
  description: 'AI-powered task management, live deadline countdown timers, voice assistant, and calendar synchronization.',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '1240',
  },
  featureList: [
    'Voice-to-task parsing with AI',
    'Live task countdown timer',
    'Pomodoro Focus Mode',
    'Two-way Apple & Google Calendar Sync',
    'Interactive subtasks & checklists',
    'Streak productivity gamification'
  ]
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
