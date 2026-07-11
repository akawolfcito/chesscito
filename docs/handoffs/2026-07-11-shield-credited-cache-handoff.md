# Handoff — Shield credited-cache refresh (2026-07-11)

**Branch:** `main` @ `367419b9` (PR [#213](https://github.com/akawolfcito/chesscito/pull/213), merged)
**Suite:** 4875 passing / 404 files. Typecheck clean.
**Predecessor:** `2026-07-11-season-pass-celebration-handoff.md`

---

## What happened

The founder bought the Season Pass on a real MiniPay device. The celebration said
**+3 Shields**. The exercises screen then showed **1**. Navigating out to the hub and
back to `/exercises` made it show 3.

The shields were never lost. `verify-payment` credited them in Redis correctly, and the
celebration was reading the receipt, not a hardcoded string. What was broken is the
**client-side mirror of the counter**.

## Root cause

`credited` is a monotonic counter owned by Redis. The client mirrors it in localStorage
and derives the displayed count as `min(MAX_SHIELDS, credited - consumed)`
(`lib/shop/shield-storage.ts:57`).

The **only** writer of that mirror from the server was `useShieldSync`, mounted in
**exactly one place** — `components/hub/legacy-hub-client.tsx:186` — and only on mount.

Neither shield-granting path pushed the new counter back into it:

| Path | What it did | What it missed |
|---|---|---|
| Season Pass rail (`use-season-pass-rail.ts`) | verified payment → `setResult` → `onVerified` | never touched the shield cache at all |
| Welcome Pack (`use-welcome-pack-claim.ts`) | `dispatchShieldChange()` | never wrote the counter — subscribers woke and re-read the *same stale* localStorage |

That is the whole "it fixed itself" behavior: the trip to the hub remounted
`useShieldSync`, which finally reconciled.

## The fix

New `lib/shop/shield-sync.ts` — two **plain functions**, deliberately not a hook
(mounting a second `useShieldSync` inside the rail would duplicate a cache+fetch hook in
the same tree, which this repo has been bitten by before):

- `syncShieldsFromServer(address)` — GET `/api/shields/me` → mirror the absolute counter
  → notify. A failed read returns `null` and **leaves the cache untouched**, so the next
  boot still reconciles.
- `applyServerCredited(credited)` — cache an absolute counter the server already handed
  us, then notify. **Never pass a delta here.**

Wiring:

- **Rail** calls `syncShieldsFromServer` on verification success, **before** `onVerified`
  fires. Ordering is load-bearing: the hub closes the sheet in that callback, so the
  count must already be real. There is a test pinning that order.
- **Welcome Pack** calls `applyServerCredited(payload.credited)` — its own endpoint
  already echoes the `INCRBY` return (`api/welcome-pack/claim/route.ts:180`), so no extra
  round trip. Still gated on a fresh claim; `already_claimed` must not invent a delta.
- `useShieldSync` now delegates to `syncShieldsFromServer`. No behavior change.

## The product question that came with it, and how it was settled

The founder asked whether to instead **drop the grant to 1 shield**, reasoning: the
challenge is 21 days, the habit barrier is ~20, so one miss should be all you get.

**Decided: keep 3.** The reasoning is sound but applies to a mechanic that does not exist.
A shield is **not** a day of grace — `use-fail-rescue.ts` spends it when you **fail an
exercise**, to save the combo inside the session. It does not forgive a missed day. A
"day forgiveness" mechanic would be Daily-Streak recovery, which is explicitly marked
*never build*. Dropping to 1 would have removed two exercise rescues and bought no days.

`shieldsOnPurchase: 3` (`rail-config.ts:150`) also lines up with `MAX_SHIELDS = 3` and the
Welcome Pack's 3: **a purchase fills the bar.** That is a clean message. Left alone.

## Tests

10 new, written red first:

- `lib/shop/__tests__/shield-sync.test.ts` — mirror + notify, wallet scoping, non-ok read
  and network throw both leave the cache intact.
- `lib/season-pass/__tests__/use-season-pass-rail.test.tsx` — **first test file this rail
  has ever had.** Cache reconciled after success; success still reported when the shield
  read fails; `onVerified` sees the reconciled count.
- `lib/shop/__tests__/use-welcome-pack-claim.test.tsx` — counter cached on fresh claim;
  `already_claimed` does not touch it.

## Open / next

1. **Founder verification pending (the only thing tests cannot prove):** buy on a real
   device and confirm the chip goes to 3 **without leaving the screen**. Everything here
   was verified against jsdom, not MiniPay.
2. **`useShieldSync` is still mounted in exactly one place** (`legacy-hub-client`). Both
   known grant paths now self-reconcile, so nothing is broken today — but any *future*
   shield source that forgets to call `shield-sync` reintroduces this bug silently.
   Worth considering a mount at the `/exercises` root, where shields are actually spent.
3. Unchanged from before: **investigate "Claim 3 Shields"** (still the only pending item
   with unexplained behavior — check whether it was this same stale-mirror bug wearing a
   different hat), then the custom-errors decoder, then PLAY #8.

## Lesson worth keeping

A `dispatchShieldChange()` with no preceding write is a **no-op that looks like a fix**.
It wakes every subscriber up to re-read a value nobody changed. The welcome-pack carried
that line since the original shield work and it read as correct in review.

Wolfcito 🐾 @akawolfcito
