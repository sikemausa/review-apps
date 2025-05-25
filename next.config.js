/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0'
          }
        ]
      }
    ]
  },
  
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Enable strict mode
  reactStrictMode: true,
  
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  
  // Image optimization
  images: {
    domains: ['avatars.githubusercontent.com'],
    minimumCacheTTL: 60,
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  }
}

module.exports = nextConfig