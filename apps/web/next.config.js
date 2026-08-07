const createNextIntlPlugin = require('next-intl/plugin');

// next-intl plugin wires the request-time config at
// `src/i18n/request.ts` so server components can call
// `getTranslations()` without per-route boilerplate.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
  async redirects() {
    return [
      // Temporary compatibility aliases while `/` becomes the canonical Hub.
      // Next forwards request query parameters when the destination defines
      // none, so `/hub?sheet=profile` becomes `/?sheet=profile`.
      { source: '/hub', destination: '/', permanent: false },
      { source: '/en/hub', destination: '/', permanent: false },
      { source: '/es/hub', destination: '/es', permanent: false },
    ];
  },
  async rewrites() {
    return [
      // Legacy alias: /play-hub still points at /exercises. With the
      // [locale] segment, the rewrite has to be locale-aware OR else
      // /en/play-hub returns 404. Two sources cover naked + prefixed.
      { source: '/play-hub', destination: '/exercises' },
      { source: '/:locale/play-hub', destination: '/:locale/exercises' },
    ];
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
  webpack: (config, { isServer, dir }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage": false,
      "@react-native-async-storage/async-storage": false,
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')

    // Seal the build with a fingerprint of the sources that produced it, so
    // `pnpm bundle:guard` can refuse to audit a stale `.next` instead of
    // reporting green about a bundle nobody built. Client compilation only —
    // the server pass would just rewrite the same file.
    // ⛔ Deliberately NOT mtime: a checkout rewrites timestamps without
    // changing content, and a `touch` changes them without changing anything.
    if (!isServer) {
      const { writeFileSync, mkdirSync } = require('node:fs')
      const path = require('node:path')
      const {
        computeSourceFingerprint,
        STAMP_FILE,
      } = require('./scripts/lib/source-fingerprint.cjs')
      const { fingerprint, files } = computeSourceFingerprint()
      const outDir = path.join(dir, '.next')
      mkdirSync(outDir, { recursive: true })
      writeFileSync(
        path.join(outDir, STAMP_FILE),
        JSON.stringify({ fingerprint, files, stampedAt: new Date().toISOString() }, null, 2),
      )
    }

    return config
  },
};

module.exports = withNextIntl(nextConfig);
