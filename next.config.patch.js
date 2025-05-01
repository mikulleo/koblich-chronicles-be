import { withPayload } from '@payloadcms/next/withPayload'
import redirects from './redirects.js'

// Helper function to ensure URL has protocol
function ensureProtocol(url) {
  if (!url) return 'http://localhost:3000'
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : ensureProtocol(process.env.NEXT_PUBLIC_SERVER_URL) || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  reactStrictMode: true,
  redirects,
  // Force dynamic rendering for all pages in production
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
}

export default withPayload(nextConfig)
