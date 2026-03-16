/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage": false,
      "@react-native-async-storage/async-storage": false,
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  async headers() {
    return [
      {
        // Cross-origin isolation for SharedArrayBuffer (Stockfish WASM).
        // Applied globally because Next.js SPA navigation skips headers on
        // route-scoped responses. Using "credentialless" COEP to avoid
        // blocking external resources. TODO: test in MiniPay WebView.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/engines/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
