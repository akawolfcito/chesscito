# Chesscito — Play / Learn environment audit

> Archived evidence: this report describes its dated observation/source snapshot, not current production state or authorization to execute its recommendations. As of this curation, the operator reports www on Cloudflare and Play/Learn stable; main contains adaptive and bounded cron fixes. Source paths, inventories, platform limits, access failures and deployment assumptions below may have changed. See [the curation review](2026-10-05-infrastructure-worktree-curation.md).


Date: 2026-10-04. Source snapshot: `78c599ca` on `migration/www-vinext-poc`. Read-only application/configuration discovery; this requested report is the only repository file created by this audit.

## Status and evidence boundary

**EXACT NAMES-ONLY PRODUCTION RECONCILIATION COMPLETE.** The latest user-supplied Play and Learn lists are the source of truth for configured names. Verified: **Play 50; Learn 52; shared 46; Play-only 4; Learn-only 6; unique total 56**, with no duplicate names within either list. These verify the supplied inventories, not a separate live Vercel API snapshot.

No values were inspected. Configured-name presence does not prove a feature is enabled, a value differs from its default, a credential is valid, or two addresses/secrets agree. The updated decision matrix and **Final operational ownership resolution** provide the authoritative migration classifications. Only ADMIN_TOKEN remains UNRESOLVED_EXTERNAL_ONLY for both apps; earlier ownership holds below are historical context. COPY_IF_FEATURE_ENABLED explicitly preserves the conditional feature dependency. This audit cannot calculate a mathematically smallest value-aware manifest or certify full runtime parity without those checks, and does not pretend otherwise.

Only this Markdown report was updated. No code, templates, Git index, Vercel, Supabase, DNS, credentials, deployment or scheduled job was changed. Real env files, private files and secret stores were not opened. No build/backend calls were executed. Previously proven code/history conclusions and the full reference index are retained.

## Discovery method

- Searched tracked repository sources, configurations, scripts, tests and documentation for dot and literal-bracket `process.env`, `import.meta.env`, and dynamic/destructured readers. Expanded safe untracked source discovery for wrapper/workflow references.
- Traced `requireEnv(name)` call sites in `demo-signing.ts`, `env.get/has` and `loadOpsEnv` in `scripts/ops`, workflow `secrets.NAME`, shell expansions, and Supabase local `env(...)` configuration. Shell locals, fixtures and documentation are not automatically application requirements.
- Confirmed the installed Upstash SDK `Redis.fromEnv()` reads both `UPSTASH_REDIS_REST_*` and legacy `KV_REST_API_*` fallbacks. Package reference is an indirect reader, not a request to inspect credentials.
- Read mode routing, client branches, API guards, backend factories, flags/defaults, scripts and tests; reviewed history of hook extraction. App presence in a monorepo or import graph is not enough to prove feature use.
- Discovery index contains 228 named lexical candidates across the repository, including tests/docs/shell locals. The appendix records these references; this is **not** a configured Production inventory.
- A conservative static import traversal started at 304 `use client` modules and found no path to the selected application's secret-reading modules. This is supporting source evidence, not a full compiler analysis or a deployed-bundle/value scan. Dynamic/generalized imports and future edits remain outside that guarantee.

## Product reachability and classification

Both products compile `apps/web`. `feature-flags.ts` selects the hub; `mode-routing.ts` redirects Learn `/arena` and `/coach` to Play, and Play `/exercises` to Learn. **Middleware excludes `/api`**. Most signing, Coach, cron, games, payment and Focus Days APIs do not have a deployment-mode gate. A hidden card or a redirect does not establish that the backend handler is absent. Classifications distinguish normal product UI from still callable APIs.

- **REQUIRED**: needed for the connected product or correct deployment identity/metadata described in the row. Rendering a local-only game is a narrower product and can require fewer variables.
- **OPTIONAL**: live code with a fallback or a conditional feature dependency. Conditional requirements are stated; optional does not mean safe to delete from an existing deployment.
- **NOT_USED**: no effective current Production reader for that app's product path, or no env reader at all. Reachable API exceptions are marked REVIEW instead.
- **LEGACY_FLAG**: legacy aliases or retired rollout keys. Some aliases are still active fallbacks; row distinguishes them from inert retired keys.
- **OPS_ONLY**: admin/cron/debug/platform controls rather than ordinary app configuration.
- **REVIEW**: no sufficient proof to omit while preserving actual callers/features. Especially applies to shared reachable APIs and storage identity.

`NEXT_PUBLIC_*` literal accesses are Next build-time substitutions, including many server consumers. Changing them requires a new build. Private variables are server-side deployment configuration, often read at request time or module initialization. Vercel snapshots configuration into deployments: changing a variable does not mutate an existing deployment's running environment. A variable used only by middleware can be public-named without its consumer being a browser component. Dynamic `requireEnv(name)` in the server signing helper reads server process configuration, not a dynamic browser env lookup.

## Code-discovery matrix — all candidates (configured subset reconciled below)

Source cells point to concrete readers; the appendix contains all discovered references, including tests and other apps. Purpose/default/decision together describe absence and UI/API reachability. Empty and unset values are different where the code uses `??` rather than `||`.

| Variable | Play status | Learn status | Public/Secret | Source refs | Purpose | Default | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ADMIN_TOKEN` | OPS_ONLY | OPS_ONLY | Secret | `apps/web/src/app/api/admin/content/revalidate/route.ts:24`<br>`apps/web/src/app/api/admin/content/route.ts:52`<br>`apps/web/src/app/api/admin/content/stage/route.ts:46` | /api/admin/content, /stage, /revalidate, /lite-stats; control-tower and admin helpers; server runtime | missing → admin disabled / 503 | Not required for player gameplay. Retain only on deployment(s) intentionally hosting remote administration. |
| `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY` | OPTIONAL | OPTIONAL | Server security flag | `apps/web/src/lib/payments/get-peones-canary-server.ts:58` | Explicit acceptance of canary limited wallet-auth model; server runtime | not literal true → canary configuration refused | Required only for intentional current canary model. Do not enable automatically during environment migration. |
| `ANTHROPIC_API_KEY` | NOT_USED | NOT_USED | Secret | No active web reader | No current application reader found; none | no effect on current application | Candidate omission if configured. Provider name does not cause the OpenAI-compatible Coach client to read this variable. |
| `CELO_RPC_URL` | OPTIONAL | OPTIONAL | Sensitive server endpoint | `apps/web/src/app/api/payment-intents/get-peones/route.ts:33`<br>`apps/web/src/app/api/verify-payment/get-peones-canary/route.ts:26`<br>`apps/web/src/app/api/verify-payment/route.ts:71` | Receipt checks/payment verification and cron sync; server runtime | chain default or https://forno.celo.org depending caller; ?? paths treat empty as configured | Dedicated endpoint improves capacity; not universally required. Keep secret if URL contains provider key. |
| `CHESSCITO_LITE_MODE` | NOT_USED | NOT_USED | Server config name if configured | No active web reader | No env reader for this spelling; the identically named exported TS constant is used; build + server runtime | TS export is derived from mode | Do not confuse an imported constant with an environment variable. No env requirement. |
| `CHESSCITO_TREASURY_ADDRESS` | OPTIONAL | OPTIONAL | Server config; address not secret | `apps/web/src/lib/payments/rail-config.ts:45` | Authoritative server transfer recipient; server runtime | falls back to TREASURY_ADDRESS using ?? | Conditional REQUIRED for direct rail if no fallback. Prefer explicit canonical name; empty canonical masks valid legacy fallback. |
| `CHESSCITO_TREASURY_CANARY_ADDRESS` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/payments/get-peones-canary-server.ts:37` | Independent Get Peones treasury-canary configuration; server runtime | missing/invalid fails canary configuration | Conditional REQUIRED only when server canary enabled; no fallback to legacy direct-transfer recipient. |
| `CHESSCITO_TREASURY_CANARY_CONFIG_VERSION` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/payments/get-peones-canary-server.ts:42` | Independent Get Peones treasury-canary configuration; server runtime | empty; must match version regex | Conditional REQUIRED only when server canary enabled; no fallback to legacy direct-transfer recipient. |
| `CHESSCITO_TREASURY_CANARY_CONFIRMATIONS` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/payments/get-peones-canary-server.ts:48` | Independent Get Peones treasury-canary configuration; server runtime | empty; must be integer 1..100 | Conditional REQUIRED only when server canary enabled; no fallback to legacy direct-transfer recipient. |
| `CHESSCITO_TREASURY_CANARY_PRICE_VERSION` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/payments/get-peones-canary-server.ts:43` | Independent Get Peones treasury-canary configuration; server runtime | empty; must match version regex | Conditional REQUIRED only when server canary enabled; no fallback to legacy direct-transfer recipient. |
| `CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/payments/get-peones-canary-server.ts:62` | Independent Get Peones treasury-canary configuration; server runtime | empty; nonempty validated token list required | Conditional REQUIRED only when server canary enabled; no fallback to legacy direct-transfer recipient. |
| `CLAIM_IP_HASH_SALT` | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/server/welcome-pack.ts:109` | /api/welcome-pack/claim salted IP hash; server runtime | absent → null IP hash | Keep if retaining claim/IP abuse correlation; gameplay can operate without this correlation. Do not rotate as part of moving environments. |
| `COACH_LLM_API_KEY` | OPTIONAL | REVIEW | Secret | `apps/web/src/app/api/coach/analyze/route.ts:65`<br>`apps/web/src/app/api/coach/analyze/route.ts:66` | POST /api/coach/analyze creates the LLM client; server runtime / module initialization | absent → client null; uncached analysis returns 503 | Required if Play Coach must work. Learn UI redirects /coach and /arena, but /api/coach/* remains deployed and callable: proposed omit there after parity/consumer review. |
| `COACH_LLM_BASE_URL` | OPTIONAL | REVIEW | Server config | `apps/web/src/app/api/coach/analyze/route.ts:60` | Coach OpenAI-compatible provider endpoint; server runtime / module initialization | https://api.openai.com/v1 via ?? | Keep with non-default provider; empty string is not equivalent to absent. No Learn UI need, but API remains reachable. |
| `COACH_LLM_MODEL` | OPTIONAL | REVIEW | Server config | `apps/web/src/app/api/coach/analyze/route.ts:59` | Coach provider model; server runtime / module initialization | gpt-4o-mini via ?? | Keep when non-default; omit only if default matches intended provider/model. |
| `CONTENT_CACHE_DISABLED` | OPS_ONLY | OPS_ONLY | Server flag | `apps/web/src/lib/content/merged-catalog.ts:403` | Content cache bypass; server cached module setup | only 1 bypasses unstable_cache | Debug/performance knob; normal minimum omits unless deliberate troubleshooting. |
| `CONTENT_STAGE` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/content/stage.ts:24` | Merged content overlay maturity floor; server runtime / cached module setup | unset/invalid → compiled baseline only, zero overlay DB reads | Conditional REQUIRED if intended shipped content depends on overlay; do not drop blindly. |
| `CRON_SECRET` | OPS_ONLY | OPS_ONLY | Secret | `apps/web/src/app/api/cron/coach-purge/route.ts:32`<br>`apps/web/src/app/api/cron/sync/route.ts:9` | GET /api/cron/sync and /api/cron/coach-purge bearer auth; server runtime | missing → 401, fail closed | Keep on actual scheduler target only. GitHub Actions CRON_URL determines target; it was not read from live secrets. |
| `DRAGON` | REQUIRED | REVIEW | Secret | `apps/web/src/lib/server/demo-signing.ts:158` | requireEnv → decryptSignerKey → sign-score/badge/labyrinth/victory; server runtime | missing throws when getDemoConfig is called | Required for Play signing/mint parity. Learn UI is off-chain, but signing APIs have no deployment-mode gate; review real callers before omitting. |
| `ENABLE_LITE_QA_RESET` | NOT_USED | OPS_ONLY | Server flag | `apps/web/src/app/lite-debug/reset/page.tsx:18` | Learn hidden /lite-debug/reset page; server runtime | 404 unless Learn mode AND literal true | QA tool, not needed for Production gameplay. Has no separate VERCEL_ENV guard: true exposes reset UI even in Production Learn. |
| `FOCUS_DAYS_LEDGER_ENABLED` | REVIEW | OPTIONAL | Server flag | `apps/web/src/app/api/focus-day/route.ts:82`<br>`apps/web/src/app/api/season-pass/status/route.ts:216` | Learn Focus Days writes/reads for purchased pass; server runtime | Redis override wins; then literal true env; otherwise off | Learn recorder gated by Lite mode. Play APIs still reachable. Retain for existing entitlement progress; deleting env may disable if Redis override absent. |
| `FOUNDER_STATUS_RPC_URL` | OPTIONAL | REVIEW | Sensitive server endpoint | `apps/web/src/app/api/founder-status/route.ts:74` | /api/founder-status historical Shop logs; server runtime | https://forno.celo.org via &#124;&#124; | Independent from CELO_RPC_URL. Learn API remains reachable even if Founder UI hidden. |
| `GET_PEONES_TREASURY_CANARY_ENABLED` | OPTIONAL | OPTIONAL | Server flag | `apps/web/src/lib/payments/get-peones-canary-server.ts:28` | Independent server canary gate; server runtime | only literal true enables | Retain only deliberate canary rollout; public flag is not its authority. |
| `KV_REST_API_TOKEN` | LEGACY_FLAG | LEGACY_FLAG | Secret | `apps/web/node_modules/@upstash/redis/nodejs.mjs:276` | Upstash SDK legacy Vercel KV credential alias; server runtime / module initialization | used only when corresponding UPSTASH value is falsy | Intentional SDK fallback, not a separate database requirement. Never retain conflicting pairs unknowingly. |
| `KV_REST_API_URL` | LEGACY_FLAG | LEGACY_FLAG | Server config | `apps/web/node_modules/@upstash/redis/nodejs.mjs:272` | Upstash SDK legacy Vercel KV credential alias; server runtime / module initialization | used only when corresponding UPSTASH value is falsy | Intentional SDK fallback, not a separate database requirement. Never retain conflicting pairs unknowingly. |
| `LOGIN_CAPACITY_ENABLED` | OPTIONAL | OPTIONAL | Server flag | `apps/web/src/lib/access/capacity-config.ts:30` | Web login capacity control fallback; server runtime | DB row wins; normalized false/0 disables; default enabled | Shared WebAccessGate flow; not merely Play feature. |
| `LOGIN_CAPACITY_LIMIT` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/access/capacity-config.ts:29` | Web login seat limit fallback; server runtime | DB row wins; code default 460 for absent/invalid | Preserve custom fallback if used; DB override is independent of env. |
| `LOG_SALT` | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/server/logger.ts:142`<br>`apps/web/src/lib/server/logger.ts:171` | Shared privacy-safe wallet/IP logging; server runtime | missing → unsalted placeholder + one warning, never raw address fallback | Both use logger. Keep for useful pseudonymous incident logs; absence reduces diagnostic correlation. |
| `NEXT_PUBLIC_APP_URL` | REQUIRED | REQUIRED | Public | `apps/web/src/app/[locale]/layout.tsx:15`<br>`apps/web/src/app/[locale]/victory/[id]/page.tsx:63`<br>`apps/web/src/app/api/games/[id]/mint-receipt/route.ts:21` | Metadata base/sitemap and origin allow-list; build + server runtime | layout/sitemap use www origin; origin helpers also accept Vercel auto URLs | Use the app canonical URL. Not Play-specific: missing on Learn gives the wrong metadata base. |
| `NEXT_PUBLIC_APP_VERSION` | OPTIONAL | OPTIONAL | Public | `apps/web/src/app/api/welcome-pack/claim/route.ts:97` | Welcome-pack claim app-version provenance; server runtime | null | Optional operational metadata. |
| `NEXT_PUBLIC_ASSET_THEME` | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/theme.ts:23` | Theme asset family; build + server runtime | default selects default; everything else candy | Preserve if selecting default theme; omission chooses candy. |
| `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/feature-flags.ts:94` | Client score-attempt outbox emergency switch; build + server runtime | DEFAULT ON: only literal false disables | Active outbox consumer is ExercisesScreen, redirected to Learn on normal Play hosts. Play API remains callable but does not consult this client flag. Legacy Lite host exemption requires separate review. |
| `NEXT_PUBLIC_BADGES_ADDRESS` | REQUIRED | REVIEW | Public | `apps/web/src/lib/contracts/chains.ts:16`<br>`apps/web/src/lib/server/demo-signing.ts:154` | Contract helper and getDemoConfig signing bundle; victory viewing/sync for NFT; build + server runtime | client missing → null/unconfigured; getDemoConfig throws | getDemoConfig eagerly requires ALL these addresses, even when one signing route uses only one. Learn UI need varies; signing endpoints remain reachable. |
| `NEXT_PUBLIC_BUILD_SHA` | OPS_ONLY | OPS_ONLY | Public | `apps/web/src/components/dev/build-version.tsx:19`<br>`apps/web/src/components/hub/learn-hub-client.tsx:731`<br>`apps/web/src/lib/analytics/client-dimensions.ts:54` | Build chip and analytics build identity; build (generated) | Next config derives Vercel git SHA prefix or dev | Generated by next.config.env; do not manually duplicate in deployment manifest. |
| `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` | OPTIONAL | OPTIONAL | Public transaction metadata | `apps/web/src/lib/payments/attribution.ts:86` | Celo builder attribution suffix on client transactions; build + server runtime | absent/invalid → unattributed transaction with warning | Not a credential. Preserve for attribution; no authorization depends on it. |
| `NEXT_PUBLIC_CHAIN_ID` | REQUIRED | REQUIRED | Public | `apps/web/src/lib/contracts/chains.ts:58`<br>`apps/web/src/lib/server/demo-signing.ts:153` | Wallet/contract configuration and signing helper; build + server runtime | invalid/unset → null; signing requireEnv throws | Set 42220 for intended Celo mainnet; required for connected/on-chain behavior, not local practice alone. |
| `NEXT_PUBLIC_CHESSCITO_LITE_MODE` | LEGACY_FLAG | LEGACY_FLAG | Public | `apps/web/src/lib/feature-flags.ts:7` | Legacy product-mode compatibility; build + server runtime | unset allowed with explicit mode | Omit in a new minimum manifest when explicit mode is present; preserve existing parity until reconciliation. true conflicts with play/full; false conflicts with learn. |
| `NEXT_PUBLIC_CHESSCITO_MODE` | REQUIRED | REQUIRED | Public | `apps/web/src/app/api/peones/balance/route.ts:181`<br>`apps/web/src/lib/feature-flags.ts:6`<br>`apps/web/src/lib/scores/deployment-surface.ts:24` | Product UI, routing, provenance and weekly board; build + server runtime | legacy=true → learn; otherwise full; weekly read throws without explicit mode | Set play / learn respectively. Never infer the product from project name. |
| `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/daily/session-quota.ts:31` | Learn exercise extra-session quota; build + server runtime | 10 if missing/invalid/nonpositive | Exercise UI is redirected from Play; not a backend security quota. |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/payments/rail-config.ts:35` | Client direct-transfer recipient; Peones/PRO/Season Pass rail; build + server runtime | invalid/unset → null; rail not configured | Conditional REQUIRED for direct-transfer purchases; must match selected server recipient. |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS` | OPTIONAL | REVIEW | Public | `apps/web/src/lib/contracts/chains.ts:45` | getChesscitoTreasuryAddress contract interaction; build + server runtime | null if unset/invalid/chain mismatch | Different from EOA direct-transfer recipient. Never merge just because names contain treasury. |
| `NEXT_PUBLIC_ENABLE_COACH` | OPTIONAL | NOT_USED | Public | `apps/web/src/app/[locale]/arena/page.tsx:81` | Arena Coach UI; build + server runtime | DEFAULT ON: only literal false disables | Not an API authorization gate. Preserve false explicitly if disabled; removing false enables UI. |
| `NEXT_PUBLIC_ENABLE_DUEL` | OPTIONAL | NOT_USED | Public | `apps/web/src/lib/duel/duel-flag.ts:29` | Play friend-opponent discovery card; build + server runtime | only true enables card | Not an API/route gate: existing duel links and endpoints continue even when false. |
| `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION` | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/exercises/rotation-flag.ts:12` | Exercises screen rotation selection; build + server runtime | only true enables; absence legacy linear path | Play /exercises redirects to Learn. Current constant + consumers still active; naming does not prove rollout complete. |
| `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY` | NOT_USED | NOT_USED | Public | `apps/web/src/lib/telemetry.ts:72` | Development-only telemetry override; build + server runtime | Production NODE_ENV != development makes telemetry eligible regardless of flag | OPS_ONLY in local development, but NOT_USED for Production effect in both. Removing does not disable Production telemetry. |
| `NEXT_PUBLIC_ENABLE_MINIPAY_RAWTX` | NOT_USED | NOT_USED | Public | No active web reader | Template-only name; no current web runtime reader found; none | no effect found | Candidate template cleanup after inventory reconciliation; no changes made. |
| `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED` | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/payments/get-peones-canary.ts:342` | Client request for treasury canary purchase path; build + server runtime | only literal true enables | Intentional client/server gate pair. Both settings must be reconciled. |
| `NEXT_PUBLIC_I18N_ES_READY` | OPTIONAL | OPTIONAL | Public-named; middleware consumer | `apps/web/src/middleware.ts:28` | Spanish locale gate; build + server runtime | only 1 enables Spanish; otherwise /es redirects to English | Still live middleware behavior in both apps. Preserve 1 for ES parity; no evidence that rollout gate was removed. |
| `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` | OPTIONAL | REVIEW | Public | `apps/web/src/lib/server/demo-signing.ts:174` | getLabyrinthBadgesAddress in signing helper; build + server runtime | requireEnv throws on labyrinth signing | Required for labyrinth badge signing if retained. Shared template entry is not enough to establish active Learn use. |
| `NEXT_PUBLIC_LITE_PROGRESS_VERSION` | REVIEW | OPTIONAL | Public | `apps/web/src/lib/lite-progress-storage.ts:11` | Browser progress namespace, reused by daily/game helpers; build + server runtime | chesscito: legacy prefix if unset/invalid | Learn QA-origin purpose but helpers are not mode-gated. Play shares daily progress reads; never remove a nonempty value without checking storage continuity. |
| `NEXT_PUBLIC_MINIPAY_FEE_CURRENCY` | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/contracts/chains.ts:54` | MiniPay fee-currency override; build + server runtime | undefined; chain/wallet normal behavior | No required credential. Retain only actual override. |
| `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/onboarding/first-activity-experiment.ts:42` | Learn hub tour → Daily Focus experiment; build + server runtime | 0 if unset/invalid/out of 0..100; integers floor | Experiment surface explicitly Learn, and Play mounts separate hub. Preserve nonzero rollout if intended. |
| `NEXT_PUBLIC_PREVIEW_URL` | OPTIONAL | OPTIONAL | Public | `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:22`<br>`apps/web/src/lib/pro/pro-origin.ts:73`<br>`apps/web/src/lib/server/demo-signing.ts:257` | Extra allow-listed origin for custom preview aliases; build + server runtime | absent adds no host; Vercel URL/branch/production host remain | Not Learn-specific. Retain if a custom alias is used; no automatic metadata-base substitution. |
| `NEXT_PUBLIC_PRIVY_APP_ID` | OPTIONAL | OPTIONAL | Public identifier | `apps/web/src/components/web-wallet-provider.tsx:45` | Privy web provider mount; build + server runtime | mount throws if Privy enabled but ID missing | Conditional REQUIRED with Privy enabled in either app. Public app ID is not a service secret. |
| `NEXT_PUBLIC_PRIVY_ENABLED` | OPTIONAL | OPTIONAL | Public | `apps/web/src/components/wallet-provider-boundary.tsx:18` | Wallet branch selection outside MiniPay; build + server runtime | only true enables Privy; otherwise injected wallet | Conditional REQUIRED=true for existing Privy web-login parity; MiniPay uses injected branch independently. |
| `NEXT_PUBLIC_QA_MODE` | NOT_USED | NOT_USED | Public | No active web reader | Template-only name; no current web runtime reader found; none | no effect found | Candidate template cleanup after inventory reconciliation; no changes made. |
| `NEXT_PUBLIC_SCOREBOARD_ADDRESS` | REQUIRED | REVIEW | Public | `apps/web/src/lib/contracts/chains.ts:8`<br>`apps/web/src/lib/server/sync-blockchain.ts:20`<br>`apps/web/src/lib/server/demo-signing.ts:155` | Contract helper and getDemoConfig signing bundle; victory viewing/sync for NFT; build + server runtime | client missing → null/unconfigured; getDemoConfig throws | getDemoConfig eagerly requires ALL these addresses, even when one signing route uses only one. Learn UI need varies; signing endpoints remain reachable. |
| `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED` | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/feature-flags.ts:139` | Learn Season Pass offer and purchase gate; build + server runtime | only true enables; default sales paused | Live offer switch; access and existing buyer progress remain independent. Preserve buyer services even if sales off. |
| `NEXT_PUBLIC_SHOP_ADDRESS` | OPTIONAL | REVIEW | Public | `apps/web/src/app/api/founder-status/route.ts:37`<br>`apps/web/src/app/api/verify-pro/route.ts:23`<br>`apps/web/src/lib/contracts/chains.ts:24` | Shop/PRO/Founder contract workflows; build + server runtime | unconfigured client; founder route has no contract client | Required only for retained Shop/PRO/Founder feature parity; Learn payments can use the direct rail instead. |
| `NEXT_PUBLIC_STREAK_NUDGE_ENABLED` | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/feature-flags.ts:66` | Exercises streak nudge storage/overlay; build + server runtime | only true enables; otherwise no nudge updates/render | Active Learn exercise consumer and on/off tests; not dead. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | OPTIONAL | OPTIONAL | Public contact | `apps/web/src/lib/content/editorial.ts:2487`<br>`apps/web/src/lib/content/editorial.ts:2521`<br>`apps/web/src/lib/content/editorial.ts:2523` | Editorial support/privacy contact; build + server runtime | our support team placeholder via ?? | Product/support parity choice, not service credential. |
| `NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED` | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/telemetry.ts:95` | Batch telemetry vs one request/event compatibility switch; build + server runtime | DEFAULT ON; 0/false disables batching | Active fallback, not kill switch; removing false increases batching instead of stopping telemetry. |
| `NEXT_PUBLIC_TELEMETRY_ENABLED` | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/telemetry.ts:86` | Telemetry emergency kill switch; build + server runtime | DEFAULT ON; 0 or false (case insensitive false) disables | Active load-control flag; preserve disabled settings. Not dead. |
| `NEXT_PUBLIC_USDC_ADDRESS` | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/contracts/chains.ts:32` | Configured USDC contract in wallet/payment flows; build + server runtime | contract helper null; token registry also has separate fixed addresses | Keep when configured client payment/mint paths use it. Do not assume token-registry fallback replaces every getter. |
| `NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS` | LEGACY_FLAG | LEGACY_FLAG | Public | No active reader; history/comments only | Completed extraction rollout; only comments remain; none | no active reader, no effect | Omission candidate proven by commit a82a375b (2026-05-28); not required even on Play. |
| `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` | LEGACY_FLAG | LEGACY_FLAG | Public | No active reader; history/comments only | Completed extraction rollout; only comments remain; none | no active reader, no effect | Omission candidate proven by commit a82a375b (2026-05-28); not required even on Play. |
| `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` | REQUIRED | REVIEW | Public | `apps/web/src/app/[locale]/victory/[id]/page.tsx:20`<br>`apps/web/src/app/api/og/victory/[id]/route.tsx:27`<br>`apps/web/src/lib/contracts/chains.ts:37` | Contract helper and getDemoConfig signing bundle; victory viewing/sync for NFT; build + server runtime | client missing → null/unconfigured; getDemoConfig throws | getDemoConfig eagerly requires ALL these addresses, even when one signing route uses only one. Learn UI need varies; signing endpoints remain reachable. |
| `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` | OPTIONAL | NOT_USED | Public | `apps/web/src/lib/feature-flags.ts:70` | Play mint hook: permit-mint vs existing mint path; build + server runtime | only true selects permit branch; absent false | Live behavior flag, not completed hook-extraction flag. Learn UI cannot mount arena/coach; backend signing API is separate. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | NOT_USED | NOT_USED | Public identifier if valid | No active web reader | No current web runtime reader; injected + Privy wallet configurations; none | no current effect | Shared template is stale for this key; RainbowKit removal documented in wagmi-config. Not needed merely because transitive wallet packages exist. |
| `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/feature-flags.ts:119` | Client weekly leaderboard tab; build + server runtime | only true enables | Learn training leaderboard tab. Play Arena selects PlayLeadersSheet (Hall of Fame), not the training board. Weekly API remains callable on both, independent of this UI flag. |
| `NODE_ENV` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/app/__nextjs_original-stack-frames/route.ts:10`<br>`apps/web/src/app/dev/board-procedural/page.tsx:24`<br>`apps/web/src/components/dev/chain-config-warning.tsx:24` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `PASSPORT_API_KEY` | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/server/passport.ts:4` | syncBlockchain → checkPassportScores; server runtime | absent key/scorer → false verification | Needed by Passport enrichment job, not ordinary frontend. Minimize to the actual cron-sync host after proving ownership. |
| `PASSPORT_SCORER_ID` | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/server/passport.ts:5` | Passport score scope; server runtime | absent → false verification | Pair with PASSPORT_API_KEY only on job host requiring enrichment. |
| `PEONES_SPEND_REQUIRE_SESSION` | OPTIONAL | OPTIONAL | Server security rollout flag | `apps/web/src/lib/scores/spend-session-guard.ts:69` | Peones spend wallet-auth binding; server runtime | literal true enables; otherwise legacy behavior | Active security switch. Preserve current state and validate clients; omitting true weakens authorization. |
| `RATE_LIMIT_LOG_SAMPLE` | OPS_ONLY | OPS_ONLY | Server config | `apps/web/src/lib/server/rate-limit.ts:248` | Successful rate-limit event sampling; server runtime | 0 when invalid/missing/outside [0,1] | Logging volume knob only. |
| `REDIS_OBSERVABILITY_SAMPLE_RATE` | OPS_ONLY | OPS_ONLY | Server config | `apps/web/src/lib/server/redis-observability.ts:35` | Redis observability sampling; server runtime | 0.1 when invalid/missing/outside [0,1] | Logging volume knob only. |
| `SHOP_DEPLOY_BLOCK_CELO` | OPTIONAL | REVIEW | Server config | `apps/web/src/app/api/founder-status/route.ts:57` | Historical founder scan lower bound; server runtime | fallback constant 37800000; malformed also falls back | Keep for non-default deployment block; only Founder endpoint consumes it. |
| `SUPABASE_SERVICE_ROLE_KEY` | REQUIRED | REQUIRED | Secret | `apps/web/src/lib/supabase/server.ts:51` | Privileged server Supabase operations; server runtime | client null without URL/key | Both connected products require this today. Shared source alone is not the justification: both have actual DB workflows. |
| `SUPABASE_URL` | REQUIRED | REQUIRED | Server config | `apps/web/src/lib/supabase/server.ts:50` | Shared authoritative off-chain sessions, attempts, entitlements, ledger, content, inbox and analytics; server runtime | client null without URL/key; callers degrade or return unavailable | Required for the connected product, not to merely render a local game. |
| `TELEMETRY_ACCOUNT_SECRET` | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/analytics/account-ref.ts:30` | /api/telemetry HMAC account_ref; server runtime | absent → account_ref null, anonymous telemetry continues | Keep on both for comparable account-level analytics; preserve the existing key for continuity. Not necessary for anonymous-only gameplay. |
| `TORRE_PRINCESA` | REQUIRED | REVIEW | Secret | `apps/web/src/lib/server/demo-signing.ts:158` | requireEnv → decryptSignerKey → sign-score/badge/labyrinth/victory; server runtime | missing throws when getDemoConfig is called | Required for Play signing/mint parity. Learn UI is off-chain, but signing APIs have no deployment-mode gate; review real callers before omitting. |
| `TREASURY_ADDRESS` | LEGACY_FLAG | LEGACY_FLAG | Server config; address not secret | `apps/web/src/lib/payments/rail-config.ts:45` | Legacy server recipient alias; server runtime | only used when CHESSCITO_TREASURY_ADDRESS is null/undefined | Intentional fallback. Existing behavior can rely on it; omit from new minimum only after preserving recipient under canonical name. |
| `UPSTASH_REDIS_REST_TOKEN` | REQUIRED | REQUIRED | Secret | `apps/web/node_modules/@upstash/redis/nodejs.mjs:276` | SDK fromEnv: shared rate limiting, caches, sessions/entitlements, plus Coach; server runtime / module initialization | SDK falls back to KV_REST_API_URL / KV_REST_API_TOKEN; missing credentials break requests | Both apps use Redis outside Coach. Use one credential pair, not both aliases. |
| `UPSTASH_REDIS_REST_URL` | REQUIRED | REQUIRED | Server config | `apps/web/node_modules/@upstash/redis/nodejs.mjs:272` | SDK fromEnv: shared rate limiting, caches, sessions/entitlements, plus Coach; server runtime / module initialization | SDK falls back to KV_REST_API_URL / KV_REST_API_TOKEN; missing credentials break requests | Both apps use Redis outside Coach. Use one credential pair, not both aliases. |
| `VERCEL` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/app/api/dev/labyrinth/route.ts:25`<br>`apps/web/src/app/dev/labyrinth-builder/page.tsx:350`<br>`apps/web/src/lib/dev/dev-surface.ts:32` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `VERCEL_BRANCH_URL` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:24`<br>`apps/web/src/lib/server/demo-signing.ts:259`<br>`apps/web/src/lib/server/early-access-origin.ts:60` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `VERCEL_DEPLOYMENT_ID` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/app/api/peones/balance/route.ts:180`<br>`apps/web/src/lib/server/rate-limit.ts:271` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `VERCEL_ENV` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/app/[locale]/template.tsx:9`<br>`apps/web/src/app/dev/layout.tsx:30`<br>`apps/web/src/lib/dev/dev-surface.ts:19` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `VERCEL_GIT_COMMIT_SHA` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/next.config.js:16` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `VERCEL_PROJECT_PRODUCTION_URL` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/app/[locale]/victory/[id]/page.tsx:64`<br>`apps/web/src/app/[locale]/victory/[id]/page.tsx:65`<br>`apps/web/src/app/api/games/[id]/mint-receipt/route.ts:25` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `VERCEL_URL` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:23`<br>`apps/web/src/lib/server/demo-signing.ts:258`<br>`apps/web/src/lib/server/early-access-origin.ts:59` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |
| `VITEST` | OPS_ONLY | OPS_ONLY | Platform/test metadata | `apps/web/src/lib/server/logger.ts:37` | Platform gating/origins/build identity (VITEST: test log suppression); platform build/runtime | platform supplies; non-Vercel absence can enable dev surface | Not manually copied application secrets; preserve automatic Vercel system variables. VITEST is test-only. |

## Reader placement and timing

Placement is inferred from conservative static module reachability (ignores type-only imports and stops server traversal at client boundaries). This is not emitted-bundle verification; incidental common imports can overstate effective use, and comments/dynamic imports can complicate lexical analysis. Read alongside mode/feature gates in the main matrix. Public exposure classification and actual consumer placement are different facts.

| Variable | Browser/server readers | Timing |
| --- | --- | --- |
| `ADMIN_TOKEN` | server | server runtime |
| `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY` | server | server runtime |
| `ANTHROPIC_API_KEY` | no active web reader | none |
| `CELO_RPC_URL` | server | server runtime |
| `CHESSCITO_LITE_MODE` | no active web reader | build + server runtime |
| `CHESSCITO_TREASURY_ADDRESS` | browser + server | server runtime |
| `CHESSCITO_TREASURY_CANARY_ADDRESS` | server | server runtime |
| `CHESSCITO_TREASURY_CANARY_CONFIG_VERSION` | server | server runtime |
| `CHESSCITO_TREASURY_CANARY_CONFIRMATIONS` | server | server runtime |
| `CHESSCITO_TREASURY_CANARY_PRICE_VERSION` | server | server runtime |
| `CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES` | server | server runtime |
| `CLAIM_IP_HASH_SALT` | server | server runtime |
| `COACH_LLM_API_KEY` | server | server runtime / module initialization |
| `COACH_LLM_BASE_URL` | server | server runtime / module initialization |
| `COACH_LLM_MODEL` | server | server runtime / module initialization |
| `CONTENT_CACHE_DISABLED` | server | server cached module setup |
| `CONTENT_STAGE` | server | server runtime / cached module setup |
| `CRON_SECRET` | server | server runtime |
| `DRAGON` | server | server runtime |
| `ENABLE_LITE_QA_RESET` | server | server runtime |
| `FOCUS_DAYS_LEDGER_ENABLED` | server | server runtime |
| `FOUNDER_STATUS_RPC_URL` | server | server runtime |
| `GET_PEONES_TREASURY_CANARY_ENABLED` | server | server runtime |
| `KV_REST_API_TOKEN` | server | server runtime / module initialization |
| `KV_REST_API_URL` | server | server runtime / module initialization |
| `LOGIN_CAPACITY_ENABLED` | server | server runtime |
| `LOGIN_CAPACITY_LIMIT` | server | server runtime |
| `LOG_SALT` | server | server runtime |
| `NEXT_PUBLIC_APP_URL` | browser + server | build + server runtime |
| `NEXT_PUBLIC_APP_VERSION` | server | server runtime |
| `NEXT_PUBLIC_ASSET_THEME` | browser + server | build + server runtime |
| `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` | browser + server | build + server runtime |
| `NEXT_PUBLIC_BADGES_ADDRESS` | browser + server | build + server runtime |
| `NEXT_PUBLIC_BUILD_SHA` | browser | build (generated) |
| `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` | browser | build + server runtime |
| `NEXT_PUBLIC_CHAIN_ID` | browser + server | build + server runtime |
| `NEXT_PUBLIC_CHESSCITO_LITE_MODE` | browser + server | build + server runtime |
| `NEXT_PUBLIC_CHESSCITO_MODE` | browser + server | build + server runtime |
| `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` | browser | build + server runtime |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | browser + server | build + server runtime |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS` | browser + server | build + server runtime |
| `NEXT_PUBLIC_ENABLE_COACH` | browser | build + server runtime |
| `NEXT_PUBLIC_ENABLE_DUEL` | browser | build + server runtime |
| `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION` | browser | build + server runtime |
| `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY` | browser | build + server runtime |
| `NEXT_PUBLIC_ENABLE_MINIPAY_RAWTX` | no active web reader | none |
| `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED` | browser + server | build + server runtime |
| `NEXT_PUBLIC_I18N_ES_READY` | server | build + server runtime |
| `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` | server | build + server runtime |
| `NEXT_PUBLIC_LITE_PROGRESS_VERSION` | browser + server | build + server runtime |
| `NEXT_PUBLIC_MINIPAY_FEE_CURRENCY` | browser + server | build + server runtime |
| `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` | browser | build + server runtime |
| `NEXT_PUBLIC_PREVIEW_URL` | browser + server | build + server runtime |
| `NEXT_PUBLIC_PRIVY_APP_ID` | browser | build + server runtime |
| `NEXT_PUBLIC_PRIVY_ENABLED` | browser | build + server runtime |
| `NEXT_PUBLIC_QA_MODE` | no active web reader | none |
| `NEXT_PUBLIC_SCOREBOARD_ADDRESS` | browser + server | build + server runtime |
| `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED` | browser + server | build + server runtime |
| `NEXT_PUBLIC_SHOP_ADDRESS` | browser + server | build + server runtime |
| `NEXT_PUBLIC_STREAK_NUDGE_ENABLED` | browser + server | build + server runtime |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | browser + server | build + server runtime |
| `NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED` | browser | build + server runtime |
| `NEXT_PUBLIC_TELEMETRY_ENABLED` | browser | build + server runtime |
| `NEXT_PUBLIC_USDC_ADDRESS` | browser + server | build + server runtime |
| `NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS` | no active web reader | none |
| `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` | no active web reader | none |
| `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` | browser + server | build + server runtime |
| `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` | browser + server | build + server runtime |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | no active web reader | none |
| `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` | browser + server | build + server runtime |
| `NODE_ENV` | browser + server | platform build/runtime |
| `PASSPORT_API_KEY` | server | server runtime |
| `PASSPORT_SCORER_ID` | server | server runtime |
| `PEONES_SPEND_REQUIRE_SESSION` | server | server runtime |
| `RATE_LIMIT_LOG_SAMPLE` | server | server runtime |
| `REDIS_OBSERVABILITY_SAMPLE_RATE` | server | server runtime |
| `SHOP_DEPLOY_BLOCK_CELO` | server | server runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | server | server runtime |
| `SUPABASE_URL` | server | server runtime |
| `TELEMETRY_ACCOUNT_SECRET` | server | server runtime |
| `TORRE_PRINCESA` | server | server runtime |
| `TREASURY_ADDRESS` | browser + server | server runtime |
| `UPSTASH_REDIS_REST_TOKEN` | server | server runtime / module initialization |
| `UPSTASH_REDIS_REST_URL` | server | server runtime / module initialization |
| `VERCEL` | browser + server | platform build/runtime |
| `VERCEL_BRANCH_URL` | server | platform build/runtime |
| `VERCEL_DEPLOYMENT_ID` | server | platform build/runtime |
| `VERCEL_ENV` | browser + server | platform build/runtime |
| `VERCEL_GIT_COMMIT_SHA` | server | platform build/runtime |
| `VERCEL_PROJECT_PRODUCTION_URL` | server | platform build/runtime |
| `VERCEL_URL` | server | platform build/runtime |
| `VITEST` | server | platform build/runtime |

## Exact app-only inventory variables — code semantics

The supplied app-only memberships are now verified by exact set difference. Inventory exclusivity is distinct from semantic app exclusivity: several settings are consumed by shared code.

| Exact inventory side | Variable | Code conclusion |
| --- | --- | --- |
| Play | NEXT_PUBLIC_APP_URL | Used by both products for metadata and shared origin policy. Learn's missing APP_URL does not make PREVIEW_URL a metadata substitute; layout defaults to www. |
| Play | NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS | Retired rollout; no current env read. Stale use-coach-analysis docstring still mentions default OFF; executable Arena code calls the extracted hook unconditionally. |
| Play | NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK | Retired rollout; no current env read. The mint hook docstring explicitly describes retirement. |
| Play | NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED | Active Play mint choice. Absence uses the existing non-permit path, not necessarily no minting. Learn's Arena UI redirects away. |
| Learn | ENABLE_LITE_QA_RESET | QA-only Learn page, gated on Lite and literal true; no production-environment check. Not needed for gameplay. |
| Learn | FOCUS_DAYS_LEDGER_ENABLED | Learn purchase/progress function, with Redis override before env. Client writer is Learn-gated; APIs remain on Play, so not proof of exclusive server reachability. |
| Learn | NEXT_PUBLIC_CHESSCITO_LITE_MODE | Legacy compatibility; explicit learn mode works without it. A conflicting false causes an error. No need to introduce it into Play. |
| Learn | NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY | Development-only behavior, no Production effect in either app; Production telemetry defaults on independently. |
| Learn | NEXT_PUBLIC_LITE_PROGRESS_VERSION | QA namespace origin, now shared storage helper. Preserve a configured namespace during migration to avoid apparent progress loss. Not a generic dead flag. |
| Learn | NEXT_PUBLIC_PREVIEW_URL | Shared extra origin alias, used on both products. Not Learn-only by code; metadata still depends on APP_URL. |

## Shared variables: why presence in both is not enough

The exact intersection below contains 46 names. Each has a row in the final decision matrix, including source evidence, default, app use and reason for sharing. Common configuration is not proof of genuine need in both apps. Without configuration history, “copied historically” is an inference only when source has no reader, not a demonstrated copying event.

- **Real shared functionality**: explicit mode, Supabase, Redis rate limits/session/entitlement helpers, telemetry, log privacy, canonical origins, enabled Privy, locale handling and account/payment helpers.
- **Play UI features**: Coach, victory mint/permit and duel discovery. Shared APIs are still reachable on Learn; importing a rate-limit helper does not alone require a signing key, but calling getDemoConfig does.
- **Learn UI features**: exercise rotation, onboarding-first-activity percentage, streak nudge, exercise session quota, training attempt outbox/weekly tab and Season Pass offer. Common compilation does not make those active Play UI features.
- **Common module import**: both products include contract and signing helpers. getDemoConfig requires badge, scoreboard and victory addresses together even for a signing route that uses just one; that's actual eager coupling, not a clean per-feature manifest.
- **Historical/config-only candidates**: extracted-hook flags have proven removal history; WalletConnect project ID has no current reader. WalletConnect project ID is shared; the two extracted-hook flags are Play-only. No-reader conclusions are unchanged.

## Alias and flag conflicts

### Treasury

`NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` is the browser-visible direct-transfer recipient. `CHESSCITO_TREASURY_ADDRESS` is its server authoritative counterpart. Both should agree for the same rail. `TREASURY_ADDRESS` is an intentional server fallback, selected only when the canonical server variable is null/undefined. An empty canonical value masks the fallback; two populated different server recipients can also silently select one. Values were not inspected, so no actual conflict is asserted.

`NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS` and `CHESSCITO_TREASURY_CANARY_ADDRESS` refer to separate contract/canary workflows. Do not collapse them into the EOA direct recipient. Canary server settings deliberately do not fall back to the legacy EOA.

### Mode

`NEXT_PUBLIC_CHESSCITO_MODE` is canonical. `NEXT_PUBLIC_CHESSCITO_LITE_MODE` is a live compatibility fallback plus contradiction check. The exported `CHESSCITO_LITE_MODE` TypeScript constant is derived from resolved mode and is deprecated but used; **there is no `process.env.CHESSCITO_LITE_MODE` reader**. Configuring an env with that unprefixed name does not change the constant.

Explicit mode is still required by weekly leaderboard reads even if the UI resolves through the legacy flag. Omitting explicit mode on Play can label score writes as Learn. Valid explicit mode + legacy absent is supported; Play + legacy true and Learn + legacy false throw.

### Enable/use groups

| Group | Relationship / safe interpretation |
| --- | --- |
| PRIVY_ENABLED + PRIVY_APP_ID | Intentional enable gate and conditional public identifier requirement, not duplicates. |
| GET_PEONES_TREASURY_CANARY_ENABLED + NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED | Intentional server/client gates. Server validates independent canary address, versions, confirmations, token list and explicit wallet-model flag. Public true alone cannot authorize server canary. |
| ENABLE_COACH | UI gate only; DEFAULT ON. No backend Coach kill switch. |
| ENABLE_DUEL | Discovery gate only; invitation routes/API remain alive. |
| VICTORY_PERMIT_MINT_ENABLED | Active mint-method switch; independent of retired USE_EXTRACTED_MINT_HOOK. |
| ATTEMPT_LANE_ENABLED + WEEKLY_LEADERS_ENABLED | Independent writer and UI-reader controls, not aliases. Weekly meaningful data depends on attempt writes; API persists independently. |
| TELEMETRY_ENABLED + TELEMETRY_BATCH_ENABLED + ENABLE_LOCAL_TELEMETRY | Global client emergency stop, batching fallback, development-only override; distinct. Both main switches default ON. |
| ENABLE_LITE_QA_RESET + LITE_PROGRESS_VERSION | QA reset availability and browser storage namespace; different functions. |
| STREAK_NUDGE_ENABLED / ENABLE_EXERCISE_ROTATION / ONBOARDING_FIRST_ACTIVITY_PCT | Separate Learn feature/experiment controls; still read. |
| SEASON_PASS_SALES_ENABLED + FOCUS_DAYS_LEDGER_ENABLED | New offer/purchase gate vs existing buyer progress; sales pause must not revoke progress. Redis may override Focus Days env. |
| PEONES_SPEND_REQUIRE_SESSION | Active security rollout. Dropping an enabled flag weakens authorization; not a generic redundant boolean. |

## Dead-flag evidence

| Variable | Evidence | Conclusion |
| --- | --- | --- |
| USE_EXTRACTED_COACH_HOOKS | Commit a82a375b, 2026-05-28, removed Arena flag read and inline alternatives; current useCoachAnalysis invocation unconditional. Commit 1bc2f68a, 2026-06-14, later removed orphaned purchase hook. | Completed rollout; executable env dependency dead, stale comment remains. |
| USE_EXTRACTED_MINT_HOOK | Same a82a375b removal; current useMintVictory invocation unconditional; hook docstring confirms retirement. | Completed rollout; executable env dependency dead. |
| I18N_ES_READY | middleware.ts:28 and middleware.test.ts:14 exercise on/off. | Active gate; removing enabled value disables ES. |
| ATTEMPT_LANE_ENABLED | feature-flags.ts:94, use-attempt-outbox.ts:209; tests include false and invalid off spelling. | Active emergency switch, default ON. |
| STREAK_NUDGE_ENABLED | feature-flags.ts:66, exercises-screen.tsx:1636 and nudge on/off tests. | Active Learn switch, default OFF. |
| ENABLE_EXERCISE_ROTATION | rotation-flag.ts:12; exercises-screen.tsx:915/1039. | Active rollout constant; no proof of completed deletion. |
| ONBOARDING_FIRST_ACTIVITY_PCT | experiment.ts:42; Learn hub integration, explicit not-learn early return and assignment tests. Commit 990b527c, 2026-08-05, introduced it. | Active Learn experiment, default 0. |
| ENABLE_LOCAL_TELEMETRY | telemetry.ts:70–72 first disjunct true outside development. | Inert in Production, useful locally; not a global telemetry flag. |
| ENABLE_LITE_QA_RESET | reset/page.tsx:18 checks Lite + literal true. | Live QA feature, unnecessary for ordinary Production; not deleted rollout. |

## Secret minimization decisions

| Secret | Play | Learn | Operates without it? |
| --- | --- | --- | --- |
| ADMIN_TOKEN | Admin-only; select intentional admin host. | Same deployed admin routes. | Yes for players; admin functions disabled. |
| CRON_SECRET | Keep if scheduler targets Play. | Keep if scheduler targets Learn; not inherently required on both. | Players yes; jobs 401. Running identical jobs on both is not established. |
| SUPABASE_SERVICE_ROLE_KEY | Real connected product dependency. | Real scores/sessions/entitlement/content dependency. | Local game can render; full connected parity cannot be promised. |
| ANTHROPIC_API_KEY | No runtime reader. | No runtime reader. | Yes under current source; current Coach uses COACH_LLM_API_KEY instead. |
| COACH_LLM_API_KEY | Keep for Coach; missing uncached analysis 503. | Proposed omit for Learn UI; API remains callable and needs manual consumer review. | Gameplay yes; LLM analysis no. |
| TELEMETRY_ACCOUNT_SECRET | Keep for account-level analytics continuity. | Same. | Yes; anonymous telemetry persists, account_ref null. |
| PASSPORT_API_KEY | Cron enrichment host only if wanted. | Same shared cron endpoint. | Yes, but Passport verification reads false. |
| UPSTASH_REDIS_REST_TOKEN | Shared rate limits/caches, not just Coach. | Shared rate limits/caches/entitlements. | Many production requests fail; not a safe blanket omission. |
| CLAIM_IP_HASH_SALT | Claim correlation if used. | Same welcome-pack claim API. | Yes with null IP hash / reduced abuse correlation. |
| LOG_SALT | Keep diagnostic privacy-safe pseudonym continuity. | Same. | Yes, but hashes become unsalted placeholders. |
| TORRE_PRINCESA + DRAGON | Required for retained contract signing. | Potential omission for off-chain Learn UI; no API-mode gate proves no callers. | Plain gameplay yes; calls to signing factory fail. |

These decisions do not authorize removing a secret from a deployed app. Cron ownership, admin hosting, real endpoint traffic and current enabled features remain manual-review inputs; exact name membership is now known.

## Public environment safety

All current runtime `NEXT_PUBLIC_*` readers in this source resolve to flags, addresses, IDs, public URLs, version/build metadata, theme, support contact, namespace or transaction attribution. No source reader names a public Supabase service-role, signer, Redis token, admin/cron, LLM, Passport, analytics-HMAC or salt credential. Next config explicitly exposes only generated NEXT_PUBLIC_BUILD_SHA; it does not deliberately inject private credentials through next.config.env.

The static client-import check found no selected private-reader module transitively imported from the discovered client entries. This supports the intended boundary, but it does not certify deployed bundles or arbitrary current public values. **No secret-value or live-bundle verification was performed.** A public URL can contain a provider credential; a mistakenly populated address/flag field can contain unrelated secret material. Without inspecting values securely, this audit cannot confirm that every current configured NEXT_PUBLIC value is harmless. Names-only inventories also cannot settle this.

`SUPABASE_URL` stays server-only by project convention even though a URL is not itself a privileged service credential. RPC endpoints with provider API keys stay server-only too. Privy app ID and WalletConnect project ID are public identifiers; no Privy app secret is required by the current wallet/auth architecture.

## Reconciled Production inventory and final migration decisions

### Verified counts

| Set | Count |
| --- | ---: |
| Play | 50 |
| Learn | 52 |
| Shared | 46 |
| Play-only | 4 |
| Learn-only | 6 |
| Unique total | 56 |

Sanity checks: 50 + 52 − 46 = 56; 50 − 46 = 4; 52 − 46 = 6. No duplicates were found. Classification coverage: exactly 50 Play decisions and 52 Learn decisions; absent keys are marked NOT_CONFIGURED rather than assigned a fictional current decision.

### Exact intersection — 46 shared names

```text
ADMIN_TOKEN
ANTHROPIC_API_KEY
CELO_RPC_URL
CHESSCITO_LITE_MODE
CHESSCITO_TREASURY_ADDRESS
CLAIM_IP_HASH_SALT
COACH_LLM_API_KEY
COACH_LLM_BASE_URL
COACH_LLM_MODEL
CONTENT_STAGE
CRON_SECRET
DRAGON
LOG_SALT
NEXT_PUBLIC_ATTEMPT_LANE_ENABLED
NEXT_PUBLIC_BADGES_ADDRESS
NEXT_PUBLIC_CELO_ATTRIBUTION_TAG
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_CHESSCITO_MODE
NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT
NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS
NEXT_PUBLIC_ENABLE_COACH
NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION
NEXT_PUBLIC_I18N_ES_READY
NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_PRIVY_ENABLED
NEXT_PUBLIC_SCOREBOARD_ADDRESS
NEXT_PUBLIC_SHOP_ADDRESS
NEXT_PUBLIC_STREAK_NUDGE_ENABLED
NEXT_PUBLIC_SUPPORT_EMAIL
NEXT_PUBLIC_TELEMETRY_ENABLED
NEXT_PUBLIC_USDC_ADDRESS
NEXT_PUBLIC_VICTORY_NFT_ADDRESS
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED
PASSPORT_API_KEY
PASSPORT_SCORER_ID
PEONES_SPEND_REQUIRE_SESSION
SHOP_DEPLOY_BLOCK_CELO
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
TELEMETRY_ACCOUNT_SECRET
TORRE_PRINCESA
TREASURY_ADDRESS
UPSTASH_REDIS_REST_TOKEN
UPSTASH_REDIS_REST_URL
```

### Exact Play-only set — 4 names

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS
NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK
NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED
```

### Exact Learn-only set — 6 names

```text
ENABLE_LITE_QA_RESET
FOCUS_DAYS_LEDGER_ENABLED
NEXT_PUBLIC_CHESSCITO_LITE_MODE
NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY
NEXT_PUBLIC_LITE_PROGRESS_VERSION
NEXT_PUBLIC_PREVIEW_URL
```

### Exact supplied inventories (preserved order)

Play, 50 names:

```text
NEXT_PUBLIC_CELO_ATTRIBUTION_TAG
NEXT_PUBLIC_TELEMETRY_ENABLED
NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT
PEONES_SPEND_REQUIRE_SESSION
NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT
NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED
NEXT_PUBLIC_ATTEMPT_LANE_ENABLED
NEXT_PUBLIC_STREAK_NUDGE_ENABLED
TELEMETRY_ACCOUNT_SECRET
NEXT_PUBLIC_PRIVY_ENABLED
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED
CHESSCITO_LITE_MODE
NEXT_PUBLIC_CHESSCITO_MODE
CHESSCITO_TREASURY_ADDRESS
NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS
NEXT_PUBLIC_APP_URL
CONTENT_STAGE
ADMIN_TOKEN
NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION
TREASURY_ADDRESS
CELO_RPC_URL
CLAIM_IP_HASH_SALT
NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS
NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
PASSPORT_API_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_ENABLE_COACH
ANTHROPIC_API_KEY
CRON_SECRET
SUPABASE_URL
TORRE_PRINCESA
DRAGON
NEXT_PUBLIC_VICTORY_NFT_ADDRESS
NEXT_PUBLIC_SHOP_ADDRESS
PASSPORT_SCORER_ID
NEXT_PUBLIC_USDC_ADDRESS
NEXT_PUBLIC_SCOREBOARD_ADDRESS
NEXT_PUBLIC_BADGES_ADDRESS
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
COACH_LLM_MODEL
COACH_LLM_API_KEY
COACH_LLM_BASE_URL
NEXT_PUBLIC_I18N_ES_READY
SHOP_DEPLOY_BLOCK_CELO
NEXT_PUBLIC_SUPPORT_EMAIL
LOG_SALT
```

Learn, 52 names:

```text
NEXT_PUBLIC_CELO_ATTRIBUTION_TAG
NEXT_PUBLIC_TELEMETRY_ENABLED
NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT
PEONES_SPEND_REQUIRE_SESSION
NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT
NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED
NEXT_PUBLIC_ATTEMPT_LANE_ENABLED
FOCUS_DAYS_LEDGER_ENABLED
NEXT_PUBLIC_STREAK_NUDGE_ENABLED
TELEMETRY_ACCOUNT_SECRET
NEXT_PUBLIC_PRIVY_ENABLED
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_CHESSCITO_MODE
CHESSCITO_TREASURY_ADDRESS
NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS
NEXT_PUBLIC_LITE_PROGRESS_VERSION
ENABLE_LITE_QA_RESET
NEXT_PUBLIC_CHESSCITO_LITE_MODE
CHESSCITO_LITE_MODE
LOG_SALT
NEXT_PUBLIC_SUPPORT_EMAIL
SHOP_DEPLOY_BLOCK_CELO
NEXT_PUBLIC_I18N_ES_READY
NEXT_PUBLIC_PREVIEW_URL
COACH_LLM_BASE_URL
COACH_LLM_API_KEY
COACH_LLM_MODEL
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_BADGES_ADDRESS
NEXT_PUBLIC_SCOREBOARD_ADDRESS
NEXT_PUBLIC_USDC_ADDRESS
PASSPORT_SCORER_ID
NEXT_PUBLIC_SHOP_ADDRESS
NEXT_PUBLIC_VICTORY_NFT_ADDRESS
DRAGON
TORRE_PRINCESA
SUPABASE_URL
CRON_SECRET
ANTHROPIC_API_KEY
NEXT_PUBLIC_ENABLE_COACH
SUPABASE_SERVICE_ROLE_KEY
PASSPORT_API_KEY
UPSTASH_REDIS_REST_TOKEN
UPSTASH_REDIS_REST_URL
CLAIM_IP_HASH_SALT
CELO_RPC_URL
NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY
TREASURY_ADDRESS
NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION
ADMIN_TOKEN
CONTENT_STAGE
```

### Decision semantics

- **COPY_NOW**: copy the existing value unchanged for baseline functionality, identity, diagnostics/analytics or configured behavioral continuity. Names-only evidence cannot prove that a configured live value equals its fallback, so this is a conservative continuity minimum, not an invented feature-state assumption.
- **COPY_IF_FEATURE_ENABLED**: needed only for the described retained feature/caller. Keep the current effective value if the dependency is in use. “Feature” includes active contract/API workflows, not just a card being visible.
- **DO_NOT_COPY**: omit from a new dedicated Production app because there is no reader/effect, it belongs to the other product's ordinary UI, or it is an unnecessary legacy/QA surface. Live legacy aliases require their stated canonical prerequisites; DO_NOT_COPY is not a live deletion instruction.
- **MANUAL_REVIEW**: hold migration decision implementation until service ownership, reachable backend consumers, effective alias precedence or payment agreement is resolved. Do not automatically omit OR duplicate a held secret.

The manifest categories below contain **names only**, not dotenv assignments or values. They exhaust the supplied configured names for each app. New required settings absent from the source inventories are listed separately; no value is manufactured. Ordinary UI routing assumes the dedicated Learn/Play hosts, not the explicit legacy Lite-host routing exemption.

### Final decision matrix — 56 configured unique names

Code status/default/source conclusions come from the existing audit. Each cell is one decision for that app, or NOT_CONFIGURED. For shared names, differences distinguish genuine shared functionality from UI-only settings, operational duplication or shared-but-still-callable APIs. Values and historical copying events were not inspected.

| Variable | Play decision | Learn decision | Play code status | Learn code status | Public/Secret | Source refs | Purpose / sharing reason | Default / omission risk | Migration rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ADMIN_TOKEN` | UNRESOLVED_EXTERNAL_ONLY | UNRESOLVED_EXTERNAL_ONLY | OPS_ONLY | OPS_ONLY | Secret | `apps/web/src/app/api/admin/content/revalidate/route.ts:24`<br>`apps/web/src/app/api/admin/content/route.ts:52`<br>`apps/web/src/app/api/admin/content/stage/route.ts:46` | /api/admin/content, /stage, /revalidate, /lite-stats; control-tower and admin helpers; server runtime Operational endpoints deployed on both; host ownership, not ordinary player need. | missing → admin disabled / 503 | Operator host and immediate per-deployment content-cache invalidation are not established by repository callers. Shared-data administration can use one host; local revalidation cannot invalidate the other deployment. |
| `ANTHROPIC_API_KEY` | DO_NOT_COPY | DO_NOT_COPY | NOT_USED | NOT_USED | Secret | No active web reader | No current application reader found; none No effective application env reader; configured presence does not establish use. | no effect on current application | Candidate omission if configured. Provider name does not cause the OpenAI-compatible Coach client to read this variable. |
| `CELO_RPC_URL` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Sensitive server endpoint | `apps/web/src/app/api/payment-intents/get-peones/route.ts:33`<br>`apps/web/src/app/api/verify-payment/get-peones-canary/route.ts:26`<br>`apps/web/src/app/api/verify-payment/route.ts:71` | Receipt checks/payment verification and cron sync; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | chain default or https://forno.celo.org depending caller; ?? paths treat empty as configured | Dedicated endpoint improves capacity; not universally required. Keep secret if URL contains provider key. |
| `CHESSCITO_LITE_MODE` | DO_NOT_COPY | DO_NOT_COPY | NOT_USED | NOT_USED | Server config name if configured | No active web reader | No env reader for this spelling; the identically named exported TS constant is used; build + server runtime No effective application env reader; configured presence does not establish use. | TS export is derived from mode | Do not confuse an imported constant with an environment variable. No env requirement. |
| `CHESSCITO_TREASURY_ADDRESS` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | OPTIONAL | OPTIONAL | Server config; address not secret | `apps/web/src/lib/payments/rail-config.ts:45` | Authoritative server transfer recipient; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | falls back to TREASURY_ADDRESS using ?? | Canonical server recipient for retained payment verification. Play payment rails and Learn Season Pass use the same helper; Learn sales are gated and currently absent from the supplied inventory. |
| `CLAIM_IP_HASH_SALT` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/server/welcome-pack.ts:109` | /api/welcome-pack/claim salted IP hash; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | absent → null IP hash | Keep if retaining claim/IP abuse correlation; gameplay can operate without this correlation. Do not rotate as part of moving environments. |
| `COACH_LLM_API_KEY` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | OPTIONAL | REVIEW | Secret | `apps/web/src/app/api/coach/analyze/route.ts:65`<br>`apps/web/src/app/api/coach/analyze/route.ts:66` | POST /api/coach/analyze creates the LLM client; server runtime / module initialization Play feature dependency; Learn shares API handlers/imports and callers need review. | absent → client null; uncached analysis returns 503 | Arena and Coach-game clients request analysis on Play. No legitimate Learn analysis caller found after mode redirects. Learn history/read helpers are not LLM callers; omitting the key disables uncached generation, not the whole API surface. |
| `COACH_LLM_BASE_URL` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | OPTIONAL | REVIEW | Server config | `apps/web/src/app/api/coach/analyze/route.ts:60` | Coach OpenAI-compatible provider endpoint; server runtime / module initialization Play feature dependency; Learn shares API handlers/imports and callers need review. | https://api.openai.com/v1 via ?? | Belongs with the Play LLM provider. Preserve the current provider endpoint when Coach is retained; no Learn generation caller. |
| `COACH_LLM_MODEL` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | OPTIONAL | REVIEW | Server config | `apps/web/src/app/api/coach/analyze/route.ts:59` | Coach provider model; server runtime / module initialization Play feature dependency; Learn shares API handlers/imports and callers need review. | gpt-4o-mini via ?? | Belongs with the Play LLM provider. Preserve the current model when Coach is retained; no Learn generation caller. |
| `CONTENT_STAGE` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/content/stage.ts:24` | Merged content overlay maturity floor; server runtime / cached module setup Shared live helper/behavior; conditional feature dependency is stated in code decision. | unset/invalid → compiled baseline only, zero overlay DB reads | Conditional REQUIRED if intended shipped content depends on overlay; do not drop blindly. |
| `CRON_SECRET` | COPY_NOW | DO_NOT_COPY | OPS_ONLY | OPS_ONLY | Secret | `apps/web/src/app/api/cron/coach-purge/route.ts:32`<br>`apps/web/src/app/api/cron/sync/route.ts:9` | GET /api/cron/sync and /api/cron/coach-purge bearer auth; server runtime Operational endpoints deployed on both; host ownership, not ordinary player need. | missing → 401, fail closed | Proposed single scheduled-job host is Play: blockchain/Passport sync and Coach purge share one repository CRON_URL/CRON_SECRET in the two existing workflows. Actual secret-backed target remains external verification. |
| `DRAGON` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | REQUIRED | REVIEW | Secret | `apps/web/src/lib/server/demo-signing.ts:158` | requireEnv → decryptSignerKey → sign-score/badge/labyrinth/victory; server runtime Play feature dependency; Learn shares API handlers/imports and callers need review. | missing throws when getDemoConfig is called | Decryption partner of TORRE_PRINCESA. Preserve the existing pair on each app retaining legitimate signing callers; do not infer that the two deployments have equal values. |
| `ENABLE_LITE_QA_RESET` | NOT_CONFIGURED | DO_NOT_COPY | NOT_USED | OPS_ONLY | Server flag | `apps/web/src/app/lite-debug/reset/page.tsx:18` | Learn hidden /lite-debug/reset page; server runtime Inventory app-only; code semantic conclusion is stated in rationale. | 404 unless Learn mode AND literal true | Do not introduce into dedicated Production Learn: QA-only tool, not required for gameplay. This intentionally excludes Production QA capability; it is not a dead variable. |
| `FOCUS_DAYS_LEDGER_ENABLED` | NOT_CONFIGURED | COPY_NOW | REVIEW | OPTIONAL | Server flag | `apps/web/src/app/api/focus-day/route.ts:82`<br>`apps/web/src/app/api/season-pass/status/route.ts:216` | Learn Focus Days writes/reads for purchased pass; server runtime Inventory app-only; code semantic conclusion is stated in rationale. | Redis override wins; then literal true env; otherwise off | Learn recorder gated by Lite mode. Play APIs still reachable. Retain for existing entitlement progress; deleting env may disable if Redis override absent. |
| `LOG_SALT` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/server/logger.ts:142`<br>`apps/web/src/lib/server/logger.ts:171` | Shared privacy-safe wallet/IP logging; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | missing → unsalted placeholder + one warning, never raw address fallback | Both use logger. Keep for useful pseudonymous incident logs; absence reduces diagnostic correlation. |
| `NEXT_PUBLIC_APP_URL` | COPY_NOW | NOT_CONFIGURED | REQUIRED | REQUIRED | Public | `apps/web/src/app/[locale]/layout.tsx:15`<br>`apps/web/src/app/[locale]/victory/[id]/page.tsx:63`<br>`apps/web/src/app/api/games/[id]/mint-receipt/route.ts:21` | Metadata base/sitemap and origin allow-list; build + server runtime Inventory app-only; code semantic conclusion is stated in rationale. | layout/sitemap use www origin; origin helpers also accept Vercel auto URLs | Use the app canonical URL. Not Play-specific: missing on Learn gives the wrong metadata base. |
| `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` | DO_NOT_COPY | COPY_NOW | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/feature-flags.ts:94` | Client score-attempt outbox emergency switch; build + server runtime Learn product UI; configured on Play without normal Play effect. | DEFAULT ON: only literal false disables | Active outbox consumer is ExercisesScreen, redirected to Learn on normal Play hosts. Play API remains callable but does not consult this client flag. Legacy Lite host exemption requires separate review. |
| `NEXT_PUBLIC_BADGES_ADDRESS` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | REQUIRED | REVIEW | Public | `apps/web/src/lib/contracts/chains.ts:16`<br>`apps/web/src/lib/server/demo-signing.ts:154` | Contract helper and getDemoConfig signing bundle; victory viewing/sync for NFT; build + server runtime Play feature dependency; Learn shares API handlers/imports and callers need review. | client missing → null/unconfigured; getDemoConfig throws | Learn ExercisesScreen exposes badge claim callers; signing factory also requires this address for every demo-signing request. |
| `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Public transaction metadata | `apps/web/src/lib/payments/attribution.ts:86` | Celo builder attribution suffix on client transactions; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | absent/invalid → unattributed transaction with warning | Not a credential. Preserve for attribution; no authorization depends on it. |
| `NEXT_PUBLIC_CHAIN_ID` | COPY_NOW | COPY_NOW | REQUIRED | REQUIRED | Public | `apps/web/src/lib/contracts/chains.ts:58`<br>`apps/web/src/lib/server/demo-signing.ts:153` | Wallet/contract configuration and signing helper; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | invalid/unset → null; signing requireEnv throws | Set 42220 for intended Celo mainnet; required for connected/on-chain behavior, not local practice alone. |
| `NEXT_PUBLIC_CHESSCITO_LITE_MODE` | NOT_CONFIGURED | DO_NOT_COPY | LEGACY_FLAG | LEGACY_FLAG | Public | `apps/web/src/lib/feature-flags.ts:7` | Legacy product-mode compatibility; build + server runtime Inventory app-only; code semantic conclusion is stated in rationale. | unset allowed with explicit mode | Do not introduce legacy compatibility key: explicit valid learn mode suffices. Validate canonical mode before omission; never carry conflicting false. |
| `NEXT_PUBLIC_CHESSCITO_MODE` | COPY_NOW | COPY_NOW | REQUIRED | REQUIRED | Public | `apps/web/src/app/api/peones/balance/route.ts:181`<br>`apps/web/src/lib/feature-flags.ts:6`<br>`apps/web/src/lib/scores/deployment-surface.ts:24` | Product UI, routing, provenance and weekly board; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | legacy=true → learn; otherwise full; weekly read throws without explicit mode | Set play / learn respectively. Never infer the product from project name. |
| `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT` | DO_NOT_COPY | COPY_NOW | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/daily/session-quota.ts:31` | Learn exercise extra-session quota; build + server runtime Learn product UI; configured on Play without normal Play effect. | 10 if missing/invalid/nonpositive | Exercise UI is redirected from Play; not a backend security quota. |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/payments/rail-config.ts:35` | Client direct-transfer recipient; Peones/PRO/Season Pass rail; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | invalid/unset → null; rail not configured | Canonical browser recipient, paired with the server recipient on each retained payment rail. Preserve each app’s effective recipient; names do not prove agreement. |
| `NEXT_PUBLIC_ENABLE_COACH` | COPY_NOW | DO_NOT_COPY | OPTIONAL | NOT_USED | Public | `apps/web/src/app/[locale]/arena/page.tsx:81` | Arena Coach UI; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | DEFAULT ON: only literal false disables | Preserve Play UI feature state because omission enables its default. No legitimate Learn generation UI caller; this flag is not a server-mode authorization gate. |
| `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION` | DO_NOT_COPY | COPY_NOW | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/exercises/rotation-flag.ts:12` | Exercises screen rotation selection; build + server runtime Learn product UI; configured on Play without normal Play effect. | only true enables; absence legacy linear path | Play /exercises redirects to Learn. Current constant + consumers still active; naming does not prove rollout complete. |
| `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY` | NOT_CONFIGURED | DO_NOT_COPY | NOT_USED | NOT_USED | Public | `apps/web/src/lib/telemetry.ts:72` | Development-only telemetry override; build + server runtime Inventory app-only; code semantic conclusion is stated in rationale. | Production NODE_ENV != development makes telemetry eligible regardless of flag | OPS_ONLY in local development, but NOT_USED for Production effect in both. Removing does not disable Production telemetry. |
| `NEXT_PUBLIC_I18N_ES_READY` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Public-named; middleware consumer | `apps/web/src/middleware.ts:28` | Spanish locale gate; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | only 1 enables Spanish; otherwise /es redirects to English | Still live middleware behavior in both apps. Preserve 1 for ES parity; no evidence that rollout gate was removed. |
| `NEXT_PUBLIC_LITE_PROGRESS_VERSION` | NOT_CONFIGURED | COPY_NOW | REVIEW | OPTIONAL | Public | `apps/web/src/lib/lite-progress-storage.ts:11` | Browser progress namespace, reused by daily/game helpers; build + server runtime Inventory app-only; code semantic conclusion is stated in rationale. | chesscito: legacy prefix if unset/invalid | Copy unchanged on Learn: omission/change switches shared localStorage namespace. Do not interpret QA origin as safe removal. |
| `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` | DO_NOT_COPY | COPY_NOW | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/onboarding/first-activity-experiment.ts:42` | Learn hub tour → Daily Focus experiment; build + server runtime Learn product UI; configured on Play without normal Play effect. | 0 if unset/invalid/out of 0..100; integers floor | Experiment surface explicitly Learn, and Play mounts separate hub. Preserve nonzero rollout if intended. |
| `NEXT_PUBLIC_PREVIEW_URL` | NOT_CONFIGURED | COPY_NOW | OPTIONAL | OPTIONAL | Public | `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:22`<br>`apps/web/src/lib/pro/pro-origin.ts:73`<br>`apps/web/src/lib/server/demo-signing.ts:257` | Extra allow-listed origin for custom preview aliases; build + server runtime Inventory app-only; code semantic conclusion is stated in rationale. | absent adds no host; Vercel URL/branch/production host remain | Not Learn-specific. Retain if a custom alias is used; no automatic metadata-base substitution. |
| `NEXT_PUBLIC_PRIVY_APP_ID` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | OPTIONAL | OPTIONAL | Public identifier | `apps/web/src/components/web-wallet-provider.tsx:45` | Privy web provider mount; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | mount throws if Privy enabled but ID missing | Conditional REQUIRED with Privy enabled in either app. Public app ID is not a service secret. |
| `NEXT_PUBLIC_PRIVY_ENABLED` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Public | `apps/web/src/components/wallet-provider-boundary.tsx:18` | Wallet branch selection outside MiniPay; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | only true enables Privy; otherwise injected wallet | Conditional REQUIRED=true for existing Privy web-login parity; MiniPay uses injected branch independently. |
| `NEXT_PUBLIC_SCOREBOARD_ADDRESS` | COPY_NOW | COPY_IF_FEATURE_ENABLED | REQUIRED | REVIEW | Public | `apps/web/src/lib/contracts/chains.ts:8`<br>`apps/web/src/lib/server/sync-blockchain.ts:20`<br>`apps/web/src/lib/server/demo-signing.ts:155` | Contract helper and getDemoConfig signing bundle; victory viewing/sync for NFT; build + server runtime Play feature dependency; Learn shares API handlers/imports and callers need review. | client missing → null/unconfigured; getDemoConfig throws | Learn Save proof is a real optional user action in mission detail and leaderboard. Removing the address hides its CTA; off-chain basic saving does not need the signer. |
| `NEXT_PUBLIC_SHOP_ADDRESS` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | OPTIONAL | REVIEW | Public | `apps/web/src/app/api/founder-status/route.ts:37`<br>`apps/web/src/app/api/verify-pro/route.ts:23`<br>`apps/web/src/lib/contracts/chains.ts:24` | Shop/PRO/Founder contract workflows; build + server runtime Play feature dependency; Learn shares API handlers/imports and callers need review. | unconfigured client; founder route has no contract client | Founder/contract Shop purchase belongs to Play. Learn uses LearnShopSheet → SeasonPassSheet → treasury transfer instead. Shared hidden Shop hooks perform incidental reads, not a legitimate Learn founder purchase. |
| `NEXT_PUBLIC_STREAK_NUDGE_ENABLED` | DO_NOT_COPY | COPY_NOW | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/feature-flags.ts:66` | Exercises streak nudge storage/overlay; build + server runtime Learn product UI; configured on Play without normal Play effect. | only true enables; otherwise no nudge updates/render | Active Learn exercise consumer and on/off tests; not dead. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Public contact | `apps/web/src/lib/content/editorial.ts:2487`<br>`apps/web/src/lib/content/editorial.ts:2521`<br>`apps/web/src/lib/content/editorial.ts:2523` | Editorial support/privacy contact; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | our support team placeholder via ?? | Product/support parity choice, not service credential. |
| `NEXT_PUBLIC_TELEMETRY_ENABLED` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/telemetry.ts:86` | Telemetry emergency kill switch; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | DEFAULT ON; 0 or false (case insensitive false) disables | Copy unchanged on both: absent defaults ON; removing a configured false/0 can restore traffic. |
| `NEXT_PUBLIC_USDC_ADDRESS` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | OPTIONAL | OPTIONAL | Public | `apps/web/src/lib/contracts/chains.ts:32` | Configured USDC contract in wallet/payment flows; build + server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | contract helper null; token registry also has separate fixed addresses | Keep when configured client payment/mint paths use it. Do not assume token-registry fallback replaces every getter. |
| `NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS` | DO_NOT_COPY | NOT_CONFIGURED | LEGACY_FLAG | LEGACY_FLAG | Public | No active reader; history/comments only | Completed extraction rollout; only comments remain; none Inventory app-only; code semantic conclusion is stated in rationale. | no active reader, no effect | Omission candidate proven by commit a82a375b (2026-05-28); not required even on Play. |
| `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK` | DO_NOT_COPY | NOT_CONFIGURED | LEGACY_FLAG | LEGACY_FLAG | Public | No active reader; history/comments only | Completed extraction rollout; only comments remain; none Inventory app-only; code semantic conclusion is stated in rationale. | no active reader, no effect | Omission candidate proven by commit a82a375b (2026-05-28); not required even on Play. |
| `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` | COPY_NOW | COPY_IF_FEATURE_ENABLED | REQUIRED | REVIEW | Public | `apps/web/src/app/[locale]/victory/[id]/page.tsx:20`<br>`apps/web/src/app/api/og/victory/[id]/route.tsx:27`<br>`apps/web/src/lib/contracts/chains.ts:37` | Contract helper and getDemoConfig signing bundle; victory viewing/sync for NFT; build + server runtime Play feature dependency; Learn shares API handlers/imports and callers need review. | client missing → null/unconfigured; getDemoConfig throws | Victory minting belongs to Play, but getDemoConfig unconditionally requires this config for Learn sign-score and sign-badge too. Retain as a factory dependency; no Learn victory-minting claim is made. |
| `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED` | COPY_NOW | NOT_CONFIGURED | OPTIONAL | NOT_USED | Public | `apps/web/src/lib/feature-flags.ts:70` | Play mint hook: permit-mint vs existing mint path; build + server runtime Inventory app-only; code semantic conclusion is stated in rationale. | only true selects permit branch; absent false | Live behavior flag, not completed hook-extraction flag. Learn UI cannot mount arena/coach; backend signing API is separate. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | DO_NOT_COPY | DO_NOT_COPY | NOT_USED | NOT_USED | Public identifier if valid | No active web reader | No current web runtime reader; injected + Privy wallet configurations; none No effective application env reader; configured presence does not establish use. | no current effect | Shared template is stale for this key; RainbowKit removal documented in wagmi-config. Not needed merely because transitive wallet packages exist. |
| `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` | DO_NOT_COPY | COPY_NOW | NOT_USED | OPTIONAL | Public | `apps/web/src/lib/feature-flags.ts:119` | Client weekly leaderboard tab; build + server runtime Learn product UI; configured on Play without normal Play effect. | only true enables | Learn training leaderboard tab. Play Arena selects PlayLeadersSheet (Hall of Fame), not the training board. Weekly API remains callable on both, independent of this UI flag. |
| `PASSPORT_API_KEY` | COPY_NOW | DO_NOT_COPY | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/server/passport.ts:4` | syncBlockchain → checkPassportScores; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | absent key/scorer → false verification | Only active web consumer is sync-blockchain → checkPassportScores. Keep on proposed Play job host for existing scheduled enrichment; omitting it during sync produces false verification results, not a harmless skipped enrichment. |
| `PASSPORT_SCORER_ID` | COPY_NOW | DO_NOT_COPY | OPTIONAL | OPTIONAL | Server config | `apps/web/src/lib/server/passport.ts:5` | Passport score scope; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | absent → false verification | Required with the Passport key for retained scheduled enrichment; missing either returns false and sync persists that result. Not needed by Learn leaderboard readers. |
| `PEONES_SPEND_REQUIRE_SESSION` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Server security rollout flag | `apps/web/src/lib/scores/spend-session-guard.ts:69` | Peones spend wallet-auth binding; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | literal true enables; otherwise legacy behavior | Copy unchanged on both: omission can turn off session enforcement. This audit does not select a new security state. |
| `SHOP_DEPLOY_BLOCK_CELO` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | OPTIONAL | REVIEW | Server config | `apps/web/src/app/api/founder-status/route.ts:57` | Historical founder scan lower bound; server runtime Play feature dependency; Learn shares API handlers/imports and callers need review. | fallback constant 37800000; malformed also falls back | Founder ownership log scan belongs to Play. useFounderStatus explicitly exits in Learn; Learn training/entitlement reads do not require founder contract history. |
| `SUPABASE_SERVICE_ROLE_KEY` | COPY_NOW | COPY_NOW | REQUIRED | REQUIRED | Secret | `apps/web/src/lib/supabase/server.ts:51` | Privileged server Supabase operations; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | client null without URL/key | Both connected products require this today. Shared source alone is not the justification: both have actual DB workflows. |
| `SUPABASE_URL` | COPY_NOW | COPY_NOW | REQUIRED | REQUIRED | Server config | `apps/web/src/lib/supabase/server.ts:50` | Shared authoritative off-chain sessions, attempts, entitlements, ledger, content, inbox and analytics; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | client null without URL/key; callers degrade or return unavailable | Required for the connected product, not to merely render a local game. |
| `TELEMETRY_ACCOUNT_SECRET` | COPY_NOW | COPY_NOW | OPTIONAL | OPTIONAL | Secret | `apps/web/src/lib/analytics/account-ref.ts:30` | /api/telemetry HMAC account_ref; server runtime Shared live helper/behavior; conditional feature dependency is stated in code decision. | absent → account_ref null, anonymous telemetry continues | Keep on both for comparable account-level analytics; preserve the existing key for continuity. Not necessary for anonymous-only gameplay. |
| `TORRE_PRINCESA` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | REQUIRED | REVIEW | Secret | `apps/web/src/lib/server/demo-signing.ts:158` | requireEnv → decryptSignerKey → sign-score/badge/labyrinth/victory; server runtime Play feature dependency; Learn shares API handlers/imports and callers need review. | missing throws when getDemoConfig is called | Signing ciphertext is needed for retained Learn badge claims and Save proof, not only Play minting. Current requests are same-origin: cannot centralize signing in Play without code changes. |
| `TREASURY_ADDRESS` | DO_NOT_COPY | DO_NOT_COPY | LEGACY_FLAG | LEGACY_FLAG | Server config; address not secret | `apps/web/src/lib/payments/rail-config.ts:45` | Legacy server recipient alias; server runtime Shared live server fallback; canonical precedence requires reconciliation. | only used when CHESSCITO_TREASURY_ADDRESS is null/undefined | Legacy server fallback only. Populate the canonical server name with the verified effective recipient before relying on omission; no extra alias is needed in a new environment. |
| `UPSTASH_REDIS_REST_TOKEN` | COPY_NOW | COPY_NOW | REQUIRED | REQUIRED | Secret | `apps/web/node_modules/@upstash/redis/nodejs.mjs:276` | SDK fromEnv: shared rate limiting, caches, sessions/entitlements, plus Coach; server runtime / module initialization Shared live helper/behavior; conditional feature dependency is stated in code decision. | SDK falls back to KV_REST_API_URL / KV_REST_API_TOKEN; missing credentials break requests | Both apps use Redis outside Coach. Use one credential pair, not both aliases. |
| `UPSTASH_REDIS_REST_URL` | COPY_NOW | COPY_NOW | REQUIRED | REQUIRED | Server config | `apps/web/node_modules/@upstash/redis/nodejs.mjs:272` | SDK fromEnv: shared rate limiting, caches, sessions/entitlements, plus Coach; server runtime / module initialization Shared live helper/behavior; conditional feature dependency is stated in code decision. | SDK falls back to KV_REST_API_URL / KV_REST_API_TOKEN; missing credentials break requests | Both apps use Redis outside Coach. Use one credential pair, not both aliases. |


## Final migration manifest location

The authoritative eight manifests and operational decisions are in **Final operational ownership resolution** below. They replace the earlier MANUAL_REVIEW partitions. The supplied inventory counts remain unchanged; the final Learn manifest additionally includes its missing canonical app origin.

## Reconciliation findings

**Historical reconciliation context:** the code/default evidence below is retained. Ownership holds and suggested omissions in this section are superseded by **Final operational ownership resolution**, particularly the proven Learn signing callers.

### Configured but unused, retired, or Production-inert

**No current runtime env reader:**

- Both: CHESSCITO_LITE_MODE, ANTHROPIC_API_KEY, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
- Play only: NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS and NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK (retired rollout, history-proven; comments are not executable readers).

**Reader exists but no Production effect:** Learn NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY; NODE_ENV outside development makes local telemetry eligibility true independently. Not the same as NEXT_PUBLIC_TELEMETRY_ENABLED.

**No normal Play UI effect, despite configured shared membership:** NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT, NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT, NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED, NEXT_PUBLIC_ATTEMPT_LANE_ENABLED, NEXT_PUBLIC_STREAK_NUDGE_ENABLED, NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION. Their Learn readers remain active. Play /exercises redirects away; PlayLeadersSheet is Hall of Fame, not the training weekly tab. Exempt legacy Lite hosts or deliberate internal full builds are outside this dedicated Production recommendation.

**Do not label as unused:** NEXT_PUBLIC_CHESSCITO_LITE_MODE (live compatibility); TREASURY_ADDRESS (live fallback); ENABLE_LITE_QA_RESET (live QA page); FOCUS_DAYS_LEDGER_ENABLED (live ledger with Redis override); Learn Coach/signing variables (reachable API readers despite UI redirects).

### Code-required settings missing from each inventory

| App | Missing name | Requirement / conclusion |
| --- | --- | --- |
| Learn | NEXT_PUBLIC_APP_URL | Required for correct app metadata/canonical/OG base and explicit canonical origin configuration. It is absent from the exact 52-name list. Layout/sitemap fall back to www; NEXT_PUBLIC_PREVIEW_URL is NOT a metadata substitute. Add a separately validated Learn origin to the candidate manifest before deploying; do not copy Play's origin. No change made here. |
| Play | NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS | Conditional requirement of getLabyrinthBadgesAddress() / sign-labyrinth. Missing from exact 50-name list. Needed only if this signing feature is retained/called; missing throws. This does not establish a defect in ordinary Arena gameplay. |
| Learn | NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS | Same reachable API conditional requirement; normal off-chain Learn UI does not itself justify introducing it. Resolve Learn signing-service scope first. |

All base mode, Supabase pair, Upstash pair, chain ID, and eager getDemoConfig base badge/scoreboard/victory names are present in both inventories. Privy flag/ID and Play Coach API/model/base are present. Presence does not validate values or prove the feature works. **No additional unconditional missing baseline key was proven.**

Absent but defaulted/feature-only names are not “missing required” automatically: NEXT_PUBLIC_PREVIEW_URL on Play (auto Vercel host allow-list still exists), NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED on both (default ON), NEXT_PUBLIC_ENABLE_DUEL on both (default discovery OFF; API/invitations still alive), NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED on both (default sales paused), FOCUS_DAYS_LEDGER_ENABLED on Play (Redis override can still control APIs), FOUNDER_STATUS_RPC_URL on both (Forno fallback independent of CELO_RPC_URL), NEXT_PUBLIC_MINIPAY_FEE_CURRENCY (no override), capacity/theme/app-version knobs, KV aliases, and the independent canary settings. Do not introduce these automatically merely because source reads them.

### Behavioral continuity — preserve current effective values

COPY_NOW preserves current values without printing/inspecting them. Identity and configuration must be copied to the matching app, not copied cross-app. The names-only audit cannot validate actual mode or origin strings.

- Both: NEXT_PUBLIC_CHESSCITO_MODE, NEXT_PUBLIC_CHAIN_ID, NEXT_PUBLIC_PRIVY_ENABLED, NEXT_PUBLIC_TELEMETRY_ENABLED, NEXT_PUBLIC_I18N_ES_READY, PEONES_SPEND_REQUIRE_SESSION, CONTENT_STAGE, CELO_RPC_URL, NEXT_PUBLIC_CELO_ATTRIBUTION_TAG, NEXT_PUBLIC_SUPPORT_EMAIL.
- Both: preserve existing SUPABASE_URL/KEY and UPSTASH URL/TOKEN pairs unless deliberately selecting isolated data environments. Backend identity changes can redirect reads/writes to different data, even with correct names.
- Both: TELEMETRY_ACCOUNT_SECRET, LOG_SALT and CLAIM_IP_HASH_SALT should retain current effective keys for HMAC identity/log/claim correlation continuity; this is not a rotation task. Missing telemetry account key produces null identities; missing salts reduces correlation.
- Play: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ENABLE_COACH, NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED. Optional flags still encode current behavior; their value was not assumed.
- Learn: NEXT_PUBLIC_PREVIEW_URL, NEXT_PUBLIC_LITE_PROGRESS_VERSION, FOCUS_DAYS_LEDGER_ENABLED, NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT, NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT, NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED, NEXT_PUBLIC_ATTEMPT_LANE_ENABLED, NEXT_PUBLIC_STREAK_NUDGE_ENABLED, NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION. Keep the progress namespace exactly; changing the web origin also changes localStorage scope independently.
- Conditional features: preserve selected contract addresses, signer/decryption pairing, SHOP_DEPLOY_BLOCK_CELO, Privy ID and LLM model/base/key. A present empty string can behave differently from omission where `??` is used.
- Manual recipient group: preserve the EFFECTIVE current payment recipient and its public/server agreement. A configured canonical name does not prove it is populated or valid. Do not silently switch from legacy recipient to a different canonical recipient.
- Focus Days/capacity settings also have Redis/DB overrides. Copying env names/values alone does not verify their resulting live state; those stores were not inspected.

### Risky omission/default changes

| Setting | Omission consequence |
| --- | --- |
| NEXT_PUBLIC_TELEMETRY_ENABLED (both configured) | Defaults ON; deleting false/0 restores events/network traffic. |
| NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED (neither configured) | Defaults ON today. Preserve absence for parity; do not introduce false, which restores per-event requests. |
| NEXT_PUBLIC_ENABLE_COACH (both configured) | Defaults ON in Arena. Play must preserve current switch. Learn's UI switch is not an API shutdown. |
| NEXT_PUBLIC_ATTEMPT_LANE_ENABLED (both configured; Learn UI effect) | Defaults ON; omitting false enables writer/outbox. Play ordinary UI does not mount the consumer. |
| PEONES_SPEND_REQUIRE_SESSION (both configured) | Omission turns enforcement off; preserve current effective state, especially true. |
| NEXT_PUBLIC_PRIVY_ENABLED / ID | Omitting enabled flag changes browser auth branch; enabled branch without ID throws at mount. |
| NEXT_PUBLIC_I18N_ES_READY | Omitting enabled 1 redirects Spanish routes to English. |
| NEXT_PUBLIC_CHESSCITO_MODE | Product mode/provenance fallback can be wrong; weekly read can throw. Legacy compatibility alone is insufficient for explicit identity. |
| CONTENT_STAGE | Missing/invalid uses compiled baseline instead of DB content overlay. |
| NEXT_PUBLIC_LITE_PROGRESS_VERSION | Missing/invalid returns legacy keys; previous namespace progress appears missing. |
| FOCUS_DAYS_LEDGER_ENABLED | Without Redis override, removing true disables existing buyer ledger/progress; paused sales do not justify it. |
| Treasury canonical/legacy/public recipient | Can disable or redirect the rail; `??` means empty canonical masks valid legacy fallback. |
| Provider model/base/RPC variables | Omission selects defaults; empty and absent can differ. Do not infer equivalence without value-aware review outside this audit. |

### Secrets to minimize to one intended service host

Both inventories contain ADMIN_TOKEN, CRON_SECRET, PASSPORT_API_KEY/PASSPORT_SCORER_ID, COACH_LLM_API_KEY, TORRE_PRINCESA and DRAGON. This verifies duplicated names, **not identical secret values**.

- **ADMIN_TOKEN:** recommend one intentional administration host, outside ordinary player configuration where feasible. Shared admin routes remain compiled in both; omission disables admin operations only.
- **CRON_SECRET + Passport key/scorer:** place on actual sync/enrichment and maintenance job host(s). Select scheduler endpoints first. There may be different legitimate targets for sync and Coach purge, so do not declare that one shared token on one product necessarily covers all jobs. No scheduler was moved.
- **COACH_LLM_API_KEY:** recommend Play as Coach service host. Learn APIs remain reachable, so do not automatically remove/copy there before deciding service ownership and existing consumers. Model/base belong with the chosen service, but are not secrets themselves.
- **TORRE_PRINCESA + DRAGON:** recommend the intended signing service host (Play for normal product signing) rather than duplicating for Learn's off-chain UI. Existing Learn signing APIs are not mode-gated; manual consumer review is required before omission. Preserve key/decryption pairing when retained.
- **Supabase/Upstash secrets:** do not centralize by simply withholding them from Learn: both apps currently perform real backend workflows. Doing so would require architecture/code changes beyond this audit.
- **Telemetry/salts:** both apps legitimately use their own configured identity/correlation keys. They are not single-host job credentials. Do not rotate or infer matching values.
- **ANTHROPIC_API_KEY:** unused in either runtime, so it needs no new application host under current code.

### Aliases and legacy settings not to introduce

- CHESSCITO_LITE_MODE: no environment reader; TS constant is derived from mode.
- NEXT_PUBLIC_CHESSCITO_LITE_MODE: omit in new Learn after validating explicit learn mode; legacy fallback and conflict check are still real, so do not call it a dead feature.
- NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS / NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK: completed rollout flags, Play-only currently configured.
- NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: shared configured name but no current web reader; injected/Privy configuration does not need it.
- ANTHROPIC_API_KEY: shared configured name but no runtime reader; not an alias automatically used by COACH_LLM_API_KEY.
- TREASURY_ADDRESS: do not introduce as a second recipient source into a new manifest. It remains MANUAL_REVIEW in the category partition because removing the effective live fallback without resolving canonical configuration can change payments. Resolve effective recipient first; then carry only canonical server recipient + matching public recipient.
- KV_REST_API_URL/TOKEN: not currently configured in either inventory; do not add legacy SDK aliases when canonical Upstash pair exists.
- NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY / ENABLE_LITE_QA_RESET: omit from dedicated Production manifests; respectively Production-inert and unnecessary live QA capability. The latter omission intentionally removes QA access, not player gameplay.

### Final result and remaining limitations

The exact configured-name reconciliation and all eight category manifests are complete. No supplied name is unmapped; no name absent from an app is pretended to be configured there. Every shared name has independent app decisions with code references/defaults and sharing rationale. Presence patterns do not demonstrate historical copying intent or secret equality.

Deployment readiness still requires resolving MANUAL_REVIEW items and deciding retained conditional features. Most importantly, introduce the missing Learn canonical APP_URL with its own origin, preserve progress/security/telemetry identity, settle treasury precedence and choose admin/cron/Coach/signing ownership. Those are review outcomes, not actions executed here. No new deployment or live configuration change is authorized or performed by this report.

## Final operational ownership resolution

This names-only resolution supersedes earlier MANUAL_REVIEW decisions and ownership suggestions, while retaining the proven reader/default/history evidence. No application, workflow or remote setting was changed. Analysis assumes dedicated canonical product modes using NEXT_PUBLIC_CHESSCITO_MODE, rather than a runtime CHESSCITO_LITE_MODE environment variable. Configured-name presence does not establish feature state or credential validity.

### Outcome and final counts

| Partition | Play | Learn |
| --- | ---: | ---: |
| Current supplied Production inventory | 50 | 52 |
| REQUIRED_COPY | 25 | 27 |
| FEATURE_COPY | 12 | 9 |
| DO_NOT_COPY | 12 | 16 |
| UNRESOLVED_EXTERNAL_ONLY | 1 | 1 |
| Final classified names, including new Learn APP_URL | 50 | 53 |
| Copy candidates: required + retained optional features | 37 | 36 |

The unchanged source inventories have shared **46**, Play-only **4**, Learn-only **6**, unique **56**. Only Learn’s APP_URL is added to its manifest; no additional configured names are invented. REQUIRED_COPY is the conservative continuity baseline, not a claim that every name has no fallback. Feature groups are copied together only when retained. Total copied names therefore depend on which optional features are retained; ADMIN_TOKEN is additional only if its operational responsibility is assigned to that host. These are deploy preparation manifests, not a certification that unseen values or scheduled-job routing are correct.

Of the original **25 MANUAL_REVIEW app assignments** (Play seven, Learn eighteen), **23 are resolved**; the remaining two assignments concern **one unique name**, ADMIN_TOKEN. Seven unique dead/retired/legacy names are excluded: ANTHROPIC_API_KEY, CHESSCITO_LITE_MODE, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, both extracted-hook flags, NEXT_PUBLIC_CHESSCITO_LITE_MODE and TREASURY_ADDRESS. Including Learn’s QA reset and Production-inert local telemetry, nine unique names are excluded for these reasons across thirteen configured placements (six Play, seven Learn). Other DO_NOT_COPY names are omitted for product ownership or absent legitimate callers, not declared dead globally. Nothing was deleted from Production.

### Final decisions for formerly held variables

COPY_NOW maps to REQUIRED_COPY; COPY_IF_FEATURE_ENABLED maps to FEATURE_COPY. Play decisions for names originally held only in Learn are included for comparison. Play event-contract settings are additionally promoted to REQUIRED_COPY because the retained scheduled sync reads both contracts independently of minting/score UI state.

| Variable | Play final decision | Learn final decision | Repository evidence / reason |
| --- | --- | --- | --- |
| `ADMIN_TOKEN` | UNRESOLVED_EXTERNAL_ONLY | UNRESOLVED_EXTERNAL_ONLY | Operator host and immediate per-deployment content-cache invalidation are not established by repository callers. Shared-data administration can use one host; local revalidation cannot invalidate the other deployment. Sources: `apps/web/src/app/api/admin/content/revalidate/route.ts:24`; `apps/web/src/app/control-tower/access/page.tsx:30`; `apps/web/src/app/api/admin/lite-stats/route.ts:95`; `docs/runbooks/2026-06-17-db-content-phase3-runbook.md` |
| `CHESSCITO_TREASURY_ADDRESS` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | Canonical server recipient for retained payment verification. Play payment rails and Learn Season Pass use the same helper; Learn sales are gated and currently absent from the supplied inventory. Sources: `apps/web/src/lib/payments/rail-config.ts:43`; `apps/web/src/lib/season-pass/use-season-pass-rail.ts:75` |
| `COACH_LLM_API_KEY` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | Arena and Coach-game clients request analysis on Play. No legitimate Learn analysis caller found after mode redirects. Learn history/read helpers are not LLM callers; omitting the key disables uncached generation, not the whole API surface. Sources: `apps/web/src/app/api/coach/analyze/route.ts:65`; `apps/web/src/app/[locale]/arena/page.tsx:411`; `apps/web/src/app/[locale]/coach/[gameId]/coach-game-client.tsx:77` |
| `COACH_LLM_BASE_URL` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | Belongs with the Play LLM provider. Preserve the current provider endpoint when Coach is retained; no Learn generation caller. Sources: `apps/web/src/app/api/coach/analyze/route.ts:60` |
| `COACH_LLM_MODEL` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | Belongs with the Play LLM provider. Preserve the current model when Coach is retained; no Learn generation caller. Sources: `apps/web/src/app/api/coach/analyze/route.ts:59` |
| `CRON_SECRET` | COPY_NOW | DO_NOT_COPY | Proposed single scheduled-job host is Play: blockchain/Passport sync and Coach purge share one repository CRON_URL/CRON_SECRET in the two existing workflows. Actual secret-backed target remains external verification. Sources: `.github/workflows/cron-cache-sync.yml`; `.github/workflows/cron-coach-purge.yml`; `apps/web/src/app/api/cron/sync/route.ts:9` |
| `DRAGON` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | Decryption partner of TORRE_PRINCESA. Preserve the existing pair on each app retaining legitimate signing callers; do not infer that the two deployments have equal values. Sources: `apps/web/src/lib/server/demo-signing.ts:158` |
| `NEXT_PUBLIC_BADGES_ADDRESS` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | Learn ExercisesScreen exposes badge claim callers; signing factory also requires this address for every demo-signing request. Sources: `apps/web/src/components/exercises/exercises-screen.tsx:4985`; `apps/web/src/lib/server/demo-signing.ts:154` |
| `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | Canonical browser recipient, paired with the server recipient on each retained payment rail. Preserve each app’s effective recipient; names do not prove agreement. Sources: `apps/web/src/lib/payments/rail-config.ts:34`; `apps/web/src/lib/pro/use-pro-rail.ts:86` |
| `NEXT_PUBLIC_ENABLE_COACH` | COPY_NOW | DO_NOT_COPY | Preserve Play UI feature state because omission enables its default. No legitimate Learn generation UI caller; this flag is not a server-mode authorization gate. Sources: `apps/web/src/app/[locale]/arena/page.tsx`; `apps/web/src/lib/mode-routing.ts:67` |
| `NEXT_PUBLIC_SCOREBOARD_ADDRESS` | COPY_NOW | COPY_IF_FEATURE_ENABLED | Learn Save proof is a real optional user action in mission detail and leaderboard. Removing the address hides its CTA; off-chain basic saving does not need the signer. Sources: `apps/web/src/lib/exercises/save-proof-state.ts:53`; `apps/web/src/components/exercises/exercises-screen.tsx:4239`; `apps/web/src/components/exercises/exercises-screen.tsx:5048` |
| `NEXT_PUBLIC_SHOP_ADDRESS` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | Founder/contract Shop purchase belongs to Play. Learn uses LearnShopSheet → SeasonPassSheet → treasury transfer instead. Shared hidden Shop hooks perform incidental reads, not a legitimate Learn founder purchase. Sources: `apps/web/src/components/learn/learn-shop-sheet.tsx:11`; `apps/web/src/components/exercises/exercises-screen.tsx:5007`; `apps/web/src/components/hub/learn-hub-client.tsx:701` |
| `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` | COPY_NOW | COPY_IF_FEATURE_ENABLED | Victory minting belongs to Play, but getDemoConfig unconditionally requires this config for Learn sign-score and sign-badge too. Retain as a factory dependency; no Learn victory-minting claim is made. Sources: `apps/web/src/lib/server/demo-signing.ts:156` |
| `PASSPORT_API_KEY` | COPY_NOW | DO_NOT_COPY | Only active web consumer is sync-blockchain → checkPassportScores. Keep on proposed Play job host for existing scheduled enrichment; omitting it during sync produces false verification results, not a harmless skipped enrichment. Sources: `apps/web/src/lib/server/passport.ts:4`; `apps/web/src/lib/server/sync-blockchain.ts:176` |
| `PASSPORT_SCORER_ID` | COPY_NOW | DO_NOT_COPY | Required with the Passport key for retained scheduled enrichment; missing either returns false and sync persists that result. Not needed by Learn leaderboard readers. Sources: `apps/web/src/lib/server/passport.ts:5`; `apps/web/src/lib/server/sync-blockchain.ts:184` |
| `SHOP_DEPLOY_BLOCK_CELO` | COPY_IF_FEATURE_ENABLED | DO_NOT_COPY | Founder ownership log scan belongs to Play. useFounderStatus explicitly exits in Learn; Learn training/entitlement reads do not require founder contract history. Sources: `apps/web/src/lib/founder/use-founder-status.ts:66`; `apps/web/src/app/api/founder-status/route.ts` |
| `TORRE_PRINCESA` | COPY_IF_FEATURE_ENABLED | COPY_IF_FEATURE_ENABLED | Signing ciphertext is needed for retained Learn badge claims and Save proof, not only Play minting. Current requests are same-origin: cannot centralize signing in Play without code changes. Sources: `apps/web/src/lib/server/demo-signing.ts:158`; `apps/web/src/components/exercises/exercises-screen.tsx:2309`; `apps/web/src/components/exercises/exercises-screen.tsx:2748` |
| `TREASURY_ADDRESS` | DO_NOT_COPY | DO_NOT_COPY | Legacy server fallback only. Populate the canonical server name with the verified effective recipient before relying on omission; no extra alias is needed in a new environment. Sources: `apps/web/src/lib/payments/rail-config.ts:45` |

### Actual callers and intended ownership

- **Play owns Coach generation, Arena victory minting, founder/contract Shop purchases and the proposed scheduled blockchain/Passport enrichment plus Coach purge.** The live analysis callers are Arena and Coach-game clients; those pages redirect to Play from dedicated Learn. Learn’s Coach history count/read paths do not instantiate a provider. COACH_LLM_API_KEY, its provider config and NEXT_PUBLIC_ENABLE_COACH therefore do not migrate to Learn. Its API still exists; absence of the key makes uncached generation unavailable and may leave cached/history responses working. Dropping a UI flag is not an API security boundary.
- **Learn owns exercises, off-chain score/progress persistence, Focus Days, training leaderboards and onboarding/training flows.** Supabase, Redis, telemetry identity and security settings remain legitimate dependencies there. Learn’s Season Pass, if sales are retained/enabled, is a treasury-transfer rail; it does not need the founder Shop contract or its deployment block. Sales activation is separately gated by NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED, absent from both supplied inventories. Do not add or enable that flag merely for migration. Existing entitlement reads continue without enabling sales.
- **Signing cannot become Play-only under unchanged code while preserving Learn’s optional on-chain features.** ExercisesScreen wires badge claims and Save proof to same-origin /api/sign-badge and /api/sign-score. Save proof has wallet/chain/score/receipt guards, not a Learn exclusion; mission detail and leaderboard expose its CTA. The badge sheet is also mounted in Learn. These are real legitimate callers, unlike a route merely being compiled. The base /api/scores/save is off-chain and needs no signer, so minimal off-chain Learn can omit the entire signing group, but that is an explicit loss of optional existing behavior.
- **Learn signing group is all-or-nothing:** TORRE_PRINCESA, DRAGON, NEXT_PUBLIC_BADGES_ADDRESS, NEXT_PUBLIC_SCOREBOARD_ADDRESS and NEXT_PUBLIC_VICTORY_NFT_ADDRESS, together with the already required chain/Redis settings. getDemoConfig requires every contract name before returning a signer, even for badge/score requests. Victory configuration in Learn is factory coupling, not ownership of victory minting. Centralizing these requests in Play or separating signing factories requires future code changes outside this task.
- **Hidden shared hooks do not justify importing a Play feature.** LearnHub still calls Shop/badge hooks before conditionally hiding Play sheets; the Shop hook may make incidental catalog reads. Omitting its contract removes those reads. Founder ownership’s hook explicitly exits in Learn; its history setting has no legitimate Learn use. Keep the badge configuration when Learn exercises’ actual claim feature is retained. No live application caller for /api/sign-labyrinth was found; its route-only extra contract name is not a deploy baseline requirement.

### Treasury: canonical pairing and precedence

Server precedence is CHESSCITO_TREASURY_ADDRESS, then TREASURY_ADDRESS **only when the canonical variable is nullish**; validation happens after selection. An empty or invalid canonical variable does not fall back to a valid legacy value. Browser reads only NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS. The canonical server/public names are intentional counterparts, not interchangeable aliases. TREASURY_ADDRESS has no independent active web consumer beyond that server fallback.

New deployments can use only the canonical server/public pair when a retained payment rail needs it. Do not introduce the legacy fallback. Before populating the pair, an operator must privately verify each app’s effective current recipient, canonical validity, agreement between browser transfer and server receipt validation, and whether fallback ever supplies the effective recipient. No address was read or inferred. Do not copy a legacy value into a canonical name blindly or assume equal recipients between apps. Until that private check is complete, the names are resolved but the payment configuration is not value-validated.

### Cron, Passport and administration

The two existing workflow files schedule sync and Coach purge using the same repository-secret names for CRON_URL and CRON_SECRET. This supports a single intended job host, proposed **Play**, for both responsibilities. Learn reads the shared database results; it does not need Passport provider credentials or its own duplicate scheduled-job auth. Play’s NEXT_PUBLIC_SCOREBOARD_ADDRESS and NEXT_PUBLIC_VICTORY_NFT_ADDRESS are REQUIRED_COPY for this retained sync: omission silently skips their event ingestion even if a corresponding UI feature is off. The Passport helper is called by sync; when either credential/config name is absent it returns failed verification, and sync writes those results. Preserve the Play Passport pair for the existing enrichment rather than assuming an optional missing credential makes the job skip it.

Actual CRON_URL, its deployment target, token agreement, and any additional externally configured scheduler are **UNRESOLVED_EXTERNAL_ONLY operational checks**. Repository workflow evidence shows one target slot, not its secret value. No remote secrets were accessed. This report proposes ownership; it does not claim jobs have been moved. Required Play job credentials must not be mistaken for evidence that the scheduler already calls the new host. Duplicate sync writers should not be enabled on both apps. These external checks do not require additional application env names beyond the resolved manifest.

ADMIN_TOKEN remains UNRESOLVED_EXTERNAL_ONLY in both manifests. The repository proves operator callers for control tower and content administration, including Learn-specific aggregate statistics, but those use shared data and do not establish which dedicated host operators currently call. Immediate content revalidation is local to each deployment; one host’s revalidateTag does not refresh the other. The catalog also has timed revalidation (`apps/web/src/lib/content/merged-catalog.ts:48,413`), so a single administration host is feasible if delayed propagation is accepted. An external operator must identify the desired host and whether immediate per-host invalidation is required. Prefer one administration host where that is sufficient; otherwise both legitimately need auth for local invalidation. Missing token fails closed and disables those operations, without disabling player flows. No operational need or current-host identity is invented from a token’s presence.

### Continuity and omission rules

Preserve the current per-app effective values for every REQUIRED_COPY name, except the explicitly canonical product selector and app origins. Preserve retained FEATURE_COPY group values too: signer ciphertext/decryption pairing, chain/contract configuration, LLM provider/model/key, treasury pairing and shop history start. This instruction is not an assertion that app values match each other. Do not rotate keys/salts during an environment move.

Specific risky omissions remain proven: PEONES_SPEND_REQUIRE_SESSION can weaken enforcement when omitted; telemetry switches default enabled; Learn attempt-lane behavior also defaults enabled; Play Coach UI defaults enabled; CONTENT_STAGE omission loses overlay content; NEXT_PUBLIC_LITE_PROGRESS_VERSION changes Learn’s progress namespace. Redis/Supabase missing configuration removes real persistence/security workflows. Preserve flags’ existing disable states as well as enable states. Neither alias cleanup nor moving hosts proves behavioral parity.

For Learn, dropping NEXT_PUBLIC_ENABLE_COACH does not stop a public API or protect signing credentials: that flag has no legitimate generation UI caller there. Without the LLM key, fresh generation is unavailable. Signing routes remain same-origin and callable whenever their retained feature group is configured. A mode-based API fence would be a future code change, not something this manifest implements.

Reconfirmed omissions without reopening established history: ANTHROPIC_API_KEY and NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID have no active web readers; env CHESSCITO_LITE_MODE has none (the exported TypeScript constant is derived from the selector); both extracted-hook flags are retired. Learn NEXT_PUBLIC_CHESSCITO_LITE_MODE is unnecessary legacy compatibility with the explicit selector; NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY has no Production effect; ENABLE_LITE_QA_RESET would enable a real QA surface and is deliberately omitted, not called dead. Preserve active Learn rollout controls, including attempt lane, exercise rotation, streak nudge, onboarding percentage, locale readiness and progress version; names alone do not prove their rollout completed.

### Final names-only manifests

The sets below are complete, exclusive partitions. REQUIRED_COPY corresponds to COPY_NOW; FEATURE_COPY corresponds to COPY_IF_FEATURE_ENABLED. Public contract/treasury settings are not private credentials. Values are neither inspected nor printed.

#### PLAY — REQUIRED_COPY (25)

```text
CELO_RPC_URL
CLAIM_IP_HASH_SALT
CONTENT_STAGE
CRON_SECRET
LOG_SALT
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_CELO_ATTRIBUTION_TAG
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_CHESSCITO_MODE
NEXT_PUBLIC_ENABLE_COACH
NEXT_PUBLIC_I18N_ES_READY
NEXT_PUBLIC_PRIVY_ENABLED
NEXT_PUBLIC_SCOREBOARD_ADDRESS
NEXT_PUBLIC_SUPPORT_EMAIL
NEXT_PUBLIC_TELEMETRY_ENABLED
NEXT_PUBLIC_VICTORY_NFT_ADDRESS
NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED
PASSPORT_API_KEY
PASSPORT_SCORER_ID
PEONES_SPEND_REQUIRE_SESSION
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
TELEMETRY_ACCOUNT_SECRET
UPSTASH_REDIS_REST_TOKEN
UPSTASH_REDIS_REST_URL
```

#### PLAY — FEATURE_COPY (12)

```text
CHESSCITO_TREASURY_ADDRESS
COACH_LLM_API_KEY
COACH_LLM_BASE_URL
COACH_LLM_MODEL
DRAGON
NEXT_PUBLIC_BADGES_ADDRESS
NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_SHOP_ADDRESS
NEXT_PUBLIC_USDC_ADDRESS
SHOP_DEPLOY_BLOCK_CELO
TORRE_PRINCESA
```

#### PLAY — DO_NOT_COPY (12)

```text
ANTHROPIC_API_KEY
CHESSCITO_LITE_MODE
NEXT_PUBLIC_ATTEMPT_LANE_ENABLED
NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT
NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION
NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT
NEXT_PUBLIC_STREAK_NUDGE_ENABLED
NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS
NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED
TREASURY_ADDRESS
```

#### PLAY — UNRESOLVED_EXTERNAL_ONLY (1)

```text
ADMIN_TOKEN
```

#### LEARN — REQUIRED_COPY (27)

```text
CELO_RPC_URL
CLAIM_IP_HASH_SALT
CONTENT_STAGE
FOCUS_DAYS_LEDGER_ENABLED
LOG_SALT
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ATTEMPT_LANE_ENABLED
NEXT_PUBLIC_CELO_ATTRIBUTION_TAG
NEXT_PUBLIC_CHAIN_ID
NEXT_PUBLIC_CHESSCITO_MODE
NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT
NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION
NEXT_PUBLIC_I18N_ES_READY
NEXT_PUBLIC_LITE_PROGRESS_VERSION
NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT
NEXT_PUBLIC_PREVIEW_URL
NEXT_PUBLIC_PRIVY_ENABLED
NEXT_PUBLIC_STREAK_NUDGE_ENABLED
NEXT_PUBLIC_SUPPORT_EMAIL
NEXT_PUBLIC_TELEMETRY_ENABLED
NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED
PEONES_SPEND_REQUIRE_SESSION
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
TELEMETRY_ACCOUNT_SECRET
UPSTASH_REDIS_REST_TOKEN
UPSTASH_REDIS_REST_URL
```

#### LEARN — FEATURE_COPY (9)

```text
CHESSCITO_TREASURY_ADDRESS
DRAGON
NEXT_PUBLIC_BADGES_ADDRESS
NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_SCOREBOARD_ADDRESS
NEXT_PUBLIC_USDC_ADDRESS
NEXT_PUBLIC_VICTORY_NFT_ADDRESS
TORRE_PRINCESA
```

#### LEARN — DO_NOT_COPY (16)

```text
ANTHROPIC_API_KEY
CHESSCITO_LITE_MODE
COACH_LLM_API_KEY
COACH_LLM_BASE_URL
COACH_LLM_MODEL
CRON_SECRET
ENABLE_LITE_QA_RESET
NEXT_PUBLIC_CHESSCITO_LITE_MODE
NEXT_PUBLIC_ENABLE_COACH
NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY
NEXT_PUBLIC_SHOP_ADDRESS
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
PASSPORT_API_KEY
PASSPORT_SCORER_ID
SHOP_DEPLOY_BLOCK_CELO
TREASURY_ADDRESS
```

#### LEARN — UNRESOLVED_EXTERNAL_ONLY (1)

```text
ADMIN_TOKEN
```

### Explicit app origins and missing settings

These are the only printed deployment setting values in this operational resolution:

Play:

```dotenv
NEXT_PUBLIC_APP_URL=https://play.chesscito.com
```

Learn:

```dotenv
NEXT_PUBLIC_APP_URL=https://learn.chesscito.com
```

Learn’s app origin is missing from the supplied Production inventory and is newly required for its canonical metadata/sitemap identity. NEXT_PUBLIC_PREVIEW_URL does not substitute for it. The final configured-name union stays at 56 because Play already contains APP_URL; the final Learn partition grows to 53. The product selector is NEXT_PUBLIC_CHESSCITO_MODE, using the respective canonical Play and Learn modes; do not add either Lite env spelling.

No other universally required missing name was established for baseline callers. NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS is required by its retained route but has no found active web caller, so it is not added. NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED is a conditional feature activation control absent from both supplied inventories, not a missing requirement to silently enable. If an external integration legitimately calls the labyrinth route, its contract configuration would be required there; that external use cannot be disproved from repo caller absence.

### Secret minimization and external-only remainder

Recommended Play-only secret ownership: **COACH_LLM_API_KEY, CRON_SECRET and PASSPORT_API_KEY**. Provider base/model and Passport scorer config travel with their service. ANTHROPIC_API_KEY needs neither host. ADMIN_TOKEN is not yet assigned, and no secret was actually moved. **TORRE_PRINCESA and DRAGON cannot be declared Play-only while Learn’s proved signing features are retained.** Supabase/Redis, telemetry account secret, CLAIM_IP_HASH_SALT and LOG_SALT remain valid on both apps; withholding them would remove legitimate current behavior.

Remaining external-only checks are narrowly scoped:

1. Assign the administration host and immediate content invalidation policy; privately match its caller authentication. This is the only remaining unresolved manifest name.
2. Privately verify the workflow target and cron credential agreement on the proposed Play host; determine whether any additional scheduler exists. No workflow change was made.
3. Privately verify effective treasury precedence and public/server agreement before copying canonical names and excluding the fallback. No recipient value was inspected.
4. Verify retained feature states, credential validity and any external-only consumers. Repository evidence establishes legitimate Learn signing and absence of known Learn LLM generation callers; it cannot prove the absence of third-party callers or unseen value equivalence. Feature groups remain conditional, rather than turning feature choices into unresolved env-name rows.

Report-only stop: no code, templates, Vercel, Actions, DNS, remote configuration, credentials or deployments changed. No production env files or values were inspected.

## Full repository reference index

The index records all named lexical occurrences found by the described scan, not secret values. Documentation and tests explain history/defaults but do not establish runtime need. `SDK implicit reader` references are installed dependency implementation. Shell entries can include local script variables; those must not be copied into application manifests. Untracked real env files and private files were excluded deliberately.

### `ADMIN_TOKEN`

- test/fixture: `apps/web/src/app/api/admin/content/__tests__/route-sweep-guard.test.ts:64`, `apps/web/src/app/api/admin/content/__tests__/route-sweep-guard.test.ts:68`, `apps/web/src/app/api/admin/content/__tests__/route.test.ts:100`, `apps/web/src/app/api/admin/content/__tests__/route.test.ts:104`, `apps/web/src/app/api/admin/content/__tests__/route.test.ts:109`, `apps/web/src/app/api/admin/content/stage/__tests__/route.test.ts:59`, `apps/web/src/app/api/admin/content/stage/__tests__/route.test.ts:63`, `apps/web/src/app/api/admin/content/stage/__tests__/route.test.ts:68`, `apps/web/src/app/api/dev/promote/__tests__/route.test.ts:18`, `apps/web/src/app/api/dev/promote/__tests__/route.test.ts:65`, `apps/web/src/app/api/admin/lite-stats/__tests__/route.test.ts:39`, `apps/web/src/app/api/admin/lite-stats/__tests__/route.test.ts:56`, `apps/web/src/app/api/control-tower/__tests__/route.test.ts:69`, `apps/web/src/app/api/control-tower/__tests__/route.test.ts:77`, `apps/web/src/app/api/dev/publish/__tests__/route-error-passthrough.test.ts:47`, `apps/web/src/app/api/dev/publish/__tests__/route-revalidates-baseline.test.ts:88`, `apps/web/src/app/api/dev/publish/__tests__/route.test.ts:52`, `apps/web/src/app/api/dev/publish/__tests__/route.test.ts:93`.
- web runtime: `apps/web/src/app/api/admin/content/revalidate/route.ts:24`, `apps/web/src/app/api/admin/content/route.ts:52`, `apps/web/src/app/api/admin/content/stage/route.ts:46`, `apps/web/src/app/api/admin/lite-stats/route.ts:95`, `apps/web/src/app/api/dev/promote/route.ts:88`, `apps/web/src/app/api/dev/publish/route.ts:62`, `apps/web/src/lib/server/admin-token.ts:29`.
- documentation: `docs/specs/db-backed-content.md:39`.

### `ALFAJORES_RPC_URL`

- other app / script / configuration: `apps/contracts/hardhat.config.ts:42`.

### `ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY`

- test/fixture: `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:63`, `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:167`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:36`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:64`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary-server.ts:58`.

### `ANTHROPIC_API_KEY`

- documentation: `docs/superpowers/plans/2026-03-22-chesscito-coach.md:1064`, `docs/superpowers/plans/2026-03-22-chesscito-coach.md:1065`.

### `API_BASE_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-tea/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-atdd/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-automate/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-automate/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-ci/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-ci/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-framework/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-framework/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-nfr/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-nfr/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-test-design/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-test-design/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-test-review/resources/knowledge/fixture-architecture.md:217`, `.github/skills/bmad-testarch-trace/resources/knowledge/auth-session.md:300`, `.github/skills/bmad-testarch-trace/resources/knowledge/fixture-architecture.md:217`.

### `API_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-tea/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-tea/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-automate/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-automate/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-ci/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-ci/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-framework/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-framework/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pact-consumer-framework-setup.md:506`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:793`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:822`, `.github/skills/bmad-testarch-trace/resources/knowledge/pact-consumer-framework-setup.md:398`, `.github/skills/bmad-testarch-trace/resources/knowledge/pact-consumer-framework-setup.md:506`.

### `APP_DIR`

- other app / script / configuration: `apps/web/scripts/measure-baseline-first-load.sh:22`, `apps/web/scripts/measure-baseline-first-load.sh:36`, `apps/web/scripts/measure-baseline-first-load.sh:49`.

### `APP_ROOT`

- other app / script / configuration: `apps/video/scripts/render-review-frames.sh:10`, `apps/video/scripts/render-review-frames.sh:13`.

### `APP_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:829`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:829`.

### `ART_DIR`

- other app / script / configuration: `apps/web/scripts/optimize-art-assets.sh:6`, `apps/web/scripts/optimize-art-assets.sh:7`, `apps/web/scripts/optimize-art-assets.sh:22`, `apps/web/scripts/optimize-art-assets.sh:25`, `apps/web/scripts/optimize-art-assets.sh:26`, `apps/web/scripts/optimize-art-assets.sh:27`.

### `BADGES_BASE_URI`

- other app / script / configuration: `apps/contracts/scripts/deploy-proxies.ts:56`.

### `BADGES_PROXY`

- other app / script / configuration: `apps/contracts/scripts/verify.ts:32`.

### `BASELINE_PATH`

- other app / script / configuration: `scripts/measure-perf.sh:205`, `scripts/measure-perf.sh:208`, `scripts/measure-perf.sh:210`, `scripts/measure-perf.sh:311`.

### `BASENAME`

- other app / script / configuration: `scripts/gen-triplet.sh:40`, `scripts/gen-triplet.sh:41`, `scripts/gen-triplet.sh:42`.

### `BASE_URI`

- other app / script / configuration: `apps/contracts/scripts/deploy.ts:26`.

### `BASE_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-atdd/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-automate/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-ci/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-framework/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-nfr/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-test-design/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-test-review/resources/knowledge/visual-debugging.md:40`, `.github/skills/bmad-testarch-trace/resources/knowledge/visual-debugging.md:40`.
- other app / script / configuration: `apps/web/playwright.config.ts:9`, `scripts/capture-victory-popup-flow.mjs:18`, `scripts/screenshots.mjs:13`.

### `BASH_SOURCE`

- other app / script / configuration: `apps/video/scripts/render-review-frames.sh:8`, `apps/web/scripts/measure-baseline-first-load.sh:21`, `apps/web/scripts/optimize-art-assets.sh:4`, `scripts/measure-perf.sh:143`.

### `CAPTURE_BASE_URL`

- other app / script / configuration: `apps/video/scripts/capture-screenshots.ts:21`.

### `CELOSCAN_API_KEY`

- other app / script / configuration: `apps/contracts/hardhat.config.ts:12`.

### `CELO_RPC`

- other app / script / configuration: `scripts/ops/onchain-revenue.mjs:57`.

### `CELO_RPC_URL`

- other app / script / configuration: `apps/contracts/hardhat.config.ts:52`, `apps/contracts/test/victory-permit-fork.ts:29`, `apps/web/scripts/verify-attribution.ts:53`.
- web runtime: `apps/web/src/app/api/payment-intents/get-peones/route.ts:33`, `apps/web/src/app/api/verify-payment/get-peones-canary/route.ts:26`, `apps/web/src/app/api/verify-payment/route.ts:71`, `apps/web/src/lib/server/sync-blockchain.ts:19`.
- documentation: `docs/audits/2026-06-03-founder-status-timeout-audit.md:267`, `docs/audits/2026-06-24-shortest-path-to-real-tx.md:61`, `docs/handoffs/2026-06-03-perf-i18n-founder-session-handoff.md:148`, `docs/masterplans/2026-06-25-chesscito-lite-full-minipay-masterplan.md:496`, `docs/superpowers/plans/2026-04-06-supabase-cache-layer.md:635`, `docs/superpowers/plans/2026-07-02-victory-nft-permit-mint.md:83`.

### `CELO_SEPOLIA_RPC_URL`

- other app / script / configuration: `apps/contracts/hardhat.config.ts:47`.

### `CHESSCITO_BACKUP_ROOT`

- other app / script / configuration: `scripts/ops/verified-backup.ts:36`.

### `CHESSCITO_LITE_MODE`

- documentation: `docs/reviews/2026-06-21-lite-v1-release-qa.md:31`, `docs/reviews/2026-06-21-lite-v1-release-qa.md:91`.

### `CHESSCITO_STATIC_PRERENDER`

- other app / script / configuration: `apps/landing/scripts/build-vinext.mjs:17`, `apps/landing/scripts/build-vinext.mjs:26`, `apps/landing/src/middleware.ts:10`.

### `CHESSCITO_TREASURY_ADDRESS`

- test/fixture: `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:115`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:123`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:129`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:27`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:32`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:38`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:39`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:60`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:71`.
- web runtime: `apps/web/src/lib/payments/rail-config.ts:45`.
- documentation: `docs/audits/2026-06-24-shortest-path-to-real-tx.md:20`, `docs/masterplans/2026-06-25-chesscito-lite-full-minipay-masterplan.md:159`, `docs/masterplans/2026-06-25-season-pass-pre-implementation-review.md:45`, `docs/testing/analytics-test-patterns.md:237`, `docs/testing/analytics-test-patterns.md:244`, `docs/testing/analytics-test-patterns.md:250`.
- other app / script / configuration: `apps/contracts/scripts/configure-chesscito-treasury.ts:20`.

### `CHESSCITO_TREASURY_CANARY_ADDRESS`

- test/fixture: `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:58`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:31`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary-server.ts:37`.

### `CHESSCITO_TREASURY_CANARY_CONFIG_VERSION`

- test/fixture: `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:59`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:32`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary-server.ts:42`.

### `CHESSCITO_TREASURY_CANARY_CONFIRMATIONS`

- test/fixture: `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:61`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:34`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary-server.ts:48`.

### `CHESSCITO_TREASURY_CANARY_PRICE_VERSION`

- test/fixture: `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:60`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:33`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary-server.ts:43`.

### `CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES`

- test/fixture: `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:62`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:35`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:73`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary-server.ts:62`.

### `CHROME_PATH`

- other app / script / configuration: `scripts/measure-perf.sh:68`, `scripts/measure-perf.sh:69`.

### `CI`

- documentation: `.github/skills/bmad-tea/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-tea/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-tea/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-tea/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-tea/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-overview.md:173`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-tea/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-tea/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-atdd/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-atdd/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-atdd/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-atdd/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-atdd/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-overview.md:173`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-atdd/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-atdd/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-automate/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-automate/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-automate/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-automate/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-automate/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-overview.md:170`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-automate/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-automate/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-ci/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-ci/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-ci/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-ci/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-ci/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-overview.md:170`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-ci/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-ci/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-framework/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-framework/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-framework/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-framework/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-framework/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-overview.md:170`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-framework/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-framework/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-nfr/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-nfr/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-nfr/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-nfr/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-nfr/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-overview.md:170`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-nfr/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-nfr/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-test-design/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-test-design/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-test-design/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-test-design/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-test-design/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-overview.md:170`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-test-design/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-test-design/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-test-review/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-overview.md:170`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-test-review/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-test-review/resources/knowledge/visual-debugging.md:56`, `.github/skills/bmad-testarch-trace/resources/knowledge/burn-in.md:174`, `.github/skills/bmad-testarch-trace/resources/knowledge/burn-in.md:177`, `.github/skills/bmad-testarch-trace/resources/knowledge/burn-in.md:178`, `.github/skills/bmad-testarch-trace/resources/knowledge/burn-in.md:187`, `.github/skills/bmad-testarch-trace/resources/knowledge/contract-testing.md:230`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-overview.md:170`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:314`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:59`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:60`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:61`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:98`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:426`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:431`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:434`, `.github/skills/bmad-testarch-trace/resources/knowledge/visual-debugging.md:55`, `.github/skills/bmad-testarch-trace/resources/knowledge/visual-debugging.md:56`.
- other app / script / configuration: `apps/web/playwright.config.ts:24`, `apps/web/playwright.config.ts:25`, `apps/web/playwright.config.ts:26`, `apps/web/playwright.config.ts:65`.

### `CLAIM_IP_HASH_SALT`

- test/fixture: `apps/web/src/lib/server/__tests__/welcome-pack.test.ts:173`, `apps/web/src/lib/server/__tests__/welcome-pack.test.ts:176`, `apps/web/src/lib/server/__tests__/welcome-pack.test.ts:180`, `apps/web/src/lib/server/__tests__/welcome-pack.test.ts:181`, `apps/web/src/lib/server/__tests__/welcome-pack.test.ts:197`, `apps/web/src/lib/server/__tests__/welcome-pack.test.ts:203`.
- web runtime: `apps/web/src/lib/server/welcome-pack.ts:109`.

### `CLIENT_ID`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-request-filter.md:188`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-request-filter.md:188`.

### `CLIENT_SECRET`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-request-filter.md:189`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-request-filter.md:189`.

### `COACH_LLM_API_KEY`

- test/fixture: `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts:8`.
- web runtime: `apps/web/src/app/api/coach/analyze/route.ts:65`, `apps/web/src/app/api/coach/analyze/route.ts:66`.

### `COACH_LLM_BASE_URL`

- web runtime: `apps/web/src/app/api/coach/analyze/route.ts:60`.

### `COACH_LLM_MODEL`

- web runtime: `apps/web/src/app/api/coach/analyze/route.ts:59`.
- documentation: `docs/superpowers/plans/2026-03-22-chesscito-coach.md:1059`.

### `COMMIT`

- other app / script / configuration: `apps/web/scripts/measure-baseline-first-load.sh:23`, `apps/web/scripts/measure-baseline-first-load.sh:31`, `apps/web/scripts/measure-baseline-first-load.sh:33`, `apps/web/scripts/measure-baseline-first-load.sh:50`.

### `CONFIRM_MAINNET_PRIZEPOOL_DEPLOY`

- other app / script / configuration: `apps/contracts/scripts/deploy-chesscito-prizepool.ts:46`.

### `CONFIRM_MAINNET_TREASURY_CONFIG`

- other app / script / configuration: `apps/contracts/scripts/configure-chesscito-treasury.ts:39`.

### `CONFIRM_MAINNET_TREASURY_DEPLOY`

- other app / script / configuration: `apps/contracts/scripts/deploy-chesscito-treasury.ts:21`.

### `CONFIRM_MAINNET_VICTORY_TREASURY_CONFIG`

- other app / script / configuration: `apps/contracts/scripts/configure-victory-nft-treasury.ts:43`.

### `CONFIRM_PRIZEPOOL_REDEPLOY`

- other app / script / configuration: `apps/contracts/scripts/deploy-chesscito-prizepool.ts:67`.

### `CONFIRM_TREASURY_REDEPLOY`

- other app / script / configuration: `apps/contracts/scripts/deploy-chesscito-treasury.ts:47`.

### `CONFIRM_UPGRADE`

- other app / script / configuration: `apps/contracts/scripts/upgrade-victory-nft.ts:97`.

### `CONTENT_CACHE_DISABLED`

- test/fixture: `apps/web/src/app/api/scores/save/__tests__/route.test.ts:22`, `apps/web/src/lib/scores/__tests__/attempt-grading-merged-catalog.test.ts:59`.
- web runtime: `apps/web/src/lib/content/merged-catalog.ts:403`.

### `CONTENT_OVERLAY_ENABLED`

- documentation: `docs/handoffs/2026-06-17-db-content-phase2c-handoff.md:20`.

### `CONTENT_STAGE`

- other app / script / configuration: `apps/web/scripts/verify-catalog-source.ts:39`.
- test/fixture: `apps/web/src/app/api/scores/save/__tests__/route.test.ts:484`, `apps/web/src/lib/content/__tests__/merged-catalog.test.ts:256`, `apps/web/src/lib/content/__tests__/merged-catalog.test.ts:263`, `apps/web/src/lib/content/__tests__/merged-catalog.test.ts:267`, `apps/web/src/lib/content/__tests__/merged-catalog.test.ts:268`, `apps/web/src/lib/content/__tests__/merged-catalog.test.ts:272`, `apps/web/src/lib/content/__tests__/merged-catalog.test.ts:280`, `apps/web/src/lib/content/__tests__/merged-catalog.test.ts:287`, `apps/web/src/lib/content/__tests__/stage.test.ts:24`, `apps/web/src/lib/content/__tests__/stage.test.ts:26`, `apps/web/src/lib/content/__tests__/stage.test.ts:27`, `apps/web/src/lib/content/__tests__/stage.test.ts:31`, `apps/web/src/lib/content/__tests__/stage.test.ts:36`, `apps/web/src/lib/content/__tests__/stage.test.ts:41`, `apps/web/src/lib/scores/__tests__/attempt-grading-merged-catalog.test.ts:61`.
- web runtime: `apps/web/src/lib/content/stage.ts:24`.

### `CRON_SECRET`

- test/fixture: `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts:37`, `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts:44`, `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts:50`, `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts:51`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:18`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:25`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:26`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:30`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:41`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:48`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:58`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:65`, `apps/web/src/app/api/cron/sync/__tests__/route.test.ts:72`.
- web runtime: `apps/web/src/app/api/cron/coach-purge/route.ts:32`, `apps/web/src/app/api/cron/sync/route.ts:9`.
- documentation: `docs/superpowers/plans/2026-04-06-supabase-cache-layer.md:821`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr5.md:388`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr5.md:395`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr5.md:401`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr5.md:402`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr5.md:502`, `docs/superpowers/specs/2026-04-06-supabase-cache-layer-design.md:137`, `docs/superpowers/specs/2026-05-06-coach-session-memory-design.md:413`.
- other app / script / configuration: `.github/workflows/cron-cache-sync.yml:21`, `.github/workflows/cron-coach-purge.yml:27`.

### `CRON_URL`

- other app / script / configuration: `.github/workflows/cron-cache-sync.yml:20`, `.github/workflows/cron-coach-purge.yml:26`.

### `DEFAULT_BASES`

- other app / script / configuration: `scripts/measure-perf.sh:198`.

### `DEFAULT_RUNS`

- other app / script / configuration: `scripts/measure-perf.sh:95`.

### `DEFAULT_THRESHOLD`

- other app / script / configuration: `scripts/measure-perf.sh:96`.

### `DEPLOYER_PRIVATE_KEY`

- other app / script / configuration: `apps/contracts/hardhat.config.ts:43`, `apps/contracts/hardhat.config.ts:48`, `apps/contracts/hardhat.config.ts:53`.
- documentation: `docs/plans/2026-03-08-mainnet-deploy.md:67`, `docs/plans/2026-03-08-mainnet-deploy.md:299`.

### `DEST`

- other app / script / configuration: `apps/web/scripts/copy-stockfish.sh:9`, `apps/web/scripts/copy-stockfish.sh:14`, `apps/web/scripts/copy-stockfish.sh:15`, `apps/web/scripts/copy-stockfish.sh:16`, `apps/web/scripts/copy-stockfish.sh:17`, `apps/web/scripts/copy-stockfish.sh:21`, `apps/web/scripts/copy-stockfish.sh:22`, `apps/web/scripts/copy-stockfish.sh:23`, `apps/web/scripts/copy-stockfish.sh:24`, `apps/web/scripts/copy-stockfish.sh:28`, `apps/web/scripts/copy-stockfish.sh:29`, `apps/web/scripts/copy-stockfish.sh:30`, `apps/web/scripts/copy-stockfish.sh:31`, `apps/web/scripts/copy-stockfish.sh:35`, `apps/web/scripts/copy-stockfish.sh:36`, `apps/web/scripts/copy-stockfish.sh:37`, `apps/web/scripts/copy-stockfish.sh:38`.

### `DISK_MIN_FREE_GB`

- other app / script / configuration: `apps/web/scripts/preflight-disk.ts:68`.

### `DRAGON`

- web runtime: `apps/web/src/lib/server/demo-signing.ts:158`.

### `ENABLE_LITE_QA_RESET`

- web runtime: `apps/web/src/app/lite-debug/reset/page.tsx:18`.

### `ETHERSCAN_API_KEY`

- other app / script / configuration: `apps/contracts/hardhat.config.ts:12`.

### `EXT`

- other app / script / configuration: `scripts/gen-triplet.sh:59`.

### `EXT_LOWER`

- other app / script / configuration: `scripts/gen-triplet.sh:60`, `scripts/gen-triplet.sh:62`.

### `FOCUS_DAYS_LEDGER_ENABLED`

- web runtime: `apps/web/src/app/api/focus-day/route.ts:82`, `apps/web/src/app/api/season-pass/status/route.ts:216`.
- test/fixture: `apps/web/src/app/api/focus-day/__tests__/route.test.ts:110`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:294`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:318`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:336`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:363`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:378`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:389`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:404`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:413`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:425`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:443`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:463`, `apps/web/src/app/api/season-pass/status/__tests__/route.test.ts:470`.

### `FOUNDER_STATUS_RPC_URL`

- web runtime: `apps/web/src/app/api/founder-status/route.ts:74`.
- test/fixture: `apps/web/src/app/api/founder-status/__tests__/route.test.ts:208`, `apps/web/src/app/api/founder-status/__tests__/route.test.ts:216`.

### `GET_PEONES_TREASURY_CANARY_ENABLED`

- test/fixture: `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:57`, `apps/web/src/app/api/payment-intents/get-peones/__tests__/route.test.ts:159`, `apps/web/src/app/api/verify-payment/get-peones-canary/__tests__/route.test.ts:175`, `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:30`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary-server.ts:28`.

### `GITHUB_HEAD_REF`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:316`.

### `GITHUB_REF_NAME`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:316`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:316`.

### `GITHUB_SHA`

- documentation: `.github/skills/bmad-tea/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-atdd/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-automate/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-ci/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-framework/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-nfr/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-test-design/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-test-review/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-trace/resources/knowledge/contract-testing.md:231`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-trace/steps-c/step-05-gate-decision.md:405`.

### `GIT_SHA`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-overview.md:174`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-overview.md:174`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:315`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:315`.

### `GRANT_SHOTS`

- test/fixture: `apps/web/e2e/grant-shots.spec.ts:124`.

### `GREP_TAGS`

- documentation: `.github/skills/bmad-tea/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-atdd/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-automate/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-ci/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-framework/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-nfr/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-test-design/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-test-review/resources/knowledge/selective-testing.md:118`, `.github/skills/bmad-testarch-trace/resources/knowledge/selective-testing.md:118`.

### `HOME`

- other app / script / configuration: `apps/web/scripts/db/backup.ts:55`, `scripts/measure-perf.sh:82`, `scripts/measure-perf.sh:83`.
- documentation: `docs/plans/2026-07-21-supabase-backup-restore-plan.md:852`.

### `INITIAL_MAX_LEVEL_ID`

- other app / script / configuration: `apps/contracts/scripts/deploy-proxies.ts:57`, `apps/contracts/scripts/deploy.ts:22`.

### `INTERNAL_SERVICE_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-automate/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-ci/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-framework/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-nfr/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-test-design/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md:374`, `.github/skills/bmad-testarch-trace/resources/knowledge/auth-session.md:374`.

### `INVENTORY_SERVICE_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:215`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:215`.

### `KV_REST_API_TOKEN`

- other app / script / configuration: `apps/web/node_modules/@upstash/redis/nodejs.mjs:276`.

### `KV_REST_API_URL`

- other app / script / configuration: `apps/web/node_modules/@upstash/redis/nodejs.mjs:272`.

### `LABYRINTH_BADGES_BASE_URI`

- other app / script / configuration: `apps/contracts/scripts/deploy-labyrinth-badges.ts:34`.

### `LANDING_SHOTS`

- test/fixture: `apps/web/e2e/landing-shots.spec.ts:53`.

### `LD_SDK_KEY_TEST`

- documentation: `.github/skills/bmad-tea/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-atdd/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-automate/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-ci/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-framework/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-nfr/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-test-design/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-test-review/resources/knowledge/feature-flags.md:366`, `.github/skills/bmad-testarch-trace/resources/knowledge/feature-flags.md:366`.

### `LOGIN_CAPACITY_ENABLED`

- web runtime: `apps/web/src/lib/access/capacity-config.ts:30`.
- test/fixture: `apps/web/src/lib/access/__tests__/capacity-config.test.ts:56`, `apps/web/src/lib/access/__tests__/capacity-config.test.ts:132`.

### `LOGIN_CAPACITY_LIMIT`

- web runtime: `apps/web/src/lib/access/capacity-config.ts:29`.
- test/fixture: `apps/web/src/lib/access/__tests__/capacity-config.test.ts:55`, `apps/web/src/lib/access/__tests__/capacity-config.test.ts:131`.

### `LOG_SALT`

- test/fixture: `apps/web/src/app/api/coach/analyze/__tests__/route.test.ts:9`, `apps/web/src/app/api/coach/history/__tests__/route.test.ts:221`, `apps/web/src/app/api/cron/coach-purge/__tests__/route.test.ts:43`, `apps/web/src/app/api/peones/balance/__tests__/welcome-pack-gate.test.ts:132`, `apps/web/src/lib/coach/__tests__/backfill.test.ts:160`, `apps/web/src/lib/coach/__tests__/backfill.test.ts:321`, `apps/web/src/lib/server/__tests__/logger.test.ts:112`, `apps/web/src/lib/server/__tests__/logger.test.ts:132`, `apps/web/src/lib/server/__tests__/rate-limit.test.ts:314`, `apps/web/src/lib/server/__tests__/rate-limit.test.ts:342`, `apps/web/src/lib/server/__tests__/rate-limit.test.ts:379`.
- web runtime: `apps/web/src/lib/server/logger.ts:142`, `apps/web/src/lib/server/logger.ts:171`.
- documentation: `docs/superpowers/plans/2026-05-06-coach-session-memory-pr3.md:53`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr3.md:56`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr3.md:60`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr3.md:61`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr3.md:81`, `docs/superpowers/plans/2026-05-06-coach-session-memory-pr3.md:118`.
- other app / script / configuration: `scripts/ops/collectors/supabase.ts:279`.

### `MAILOSAUR_API_KEY`

- documentation: `.github/skills/bmad-tea/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-tea/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-atdd/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-atdd/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-automate/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-automate/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-ci/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-ci/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-framework/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-framework/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-nfr/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-nfr/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-test-design/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-test-design/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-test-review/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-test-review/resources/knowledge/email-auth.md:445`, `.github/skills/bmad-testarch-trace/resources/knowledge/email-auth.md:33`, `.github/skills/bmad-testarch-trace/resources/knowledge/email-auth.md:445`.

### `MAILOSAUR_SERVER_ID`

- documentation: `.github/skills/bmad-tea/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-tea/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-tea/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-atdd/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-atdd/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-atdd/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-automate/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-automate/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-automate/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-ci/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-ci/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-ci/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-framework/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-framework/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-framework/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-nfr/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-nfr/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-nfr/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-test-design/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-test-design/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-test-design/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-test-review/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-test-review/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-test-review/resources/knowledge/email-auth.md:359`, `.github/skills/bmad-testarch-trace/resources/knowledge/email-auth.md:34`, `.github/skills/bmad-testarch-trace/resources/knowledge/email-auth.md:207`, `.github/skills/bmad-testarch-trace/resources/knowledge/email-auth.md:359`.

### `MAX_QUANTITY_PER_TX`

- other app / script / configuration: `apps/contracts/scripts/deploy-shop-upgradeable.ts:22`, `apps/contracts/scripts/deploy-shop.ts:16`, `apps/contracts/scripts/deploy.ts:25`, `apps/contracts/scripts/verify.ts:38`.
- documentation: `docs/superpowers/plans/2026-03-12-shop-upgradeable-multi-token.md:641`.

### `MAX_SUBMISSIONS_PER_DAY`

- other app / script / configuration: `apps/contracts/scripts/deploy.ts:24`.

### `MESSAGE`

- other app / script / configuration: `scripts/ops/vercel-should-build.sh:77`, `scripts/ops/vercel-should-build.sh:82`.

### `MIN_SIZE_KB`

- other app / script / configuration: `scripts/optimize-assets.sh:43`, `scripts/optimize-assets.sh:57`, `scripts/optimize-assets.sh:103`.

### `NEXT_PUBLIC_APP_URL`

- other app / script / configuration: `apps/landing/src/app/layout.tsx:20`, `apps/landing/src/app/sitemap.ts:3`.
- web runtime: `apps/web/src/app/[locale]/layout.tsx:15`, `apps/web/src/app/[locale]/victory/[id]/page.tsx:63`, `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:21`, `apps/web/src/app/sitemap.ts:16`, `apps/web/src/lib/og/share-urls.ts:66`, `apps/web/src/lib/pro/pro-origin.ts:72`, `apps/web/src/lib/server/demo-signing.ts:256`, `apps/web/src/lib/server/early-access-origin.ts:57`, `apps/web/src/lib/server/score-save-origin.ts:54`.
- test/fixture: `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts:31`, `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts:39`, `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts:43`, `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts:44`, `apps/web/src/app/api/scores/save/__tests__/route.test.ts:203`, `apps/web/src/app/api/scores/save/__tests__/route.test.ts:414`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:159`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:365`, `apps/web/src/lib/og/__tests__/share-urls.test.ts:13`, `apps/web/src/lib/og/__tests__/share-urls.test.ts:26`, `apps/web/src/lib/og/__tests__/share-urls.test.ts:31`, `apps/web/src/lib/og/__tests__/share-urls.test.ts:36`, `apps/web/src/app/api/early-access/__tests__/route.test.ts:53`, `apps/web/src/app/api/early-access/__tests__/route.test.ts:184`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:13`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:25`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:38`, `apps/web/src/lib/server/__tests__/early-access-origin.test.ts:9`, `apps/web/src/lib/server/__tests__/early-access-origin.test.ts:58`, `apps/web/src/lib/server/__tests__/early-access-origin.test.ts:67`.
- documentation: `docs/reviews/2026-06-02-i18n-redirect-audit.md:129`, `docs/reviews/2026-06-02-i18n-redirect-audit.md:130`, `docs/reviews/2026-06-02-i18n-redirect-audit.md:185`, `docs/reviews/2026-06-02-i18n-redirect-audit.md:186`, `docs/reviews/2026-08-27-adversarial-review-pre-push.md:140`, `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md:69`, `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md:75`, `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md:139`.

### `NEXT_PUBLIC_APP_VERSION`

- web runtime: `apps/web/src/app/api/welcome-pack/claim/route.ts:97`.

### `NEXT_PUBLIC_ASSET_THEME`

- web runtime: `apps/web/src/lib/theme.ts:23`.

### `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED`

- web runtime: `apps/web/src/lib/feature-flags.ts:94`.
- test/fixture: `apps/web/src/lib/scores/__tests__/use-attempt-outbox.test.tsx:432`, `apps/web/src/lib/scores/__tests__/use-attempt-outbox.test.tsx:462`.

### `NEXT_PUBLIC_BADGES_ADDRESS`

- web runtime: `apps/web/src/lib/contracts/chains.ts:16`, `apps/web/src/lib/server/demo-signing.ts:154`.

### `NEXT_PUBLIC_BUILD_SHA`

- web runtime: `apps/web/src/components/dev/build-version.tsx:19`, `apps/web/src/components/hub/learn-hub-client.tsx:731`, `apps/web/src/lib/analytics/client-dimensions.ts:54`.
- documentation: `docs/superpowers/plans/2026-05-18-hub-redesign-destinations-and-profile.md:2973`.

### `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG`

- web runtime: `apps/web/src/lib/payments/attribution.ts:86`.

### `NEXT_PUBLIC_CHAIN_ID`

- test/fixture: `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:149`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:208`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:209`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:215`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:16`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:29`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:41`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:51`.
- web runtime: `apps/web/src/lib/contracts/chains.ts:58`, `apps/web/src/lib/server/demo-signing.ts:153`.

### `NEXT_PUBLIC_CHESSCITO_LITE_MODE`

- test/fixture: `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:281`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:286`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:290`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:691`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:701`, `apps/web/src/app/[locale]/__tests__/page.test.tsx:57`, `apps/web/src/app/[locale]/__tests__/page.test.tsx:68`, `apps/web/src/lib/__tests__/feature-flags.test.ts:15`, `apps/web/src/lib/__tests__/feature-flags.test.ts:17`, `apps/web/src/lib/__tests__/feature-flags.test.ts:80`.
- web runtime: `apps/web/src/lib/feature-flags.ts:7`.
- documentation: `docs/masterplans/2026-06-25-chesscito-lite-full-minipay-masterplan.md:196`, `docs/reviews/2026-06-21-lite-v1-release-qa.md:35`, `docs/reviews/2026-06-21-lite-v1-release-qa.md:91`, `docs/superpowers/plans/2026-06-19-chesscito-lite-mode-phase1.md:96`, `docs/superpowers/specs/2026-06-19-chesscito-lite-mode-design.md:28`.

### `NEXT_PUBLIC_CHESSCITO_MODE`

- test/fixture: `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:148`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:176`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:188`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:190`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:242`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:251`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:258`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:265`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:275`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:309`, `apps/web/src/app/api/scores/save/__tests__/route.test.ts:193`, `apps/web/src/app/api/scores/save/__tests__/route.test.ts:483`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:150`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:326`, `apps/web/src/app/api/scores/session/__tests__/routes.test.ts:331`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:28`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:31`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:35`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:36`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:41`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:46`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:54`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:59`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:69`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:74`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:80`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:87`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:106`, `apps/web/src/lib/scores/__tests__/deployment-surface.test.ts:111`, `apps/web/src/app/api/early-access/__tests__/route.test.ts:54`, `apps/web/src/app/api/early-access/__tests__/route.test.ts:113`, `apps/web/src/lib/__tests__/feature-flags.test.ts:9`, `apps/web/src/lib/__tests__/feature-flags.test.ts:11`.
- web runtime: `apps/web/src/app/api/peones/balance/route.ts:181`, `apps/web/src/lib/feature-flags.ts:6`, `apps/web/src/lib/scores/deployment-surface.ts:24`, `apps/web/src/lib/scores/deployment-surface.ts:75`, `apps/web/src/lib/server/rate-limit.ts:273`.

### `NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT`

- web runtime: `apps/web/src/lib/daily/session-quota.ts:31`.
- documentation: `docs/audits/2026-08-05-session-limit-and-ranking-integrity.md:50`.

### `NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS`

- test/fixture: `apps/web/src/app/dev/rail-smoke/__tests__/rail-smoke-client.test.tsx:26`, `apps/web/src/app/dev/rail-smoke/__tests__/rail-smoke-client.test.tsx:32`, `apps/web/src/app/dev/rail-smoke/__tests__/rail-smoke-client.test.tsx:41`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:26`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:31`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:36`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:37`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:54`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:82`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:30`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:40`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:50`, `apps/web/src/lib/pro/__tests__/use-pro-rail.test.ts:29`, `apps/web/src/lib/pro/__tests__/use-pro-rail.test.ts:50`, `apps/web/src/lib/pro/__tests__/use-pro-rail.test.ts:59`, `apps/web/src/lib/pro/__tests__/use-pro-sheet-state.test.tsx:123`, `apps/web/src/lib/pro/__tests__/use-pro-sheet-state.test.tsx:159`.
- web runtime: `apps/web/src/lib/payments/rail-config.ts:35`.

### `NEXT_PUBLIC_CHESSCITO_TREASURY_CONTRACT_ADDRESS`

- web runtime: `apps/web/src/lib/contracts/chains.ts:45`.

### `NEXT_PUBLIC_E2E_MOCK_WALLET`

- documentation: `docs/specs/2026-06-05-wallet-mock-fixture-red-team.md:23`.

### `NEXT_PUBLIC_ENABLE_COACH`

- web runtime: `apps/web/src/app/[locale]/arena/page.tsx:81`.

### `NEXT_PUBLIC_ENABLE_DUEL`

- web runtime: `apps/web/src/lib/duel/duel-flag.ts:29`.
- test/fixture: `apps/web/src/lib/duel/__tests__/duel-flag.test.ts:27`, `apps/web/src/lib/duel/__tests__/duel-flag.test.ts:37`, `apps/web/src/lib/duel/__tests__/duel-flag.test.ts:44`.

### `NEXT_PUBLIC_ENABLE_EXERCISE_ROTATION`

- web runtime: `apps/web/src/lib/exercises/rotation-flag.ts:12`.

### `NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY`

- web runtime: `apps/web/src/lib/telemetry.ts:72`.

### `NEXT_PUBLIC_FULL_URL`

- other app / script / configuration: `apps/landing/src/lib/app-urls.ts:20`.

### `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED`

- test/fixture: `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:41`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:152`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:186`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:212`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:256`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:279`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:299`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:317`, `apps/web/src/lib/payments/__tests__/use-payment-rail.test.ts:340`.
- web runtime: `apps/web/src/lib/payments/get-peones-canary.ts:342`.

### `NEXT_PUBLIC_I18N_ES_READY`

- web runtime: `apps/web/src/middleware.ts:28`.
- documentation: `docs/superpowers/plans/2026-06-19-chesscito-lite-mode-phase1.md:388`.
- test/fixture: `apps/web/src/__tests__/middleware.test.ts:14`.

### `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS`

- documentation: `docs/masterplans/2026-06-25-season-pass-pre-implementation-review.md:335`, `docs/masterplans/2026-06-25-season-pass-pre-implementation-review.md:336`.
- web runtime: `apps/web/src/lib/server/demo-signing.ts:174`.

### `NEXT_PUBLIC_LEARN_URL`

- other app / script / configuration: `apps/landing/src/lib/app-urls.ts:16`.

### `NEXT_PUBLIC_LEGAL_URL`

- other app / script / configuration: `apps/landing/src/lib/app-urls.ts:23`.

### `NEXT_PUBLIC_LITE_PROGRESS_VERSION`

- web runtime: `apps/web/src/lib/lite-progress-storage.ts:11`.
- test/fixture: `apps/web/src/lib/__tests__/lite-progress-storage.test.ts:15`, `apps/web/src/lib/__tests__/lite-progress-storage.test.ts:26`.

### `NEXT_PUBLIC_MINIPAY_FEE_CURRENCY`

- web runtime: `apps/web/src/lib/contracts/chains.ts:54`.

### `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT`

- test/fixture: `apps/web/src/lib/onboarding/__tests__/first-activity-experiment.test.ts:11`, `apps/web/src/lib/onboarding/__tests__/first-activity-experiment.test.ts:14`, `apps/web/src/lib/onboarding/__tests__/first-activity-experiment.test.ts:20`, `apps/web/src/lib/onboarding/__tests__/first-activity-experiment.test.ts:25`, `apps/web/src/lib/onboarding/__tests__/first-activity-experiment.test.ts:35`, `apps/web/src/lib/onboarding/__tests__/first-activity-experiment.test.ts:41`.
- web runtime: `apps/web/src/lib/onboarding/first-activity-experiment.ts:42`.

### `NEXT_PUBLIC_PLAY_URL`

- other app / script / configuration: `apps/landing/src/lib/app-urls.ts:19`.

### `NEXT_PUBLIC_PREVIEW_URL`

- test/fixture: `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts:139`, `apps/web/src/app/api/games/[id]/mint-receipt/__tests__/route.test.ts:150`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:14`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:26`, `apps/web/src/lib/server/__tests__/early-access-origin.test.ts:10`.
- web runtime: `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:22`, `apps/web/src/lib/pro/pro-origin.ts:73`, `apps/web/src/lib/server/demo-signing.ts:257`, `apps/web/src/lib/server/early-access-origin.ts:58`, `apps/web/src/lib/server/score-save-origin.ts:55`.

### `NEXT_PUBLIC_PRIVY_APP_ID`

- web runtime: `apps/web/src/components/web-wallet-provider.tsx:45`.
- documentation: `docs/validations/2026-07-23-privy-celo-phase-0.md:107`.
- test/fixture: `apps/web/src/components/__tests__/wallet-branch-attribute.test.tsx:68`, `apps/web/src/components/__tests__/web-wallet-provider.test.tsx:73`, `apps/web/src/components/__tests__/web-wallet-provider.test.tsx:78`, `apps/web/src/components/__tests__/web-wallet-provider.test.tsx:85`.

### `NEXT_PUBLIC_PRIVY_ENABLED`

- web runtime: `apps/web/src/components/wallet-provider-boundary.tsx:18`.
- test/fixture: `apps/web/src/components/__tests__/wallet-branch-lazy.test.tsx:66`, `apps/web/src/components/__tests__/wallet-branch-lazy.test.tsx:171`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:62`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:72`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:87`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:108`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:119`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:134`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:143`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:149`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:158`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:171`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:187`, `apps/web/src/components/__tests__/wallet-provider-boundary.test.tsx:199`.

### `NEXT_PUBLIC_SCOREBOARD_ADDRESS`

- web runtime: `apps/web/src/lib/contracts/chains.ts:8`, `apps/web/src/lib/server/sync-blockchain.ts:20`, `apps/web/src/lib/server/demo-signing.ts:155`.
- documentation: `docs/superpowers/plans/2026-03-28-score-submission-system.md:43`, `docs/superpowers/plans/2026-04-06-supabase-cache-layer.md:636`.

### `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED`

- other app / script / configuration: `apps/landing/src/lib/onboarding/sales.ts:35`.
- test/fixture: `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:376`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:411`, `apps/web/src/app/api/verify-payment/__tests__/route.test.ts:424`.
- web runtime: `apps/web/src/lib/feature-flags.ts:139`.

### `NEXT_PUBLIC_SHOP_ADDRESS`

- test/fixture: `apps/web/src/app/api/founder-status/__tests__/route.test.ts:5`, `apps/web/src/app/api/verify-pro/__tests__/route.test.ts:9`.
- web runtime: `apps/web/src/app/api/founder-status/route.ts:37`, `apps/web/src/app/api/verify-pro/route.ts:23`, `apps/web/src/lib/contracts/chains.ts:24`.
- documentation: `docs/superpowers/plans/2026-03-22-chesscito-coach.md:1908`.

### `NEXT_PUBLIC_STREAK_NUDGE_ENABLED`

- web runtime: `apps/web/src/lib/feature-flags.ts:66`.
- test/fixture: `apps/web/src/lib/daily/__tests__/streak-nudge.test.ts:282`, `apps/web/src/lib/daily/__tests__/streak-nudge.test.ts:346`, `apps/web/src/lib/daily/__tests__/use-streak-nudge.test.tsx:35`, `apps/web/src/lib/daily/__tests__/use-streak-nudge.test.tsx:196`.

### `NEXT_PUBLIC_SUPABASE_URL`

- documentation: `docs/handoffs/2026-08-05-stats-phase-b-server-only-client.md:199`.

### `NEXT_PUBLIC_SUPPORT_EMAIL`

- other app / script / configuration: `apps/landing/src/components/landing/landing-page.tsx:439`, `apps/landing/src/components/landing/landing-page.tsx:728`, `apps/landing/src/components/landing/landing-page.tsx:730`.
- web runtime: `apps/web/src/lib/content/editorial.ts:2487`, `apps/web/src/lib/content/editorial.ts:2521`, `apps/web/src/lib/content/editorial.ts:2523`, `apps/web/src/lib/content/editorial.ts:2524`, `apps/web/src/lib/content/messages/es.ts:209`.

### `NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED`

- web runtime: `apps/web/src/lib/telemetry.ts:95`.
- test/fixture: `apps/web/src/lib/__tests__/telemetry-batching.test.ts:235`.

### `NEXT_PUBLIC_TELEMETRY_ENABLED`

- web runtime: `apps/web/src/lib/telemetry.ts:86`.
- test/fixture: `apps/web/src/lib/__tests__/telemetry-batching.test.ts:222`.

### `NEXT_PUBLIC_USDC_ADDRESS`

- web runtime: `apps/web/src/lib/contracts/chains.ts:32`.

### `NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS`

- documentation: `docs/superpowers/plans/2026-05-27-coach-game-viewer.md:1256`.

### `NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK`

- documentation: `docs/superpowers/plans/2026-05-27-coach-game-viewer.md:1479`.

### `NEXT_PUBLIC_VICTORY_NFT_ADDRESS`

- web runtime: `apps/web/src/app/[locale]/victory/[id]/page.tsx:20`, `apps/web/src/app/api/og/victory/[id]/route.tsx:27`, `apps/web/src/lib/contracts/chains.ts:37`, `apps/web/src/lib/server/sync-blockchain.ts:21`, `apps/web/src/lib/server/demo-signing.ts:156`.
- documentation: `docs/superpowers/plans/2026-03-17-mint-your-victory.md:403`, `docs/superpowers/plans/2026-03-24-header-and-hof-fixes.md:101`, `docs/superpowers/plans/2026-04-06-supabase-cache-layer.md:637`.

### `NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED`

- web runtime: `apps/web/src/lib/feature-flags.ts:70`.
- documentation: `docs/handoffs/2026-07-08-permit-preview-activation-and-tx-smoke-map-handoff.md:10`, `docs/superpowers/plans/2026-07-02-victory-nft-permit-mint.md:981`.
- test/fixture: `apps/web/src/lib/__tests__/feature-flags.test.ts:92`, `apps/web/src/lib/__tests__/feature-flags.test.ts:98`, `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts:505`, `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts:564`, `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts:619`, `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts:664`, `apps/web/src/lib/coach/__tests__/use-mint-victory.test.ts:719`.

### `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED`

- test/fixture: `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:177`, `apps/web/src/app/api/leaderboard/__tests__/route.test.ts:282`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet-weekly.test.tsx:90`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet-weekly.test.tsx:102`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet-weekly.test.tsx:108`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet-weekly.test.tsx:110`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet-weekly.test.tsx:117`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet-weekly.test.tsx:130`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet.test.tsx:98`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet.test.tsx:101`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet.test.tsx:106`, `apps/web/src/components/exercises/__tests__/leaderboard-sheet.test.tsx:108`.
- web runtime: `apps/web/src/lib/feature-flags.ts:119`.

### `NODE_ENV`

- documentation: `DESIGN_SYSTEM.md:362`, `DESIGN_SYSTEM.md:436`, `docs/audits/2026-06-03-founder-status-timeout-audit.md:87`, `docs/backlog/2026-06-17-isolate-dev-tools-into-separate-app.md:13`, `docs/handoffs/2026-05-21-vr-fixture-harness-handoff.md:25`, `docs/reviews/contextual-header-implementation-review-2026-05-01.md:133`, `docs/specs/ui/global-status-bar-spec-2026-05-02.md:167`, `docs/superpowers/plans/2026-06-16-labyrinth-builder.md:379`, `docs/superpowers/plans/2026-06-16-labyrinth-builder.md:401`, `docs/superpowers/specs/2026-06-16-labyrinth-builder-design.md:111`.
- web runtime: `apps/web/src/app/__nextjs_original-stack-frames/route.ts:10`, `apps/web/src/app/dev/board-procedural/page.tsx:24`, `apps/web/src/components/dev/chain-config-warning.tsx:24`, `apps/web/src/components/dev/pro-origin-warning.tsx:16`, `apps/web/src/components/dev/pro-origin-warning.tsx:26`, `apps/web/src/components/hub/learn-hub-client.tsx:676`, `apps/web/src/components/mini-arena/mini-arena-sheet.tsx:54`, `apps/web/src/components/redesign/tx-progress-steps.tsx:158`, `apps/web/src/components/scene-rooted/wood-banner.tsx:38`, `apps/web/src/components/ui/contextual-header.tsx:148`, `apps/web/src/components/ui/global-status-bar.tsx:117`, `apps/web/src/lib/daily/session-quota.ts:189`, `apps/web/src/lib/duel/http.ts:59`, `apps/web/src/lib/payments/attribution.ts:65`, `apps/web/src/lib/server/logger.ts:37`, `apps/web/src/lib/telemetry.ts:71`.
- test/fixture: `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:98`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:104`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:119`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:133`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:147`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:165`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:189`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:211`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:229`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:246`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:263`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:273`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:301`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:324`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:352`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:368`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:387`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:406`, `apps/web/src/app/api/dev/promote/__tests__/route.test.ts:17`, `apps/web/src/app/api/dev/publish/__tests__/route-error-passthrough.test.ts:46`, `apps/web/src/app/api/dev/publish/__tests__/route-revalidates-baseline.test.ts:67`, `apps/web/src/app/api/dev/publish/__tests__/route.test.ts:51`, `apps/web/src/app/dev/__tests__/layout.test.tsx:36`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:15`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:28`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:40`, `apps/web/src/components/dev/__tests__/chain-config-warning.test.tsx:50`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:12`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:24`, `apps/web/src/components/dev/__tests__/pro-origin-warning.test.tsx:37`, `apps/web/src/lib/dev/__tests__/dev-surface.test.ts:19`.

### `ORDER_SERVICE_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/api-request.md:254`, `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:214`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-request.md:254`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:214`.

### `OUT_AVIF`

- other app / script / configuration: `scripts/gen-triplet.sh:77`, `scripts/gen-triplet.sh:81`.

### `OUT_DIR`

- other app / script / configuration: `apps/video/scripts/render-review-frames.sh:12`, `apps/video/scripts/render-review-frames.sh:15`, `apps/video/scripts/render-review-frames.sh:22`, `apps/video/scripts/render-review-frames.sh:24`, `apps/video/scripts/render-review-frames.sh:26`, `apps/video/scripts/render-review-frames.sh:28`, `apps/video/scripts/render-review-frames.sh:30`, `apps/video/scripts/render-review-frames.sh:32`, `apps/video/scripts/render-review-frames.sh:34`, `apps/video/scripts/render-review-frames.sh:36`, `apps/video/scripts/render-review-frames.sh:38`, `apps/video/scripts/render-review-frames.sh:42`, `apps/video/scripts/render-review-frames.sh:44`, `scripts/gen-triplet.sh:32`, `scripts/gen-triplet.sh:40`, `scripts/gen-triplet.sh:41`, `scripts/gen-triplet.sh:42`, `scripts/gen-triplet.sh:54`.

### `OUT_PNG`

- other app / script / configuration: `scripts/gen-triplet.sh:60`, `scripts/gen-triplet.sh:61`, `scripts/gen-triplet.sh:64`, `scripts/gen-triplet.sh:66`, `scripts/gen-triplet.sh:74`, `scripts/gen-triplet.sh:77`, `scripts/gen-triplet.sh:81`.

### `OUT_WEBP`

- other app / script / configuration: `scripts/gen-triplet.sh:74`, `scripts/gen-triplet.sh:81`.

### `PACT_BREAKING_CHANGE`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-request-filter.md:135`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:58`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:109`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:158`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:318`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:339`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-request-filter.md:135`.

### `PACT_BROKER_BASE_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-tea/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-atdd/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-atdd/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-overview.md:171`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-automate/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-automate/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-overview.md:168`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-ci/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-ci/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-overview.md:168`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-framework/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-framework/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-overview.md:168`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-nfr/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-nfr/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-overview.md:168`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-test-design/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-test-design/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-overview.md:168`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-test-review/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-test-review/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-overview.md:168`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:312`, `.github/skills/bmad-testarch-trace/resources/knowledge/contract-testing.md:228`, `.github/skills/bmad-testarch-trace/resources/knowledge/contract-testing.md:718`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-overview.md:168`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:188`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:312`.

### `PACT_BROKER_TOKEN`

- documentation: `.github/skills/bmad-tea/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-tea/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-overview.md:172`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-atdd/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-atdd/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-overview.md:172`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-automate/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-automate/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-overview.md:169`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-ci/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-ci/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-overview.md:169`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-framework/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-framework/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-overview.md:169`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-nfr/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-nfr/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-overview.md:169`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-test-design/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-test-design/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-overview.md:169`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-test-review/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-test-review/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-overview.md:169`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:313`, `.github/skills/bmad-testarch-trace/resources/knowledge/contract-testing.md:229`, `.github/skills/bmad-testarch-trace/resources/knowledge/contract-testing.md:719`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-overview.md:169`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:313`.

### `PACT_PAYLOAD_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:321`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:187`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:321`.

### `PASSPORT_API_KEY`

- web runtime: `apps/web/src/lib/server/passport.ts:4`.
- documentation: `docs/superpowers/plans/2026-03-10-passport-gating.md:41`.

### `PASSPORT_SCORER_ID`

- web runtime: `apps/web/src/lib/server/passport.ts:5`.
- documentation: `docs/superpowers/plans/2026-03-10-passport-gating.md:42`.

### `PATH`

- test/fixture: `scripts/ops/__tests__/child-env.test.ts:38`, `scripts/ops/__tests__/vercel-should-build.test.ts:40`.

### `PEONES_SPEND_REQUIRE_SESSION`

- test/fixture: `apps/web/src/app/api/peones/spend/__tests__/route.test.ts:570`, `apps/web/src/app/api/peones/spend/__tests__/route.test.ts:573`, `apps/web/src/app/api/peones/spend/__tests__/route.test.ts:576`, `apps/web/src/app/api/peones/spend/__tests__/route.test.ts:577`, `apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts:76`, `apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts:78`, `apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts:79`, `apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts:82`, `apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts:86`, `apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts:88`, `apps/web/src/lib/scores/__tests__/spend-session-guard.test.ts:90`.
- web runtime: `apps/web/src/lib/scores/spend-session-guard.ts:69`.

### `PGCONN`

- test/fixture: `scripts/ops/__tests__/child-env.test.ts:42`, `scripts/ops/__tests__/child-env.test.ts:44`.

### `PORT`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-request-filter.md:134`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-request-filter.md:134`.
- other app / script / configuration: `apps/web/scripts/measure-baseline-first-load.sh:43`, `apps/web/scripts/measure-baseline-first-load.sh:44`, `apps/web/scripts/measure-baseline-first-load.sh:46`, `apps/web/scripts/measure-baseline-first-load.sh:50`.

### `PRIZEPOOL_PAYOUT_ADDRESS`

- other app / script / configuration: `apps/contracts/scripts/deploy-chesscito-prizepool.ts:42`.

### `PROCESSED`

- other app / script / configuration: `scripts/optimize-assets.sh:103`, `scripts/optimize-assets.sh:111`.

### `PUBLIC_DIR`

- other app / script / configuration: `scripts/optimize-assets.sh:97`.

### `PW_NET_MODE`

- documentation: `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-tea/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-automate/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-ci/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-framework/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-nfr/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-test-design/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-test-review/resources/knowledge/network-recorder.md:504`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:30`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:49`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:76`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:109`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:431`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:496`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:498`, `.github/skills/bmad-testarch-trace/resources/knowledge/network-recorder.md:504`.

### `PW_SHARD`

- documentation: `.github/skills/bmad-tea/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-atdd/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-automate/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-ci/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-framework/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-nfr/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-test-design/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-test-review/resources/knowledge/burn-in.md:206`, `.github/skills/bmad-testarch-trace/resources/knowledge/burn-in.md:206`.

### `RATE_LIMIT_LOG_SAMPLE`

- web runtime: `apps/web/src/lib/server/rate-limit.ts:248`.
- test/fixture: `apps/web/src/lib/server/__tests__/rate-limit.test.ts:429`.

### `REDIS_OBSERVABILITY_SAMPLE_RATE`

- web runtime: `apps/web/src/lib/server/redis-observability.ts:35`.
- test/fixture: `apps/web/src/lib/server/__tests__/rate-limit.test.ts:459`, `apps/web/src/lib/server/__tests__/redis-observability.test.ts:24`, `apps/web/src/lib/server/__tests__/redis-observability.test.ts:45`, `apps/web/src/lib/server/__tests__/redis-observability.test.ts:55`.

### `REPORT_FILE`

- other app / script / configuration: `scripts/optimize-assets.sh:39`, `scripts/optimize-assets.sh:40`, `scripts/optimize-assets.sh:91`, `scripts/optimize-assets.sh:99`, `scripts/optimize-assets.sh:116`.

### `REPORT_GAS`

- other app / script / configuration: `apps/contracts/hardhat.config.ts:91`.

### `REPO_ROOT`

- other app / script / configuration: `apps/web/scripts/measure-baseline-first-load.sh:23`, `apps/web/scripts/measure-baseline-first-load.sh:27`, `apps/web/scripts/measure-baseline-first-load.sh:32`, `apps/web/scripts/measure-baseline-first-load.sh:33`, `apps/web/scripts/measure-baseline-first-load.sh:35`.

### `ROUTES`

- other app / script / configuration: `scripts/measure-perf.sh:185`.

### `SAFE_OWNER`

- other app / script / configuration: `apps/contracts/scripts/deploy-shop.ts:14`, `apps/contracts/scripts/verify.ts:36`, `apps/contracts/scripts/deploy-chesscito-prizepool.ts:40`, `apps/contracts/scripts/deploy-chesscito-treasury.ts:14`, `apps/contracts/scripts/deploy-labyrinth-badges.ts:32`, `apps/contracts/scripts/deploy-proxies.ts:52`, `apps/contracts/scripts/deploy-shop-upgradeable.ts:20`, `apps/contracts/scripts/deploy-victory-nft.ts:27`.

### `SAFE_OWNER_KEY`

- other app / script / configuration: `apps/contracts/scripts/register-coach-items.ts:21`.

### `SAVINGS_AFTER`

- other app / script / configuration: `scripts/optimize-assets.sh:105`, `scripts/optimize-assets.sh:113`.

### `SAVINGS_BEFORE`

- other app / script / configuration: `scripts/optimize-assets.sh:104`, `scripts/optimize-assets.sh:112`.

### `SCOREBOARD_MAX_SUBMISSIONS_PER_DAY`

- other app / script / configuration: `apps/contracts/scripts/deploy-proxies.ts:59`.

### `SCOREBOARD_PROXY`

- other app / script / configuration: `apps/contracts/scripts/verify.ts:33`.

### `SCOREBOARD_SUBMIT_COOLDOWN`

- other app / script / configuration: `apps/contracts/scripts/deploy-proxies.ts:58`.

### `SCRIPT_DIR`

- other app / script / configuration: `apps/video/scripts/render-review-frames.sh:9`.

### `SERVER_PID`

- other app / script / configuration: `apps/web/scripts/measure-baseline-first-load.sh:26`.

### `SERVICE_API_KEY`

- documentation: `.github/skills/bmad-tea/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-automate/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-ci/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-framework/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-nfr/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-test-design/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md:373`, `.github/skills/bmad-testarch-trace/resources/knowledge/auth-session.md:373`.

### `SHARD_COUNT`

- documentation: `.github/skills/bmad-tea/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-atdd/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-ci/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-framework/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-nfr/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-test-design/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-test-review/resources/knowledge/ci-burn-in.md:391`, `.github/skills/bmad-testarch-trace/resources/knowledge/ci-burn-in.md:391`.

### `SHARD_INDEX`

- documentation: `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:440`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:440`.

### `SHARD_TOTAL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:441`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:438`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:441`.

### `SHOP_ADDRESS`

- other app / script / configuration: `apps/contracts/scripts/configure-shop.ts:17`, `apps/contracts/scripts/verify.ts:34`.

### `SHOP_DEPLOY_BLOCK_CELO`

- web runtime: `apps/web/src/app/api/founder-status/route.ts:57`.
- documentation: `docs/audits/2026-06-03-founder-status-timeout-audit.md:13`, `docs/audits/2026-06-03-founder-status-timeout-audit.md:83`, `docs/audits/2026-06-03-founder-status-timeout-audit.md:84`, `docs/audits/2026-06-03-founder-status-timeout-audit.md:134`, `docs/audits/2026-06-03-founder-status-timeout-audit.md:198`.
- test/fixture: `apps/web/src/app/api/founder-status/__tests__/route.test.ts:162`, `apps/web/src/app/api/founder-status/__tests__/route.test.ts:171`, `apps/web/src/app/api/founder-status/__tests__/route.test.ts:180`.

### `SHOP_OWNER`

- other app / script / configuration: `apps/contracts/scripts/deploy-shop.ts:14`, `apps/contracts/scripts/verify.ts:36`.

### `SHOP_TREASURY`

- other app / script / configuration: `apps/contracts/scripts/deploy-shop-upgradeable.ts:21`, `apps/contracts/scripts/deploy-shop.ts:15`.
- documentation: `docs/superpowers/plans/2026-03-12-shop-upgradeable-multi-token.md:640`.

### `SHOT_DIR`

- test/fixture: `apps/web/e2e/rook-rails-shots.spec.ts:12`.

### `SIGNER_ADDRESS`

- other app / script / configuration: `apps/contracts/scripts/deploy.ts:20`, `apps/contracts/scripts/deploy-labyrinth-badges.ts:33`, `apps/contracts/scripts/deploy-victory-nft.ts:28`.

### `SIGNER_PRIVATE_KEY`

- other app / script / configuration: `apps/contracts/scripts/deploy-proxies.ts:53`, `apps/contracts/scripts/smoke-labyrinth-badges.ts:79`, `apps/contracts/scripts/smoke-victory-permit-mint.ts:74`.

### `SMOKE_BASE`

- other app / script / configuration: `scripts/attempt-http-smoke.mjs:33`.

### `SOURCE`

- other app / script / configuration: `scripts/gen-triplet.sh:24`, `scripts/gen-triplet.sh:25`, `scripts/gen-triplet.sh:34`, `scripts/gen-triplet.sh:38`, `scripts/gen-triplet.sh:53`, `scripts/gen-triplet.sh:58`, `scripts/gen-triplet.sh:60`, `scripts/gen-triplet.sh:61`, `scripts/gen-triplet.sh:64`, `scripts/gen-triplet.sh:66`.

### `SRC`

- other app / script / configuration: `apps/web/scripts/copy-stockfish.sh:14`, `apps/web/scripts/copy-stockfish.sh:15`, `apps/web/scripts/copy-stockfish.sh:21`, `apps/web/scripts/copy-stockfish.sh:22`, `apps/web/scripts/copy-stockfish.sh:28`, `apps/web/scripts/copy-stockfish.sh:29`, `apps/web/scripts/copy-stockfish.sh:35`, `apps/web/scripts/copy-stockfish.sh:36`.

### `STATS_REFRESH_SECRET`

- test/fixture: `apps/landing/src/app/api/internal/stats/refresh/__tests__/route.test.ts:66`, `apps/landing/src/app/api/internal/stats/refresh/__tests__/route.test.ts:86`, `apps/landing/src/app/api/internal/stats/refresh/__tests__/route.test.ts:87`.
- other app / script / configuration: `apps/landing/src/app/api/internal/stats/refresh/route.ts:42`, `.github/workflows/cron-stats-snapshot-refresh.yml:20`.

### `STATS_REFRESH_URL`

- other app / script / configuration: `.github/workflows/cron-stats-snapshot-refresh.yml:19`.

### `STATS_REVALIDATE_TOKEN`

- test/fixture: `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:29`, `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:33`, `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:37`, `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:38`, `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:75`, `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:82`, `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:90`, `apps/landing/src/app/api/revalidate-stats/__tests__/route.test.ts:137`.
- other app / script / configuration: `apps/landing/src/app/api/revalidate-stats/route.ts:35`.

### `SUBMIT_COOLDOWN_SECS`

- other app / script / configuration: `apps/contracts/scripts/deploy.ts:23`.

### `SUPABASE_DB_PASSWORD`

- other app / script / configuration: `scripts/ops/archive.ts:300`, `scripts/ops/backup.ts:152`, `scripts/ops/collectors/supabase.ts:225`, `scripts/ops/collectors/supabase.ts:235`, `scripts/ops/launch-health-snapshot.ts:595`, `scripts/ops/no-token-observation.ts:233`, `scripts/ops/no-token-observation.ts:236`, `scripts/ops/read-only-query.ts:130`, `scripts/ops/read-only-query.ts:135`, `scripts/ops/verify-stats-rpcs.ts:882`.

### `SUPABASE_SERVICE_ROLE_KEY`

- test/fixture: `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:59`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:65`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:71`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:72`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:88`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:95`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:102`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:114`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:125`, `apps/web/src/lib/supabase/__tests__/fresh-reads.test.ts:34`.
- other app / script / configuration: `apps/landing/src/lib/supabase/server.ts:48`, `apps/web/scripts/peones-smoke.mjs:40`, `apps/web/scripts/peones-spend-smoke.mjs:40`, `apps/web/scripts/reset-wallet.ts:164`, `apps/web/scripts/verify-catalog-source.ts:43`, `scripts/ops/send-inbox-message.ts:112`.
- web runtime: `apps/web/src/lib/supabase/server.ts:51`.
- documentation: `docs/handoffs/2026-08-05-stats-phase-b-server-only-client.md:105`.

### `SUPABASE_URL`

- test/fixture: `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:58`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:64`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:69`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:70`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:82`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:94`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:101`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:113`, `apps/landing/src/lib/supabase/__tests__/server-only.test.ts:124`, `apps/web/src/lib/supabase/__tests__/fresh-reads.test.ts:33`, `apps/web/src/lib/supabase/__tests__/fresh-reads.test.ts:67`.
- other app / script / configuration: `apps/landing/src/lib/supabase/server.ts:47`, `apps/web/scripts/peones-smoke.mjs:39`, `apps/web/scripts/peones-spend-smoke.mjs:39`, `apps/web/scripts/reset-wallet.ts:163`, `apps/web/scripts/verify-catalog-source.ts:43`, `scripts/ops/archive.ts:299`, `scripts/ops/backup.ts:151`, `scripts/ops/collectors/supabase.ts:224`, `scripts/ops/collectors/supabase.ts:227`, `scripts/ops/no-token-observation.ts:232`, `scripts/ops/read-only-query.ts:129`, `scripts/ops/send-inbox-message.ts:111`, `scripts/ops/verify-stats-rpcs.ts:881`.
- web runtime: `apps/web/src/lib/supabase/server.ts:50`.
- documentation: `docs/handoffs/2026-08-05-stats-phase-b-server-only-client.md:104`.

### `TELEMETRY_ACCOUNT_SECRET`

- web runtime: `apps/web/src/lib/analytics/account-ref.ts:30`.
- test/fixture: `apps/web/src/app/api/telemetry/__tests__/route.test.ts:234`, `apps/web/src/app/api/telemetry/__tests__/route.test.ts:253`, `apps/web/src/app/api/telemetry/__tests__/route.test.ts:273`, `apps/web/src/app/api/telemetry/__tests__/route.test.ts:345`.

### `TEST_AUTH_TOKEN`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-request-filter.md:129`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:61`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-request-filter.md:129`.

### `TEST_CLIENT_ID`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-request-filter.md:65`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-request-filter.md:65`.

### `TEST_CLIENT_SECRET`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-request-filter.md:66`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-request-filter.md:66`.

### `TEST_ENV`

- documentation: `.github/skills/bmad-tea/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-tea/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-atdd/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-atdd/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-automate/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-automate/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-ci/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-ci/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-framework/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-framework/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-nfr/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-nfr/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-test-design/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-test-design/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-test-review/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md:36`, `.github/skills/bmad-testarch-trace/resources/knowledge/ci-burn-in.md:392`, `.github/skills/bmad-testarch-trace/resources/knowledge/playwright-config.md:36`.

### `TEST_TOKEN`

- documentation: `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-tea/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-atdd/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-ci/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-framework/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-nfr/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-test-design/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-test-review/resources/knowledge/pactjs-utils-provider-verifier.md:344`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:326`, `.github/skills/bmad-testarch-trace/resources/knowledge/pactjs-utils-provider-verifier.md:344`.

### `TEST_USER_EMAIL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-tea/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-tea/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-atdd/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-automate/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-automate/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-ci/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-ci/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-framework/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-framework/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-nfr/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-nfr/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-test-design/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-test-design/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-test-review/resources/knowledge/email-auth.md:670`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:647`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:666`, `.github/skills/bmad-testarch-trace/resources/knowledge/auth-session.md:276`, `.github/skills/bmad-testarch-trace/resources/knowledge/email-auth.md:670`.

### `TEST_USER_PASSWORD`

- documentation: `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-tea/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-automate/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-ci/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-framework/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-nfr/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-test-design/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-test-review/resources/knowledge/auth-session.md:277`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:648`, `.github/skills/bmad-testarch-trace/resources/knowledge/auth-session.md:277`.

### `TMPDIR`

- other app / script / configuration: `scripts/measure-perf.sh:170`.

### `TORRE_PRINCESA`

- web runtime: `apps/web/src/lib/server/demo-signing.ts:158`.

### `TREASURY_ADDRESS`

- other app / script / configuration: `apps/contracts/scripts/deploy.ts:21`, `apps/contracts/scripts/verify.ts:37`.
- test/fixture: `apps/web/src/lib/payments/__tests__/get-peones-canary-server.test.ts:45`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:28`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:33`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:40`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:41`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:66`, `apps/web/src/lib/payments/__tests__/rail-config.test.ts:72`.
- web runtime: `apps/web/src/lib/payments/rail-config.ts:45`.
- documentation: `docs/audits/2026-06-24-shortest-path-to-real-tx.md:20`, `docs/masterplans/2026-06-25-season-pass-pre-implementation-review.md:45`.

### `TREASURY_PAYOUT_ADDRESS`

- other app / script / configuration: `apps/contracts/scripts/deploy-chesscito-treasury.ts:16`.

### `TURBO_IGNORE_VERSION`

- other app / script / configuration: `scripts/ops/vercel-should-build.sh:102`.

### `UPSTASH_API_KEY`

- other app / script / configuration: `scripts/ops/launch-health-snapshot.ts:508`, `scripts/ops/launch-health-snapshot.ts:530`, `scripts/ops/launch-health-snapshot.ts:597`.

### `UPSTASH_EMAIL`

- other app / script / configuration: `scripts/ops/launch-health-snapshot.ts:508`, `scripts/ops/launch-health-snapshot.ts:529`.

### `UPSTASH_REDIS_REST_TOKEN`

- other app / script / configuration: `apps/landing/src/lib/stats/redis.ts:9`, `apps/web/scripts/grant-pro.ts:63`, `apps/web/node_modules/@upstash/redis/nodejs.mjs:276`, `scripts/ops/launch-health-snapshot.ts:528`, `scripts/ops/launch-health-snapshot.ts:596`.

### `UPSTASH_REDIS_REST_URL`

- other app / script / configuration: `apps/landing/src/lib/stats/redis.ts:9`, `apps/web/scripts/grant-pro.ts:63`, `apps/web/node_modules/@upstash/redis/nodejs.mjs:272`, `scripts/ops/launch-health-snapshot.ts:527`.

### `USDC_ADDRESS`

- other app / script / configuration: `apps/contracts/scripts/deploy.ts:29`, `apps/contracts/scripts/verify.ts:35`, `apps/contracts/scripts/deploy-shop.ts:13`.

### `USER_SERVICE_URL`

- documentation: `.github/skills/bmad-tea/resources/knowledge/api-request.md:253`, `.github/skills/bmad-tea/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-atdd/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-automate/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-ci/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-framework/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-nfr/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-test-design/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-test-review/resources/knowledge/api-testing-patterns.md:213`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-request.md:253`, `.github/skills/bmad-testarch-trace/resources/knowledge/api-testing-patterns.md:213`.

### `VERCEL`

- test/fixture: `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:306`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:311`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:318`, `apps/web/src/lib/dev/__tests__/dev-surface.test.ts:31`, `apps/web/src/lib/dev/__tests__/dev-surface.test.ts:40`.
- web runtime: `apps/web/src/app/api/dev/labyrinth/route.ts:25`, `apps/web/src/app/dev/labyrinth-builder/page.tsx:350`, `apps/web/src/lib/dev/dev-surface.ts:32`.

### `VERCEL_BRANCH_URL`

- web runtime: `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:24`, `apps/web/src/lib/server/demo-signing.ts:259`, `apps/web/src/lib/server/early-access-origin.ts:60`, `apps/web/src/lib/server/score-save-origin.ts:57`.
- test/fixture: `apps/web/src/lib/server/__tests__/early-access-origin.test.ts:12`.

### `VERCEL_DEPLOYMENT_ID`

- web runtime: `apps/web/src/app/api/peones/balance/route.ts:180`, `apps/web/src/lib/server/rate-limit.ts:271`.

### `VERCEL_ENV`

- web runtime: `apps/web/src/app/[locale]/template.tsx:9`, `apps/web/src/app/dev/layout.tsx:30`, `apps/web/src/lib/dev/dev-surface.ts:19`, `apps/web/src/lib/server/demo-signing.ts:237`, `apps/web/src/lib/server/rate-limit.ts:272`.
- test/fixture: `apps/web/src/app/dev/__tests__/layout.test.tsx:6`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:273`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:282`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:283`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:291`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:306`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:312`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:320`, `apps/web/src/lib/server/__tests__/demo-signing.test.ts:327`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:87`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:97`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:292`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:300`, `apps/web/src/app/api/dev/labyrinth/__tests__/route.test.ts:312`, `apps/web/src/app/api/dev/promote/__tests__/route.test.ts:39`, `apps/web/src/app/api/dev/publish/__tests__/route.test.ts:62`, `apps/web/src/app/dev/__tests__/layout.test.tsx:29`, `apps/web/src/app/dev/__tests__/layout.test.tsx:35`, `apps/web/src/app/dev/__tests__/layout.test.tsx:42`, `apps/web/src/lib/dev/__tests__/dev-surface.test.ts:10`, `apps/web/src/lib/dev/__tests__/dev-surface.test.ts:18`, `apps/web/src/lib/dev/__tests__/dev-surface.test.ts:24`, `apps/web/src/lib/dev/__tests__/dev-surface.test.ts:41`.
- documentation: `docs/audits/2026-06-03-hub-render-delay-audit.md:182`.

### `VERCEL_GIT_COMMIT_MESSAGE`

- other app / script / configuration: `scripts/ops/vercel-should-build.sh:66`.

### `VERCEL_GIT_COMMIT_SHA`

- other app / script / configuration: `apps/landing/next.config.mjs:14`, `apps/web/next.config.js:16`.

### `VERCEL_PROJECT_PRODUCTION_URL`

- web runtime: `apps/web/src/app/[locale]/victory/[id]/page.tsx:64`, `apps/web/src/app/[locale]/victory/[id]/page.tsx:65`, `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:25`, `apps/web/src/lib/server/demo-signing.ts:260`, `apps/web/src/lib/server/early-access-origin.ts:61`, `apps/web/src/lib/server/score-save-origin.ts:58`.
- documentation: `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md:69`, `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md:70`, `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md:76`, `docs/superpowers/plans/2026-03-20-og-social-preview-fix.md:77`.
- test/fixture: `apps/web/src/lib/server/__tests__/early-access-origin.test.ts:13`.

### `VERCEL_SHOULD_BUILD_DRY_RUN`

- other app / script / configuration: `scripts/ops/vercel-should-build.sh:95`.

### `VERCEL_TOKEN`

- other app / script / configuration: `scripts/ops/launch-health-snapshot.ts:505`, `scripts/ops/launch-health-snapshot.ts:525`, `scripts/ops/launch-health-snapshot.ts:598`.

### `VERCEL_URL`

- web runtime: `apps/web/src/app/api/games/[id]/mint-receipt/route.ts:23`, `apps/web/src/lib/server/demo-signing.ts:258`, `apps/web/src/lib/server/early-access-origin.ts:59`, `apps/web/src/lib/server/score-save-origin.ts:56`.
- test/fixture: `apps/web/src/lib/server/__tests__/early-access-origin.test.ts:11`.

### `VICTORY_PRIZE_POOL`

- other app / script / configuration: `apps/contracts/scripts/deploy-victory-nft.ts:30`.

### `VICTORY_TREASURY`

- other app / script / configuration: `apps/contracts/scripts/deploy-victory-nft.ts:29`.

### `VITEST`

- web runtime: `apps/web/src/lib/server/logger.ts:37`.
- test/fixture: `apps/web/src/lib/server/__tests__/logger.test.ts:101`.

### `VITE_PRIVY_APP_ID`

- other app / script / configuration: `tools/privy-celo-harness/src/main.tsx:15`.

### `WORKSPACE`

- other app / script / configuration: `scripts/ops/vercel-should-build.sh:88`, `scripts/ops/vercel-should-build.sh:96`, `scripts/ops/vercel-should-build.sh:101`, `scripts/ops/vercel-should-build.sh:102`.

### `WORKTREE`

- other app / script / configuration: `apps/web/scripts/measure-baseline-first-load.sh:27`, `apps/web/scripts/measure-baseline-first-load.sh:32`, `apps/web/scripts/measure-baseline-first-load.sh:33`, `apps/web/scripts/measure-baseline-first-load.sh:35`, `apps/web/scripts/measure-baseline-first-load.sh:36`, `apps/web/scripts/measure-baseline-first-load.sh:41`, `apps/web/scripts/measure-baseline-first-load.sh:44`.

### `X`

- documentation: `docs/handoffs/2026-06-02-monetization-m1-handoff.md:69`, `docs/handoffs/2026-08-05-stats-phase-b-server-only-client.md:124`.

## Validation / stop condition

Parsed the exact user-supplied names; checked per-list uniqueness, counts, intersection, differences and union. Verified complete non-overlapping configured-name decisions (50 Play and 52 Learn) and a 56-row final matrix. Operational resolution verifies final exclusive partitions of 50 Play names and 53 Learn names including its added APP_URL; only ADMIN_TOKEN remains externally unresolved per app. Caller evidence retains Learn’s real optional signing dependency and proposes Play as the single cron/Passport/LLM host. Preserved the earlier 92-candidate code-discovery matrix, reader-timing evidence, history/default/reachability conclusions and 228-name reference index. Checked Markdown diff/whitespace and report-only changes relative to the reconciliation start.

STOP: report updated only. No values inspected, no code/templates or Vercel changed, no secret rotated and no deployment executed.
