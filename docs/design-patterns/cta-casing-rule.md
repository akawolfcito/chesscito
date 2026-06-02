# CTA casing rule

**Status:** Canonical from 2026-06-01.

Defines casing for every button / CTA label in the app. Lives in
`apps/web/src/lib/content/editorial.ts`; consumers (next-intl,
component code) inherit automatically.

## The rule

| Label type | Casing | Examples |
|---|---|---|
| 1 word — primary verb / destination | ALL CAPS | `PLAY`, `ARENA`, `PIECES`, `HUB`, `RETRY`, `CONTINUE`, `SAVE`, `CLAIM`, `CONNECT`, `LEADERS` |
| 2+ words — action phrase | Sentence case | `Try again`, `Play again`, `Share trophy`, `Retry anyway`, `Connect Wallet` (proper noun) |
| Proper nouns of the game | Capitalized inside multi-word | `Save Victory`, `Ask Coach`, `Back to Hub`, `Mint Victory` |
| Chip / HUD informational | Sentence or short | `Easy`, `Medium`, `Shield · 0 left`, `Earned` |
| Modal dismissive ("Cancel" / "Dismiss") | Title (legacy) | `Cancel`, `Dismiss` — left untouched in the 2026-06-01 pass |

Proper nouns that anchor the game vocabulary stay capitalized
even when surrounded by sentence-case words:

- `Coach` (the persona)
- `Hub` (the home destination)
- `Victory` (the mintable result)
- `Wallet` (when paired with `Connect`)
- `Trial`, `Trophies` (collection nouns when explicit destination)

## Why

The game-y candy aesthetic asks for impact on the primary action
("PLAY", "RETRY") while multi-word actions need legibility
("Save Victory", "Connect Wallet"). One-word ALL CAPS reads as a
verb + intent, not as shouting. Multi-word ALL CAPS reads as
shouting.

## Where to look

- `apps/web/src/lib/content/editorial.ts` — single source of truth
- `apps/web/src/lib/content/messages/en.ts` — derived runtime bundle
  (do NOT add manual copy here)
- `apps/web/src/lib/content/README.md` — copy authoring rules

## What was migrated 2026-06-01

- `tryAgain: "Try Again"` → `"Try again"` (3 namespaces drifted)
- `retry: "Retry"` → `"RETRY"` (CTA contexts)
- `continue: "Continue"` → `"CONTINUE"` (CTA contexts)
- `FOOTER_CTA_COPY.retry.label / .compactLabel` → `"RETRY"`
- `FOOTER_CTA_COPY.connectWallet.compactLabel` → `"CONNECT"`
- `matchNotSavedRetry`, `loadErrorRetry` → `"RETRY"`

## What was NOT touched (deliberately)

- `cancel: "Cancel"` and `dismiss: "Dismiss"` — modal-utility verbs
  that read more politely in Title Case across iOS/Material patterns.
  Open for a future pass if Wolfcito wants the rule applied uniformly.
- Body copy / hints / descriptions — not button labels.
- Proper nouns in multi-word labels.
