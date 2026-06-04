# Talent Protocol API — Reference (Deferred Integration)

**Date:** 2026-06-03
**Status:** Deferred — see decision below
**Discovery source:** Wolfcito session 2026-06-03 (intake form + /stats UX cluster)
**Related decision:** `_bmad-output/planning-artifacts/ux-stats-refactor-spec-2026-06-03.md` §5.11

---

## Why this file exists

Talent Protocol surfaces three valuable metrics on Chesscito's public project page that we do NOT track today: **DAU**, **Transactions**, **Gas Fees** — over 7D / 30D / 90D / 1Y windows, with deltas vs prior period.

These metrics align directly with MiniPay readiness §8 ("Coming next" items in our /stats MVP). Integrating them programmatically would close part of that gap.

We chose **NOT to integrate now** because:

1. Intake form already closed; immediate listing path doesn't require it.
2. Integration estimated at 5–8h (API key procurement + client + cache + fallback + UI + tests).
3. The `External Verification` link block in /stats §5.11 already gives the reviewer one-click access to the same dashboard at zero engineering cost.
4. Stage 2 callback hasn't happened yet; if MiniPay reviewer asks for tighter DAU integration, we'll know with concrete feedback rather than speculation.

This file captures what was learned so re-discovery isn't required when integration is unblocked.

---

## API base + endpoints discovered

**Base URL:** `https://api.talentprotocol.com`

**Project endpoints (relevant to Chesscito /stats):**

| Method | Path | Use |
|--------|------|-----|
| GET | `/projects` | List all projects |
| GET | `/projects/contributed_projects` | Projects the authenticated user contributes to |
| GET | `/projects/:project_slug` | Single project by slug — **most likely contains impact metrics** |

**Sample probe (no auth, headers only):**

```bash
curl -L 'https://api.talentprotocol.com/projects' \
  -H 'Accept: application/json'

curl -L 'https://api.talentprotocol.com/projects/contributed_projects' \
  -H 'Accept: application/json'

curl -L 'https://api.talentprotocol.com/projects/:project_slug' \
  -H 'Accept: application/json'
```

---

## Chesscito's Talent project handle

- Project ID (UUID, used in public URL): `e850a453-2b0c-4080-a070-781d712791a7`
- Public project page: https://talent.app/~/projects/e850a453-2b0c-4080-a070-781d712791a7
- Data sources Talent tracks for Chesscito (per public page Impact tab):
  - `0x1681…63959a` (CELO)
  - `0x0ee2…abeeb0` (CELO)
  - `0x2484…a1f74b` (CELO, UTILITY — proxy admin pattern)
  - `0xf927…4a6739` (CELO, UTILITY — **= Badges proxy `0xf92759E5525763554515DD25E7650f72204a6739`**)
  - `akawolfcito/chesscito` (GITHUB, PUBLIC)

The `:project_slug` parameter likely accepts either the UUID or a human slug — confirm at integration time.

---

## Protocol concepts (sidebar overview)

Talent Protocol's documented core concepts are builder-centric:

- **Profile** — unified builder identity
- **User** — verified individual
- **Account** — third-party connection (wallet, GitHub, X)
- **Data Point** — verified fact (GitHub stars, wallet tx counts)
- **Event** — historical reputation change record
- **Builder Rank** — primary builder ranking

Plus:

- **Data Issuer** — entity that attests data
- **Human Checkmark** — verification primitive
- **Socials** — social account connections

`Project` is NOT one of the documented core concepts, but `/projects` endpoints exist — suggesting projects sit on top of the protocol primitives rather than being primitives themselves. Impact metrics may live behind the project endpoint as derived/aggregated data.

---

## Auth model (assumed, verify at integration)

- API Key required for most endpoints (industry pattern).
- Get key flow not yet probed — start at `https://docs.talent.app/docs` "Get your API Key" section.
- Auth header most likely `Authorization: Bearer <KEY>` (Talent default) or custom `X-API-KEY`.

---

## Open questions for integration time

1. **Does `GET /projects/:project_slug` return DAU / transactions / gas fees fields?** Probe with curl + API key to confirm response shape before designing UI.
2. **Are the metrics returned as totals or as time-series (daily buckets)?** Determines whether sparklines are possible from the same endpoint or require a separate one.
3. **What period selectors does the response support?** (7D, 30D, 90D, 1Y match the dashboard UI — confirm query param name like `?period=30d`).
4. **Rate limits + pricing?** Self-serve free tier? Bands? Hard cap?
5. **Is the project slug the UUID or a human-readable slug?** Both should be tested.
6. **Cache TTL discipline** — Talent's dashboard is "Updated today"; our hourly revalidation matches that cadence. Align cache key strategy accordingly.

---

## When to revisit integration

Open the integration cluster IF AND ONLY IF one of these triggers fires:

- MiniPay Stage 2 reviewer asks for DAU / on-chain gas fees as blocker for listing.
- Talent.app publishes pricing AND it's free tier or <$50/mo for our query volume.
- A larger telemetry/analytics cluster opens for another reason (logical bundle per HARD RULE `bundle-dont-defer`).
- Chesscito sustains >1k DAU and the analytics-grade integration becomes meaningful business-wise.

Until then, the `External Verification` link in /stats §5.11 is sufficient.

---

## Cross-refs

- /stats refactor spec: `_bmad-output/planning-artifacts/ux-stats-refactor-spec-2026-06-03.md`
- /stats MVP architecture: `docs/audits/2026-06-03-stats-mvp-architecture-audit.md`
- MiniPay readiness audit: `docs/audits/2026-06-03-minipay-submission-readiness-audit.md` §3 item 8 (Stats coverage)
- MiniPay submission packet: `docs/audits/2026-06-03-minipay-intake-form-packet.md`
