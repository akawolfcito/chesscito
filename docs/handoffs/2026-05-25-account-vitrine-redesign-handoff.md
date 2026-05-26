# Handoff — Account Refactor + Vitrine HERO BAND Pattern (2026-05-25)

**Owner:** Wolfcito · **Co-pilot:** Sally (UX) + Claude
**Session window:** 2026-05-25 evening
**Branch:** `main` — **6 commits ahead of origin/main** (push pending)

## TL;DR

Shipped two intertwined arcs in one session:

1. **AccountSheet redesign** (vertical row layout, Manage PRO unified, EN/ES locale switcher fix, About link relocation, compact mode).
2. **Vitrine visual-presence pass** — Badges / Trophies / Leaderboard sheets now open with a HERO BAND anchor (cream-amber panel + character overflow + glance-able stats). Each surface keeps its own identity (wolf wizard / trofeo-épico / corona-pro) but shares the structural rhythm so the three vitrines read as a coherent family.

UX direction (Sally + Wolfcito): the dock stays at **5 slots**. Trophies earns its slot because of the "Immortal Game" thesis — collectibles with long-term latent value. Each slot must defend its existence narratively, and the HERO BAND is how it does so visually.

## Commits in this session (oldest → newest, all on `main`)

| SHA | Type | Summary |
|---|---|---|
| `e75f32d3` | `chore(art)` | Account icons triplet (wallet/network/language) + regen siblings |
| `0c9f7bca` | `refactor(badge-sheet)` | Drop redundant Trophies + About footer; remove orphan prop |
| `582b0bef` | `feat(account)` | Vertical row layout + Manage PRO unified + EN/ES switcher hard-nav fix |
| `fc564869` | `feat(empty-states)` | Badges + Trophies promise-first copy |
| `d513eef6` | `chore(leaderboard)` | Hide passport verify banner until Celo-native |
| `8ef4cb34` | `feat(badge-sheet)` | HERO BAND — wolf wizard + piece preview |
| `1f27eb65` | `feat(trophies)` | HERO BAND — trofeo-épico + victories overview |
| `e600cf30` | `feat(leaderboard)` | HERO BAND — corona-pro + champion overview |

**Push:** `git push origin main` — owner does this manually per session convention.

## Architectural decisions to remember

### Dock — keep at 5 slots
Sally + Wolfcito agreed: each slot defends its existence under the lens of "user journey + reward narrative".

| Slot | Why it stays |
|---|---|
| Badges | NFT vitrina #1 — piece-mastery collection; wallet-connect driver |
| Shop | Revenue lever #1 |
| Center (Arena ↔ Pieces) | Core gameplay swap |
| Trophies | NFT vitrina #2 — match-outcome collection with **Immortal Game** latent-value thesis |
| Leaderboard | Competition + cognitive-mission narrative |

Trophies was nearly dropped early in the conversation, but Wolfcito's narrative ("a game might not be known as great until much later, like The Immortal — Ella analyzes and tags it retroactively, making the NFT economically + pedagogically valuable over time") reframed it from vanity to thesis.

### HERO BAND pattern — reusable across vitrines
**Composition:**
```
┌──────────────────────────────────────┐
│ [anchor]  EYEBROW                    │
│ [char]    ──────────                 │
│           Stats line                  │
│           Sub line (dynamic)          │
│           ████░░░░ (progress, opt)   │
└──────────────────────────────────────┘
```

**Shared rules:**
- Panel: cream-amber gradient (`rgba(255, 245, 215, 0.95)` → `rgba(252, 211, 77, 0.55)`) + double border + `min-height: 7.75rem`
- Anchor: 7.75rem × 7.75rem, `position: absolute`, `left: -1.25rem`, `bottom: 0` (intentional overflow on the left + sit on the bottom border)
- Stats: warm brown tone with cream text-shadow

**Surface-specific accents:**
| Surface | Anchor asset | Progress color | Notes |
|---|---|---|---|
| Badges | `/art/scene-rooted/avatar-chesscito` (wolf wizard) | Emerald | 6 piece thumbnails inline (claimed full-color + amber glow, locked ghosted) |
| Trophies | `/art/action-row/trofeo-epico` | Purple | Dynamic sub-line: "Your best: X moves · Ys" OR "Your first victory awaits" |
| Leaderboard | `/art/screen-mission/corona-pro` | (no bar) | Stats truncates with ellipsis for long wallet hex |

**CSS lives in:** `apps/web/src/app/globals.css` — search `.badge-vitrine-hero`, `.trophy-vitrine-hero`, `.leaderboard-vitrine-hero`.

### Copy principle extracted from Wolfcito feedback
> PROMISE in ≤5 words + microcopy (1 line) — lead with the REWARD, not the action, and avoid web3 jargon (NFT, mint, web3, chain) on entry surfaces. The audience is visual-first and scans; "coleccionable digital para toda la vida" beats "NFT permanente" every time.

Empty state copy now ships as:
- Badges (0 stars): `"Master the Rook — claim your first digital collectible."`
- Trophies (no victories): `"Every victory, yours forever."` + `"Win a match and earn a digital collectible. Yours for life."`

## AccountSheet redesign — what's in production now

Five uniform `candy-tray` rows (replaces card + grid-2x1 + ghost button + CTA stack):

1. **Wallet** — icon · label · `0x09…eba4` · copy button
2. **Network** — icon · label · pill `CELO` ✓
3. **Manage PRO** — `corona-pro` icon · label · pill `ACTIVE`/`INACTIVE` → entire row clickable to ProSheet
4. **Language** — icon · label · `<LocaleSwitcher>` inline (compact EN/ES segmented)
5. **Disconnect** — rose close icon · rose label → entire row clickable

Footer: MiniPay hint + `About Chesscito` link.

**Locale switcher fix worth remembering:** `router.replace(pathname, { locale })` silently no-op'd because `usePathname()` could return null OR a locale-included path. Solution: read raw URL from `window.location.pathname`, strip any locale segment via regex, prepend new locale, then `window.location.assign()`. Hard nav bypasses next-intl router edge cases entirely.

**ES kill-switch trap:** `NEXT_PUBLIC_I18N_ES_READY` must be set to `1` in `apps/web/.env.local` (NOT repo-root `.env.local` — Next.js in monorepos only reads from app-local env). Without it, the middleware 307-redirects every `/es/*` request back to `/en/*`, making the switcher visually do "a reload that stays in EN".

## VR baseline drift note

After running `pnpm test:e2e:visual` we hit a tiny `hub-clean` diff (~2761 px, 0.01 ratio) caused by the non-deterministic asset regen via `optimize-assets.sh` (pngquant / avifenc don't produce bit-identical output across runs). On a refresh pass the snapshots auto-tolerated and 13/13 passed. **Open question** (also already in earlier session memory): worth investigating fixed seeds or per-file regeneration to stop this from recurring on every art change.

## Open / next-up

| # | Item | Why it matters |
|---|---|---|
| 1 | **Push the 6 local commits to origin/main** | Working tree shipped, just needs `git push` |
| 2 | **Coach (Diario) visibility — open the conversation** | PRO value-prop currently buried in HUD. Wolfcito flagged this as the next big UX call once vitrines were stabilized. 3 paths pre-discussed (A hub-card for active PROs / B section inside Profile / C dock-adaptive slot for PROs). Decision-level, not implementation. |
| 3 | **VR baseline regen non-determinism** | Long-tail. Consider seeded encoders OR a manifest of "intentional" regenerations vs "noise" regenerations. |
| 4 | **Hero band v2 ideas (deferred)** | Wolfcito hinted at deeper visual polish later. Candidates: animated character (wolf idle), trophy parallax on scroll, leaderboard podium graphic, sparkle particles on claimed pieces preview. |

## Files touched in this session

```
apps/web/src/app/globals.css                                # 3 hero band CSS blocks (+ misc)
apps/web/src/app/[locale]/arena/page.tsx                    # drop onNavigateToTrophies callsites
apps/web/src/components/exercises/badge-sheet.tsx           # cleanup + HERO BAND + hint
apps/web/src/components/exercises/exercises-screen.tsx      # AccountSheet vertical rows + About link
apps/web/src/components/exercises/leaderboard-sheet.tsx     # disable verify banner + HERO BAND
apps/web/src/components/exercises/__tests__/badge-sheet.test.tsx
apps/web/src/components/hub/hub-scaffold-client.tsx         # update useBadgeSheetState call
apps/web/src/components/i18n/locale-switcher.tsx            # compact EN/ES + hard-nav fix
apps/web/src/components/profile/profile-sheet.tsx           # About link
apps/web/src/components/trophies/trophies-body.tsx          # HERO BAND
apps/web/src/lib/badges/use-badge-sheet-state.ts            # drop options arg
apps/web/src/lib/badges/__tests__/use-badge-sheet-state.test.tsx
apps/web/src/lib/content/editorial.ts                       # new hero/empty-state keys
apps/web/src/lib/content/messages/es.ts                     # ES translations for new keys
apps/web/public/art/new-assets-chesscito/account/*.{png,webp,avif}   # 3 new icons
apps/web/public/art/**                                       # regen siblings via optimize-assets.sh
```

## Test status snapshot

- TypeScript: clean from `apps/web`
- Vitest (badge sheet + use-badge-sheet-state): **18/18 passing**
- Playwright VR: **13/13 passing** after baseline auto-tolerance

Full suite was NOT run this session — only the changed surfaces' specs. Worth a full pass when the push happens.

---

**Next session, start here:** read `MEMORY.md` index first, then this handoff. Then either push the 6 commits or open the Coach (Diario) visibility conversation per Wolfcito's preference.
