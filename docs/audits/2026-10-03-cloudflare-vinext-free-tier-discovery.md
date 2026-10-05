# Chesscito: Cloudflare Workers Free / vinext discovery

> Archived evidence: this report describes its dated observation/source snapshot, not current production state or authorization to execute its recommendations. As of this curation, the operator reports www on Cloudflare and Play/Learn stable; main contains adaptive and bounded cron fixes. Source paths, inventories, platform limits, access failures and deployment assumptions below may have changed. See [the curation review](2026-10-05-infrastructure-worktree-curation.md).


Date: 2026-10-03. Source revision: `46bb5783`. Mode: read-only discovery; diagnosis only.

## Decision

**Migrate in the order www → learn → play, if later authorized. None of the three is certified to run unchanged at $0.** www is the strongest candidate after controlling dynamic rendering. Learn is plausible after fixing shared runtime incompatibilities and proving CPU limits. Play has the weakest Free-tier fit because of signing, chess validation, dynamic image generation, polling, and catch-up work.

Cloudflare currently recommends vinext, but this is a framework migration as well as a hosting migration: both source apps use Next.js 14.2.35 and React 18.3.1; the checked vinext release requires React 19.2.6 or later within its declared range and Node 22 or later. [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/). Exact release requirements below were read from the installed public package, not inferred from the guide.

**$0 hosting and $0 total infrastructure are different acceptance criteria.** Cloudflare Free can cover a suitable frontend and lightweight handlers. It does not establish that existing Supabase, Upstash, Privy, blockchain RPC, Passport, GitHub Actions or LLM use costs nothing. Their live plans, allowance consumption and invoices were not read in this investigation. Play's server calls an OpenAI-compatible LLM endpoint; continued AI service cannot be promised at a perpetual zero cost.

## Scope and evidence quality

- No application code, package manifest, lockfile, production deployment, DNS, Vercel setting or Supabase resource was modified. No refresh job, gameplay endpoint, database operation or blockchain transaction was triggered.
- This Markdown report is the only repository file added by this discovery, as required by AGENTS.md. Pre-existing untracked tests, migrations and audit reports were left intact.
- Environment files and `private/` were not read or copied. No credential values or personal records appear in this report. Environment inventory uses names in source and public templates only.
- Official checker execution used a temporary source copy under `/tmp`, excluding environment files, private directories, `.vercel`, build output, dependencies and binary assets. Public vinext tooling was installed only under `/tmp`, with installation scripts disabled.
- Vercel project metadata and billing/observability queries were read-only. Responses were filtered in memory. The connector lacked access to the team; the already-authenticated local CLI could read project metadata and billing.
- No vinext init, application build, dry-run deployment or runtime benchmark was performed. Existing Next build manifests are supporting evidence, not a build of current source: landing dates to September 17; web to September 30.
- Official web documentation was checked during this investigation. Numbers below intentionally reflect current documents, rather than older commonly quoted limits.

## Phase 1 — app inventory

### Deployment map

| Public application | Source | Vercel project | Mode / evidence |
| --- | --- | --- | --- |
| www.chesscito.com | `apps/landing` | `chesscito-landing` | Package description and source URLs identify www. Project root confirmed through GET metadata. |
| learn.chesscito.com | `apps/web` | `lite-chesscito` | GET metadata confirms root and Learn domain alias. Source implements `learn` mode and the legacy Lite flag. |
| play.chesscito.com | `apps/web` | `chesscito` | GET metadata confirms root and Play domain alias. Source implements `play` mode. |

Learn and Play share the same server route tree. Their UI/middleware mode separation does **not** remove unwanted API handlers from the build or prove those handlers are unreachable. Middleware excludes `/api`. Actual production flag values were not retrieved; mode assignments describe the intended source architecture and confirmed project/domain mapping.

### Feature matrix

| Feature | www / landing | learn / web | play / web |
| --- | --- | --- | --- |
| Next / React versions | 14.2.35 / 18.3.1 | 14.2.35 / 18.3.1 | Same as Learn |
| Router | App Router; no authored Pages Router | App Router; no authored Pages Router | Same |
| SSR | Locale home reads onboarding cookies; `/stats` forces dynamic rendering and reads request language plus Redis | Home and exercises consume server `searchParams`; exercises can load a Supabase content overlay | Home consumes `searchParams`; victory and coach detail routes have server data paths |
| SSG | Locale layout declares static params; existing manifest contains `/classic`, `/pricing`, robots and sitemap | Locale layout declares static params; existing manifest contains arena, minigames, trophies, why and other shells | Same shared source; manifest mode is not proof of both deployments' output |
| ISR / data caching | `unstable_cache` and tag revalidation exist in stats library; current public `/stats` reads a separately persisted snapshot | `unstable_cache` for merged content and census; content tag invalidation | Same |
| Middleware | next-intl locale selection; excludes API/static/classic/stats/pricing | next-intl, Spanish readiness gate and cross-host mode redirects | Same, with different mode destinations |
| Route handlers / API routes | 3 App Router handlers | 61 API handlers in shared tree, including 4 dev APIs | Same 61; not a separate backend |
| Pages API routes | None | None | None |
| Server Actions | No authored `use server`; old build manifest has zero actions | Same | Same |
| next/image | No source imports; images use browser/static asset paths | No source imports | No source imports |
| next/font | Google Fredoka and Rowdies | Google Fredoka, Rowdies, Lilita One | Same |
| Local fonts | No next/font/local import | Cinzel TTF asset fetched by OG renderer; no next/font/local import | Same |
| Node APIs | Refresh handler uses node:crypto UUID | Buffer, crypto hash/HMAC/random/AES-GCM/timing comparison, ethers/viem | Same |
| Filesystem access | No application runtime fs access found | Build fingerprint writer; local dev content/theme editors read/write filesystem | Same; dev tools must not reach production |
| Crypto | UUID and constant-time secret comparison logic | Signing-key decryption, typed-data signing, signature recovery, session/seat tokens, salted identifiers | Same; more signing/game paths are exercised by Play |
| Streaming | Framework RSC/SSR possible; no authored SSE/stream API found | Framework RSC/SSR, victory loading boundary; no authored SSE/stream API found | Same; coach LLM request returns a complete result, not a streamed response |
| Scheduled jobs | GitHub Actions calls protected stats refresh every 6 hours | Shared sync/purge handlers exist; actual workflow destination is not verified | Sync every 15 minutes; coach purge daily, invoked by GitHub Actions |
| Background work | Refresh awaits its work | `afterResponse` currently awaits by default; no registered platform runner found | Same; coach job records exist, but analysis is awaited in its handler |
| External APIs | Product redirects; Supabase and Upstash; dormant on-chain stats aggregation source exists | Supabase, Upstash, Celo RPC, browser auth/wallet services; shared Passport/LLM backend code | Same, including active-feature potential for Passport and LLM |
| Supabase | Server-only HTTP client; emergency stats refresh invokes five selected RPCs | Server-only HTTP client for content, scores, sessions, ledger, inbox and operations | Also duel, games/history and coach persistence |
| Redis | Upstash HTTP REST; durable public stats snapshot and refresh lease/cooldown | Upstash HTTP REST for rate limits, entitlement/cache/session/game state | Same; coach/duel/game paths add operations |
| Privy | No dependency in landing | Browser provider and access gate | Same |
| WalletConnect | No dependency in landing | Browser wallet stack; prior audit observed metadata requests. WalletConnect is not a direct package.json dependency | Same |
| Blockchain RPC | Current stats refresh explicitly disables on-chain work; on-chain counters read from Supabase in dormant aggregation path | Browser Celo transactions/reads, server receipt verification and contract checks | Also victory reads/signing, sync and games |

Raw source contains a 62nd route file at `__nextjs_original-stack-frames`; App Router private-folder rules exclude it from normal route discovery. The official checker therefore counts 61 handlers. Production API surface after excluding the four explicitly dev APIs contains 57 route files; this is a source count, not an execution-frequency measurement.

### Routes and workload groups

| Group | Routes / source | Execution properties |
| --- | --- | --- |
| Public landing | `/`, locale variants, `/classic`, `/pricing`, robots, sitemap | Static presentation except cookie-selected onboarding entry |
| Landing API | `/api/enter`, `/api/revalidate-stats`, `/api/internal/stats/refresh` | Enter sets cookies and redirects. Revalidation is a protected mutation. Refresh is a protected scheduled writer. |
| Learn product | `/`, `/exercises`, `/minigames`, `/challenge/daily`, `/trophies`, `/inbox`, informational pages | Browser gameplay; dynamic query setup/content overlay; account reads and score writes |
| Play product | `/`, `/arena`, `/coach/history`, `/coach/[gameId]`, `/victory/[id]`, trophies/inbox | Browser engine, server chess validation, external AI, share rendering |
| Stats redirects | Web locale `/stats` | Redirects to www's public stats page; no local stats aggregation on the current page |
| Scores/signatures | `/api/scores/save`, session authorize/challenge, sign-score/badge/labyrinth/victory, cache-score/victory | Integrity-sensitive writes, recovery/signing and rate limits; not globally cacheable |
| Account/store | pro/founder/season-pass status, verify-payment/pro, payment intents, peones balance/earn/spend, shields me/spend, welcome-pack status/claim, focus-day | Wallet-dependent responses; some GETs can initialize/backfill state |
| Games/coach | games collection/item/mint-receipt, coach analyze/credits/history/job | Storage, chess move validation, LLM; job status is not evidence of detached computation |
| Duels | collection/item/join/move/resign | Supabase state, seat token/security and move validation; polling adds traffic |
| Public reads | leaderboard, hall-of-fame, profile stats, my-victories, access capacity | Cache opportunities vary; profile/ownership data needs correct partitioning |
| Telemetry/inbox/access | telemetry, inbox, early-access request | Writes, reads and safety gates; browser telemetry already batches events |
| Operations | cron sync/purge, control-tower, admin content/stage/revalidate/lite-stats | Protected operational endpoints; content tag invalidation must work on both deployments |
| OG images | `/api/og/{home,invite,exercise,match,endgame,victory/[id]}` | ImageResponse then native sharp JPEG conversion in all six handlers |
| Dev | `/dev/*`, `/api/dev/{theme-asset,labyrinth,publish,promote}`, Lite QA reset | Production-denial gates and local filesystem tooling; must be excluded or fail closed |

Primary evidence: both app `package.json` / `next.config.js`, `src/middleware.ts`, locale layouts/pages, `apps/web/src/lib/feature-flags.ts`, `mode-routing.ts`, `server/demo-signing.ts`, `server/crypto.ts`, `server/redis.ts`, `server/sync-blockchain.ts`, `lib/dev/dev-surface.ts`, `lib/server/after-response.ts`, all API route files and `.github/workflows/cron-*.yml`.

## Phase 2 — official vinext compatibility check

Installed public release: **vinext 1.0.1**. Its package metadata declares Node `>=22`, React / React DOM / React Server DOM Webpack `^19.2.6`, Vite `^8.0.0`, and the corresponding Vite RSC plugin. Node 22.23.2, already present on this computer, was used without changing the shell's default Node 20.

The checker implementation was inspected first: `check` invokes the static scanner; config is parsed rather than evaluated, and this command does not load app dotenv, initialize, build or deploy. The actual official CLI was then run twice:

```text
<existing-node-22> /tmp/chesscito-vinext-tooling/node_modules/vinext/dist/cli.js check
cwd: /tmp/chesscito-vinext-discovery/apps/landing
cwd: /tmp/chesscito-vinext-discovery/apps/web
```

| Application | Score | Supported | Partial | Unsupported | Process exit |
| --- | ---: | ---: | ---: | ---: | ---: |
| www | 94% | 15 | 2 | 0 | 0 |
| learn + play shared source | 91% | 24 | 3 | 1 | 0 |

These percentages measure detected patterns, not application correctness, Worker-native dependencies, security gates, performance, provider fees or production readiness. A zero exit code does not mean no issues.

### Compatibility and adaptation classification

| Finding | Apps | Classification | Required adaptation / implication |
| --- | --- | --- | --- |
| App Router, route handlers, metadata, navigation, headers/cookies, RSC | All | Compatible at framework level | Runtime and mobile regression checks still required |
| Next 14 / React 18 against current vinext peer requirements | All | Moderate adaptation; blocks an unchanged adoption | Move to a mutually compatible Next/React/toolchain set, or remove Next runtime as part of an explicit vinext migration. Keeping Next 14 + React 19 together violates current Next 14 peers. A parallel Next/vinext workflow needs compatible versions. |
| Node 20 default / root engine allows >=18 | All | Trivial adaptation | Specify Node 22+ for the future build toolchain |
| next-intl 4.12 | All | Moderate adaptation | Official scanner reports partial support and possible missing client intl context. Its request config auto-discovery replaces the Next plugin wiring. Verify EN/ES providers, dynamic imports, canonical paths and locale redirects. Landing's template-string message import also needs Vite verification. |
| App Router Strict Mode behavior | All | Trivial adaptation | Scanner flags differing Strict Mode handling; verify effects/subscriptions rather than assuming parity |
| Webpack customization | learn/play | Moderate adaptation | Transfer aliases/exclusions and needed externals to Vite; move source-fingerprint generation to the new build lifecycle and update bundle guards that expect `.next`. Arbitrary webpack side effects will not execute. |
| __dirname / __filename | learn/play | Compatible outside Worker runtime; trivial adaptation if scripts move to ESM | Scanner flags seven scripts: backup, restore-local, gen-board-grid-svg, grant-pro, reset-wallet, seed-supabase, threshold-piece-alpha. They are not runtime route dependencies established by this scan. Keep scripts in Node or update their ESM path handling. |
| sharp in six OG handlers | learn/play | Blocker for those unchanged routes | Native sharp cannot perform this conversion in Workers. Auto-stubbing a dependency does not implement `.jpeg().toBuffer()`. Use prebuilt cards, compatible rendering/output, or a separate already-costed service. ImageResponse support alone does not fix the second pipeline stage. |
| OG rasterization after removing sharp | learn/play | Moderate adaptation; Free-tier CPU feasibility unresolved | Rendering 1080×1350 cards and replaying dynamic games can still exceed the per-request CPU allowance on a cache miss. Prefer static/generic cards where possible. |
| Production/dev gating uses VERCEL_ENV / VERCEL | learn/play | Blocker before any publicly reachable test | Without those values, `isDevSurfaceEnabled()` permits tools and `canWriteBaseline()` permits filesystem writes. Introduce explicit platform-independent environment gating with a closed default; exclude local-only tools from Worker output where practical. |
| Persistent working-tree filesystem editing | learn/play dev tools | Blocker if hosting editors remotely is required | Worker fs is a virtual filesystem, not the repository checkout. Keep these editors local. This is not a blocker for production gameplay once unreachable code is separated. [Workers fs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/). |
| node:crypto / Buffer | learn/play; UUID on www | Compatible with the correct Workers compatibility settings | AES-GCM, hashes, HMAC, random bytes and timing comparison are covered by current Node compatibility. Separately measure ethers/viem signing/recovery CPU. [Workers crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/). |
| Supabase / Upstash REST | All | Compatible transport; moderate operational adaptation | Preserve server-only secrets, fetch policy, deadlines/retries and source of truth. No DB/Redis migration is required for hosting migration. |
| Privy / wagmi / WalletConnect | learn/play | Compatible architecture; moderate validation | Installed Privy 2.25.0 accepts React 18/19, Privy wagmi 1.0.6 and wagmi 2.19.5 accept React >=18. Peer acceptance is not a hydration/auth regression test. Preserve origin handling, custom auth domain and cross-app sessions. |
| Vercel origin/build identity variables | All, especially web | Trivial identity adaptation; moderate origin adaptation | Replace Vercel build SHA fallback and preview-origin assumptions; configure intended origins explicitly. Validate score/signing/early-access allowlists and mode redirects before moving traffic. |
| getMergedCatalog / cache tags | learn/play | Moderate adaptation | Cache API names pass the check; default in-memory storage is not durable or shared between Workers. Choose a persistent data strategy and prove invalidation across Learn/Play. |
| GitHub Actions schedules | All | Compatible scheduler; moderate workload adaptation | Existing schedules do not require Vercel Cron. Handler CPU/subrequest limits still apply when Actions calls a Worker over HTTP. Targets/secrets would need deliberate later configuration. |
| Blockchain sync catch-up | Shared web handler, primarily Play operations | Blocker to guaranteeing arbitrary backlog on Free | Block pagination and per-event writes are not capped to 50 external calls per invocation. Bound/checkpoint work or run the existing operation in separately budgeted compute. |
| Purge batching | Shared web handler | Moderate adaptation | Up to 20 delete batches of 5,000 rows plus lease operations; bounded calls, but parsing up to 100k returned identifiers is a CPU/memory concern. |
| Coach jobs / afterResponse | Primarily Play, shared web code | Moderate adaptation | Analysis is awaited; afterResponse defaults to awaiting. Do not convert reliable writes into fire-and-forget promises. waitUntil is not extra CPU allowance; its post-response lifetime is bounded. [Worker context](https://developers.cloudflare.com/workers/runtime-apis/context/). |
| Runtime labels and maxDuration=60 | www refresh; web operations/signing/OG | Trivial configuration adaptation; workload risk remains | These exports do not grant a Node server or a larger Workers Free CPU quota |

The officially recommended caching setup currently adds a Response Store backed by R2 and a SQLite Durable Object, optionally via another Worker. That is extra infrastructure to assess, not a free benefit established by the compatibility score. In-memory cache can be used initially, but cannot substantiate a shared-cache guarantee. [vinext caching guide](https://vinext.dev/docs/guides/caching).

## Phase 3 — Free-tier cost model

### Current limits checked

| Resource | Workers Free |
| --- | --- |
| Dynamic request allowance | 100,000/day **per account**, shared by applications; resets at midnight UTC |
| CPU | 10 ms per HTTP invocation; Free Cron execution also 10 ms |
| Memory / startup | 128 MB / 1 second |
| External subrequests | 50 per invocation; Cloudflare-service subrequests have a separate allowance |
| Simultaneous outgoing connections | 6 |
| Text variables + secrets | 64 per Worker; 5 KB per value |
| Worker code size | **64 MiB uncompressed; no compressed-size limit** |
| Static asset deployment | 20,000 files per Worker version; 25 MiB per file |

Network waiting is excluded from CPU. Repeated CPU overruns can terminate execution. Historical 3 MiB compressed bundle assumptions are not the current published limit. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Static Assets requests and storage have no additional charge when served directly. Worker-first routing causes matching asset requests to execute the Worker and consume its request allowance. [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

Workers Builds Free includes 3,000 build minutes/month, one concurrent build, a 20-minute timeout and 64 build variables of up to 5 KB each. These are build-service limits, distinct from runtime variables and CPU. [Workers Builds limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/).

### Traffic evidence

Current queries covered September 3 00:00 UTC through October 3 00:00 UTC, production only, filtered to the three Chesscito projects. Invocation counts, edge request counts, average CPU and p95 CPU all returned `payment_required`: Observability Plus is required. No plan was changed to obtain them. Schema discovery succeeded. [Vercel metrics access](https://vercel.com/docs/cli/metrics).

The billing CLI succeeded, returning an interval September 3 07:00 UTC through October 4 07:00 UTC. It returned **monetary service quantities across the team**, including a Pro line, Function Invocations ~$0.2535 and Fluid Active CPU ~$1.2183. This is not per-app traffic, a current plan confirmation, proof of pause cause, or a rate-card-independent way to recover requests/CPU. Do not divide dollars by an assumed price. The user-reported Hobby pause remains reported context, not independently diagnosed here. [Vercel usage CLI](https://vercel.com/docs/cli/usage).

Usable historical evidence exists in [the August 4 usage audit](2026-08-04-vercel-usage-http-400-audit.md), covering approximately 8.4 hours:

| Application | Historical function invocations | Daily equivalent if that sampled rate persisted |
| --- | ---: | ---: |
| www | 5,033 | ~14,380 |
| learn | 10,370 | ~29,629 |
| play | 13,462 | ~38,463 |
| Three-app sum | 28,865 | ~82,471 |

**This is a scenario, not a current forecast.** It is two months old, short, not a full UTC day, potentially affected by bucket alignment, and not confirmed here as production-only. The source audit specifically warns about calendar buckets and other projects. It does not establish current daily peaks or margin.

That audit also recorded 634,839 ms active CPU / 28,881 team invocations, an approximate team-wide mean of 22 ms. It includes non-Chesscito projects and supplies no per-app CPU distribution. Hardware, framework and accounting differ from Workers. It is a warning against assuming <10 ms, not proof that every migrated route would exceed the limit.

The October 2 performance audit's bounded log samples and HTTP timings are **not** traffic totals or CPU measurements. Wall latency includes transport, network waits and backend time. Client JavaScript long tasks are browser CPU, not Worker CPU.

### Per-app estimate and missing measurements

| Dimension | www | learn | play |
| --- | --- | --- | --- |
| Requests/day | Current unknown; historical scenario ~14.4k function calls/day | Current unknown; scenario ~29.6k | Current unknown; scenario ~38.5k, with duel polling growth risk |
| Expected CPU/request | Direct static delivery: no Worker CPU. Cookie redirect likely lightweight; SSR/stats require measurement | Cheap cached/read paths may fit; SSR and signature/recovery paths have meaningful >10ms risk | Greatest risk: chess validation/replay, signing, coach normalization, image rendering and catch-up |
| Static assets | 143 public files, 16.39 MiB aggregate | 915 shared public files, 47.66 MiB aggregate | Same inventory; separate deployment assets |
| Subrequests | Enter 0; stats page normally 1 Redis GET; successful emergency refresh ~9 base calls before retries/cache bookkeeping | Typical simple data reads 1–5 base calls; session/save/payment operations can be much larger | Same plus coach history and signing/game work; sync backlog can exceed 50 |
| Build minutes | No vinext build measured | No vinext build measured | No vinext build measured |
| Env names in source | 14 total: 7 public, 7 other including Vercel build SHA | 83 total: 37 public, 46 other including provider/system/test names | Same code inventory, actual enabled configuration differs |
| Worker bundle | Unmeasured; current `.next` output is not a vinext Worker | Unmeasured; native/editor imports require cleanup | Unmeasured; large server/OG dependencies require cleanup |

All public assets are below 25 MiB individually. Public asset totals are not Worker bundle size; compiled assets and prerendered responses add files to the final deployment inventory.

Numeric CPU values cannot honestly be estimated per Chesscito route from current evidence. For capacity planning only, use a **1–5 ms hypothesis for lightweight redirects/JSON handlers** and **10–20+ ms for uncached SSR/auth/large-payload handlers**; neither is a benchmark. The broad SSR/auth range is consistent with Cloudflare's guidance in the limits page. Both request tails and cold paths must be measured before accepting Free.

Build planning example, not a measurement: at 5 minutes for www and 10 each for Learn/Play, 60 complete three-app build sets/month would use 1,500 minutes. Preview builds, retries, installs and build-time prerendering must be included. Separate mode builds are needed if public mode flags are compiled in. The actual build must also finish within 20 minutes.

Do not create 83 runtime secrets/variables mechanically. Public configuration is ordinarily compiled into the relevant bundles, and provider/system/test names can be removed or supplied automatically. After those exclusions, the remaining non-public name inventory is about 37 for web; server use of any public configuration still needs correct build/runtime handling. Exact deployed bindings and build-variable counts remain unmeasured. A naive 83-variable runtime/build configuration exceeds Free limits.

### Subrequest and concurrency details

- Current landing refresh selects five emergency stats RPCs and disables on-chain, census and breakdown work. A normal successful refresh uses a lease SET, cooldown GET, five RPC calls, one atomic publication EVAL (which writes snapshot and cooldown), and lease release EVAL: approximately 9 network operations. Exceptional paths/retries add calls. Restoring the older full refresh changes the budget.
- Supabase RPCs are HTTP subrequests, not Cloudflare D1 queries. Upstash HTTP commands/retries also count as external fetches; auto-pipelining can reduce physical requests. Redis logical command counts are not automatically equal to fetch counts.
- `sync-blockchain.ts` paginates in 50,000-block chunks without a per-run range cap. Each score writes separately; victories additionally fetch their block. Passport can fetch ten scores concurrently. This threatens both the external-call budget and outgoing connection handling. Chunk checkpointing must preserve authoritative sync behavior.
- Coach operations read/write multiple Redis keys, validate moves, consult entitlements and potentially backfill/history-read before/after the LLM call. Retries and game/history length determine the real request CPU/call count. Treat 50 as a per-invocation bound, not a daily allowance.
- Purge performs up to 20 large delete-return batches. It may fit the fetch count while exceeding CPU/memory; neither was tested against production.

### Request growth scenarios

Budget the **combined account**, including bots, RSC navigation/prefetch, redirects, APIs, previews, cron calls, cache-service requests and any unrelated Workers. Three hostnames do not provide three independent 100k allowances.

```text
daily_counted_requests = www + learn + play + auxiliary/other usage
required: daily_counted_requests < 100,000, with operating headroom
```

The historical scenario leaves only ~17.5k/day before other usage and architectural differences. It does not justify a guarantee.

Play duels poll every 3 seconds while active, every 1.2 seconds while waiting, and skip hidden-tab reads until visibility returns. Ignoring fetch latency, one visible client in an active ten-minute match can add ~200 polls; two players add ~400. A full one-hour waiting invitation can approach ~3,000 polls. These are upper-cadence scenarios; the implementation schedules the next delay after the fetch completes. About 250 such two-player matches alone can consume 100k requests, before other application traffic. Preserve terminal and hidden-tab stopping behavior.

### Added services and the strict zero-cost requirement

Avoid adding an Images service merely because the adapter offers it: current apps do not use next/image, and prebuilt AVIF/WebP/static cards can avoid runtime transforms. If any paid service is proposed later, it fails the strict $0 objective unless its actual Free allowance and account configuration cover the workload.

If KV is introduced for persistent framework data, Free includes 100k reads/day, 1k writes/day and 1 GB storage; expiry/revalidation fan-out and cache metadata can consume these independently of Worker requests. [KV limits](https://developers.cloudflare.com/kv/platform/limits/).

A default Response Store would also require a separate budget for R2, Durable Objects and possibly cache Worker calls. This discovery does not authorize or assume provisioning those services. Existing Redis may be an adaptation option rather than adding infrastructure; its pricing and semantic suitability still need checking.

**Free-tier failure behavior matters:** a zero bill does not mean continuous availability when a daily allowance is exhausted or an invocation is terminated. Do not automatically upgrade plans as part of a migration with a hard $0 target.

## Phase 4 — static versus dynamic

SSG compatibility is not proof that a response bypasses execution. Vinext's Static Assets response adapter prerenders immutable responses but retrieves them through the Worker; runtime revalidation cannot update packaged responses. Its prerenderer skips dynamic API/searchParams pages. A true static export/direct asset-serving path is a separate design choice. Private framework cache artifacts must remain protected. [vinext caching](https://vinext.dev/docs/guides/caching).

| Route / resource | Current reason for execution | Opportunity / constraints |
| --- | --- | --- |
| www locale home | Reads onboarding cookies on server | A static carousel shell with browser-selected returning state could remove per-user SSR. Must preserve correct initial slide/cookie behavior and avoid showing cached personal choices. |
| `/classic`, `/pricing`, informational pages | Static presentation; some localized pages depend on provider setup | Explicit prerender/static delivery; verify metadata and locale routing. Middleware alone can still count as Worker execution. |
| www `/stats` | force-dynamic, language header and Redis snapshot read per visit | Cache public presentation in a small normalized locale set, or separate a static UI from a public snapshot read. Preserve stale/unavailable states, noindex/nofollow and containment. Never rebuild aggregate stats on visitor traffic. |
| www `/api/enter` | Cookie-setting redirect | Keep dynamic unless onboarding cookie write moves to the browser. Do not share-cache Set-Cookie responses. |
| www refresh/revalidate | Protected writes/cache invalidation | Remain dynamic; small scheduled request volume does not waive CPU limits. |
| Learn/Play home | Server query parsing for legacy/piece/action/sheet | Move presentation-only query parsing to a client boundary if approved; retain deep links and redirects. Today it is unnecessarily dynamic for its largely static shell. |
| `/exercises` | Query setup plus optional server content overlay | Browser query state and static/build snapshot could reduce work; an immutable snapshot changes live-admin content semantics. Preserve overlay stage and cross-deployment invalidation if runtime updates remain required. |
| `/arena`, minigames, trophies, legal/help shells | Mostly browser state/gameplay | Explicit prerendering; browser engine work does not consume Worker CPU. Account data APIs remain dynamic. |
| Web `/stats` and obsolete hub aliases | Redirect-only behavior | Asset redirect rules can avoid rendering where possible; retain locale/query contracts. Cross-mode locale redirects may still need a lightweight Worker. |
| Public leaderboards / access capacity | Public read responses | Bounded, canonical cache keys; capacity already authors short shared cache headers. Cache failures/refresh policy must not admit unauthorized access. |
| Account, balance, inventory, entitlements and inbox | Wallet-dependent; several GETs mutate/backfill | Keep private/dynamic unless identity and side effects are fully separated. Never use a blanket shared-cache rule for `/api/*`. |
| OG home/invite | Rendering repeats mostly fixed art | Prebuild generic cards; serve direct assets. Theme changes need build/version updates. |
| OG exercise/match/endgame/victory | Query/token-dependent rendering | Finite exercise variants can be prebuilt. Match/victory variants need an explicit finite/static or compatible generation strategy; edge hits cannot save a failing first render. |
| JS, CSS, fonts, art, manifest/icons | Static resources | Serve from Static Assets before the Worker. Immutable caching for content-hashed/versioned files; mutable art URLs need versioning or shorter cache lifetimes. |
| Dev/editor surfaces | force-dynamic and filesystem authoring | Keep local; deny or exclude in production. Denying a request cheaply is preferable to invoking heavyweight unreachable tools. |

Caching inside `caches.default`, KV, vinext middleware or a response adapter does not inherently remove the incoming counted request. Current Workers Cache-served requests also count at the request rate; CPU savings and request savings must be modeled separately. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Phase 5 — migration order

| Order | App | Difficulty | Changes needed | Operational risk | Free-tier likelihood |
| --- | --- | --- | --- | --- | --- |
| 1 | www | Low–moderate relative to the others; framework upgrade is still material | Compatible React/Next/toolchain, next-intl verification, static-first public routes, onboarding cookie strategy, explicit stats caching/refresh budget | Lowest: no wallet/payment signer; main risk is onboarding or stats refresh regression | High for optimized hosting at modest traffic; conditional for current dynamic implementation; total stack $0 unverified |
| 2 | learn | Moderate–high | Shared OG replacement, closed dev gates, Vite config/build guard adaptation, content data-cache/invalidation strategy, static shell/query cleanup, crypto/score API profiling | Scores, balances, entitlements, auth sessions, content integrity | Plausible after adaptation; cannot certify with current metrics and no workerd CPU measurements |
| 3 | play | High | All shared changes plus bounded sync/purge, game/coach/signature CPU work, compatible dynamic share strategy and polling budget | Highest: payments, authoritative records, seat state, AI credits, signer and history integrity | Low for full unchanged behavior; conditional after reducing or separately budgeting expensive work |

Because Learn and Play share `apps/web`, most preparation must be made once and verified in both modes. Migrating Learn first does not by itself eliminate Play handlers from its bundle.

## Phase 6 — answers A–H

**A. Can www run at $0?** Likely yes for Cloudflare hosting after adaptation and a static-first design, provided dynamic requests/CPU and any cache-service quotas fit. Cookie SSR and stats refresh need validation. No unconditional all-infrastructure $0 guarantee is established.

**B. Can learn run at $0?** Plausible after shared blockers are fixed and all critical score/session/wallet paths pass the Free CPU budget. Its primarily browser-based exercises help. It is not ready to migrate unchanged.

**C. Can play run at $0?** Not defensibly with the current full server behavior unchanged. Native OG conversion is incompatible; worst-case sync exceeds the external-call design budget; CPU-heavy paths and polling make Free operations uncertain. A reduced/precomputed/bounded implementation could fit, but that would be a later engineering decision and still requires measurements.

**D. Is vinext appropriate?** Yes for a controlled evaluation and likely www first. Cloudflare recommends it; the official checker found mostly supported API usage. Treat its beta designation in the current Cloudflare guide, partial next-intl/config coverage and React/toolchain upgrade as real migration work, not a production guarantee.

**E. Does any feature require OpenNext instead?** No required feature established here mandates OpenNext. Current common framework APIs are supported by both paths. OpenNext can preserve more of the Next build workflow if a concrete vinext library/build regression appears. It does not provide native sharp, persistent repo editing or larger Free CPU limits. Do not assume a current OpenNext release supports Next 14 unchanged: its published version guidance contains a planned Q1 2026 support drop, so that exact version pairing must be reverified before choosing it. [OpenNext support guidance](https://opennext.js.org/cloudflare), [Cloudflare OpenNext guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/).

**F. Biggest Free-tier risk?** The **10 ms CPU limit per invocation**, especially cache misses, SSR, cryptographic recovery/signing, chess replay, OG rendering and catch-up. The second risk is the shared daily request budget, particularly duel waiting/polling. Fewer users or a higher cache-hit rate cannot make an incompatible native call or an oversized miss reliable.

**G. Which app first?** www, then Learn, then Play. www isolates the framework/locale/assets experiment from wallet and payment correctness.

**H. Changes before the first test deployment?** The following is a future prerequisite list, not implemented work:

1. Pin the chosen vinext/toolchain versions; use Node 22+; establish a compatible React/Next version set and preserve script compatibility when converting config to ESM. Run existing meaningful tests after that separately authorized work.
2. For www, verify next-intl client context, locale imports and middleware, cookie routing, and metadata. Choose explicitly which pages prerender, which assets bypass execution, and which dynamic endpoints remain.
3. Choose the cache topology deliberately. Do not accept default provisioning of R2/DO/cache Workers or assume their quotas. Preserve the stats containment design; bound its handler and cache the public read separately from protected refresh.
4. Inventory actual build/runtime variables by name and keep each configured set within limits. Supabase service credentials, Redis credentials and signer material remain server-only. Set correct public origins and preview/production identities.
5. Before any web-mode test, close the Vercel-specific dev/editor/QA gates and replace all six native OG paths, including the shared root metadata's `/api/og/home` dependency. Transfer needed webpack aliases/externals and build-fingerprint/bundle checks to Vite.
6. Define a local workerd validation matrix using synthetic data/mocks: mobile 390px EN/ES home, redirects, content overlay, existing score/session verification, signing/receipt checks, Privy/MiniPay hydration and closed dev routes. Test both Learn/Play modes; no production writes are needed.
7. Measure final Worker upload size, startup, memory, CPU distribution/cold paths and fetch counts locally first. Define acceptance margins below 10 ms and 50 external fetches for every required handler, rather than accepting only an average.
8. For Play, bound/checkpoint sync and purge; quantify polling and coaching requests. Preserve idempotency, credit accounting and authoritative state. Assess all third-party plans against the separate total-infrastructure $0 target.
9. Plan a later isolated preview with non-production credentials/data, retained rollback and a combined-account request budget. Leave production domains, workflow destinations, Vercel and Supabase unchanged until that separate phase is authorized.

## Unresolved evidence required for a production decision

Current per-app daily traffic/peaks and bot/RSC/static breakdown; current route CPU tails; final vinext Worker bundle/startup; exact variable/binding counts; actual build times; workerd compatibility of all critical imports; next-intl hydration behavior; durable content invalidation semantics; current external provider plans/usage; and the business acceptability of simplifying dynamic OG or heavy jobs.

These gaps prevent a guarantee, but not the architectural diagnosis: **www is the best zero-cost candidate; Learn is conditional; unchanged full Play is not a sound Free-tier commitment.** Work stops at diagnosis.
