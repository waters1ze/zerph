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
            value: "frame-ancestors * 'self' https://*.telegram.org https://telegram.org https://web.telegram.org https://webk.telegram.org https://webz.telegram.org https://*.t.me https://t.me https://vk.com https://*.vk.com https://m.vk.com https://vk.ru https://*.vk.ru https://*.vk-apps.com https://*.vk-apps.ru https://*.vk-portal.net https://vk.me https://*.vk.me",
          },
        ],
      },
    ]
  },
}

export default nextConfig
