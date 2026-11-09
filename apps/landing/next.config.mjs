import createNextIntlPlugin from 'next-intl/plugin';

// Wires the request-time config at src/i18n/request.ts so server
// components under app/[locale]/** can call getTranslations() /
// useTranslations() without per-route boilerplate. Scoped to the
// onboarding route only — /classic and /stats stay locale-agnostic
// (excluded via middleware.ts's matcher).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // Resolve React runtime through Next's own aliases/conditions. These paths
    // select local React 19 declarations only for the TypeScript checker.
    for (const plugin of config.resolve.plugins ?? []) {
      if (plugin.constructor.name === 'JsConfigPathsPlugin') {
        plugin.paths = Object.fromEntries(Object.entries(plugin.paths).filter(([name]) => name !== 'react' && name !== 'react/*'));
      }
    }
    return config;
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
};

export default withNextIntl(nextConfig);
