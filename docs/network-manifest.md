# Network Manifest — Chesscito

**Audit date:** 2026-03-23
**Method:** Manual code inspection of `apps/web/src/`
**App URL:** https://chesscito.vercel.app

## External Origins

| Host | Protocol | Purpose | CSP Directive |
|------|----------|---------|---------------|
| `forno.celo.org` | HTTPS | Celo Mainnet RPC (default fallback via `CELO_RPC_URL`) | `connect-src` |
| `sepolia.forno.celo.org` | HTTPS | Celo Sepolia RPC (wagmi celoSepolia chain transport) | `connect-src` |
| `api.openai.com` | HTTPS | LLM inference — Coach analyze endpoint (default fallback via `COACH_LLM_BASE_URL`) | `connect-src` |
| `*.upstash.io` | HTTPS | Upstash Redis — rate limiting, job queue, coach credits, game records (`UPSTASH_REDIS_REST_URL`) | `connect-src` |
| `api.passport.xyz` | HTTPS | Gitcoin Passport score check — leaderboard gating (`PASSPORT_API_KEY`) | `connect-src` |
| `celoscan.io` | HTTPS | Block explorer — transaction receipt links (mainnet) | `connect-src` |
| `sepolia.celoscan.io` | HTTPS | Block explorer — transaction receipt links (Celo Sepolia) | `connect-src` |
| `alfajores.celoscan.io` | HTTPS | Block explorer — transaction receipt links (Alfajores, legacy) | `connect-src` |
| `docs.celo.org` | HTTPS | External documentation link — "Get MiniPay" connect button | `connect-src` |
| `passport.gitcoin.co` | HTTPS | Gitcoin Passport onboarding link — shown in UI when passport not verified | `connect-src` |
| `x.com` | HTTPS | Twitter/X share intent — victory share button | `connect-src` |
| `wa.me` | HTTPS | WhatsApp share link — victory share button | `connect-src` |
| `github.com` | HTTPS | Bug report link — feedback item in editorial.ts (`/akawolfcito/chesscito/issues`) | `connect-src` |
| `*.walletconnect.com` | HTTPS/WSS | WalletConnect v2 relay — RainbowKit wallet connection (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`) | `connect-src` |
| `explorer-api.walletconnect.com` | HTTPS | WalletConnect wallet registry — injected wallet discovery via RainbowKit | `connect-src` |

## Notes

- **No analytics vendors**: no Google Analytics, Mixpanel, Segment, Plausible, or similar. Confirmed by code inspection and corroborated by the Privacy Policy copy in `editorial.ts`.
- **No ad networks**: no ad SDK or tracking pixel found anywhere in `apps/web/src/`.
- **No CDN asset loading**: all fonts, icons, and images are self-hosted or bundled. No Google Fonts, no Cloudflare CDN, no jsDelivr.
- **RPC URL is configurable**: `forno.celo.org` is the default; operators can override with `CELO_RPC_URL` (server-side routes) or wagmi's default transport (client-side). Wagmi uses the chain's built-in public RPC when `http()` is called with no URL.
- **OpenAI base URL is configurable**: `COACH_LLM_BASE_URL` defaults to `https://api.openai.com/v1`. Any OpenAI-compatible endpoint can be substituted (e.g. a self-hosted proxy).
- **Upstash host is dynamic**: resolved at runtime from `UPSTASH_REDIS_REST_URL` env var. The wildcard `*.upstash.io` covers standard Upstash regional endpoints.
- **WalletConnect hosts**: RainbowKit v2 / WalletConnect v2 contacts `relay.walletconnect.com` (WSS) and `explorer-api.walletconnect.com` (HTTPS) internally. These are not explicitly referenced in source code but are required by the wagmi/RainbowKit dependency.
- **Alfajores (`44787`) is deprecated** in the app but the `txLink()` helper still emits the subdomain for that chain ID; kept in manifest for completeness.
