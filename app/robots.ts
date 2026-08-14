import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/admin/', '/api/cron/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
