const path = require('path');

/** @type {import('next').NextConfig} */
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://motacare-gateway:3000';

const nextConfig = {
  output: 'standalone', // Required for Docker production image
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3005'] },
    // Pins the monorepo root Next.js traces dependencies from when
    // building the standalone output. Without this it auto-detects by
    // searching upward for a lockfile, which works but is one more
    // thing that can silently pick the wrong boundary in a Docker
    // build context — pinning it removes the guesswork.
    outputFileTracingRoot: path.join(__dirname, '../../'),
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