import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return new NextResponse('google-site-verification: google1cf58876479fe2e3.html', {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
