import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zerf AI — Умный Планировщик & Тайм-Менеджер',
    short_name: 'Zerf AI',
    description: 'Интеллектуальный ИИ-ассистент, голосовые напоминания, таймеры, цели и совместная работа.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#2d7a4f',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
