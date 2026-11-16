import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@dentweb/shared-types', '@dentweb/remotion-compositions'],
  // Same-origin API: cookies stay first-party on Vercel; the API lives on the VPS.
  async rewrites() {
    return {
      // Public landing is a static, gate-checked page in /public/landing; its relative assets resolve from "/".
      beforeFiles: [
        { source: '/', destination: '/landing/index.html' },
        { source: '/assets/:path*', destination: '/landing/assets/:path*' },
        { source: '/fonts/:path*', destination: '/landing/fonts/:path*' },
        { source: '/render-loop.js', destination: '/landing/render-loop.js' },
        { source: '/favicon.svg', destination: '/landing/favicon.svg' },
      ],
      afterFiles: [{ source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` }],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
