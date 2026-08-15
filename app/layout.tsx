import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

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
    default: 'Zerf Note — Умный Планировщик Задач, Заметки и ИИ-Ассистент',
    template: '%s | Zerf Note'
  },
  description: 'Экосистема персональной продуктивности: структурированные заметки, голосовые задачи, умные напоминания, трекер целей и синхронизация в реальном времени.',
  keywords: [
    'Zerf Note',
    'планировщик задач',
    'умные заметки',
    'таск менеджер',
    'умный таймер',
    'обратный отсчет до задачи',
    'ИИ ассистент',
    'голосовые напоминания',
    'тайм менеджмент',
    'Zerf',
    'Zerph'
  ],
  authors: [{ name: 'Zerf Note Team' }],
  creator: 'Zerf Note',
  publisher: 'Zerf Note',
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
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Zerf" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Zerf" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js" strategy="beforeInteractive" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (window.vkBridge) {
                  window.vkBridge.send('VKWebAppInit');
                }
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(JSON.stringify({ type: 'VKWebAppInit', data: {} }), '*');
                  window.parent.postMessage({ type: 'VKWebAppInit', data: {} }, '*');
                }
              } catch(e) {}
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration skipped:', err);
                  });
                });
              }
            `,
          }}
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
