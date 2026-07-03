/** @type {import('next').NextConfig} */
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const nextConfig = {
  output: 'standalone', // Required for Docker production image
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3005'] },
  },
  // Proxy API calls from Next.js server to the gateway
  // so the browser never needs to know about internal service URLs
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;