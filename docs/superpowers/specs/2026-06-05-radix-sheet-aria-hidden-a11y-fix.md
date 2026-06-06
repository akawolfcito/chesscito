# Spec — Fix Radix Sheet "Blocked aria-hidden" warning

**Date:** 2026-06-05
**Status:** Ready for execution — awaiting browser repro session
**Owner:** TBD (a11y sprint)
**Estimated effort:** 2-4h (with repro in hand)

## Problem

Chrome DevTools emits the following warning when certain Radix Sheet
instances open:

> Blocked aria-hidden on an element because its descendant retained focus.
> The focus must not be hidden from assistive technology users.

The warning is **not blocking** functionality and Playwright tests are
unaffected. It is, however, an a11y regression — Chrome is signalling
that we have a focused element that gets hidden from the accessibility
tree, which would break screen readers.

Documented as deferred work in:
`docs/handoffs/2026-06-05-hub-redesign-and-coach-unification-handoff.md`
(open question #3).

## Probe findings (2026-06-05)

A reproducible probe lives at
`apps/web/e2e/a11y/sheet-aria-hidden-probe.spec.ts`. It drives
Chromium through every Sheet trigger reachable anonymously, listens
to both `page.console` and the CDP `Audits.issueAdded` channel (the
canonical pipe for modern Chrome a11y warnings), and prints a
JSON report.

Run: `cd apps/web && pnpm exec playwright test e2e/a11y/sheet-aria-hidden-probe.spec.ts --project=minipay --reporter=list`

Result against `HEAD = 69a7ec18` (2026-06-05) in headless Chromium
(Playwright bundled Chromium ≥ 130):

| Surface | Triggered? | aria-hidden warnings |
|---|---|---|
| `/exercises` dock — Badges | ✅ opened | 0 |
| `/exercises` dock — Shop | ✅ opened | 0 |
| `/exercises` dock — Trophies | ✅ opened | 0 |
| `/exercises` dock — Leaders | ✅ opened | 0 |
| `/exercises` piece-picker | ✅ opened | 0 |
| `/exercises` exercise-drawer | ⚠ trigger not visible anonymously | n/a |
| `/hub` daily-tactic | ✅ opened | 0 |

**The warning could not be reproduced against any anonymous-reachable
sheet.** This narrows the search:

1. The warning likely fires only on **wallet-connected** sheets
   (`AccountSheet`, `ProSheet`, `ProfileSheet`, `CoachPaywall`,
   `PurchaseConfirmSheet`). The probe can't reach these without a
   RainbowKit wallet mock — see the same handoff's open question
   #4 ("Confirm Purchase wallet-mock for Playwright").
2. Or the warning is **real-Chrome-only** (the user's daily browser
   may emit it where headless Chromium does not — different Chrome
   build channel / a11y feature flag).
3. Or it was fixed in a commit between the handoff timestamp and now,
   and the bullet is stale.

## What we know

- Radix Dialog version: `@radix-ui/react-dialog@1.1.15` (`apps/web/package.json`).
- Wrapper: `apps/web/src/components/ui/sheet.tsx` — single primitive consumed
  by 44 callsites across 19 components.
- No custom `onOpenAutoFocus` / `onCloseAutoFocus` / FocusScope overrides
  in the codebase (`grep` returned zero hits). Default Radix focus
  management is active.
- Most sheets are **controlled** (`<Sheet open={state} onOpenChange={…}>`)
  — triggers live as ordinary buttons outside the sheet subtree. On click,
  the trigger retains focus while the sheet opens, then Radix's
  `useFocusGuards` cascades `aria-hidden` onto sibling subtrees of the
  portal target. Chrome blocks because the focused trigger is now inside
  an aria-hidden subtree.
- `dev/layout.tsx` portal target is `document.body`. `desktop-app-frame`
  callsites portal into `.desktop-app-frame-inner` (`sheet.tsx:25-35`) —
  same aria-hidden problem with a different parent.

## Candidate fix paths

### Path A — `onOpenAutoFocus` defensive override (one-file, universal)

Force focus into the dialog content synchronously on open. This races
ahead of the aria-hidden cascade so the trigger has already lost focus
by the time aria-hidden lands on its subtree.

```tsx
// sheet.tsx — inside SheetContent
<SheetPrimitive.Content
  ref={ref}
  className={…}
  onOpenAutoFocus={(event) => {
    event.preventDefault();
    contentRef.current?.focus();
  }}
  {...props}
>
```

Pros: one file, applies to all 44 callsites, no per-trigger changes.
Cons: subtly changes Radix's default focus behavior — must verify
screen readers still announce the dialog correctly. Risk of breaking
existing focus traps in sheets that rely on Radix focusing the first
interactive child.

### Path B — Trigger blur on click (per-callsite, surgical)

```tsx
<button onClick={(e) => { e.currentTarget.blur(); setOpen(true); }} />
```

Pros: explicit, no Radix surgery.
Cons: 44 callsites — error-prone, easy to regress when adding new sheets.

### Path C — Upgrade Radix when the issue lands upstream

Track <https://github.com/radix-ui/primitives/issues> for an
official Dialog fix. They moved to `inert` attribute in some primitives;
Dialog is on the migration roadmap.

Pros: zero local code change, definitive fix.
Cons: indefinite timeline. Not actionable on a sprint cadence.

### Path D — Migrate Sheet to a different primitive (vaul, headlessui)

Pros: vaul is mobile-first and avoids the focus-guard pattern.
Cons: huge scope — 44 callsites, behavior parity work, baseline refresh.

## Recommended sprint path

Per the probe findings, the anonymous surfaces are clean. The sprint
sequence is now:

1. **Confirm the warning exists at all in 2026-06-05+ HEAD.** Open
   `https://chesscito.com` in real Chrome (NOT Playwright) with
   DevTools → Issues panel open. Walk through every sheet trigger.
   If no warning fires anywhere, **close the bullet as already-fixed
   /stale** — the probe spec stays as a regression guard, no code
   change needed.
2. **If the warning fires only on wallet-connected sheets:** wire
   the probe to the same wallet mock that closes open question #4
   from the hub-redesign handoff (RainbowKit mock). Then extend the
   spec to cover Account / PRO / Profile / CoachPaywall /
   PurchaseConfirm, and identify the offenders surgically.
3. **Apply Path A** (`onOpenAutoFocus` override in `sheet.tsx`).
4. **Re-run the probe.** Both anonymous and wallet-mocked passes
   must end with zero findings.
5. **Flip the probe `STRICT_ASSERT = true`** so the spec becomes a
   CI guard against regression.
6. Smoke-test screen reader announcement on macOS VoiceOver
   (Cmd+F5) — confirm the dialog still announces title + description
   on open.

If Path A breaks SR announcement, fall back to Path B for the 2-3
identified offenders only (not all 44).

## Acceptance criteria

- Open any Sheet in Chrome with DevTools console open → no
  "Blocked aria-hidden" warning.
- Open any Sheet with VoiceOver active → dialog title + description
  are announced on open.
- Close any Sheet → focus returns to the trigger (Radix default).
- No regression in existing VR baselines (vr1..vr15) or e2e specs.

## Out of scope

- The `aria-describedby` warning suppression (already handled in
  `sheet.tsx:88-90`).
- Migration to `vaul` / `headlessui`.
- Sheets that don't use the `ui/sheet.tsx` primitive (none currently;
  guard against future).

## References

- Handoff: `docs/handoffs/2026-06-05-hub-redesign-and-coach-unification-handoff.md`
  open question #3.
- Primitive: `apps/web/src/components/ui/sheet.tsx`.
- Radix Dialog docs: <https://www.radix-ui.com/primitives/docs/components/dialog>.
- Chrome DevTools rationale:
  <https://developer.chrome.com/blog/aria-hidden-focus/>.
