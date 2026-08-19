/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://vk.com https://*.vk.com https://m.vk.com https://vk.ru https://*.vk.ru https://*.vk-apps.com https://*.vk-apps.ru https://*.vk-portal.net https://vk.me https://*.vk.me https://web.telegram.org https://*.telegram.org https://*.t.me",
          },
        ],
      },
    ]
  },
}

export default nextConfig
