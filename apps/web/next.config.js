/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Surface the deploy identity to the client bundle so a small chip
  // can confirm "the new code is loaded". Vercel auto-populates
  // VERCEL_GIT_COMMIT_SHA at build time; locally it falls back to
  // "dev" so the chip is still informative during development.
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7),
  },
  async rewrites() {
    return [{ source: '/play-hub', destination: '/' }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage": false,
      "@react-native-async-storage/async-storage": false,
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
};

module.exports = nextConfig;
