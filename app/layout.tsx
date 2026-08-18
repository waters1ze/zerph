import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'

// CSS-переменная вместо className: стек шрифтов задаётся в globals.css
// (@theme --font-sans), куда входит и монохромный Noto Emoji для эмодзи
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' })

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
    default: 'Zerf Note — Умный Планировщик Задач, Заметки и ИИ-Ассистент | Онлайн Таск-Менеджер',
    template: '%s | Zerf Note'
  },
  description: 'Zerf Note — бесплатный умный планировщик задач, заметок и проектов с ИИ-ассистентом. Голосовой ввод дел, живые таймеры до дедлайнов, матрица Эйзенхауэра, канбан-доски и синхронизация с Telegram и VK.',
  keywords: [
    'Zerf Note',
    'Zerf',
    'Zerph',
    'планировщик задач',
    'планировщик задач онлайн',
    'умный таск менеджер',
    'заметки онлайн',
    'список дел на день',
    'голосовые напоминания',
    'матрица эйзенхауэра онлайн',
    'трекер целей',
    'канбан доска для проектов',
    'тайм менеджмент',
    'ИИ ассистент по продуктивности',
    'таймер обратного отсчета',
    'синхронизация с календарем'
  ],
  authors: [{ name: 'Zerf Note Team', url: APP_URL }],
  creator: 'Zerf Note',
  publisher: 'Zerf Note',
  category: 'Productivity',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION || 'google1cf58876479fe2e3',
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || process.env.YANDEX_VERIFICATION || '5f45b0a0a8aac467',
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    alternateLocale: 'en_US',
    url: APP_URL,
    title: 'Zerf Note — Умный Планировщик Задач, Заметки и ИИ-Ассистент',
    description: 'Структурированные заметки, голосовой ввод задач, живые дедлайны, цели и синхронизация с Telegram и VK.',
    siteName: 'Zerf Note',
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Zerf Note Command Center',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zerf Note — Умный Планировщик Задач & Заметки',
    description: 'Голосовые команды, таймеры обратного отсчета, умные списки, заметки и цели.',
    images: [`${APP_URL}/og-image.png`],
  },
  alternates: {
    canonical: APP_URL,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zerf Note',
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

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Zerf Note',
    url: APP_URL,
    description: 'Умный планировщик задач, заметок и ИИ-ассистент продуктивности',
    inLanguage: 'ru',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${APP_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zerf Note',
    operatingSystem: 'Windows, macOS, iOS, Android, Linux, Web',
    applicationCategory: 'ProductivityApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
    },
    description: 'Умный планировщик задач, система заметок, живой обратный отсчет до дедлайнов, голосовые команды и синхронизация с Telegram и VK.',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.95',
      ratingCount: '1580',
    },
    featureList: [
      'Голосовой ввод задач с распознаванием даты и времени',
      'Структурированные заметки и списки',
      'Живой таймер обратного отсчета до ближайшего дедлайна',
      'Матрица Эйзенхауэра (Срочно / Важно)',
      'Канбан-доски и совместные командные проекты',
      'Двусторонняя синхронизация с Apple и Google Календарями',
      'ИИ-ассистент продуктивности на русском языке'
    ]
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Zerf Note',
    url: APP_URL,
    logo: `${APP_URL}/icon-512.png`,
    sameAs: [
      'https://t.me/Zerph_bot',
      'https://vk.com/im?sel=-240878278'
    ]
  }
]

import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'

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
        <meta name="apple-mobile-web-app-title" content="Zerf Note" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Zerf Note" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <Script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js" strategy="afterInteractive" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = {};
                var raw = localStorage.getItem('zerf-settings');
                if (raw) s = JSON.parse(raw);
                var theme = s.theme || 'strict';
                if (theme === 'light') theme = 'paper';
                var isDark = theme !== 'paper' && theme !== 'blue';
                var root = document.documentElement;
                root.classList.add('theme-' + theme);
                if (isDark) root.classList.add('dark');
                if (s.density) root.classList.add('density-' + s.density);
                if (s.borderRadius) root.classList.add('radius-' + s.borderRadius);
                if (s.roundShapes === false) root.classList.add('shapes-square');
              } catch (e) {}
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary`}>
        <LanguageProvider>
          <ConfirmDialogProvider>
            {children}
          </ConfirmDialogProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
