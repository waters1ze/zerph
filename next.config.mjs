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
            value: "frame-ancestors 'self' https://vk.com https://*.vk.com https://vk.me https://*.vk.me https://web.telegram.org https://*.telegram.org https://*.t.me",
          },
        ],
      },
    ]
  },
}

export default nextConfig
