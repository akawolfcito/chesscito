# P0-4 — MiniPay Zero-Click Runtime Checklist

**Date:** 2026-06-03
**Cluster:** MiniPay readiness P0-4
**Mode:** Read-only validation on physical Android device
**Target URL:** `https://www.chesscito.com` (production, NOT a preview)
**Production HEAD at start of test:** `9139c393` (or whatever `git rev-parse origin/production` reports at run time)

> **Goal:** Verify that opening the canonical production URL inside the real MiniPay Android WebView triggers **zero-click wallet detection + auto-connection**, with no manual "Connect Wallet" prompt anywhere in the golden path. No edits this session — only observation + evidence capture.

---

## 0. Pre-flight (before opening MiniPay)

| # | Step | Pass criteria | Evidence to capture |
|---|---|---|---|
| 0.1 | Confirm Android device has MiniPay installed | App icon present, launches to home | — |
| 0.2 | Confirm MiniPay version | Open MiniPay → Settings/About → record version string | Screenshot of version screen |
| 0.3 | Confirm MiniPay wallet has any CELO/cUSD balance (even dust) | Balance visible on MiniPay home | Screenshot |
| 0.4 | Note device model + Android version | e.g. "Pixel 6a / Android 14" | Settings → About phone screenshot |
| 0.5 | Connect device to laptop via USB (only if remote debugging is attempted) | Device authorizes ADB; `chrome://inspect` lists the WebView | Screenshot of chrome://inspect listing |
| 0.6 | Confirm `origin/production` HEAD on laptop | `git rev-parse origin/production` matches what's deployed | Paste hash into evidence note |

If 0.5 fails (no ADB, no laptop, no auth), proceed without console logs — visual + behavioral evidence is sufficient per user directive.

---

## 1. Golden path — zero-click validation steps

Each step is **observation only**. Do NOT tap anything beyond what the script prescribes. If a step asks for an unexpected manual action (e.g. "Connect Wallet" button visible), that itself is the failure signal.

### Step 1.1 — Open URL inside MiniPay

| Aspect | Expected | Actual | Pass? |
|---|---|---|---|
| Entry | Open MiniPay → Discover/Apps tab → paste `https://www.chesscito.com` in the in-app browser (or tap a saved bookmark if present) | — | — |
| Initial load | Landing renders | — | — |
| Layout | 390px-aligned, no horizontal scroll, no overflow | — | — |
| Telemetry | First-paint within ~2s on warm cache, ~4s on cold | — | — |

**Evidence:** screen recording from this step through Step 1.6, OR sequential screenshots at each transition + timestamps.

### Step 1.2 — Detect MiniPay context

| Aspect | Expected | Actual | Pass? |
|---|---|---|---|
| `window.ethereum.isMiniPay` | `true` (if remote debugging is up, verify via DevTools console) | — | — |
| Visual MiniPay indicator | If app shows a "MiniPay detected" hint/badge, it appears without user action | — | — |
| No connect modal | RainbowKit/WalletConnect modal does NOT appear | — | — |

If remote debugging is NOT available, this step is satisfied by Step 1.3 success.

### Step 1.3 — Auto-route landing → `/hub`

| Aspect | Expected | Actual | Pass? |
|---|---|---|---|
| Landing → /hub | Without tapping anything, app routes to `/hub` (or the user is parked on landing with the MiniPay-aware CTA already armed) | — | — |
| Timing | Route transition within ~2-3s of landing render | — | — |
| Console errors | Zero red errors logged (if remote debugging is up) | — | — |

> Note: if current production routes landing → /hub only on CTA tap (not auto), record that fact verbatim — it is the surface-level finding and informs whether the listing should expect auto-route or one-tap.

### Step 1.4 — `/hub` shows connected state, NO manual Connect button

| Aspect | Expected | Actual | Pass? |
|---|---|---|---|
| Hub HUD | Connect pill shows truncated address OR ProBadge (if PRO), NOT the "Connect Wallet" CTA | — | — |
| KingdomAnchor + tile rail | Renders with daily-tile content gated to today's tactic (no skeleton stuck) | — | — |
| LCP image | `bg-new-hub.avif` renders without visible delay | — | — |
| Any modal | No wallet modal, no terms modal blocking interaction | — | — |

### Step 1.5 — Account / Profile sheet shows wallet bound

| Aspect | Expected | Actual | Pass? |
|---|---|---|---|
| Open account sheet | Tap account icon in HUD → sheet opens | — | — |
| Wallet address | Sheet shows the user's MiniPay address (truncated 0x... pattern) | — | — |
| Identity surfaces | If ODIS phone-first is wired, shows phone-derived identity; otherwise plain address | — | — |
| Disconnect option | If present, is intentional and does NOT autodisplay | — | — |

### Step 1.6 — Shop or balance-reading flow returns live data

| Aspect | Expected | Actual | Pass? |
|---|---|---|---|
| Open Shop OR a balance-aware tile | Sheet renders | — | — |
| Balance display | Shop pricing or HUD pill reads a real balance (does not stay "—" / 0 / skeleton) | — | — |
| Provider chain | Reads from Celo Mainnet (42220) — confirm via UI hint or via DevTools call if debugging | — | — |
| Errors | Zero RPC error toasts in 30s of dwelling | — | — |

> **DO NOT** trigger a real mint or any tx that spends funds in this validation. Mint is out-of-scope for P0-4; reserved for a fund-prepared session.

---

## 2. Evidence package format

Per step, capture:

1. **Screenshot or short clip** (≤10s ideal per step; full recording for steps 1.1-1.6 is acceptable).
2. **Timestamp** (HH:MM:SS, device clock).
3. **Result line:** one of `PASS`, `PARTIAL: <what was off>`, `FAIL: <observed behavior>`.
4. **Notes:** any unexpected modal, latency, console error.

At the end of the run, drop everything into:

```
docs/audits/2026-06-03-minipay-zero-click-runtime-results.md
```

Template skeleton for results doc (write after the run):

```markdown
# P0-4 Runtime Results — MiniPay Zero-Click

- **Date / time:** YYYY-MM-DD HH:MM (timezone)
- **Device:** <model> / Android <version>
- **MiniPay version:** <version>
- **URL:** https://www.chesscito.com
- **Production HEAD:** <hash>
- **Remote debugging used?** yes/no

## Step-by-step

| Step | Result | Notes |
|---|---|---|
| 1.1 open URL | PASS / FAIL | … |
| 1.2 detect MiniPay | … | … |
| 1.3 auto-route | … | … |
| 1.4 hub no-connect | … | … |
| 1.5 account wallet | … | … |
| 1.6 balance read | … | … |

## Summary

- Zero-click confirmed? yes / no / partial.
- Blockers found: …
- Next action: …

## Evidence

(Embed/link screenshots, recordings.)
```

---

## 3. Failure handling

| Failure mode | Triage | Next action |
|---|---|---|
| Manual "Connect Wallet" modal appears on landing or /hub | wagmi/RainbowKit not detecting `window.ethereum.isMiniPay`, OR connector priority wrong | Open spec for connector audit; do NOT patch in this session |
| Hub renders but address shows blank | `useAccount()` returning empty despite provider injected | Capture exact state via DevTools; cluster spec for connector wiring |
| Provider injected but balance reads time out | RPC failure (Forno / fallback) | Cross-reference founder-status memory — likely same Forno class; note in results, NOT a P0-4 blocker per se |
| MiniPay browser refuses to open URL / shows error | DNS / cert / CSP / `X-Frame-Options` issue at edge | Capture URL bar + error verbatim; verify www apex serves 200 from regular browser |
| Auto-route does not fire, landing stays as is | Could be by design — record what user-action sequence reaches `/hub` instead | Mark PARTIAL not FAIL until product intent is confirmed |
| Console floods with warnings (chunk load, hydration mismatch) | Note in results, capture top 3 entries | Schedule audit but does not block P0-4 sign-off if visual flow is clean |

---

## 4. Out-of-scope for this validation

The following are explicitly **NOT** validated in P0-4 to keep blast radius narrow:

- Real mint transaction (requires funded test plan).
- iOS MiniPay flow (user deferred; Android-only this pass).
- Performance metrics on device (covered in /hub Lighthouse cluster, separate concern).
- Preview deployments — production only.
- Founder-status, Labyrinth, ODIS, wagmi/RainbowKit lazy refactor (user-prohibited surfaces per session brief).

---

## 5. Sign-off rule

P0-4 is closed when:

1. Steps 1.1 → 1.6 all show `PASS` on at least one fresh cold-boot of MiniPay (kill app + relaunch + open URL).
2. Results doc committed under `docs/audits/2026-06-03-minipay-zero-click-runtime-results.md`.
3. MEMORY.md gets a one-line entry pointing to that results doc.
4. MiniPay readiness checklist count moves from 6/9 → 7/9.

If any step shows `FAIL` or `PARTIAL`, P0-4 stays open; the failure becomes its own cluster spec (`docs/superpowers/specs/...-minipay-zero-click-<topic>.md`) for a follow-up session — no patches inside this validation pass.

---

## 6. After the run

- Commit results doc: `docs(audits): record MiniPay zero-click runtime P0-4 results`.
- No production promote needed (docs-only).
- Update MEMORY.md with project entry `minipay-zero-click-p0-4-<result>`.
- If PASS, update README "What's live" only if a user-facing surface changed (none expected — runtime validation).
