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

**Path A** with verification:

1. Reproduce the warning in Chrome DevTools. Identify at least 2-3
   sheets that trigger it (probably Account, Shop, Settings — large
   sheets opened from controlled state).
2. Apply Path A patch to `sheet.tsx`.
3. Verify the warning no longer fires for the same 2-3 sheets.
4. Smoke-test screen reader announcement on macOS VoiceOver (Cmd+F5)
   — confirm the dialog still announces title + description on open.
5. Capture `vrXX-sheet-focus-management` baselines if any visual side
   effect.

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
