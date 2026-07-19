# Theme runtime coverage

Date: 2026-07-18

## Scope and inventories

The control plane was already complete. This change connects the runtime plane
for every active `apps/web` slot without adding another theme or changing the
catalog model.

Machine-readable reports:

- Initial snapshot: `docs/audits/2026-07-18-theme-runtime-inventory-initial.json`
- Regenerable final report: `docs/audits/2026-07-18-theme-runtime-inventory.json`
- Invariant: `pnpm --filter web theme:coverage`

Initial A-G classification:

| Category | Count |
| --- | ---: |
| A. Already connected | 2 |
| B. Direct JSX migration | 66 |
| C. Shared component/map migration | 26 |
| D. CSS/background migration | 38 |
| E. Dynamic/composed path migration | 19 |
| F. Deprecated or no active consumer | 11 |
| G. Blocking decision | 0 |

The initial scan found 55 slots used through `img`, 56 through `picture`, 39
through CSS backgrounds, 27 through a shared map/component, and 19 through a
dynamic or composed path. These counts overlap by design.

Final state:

- 151 active slots are fully connected.
- 7 slots are deprecated.
- 4 slots have no active consumer.
- 0 active slots have a hardcoded catalog path.
- `board.legacy-bg` is deprecated but still connected for its live legacy
  surface; its old CSS literal remains intentionally classified as deprecated.
- The six `hub.mastery.piece.*` literals remain only in deprecated code.

## Common resolution

`resolveThemeAsset` is the single pure resolver. The runtime variant is supplied
by `ThemeVariantProvider`, and small adapters cover the consumption shapes:

- `ThemeAssetPicture` for optimized JSX images and pictures. It renders nothing
  for `none` and retains existing responsive candidates for legacy art.
- `ThemeAsset` for render-prop cases where the existing element structure must
  remain unchanged.
- `ThemeCssVariables` and `useThemeBackground` for controlled CSS backgrounds.
  `none` becomes CSS `none`, never `url("")`.
- `pieceThemeSlot` / `useThemePieceAssets` for the twelve composed board piece
  paths.
- `resolveOgThemeAsset` for anonymous server-rendered OG routes, which resolve
  the DEFAULT variant because those requests have no authenticated PRO state.

The adapters return a basename without an extension. Existing consumers keep
their PNG/WebP/AVIF structure and dimensions. Deterministic builder overrides
use only the generated triplet; responsive derivative URLs are not fabricated.

## Exclusions

The literal-diff allowlist contains three active assets outside the 162-slot
catalog:

- `/art/redesign/icons/close`: generic CandyIcon close art, visually distinct
  from the cataloged mission close button.
- `/art/rivals/mara-avatar`: fallback for a rival not represented by a catalog
  slot.
- `/art/shop/pro`: product art, not a theme asset.

Adding another allowlist exception requires an explicit reason. The coverage
test fails when an active catalog slot is hardcoded, unclassified, or cannot be
resolved through the common runtime path.

## Remaining risks

- PRO state is client-derived. The provider keeps the existing hydration
  behavior, so the first render remains DEFAULT until entitlement hydration.
- CSS variables are mounted once under the existing wallet/provider tree;
  pseudo-elements and breakpoints retain their original rules.
- `usedIn` is documentation, while the invariant also uses literal-diff and
  resolver references. A new dynamically constructed family still needs a
  typed slot adapter or an explicit non-catalog exception.

Future coverage should migrate by consumption family through these adapters,
not by adding component-local DEFAULT/PRO branches.

## Verification

- Focused runtime/consumer suite: 225/225 passing.
- Full suite: 5269/5272 passing. The three failures are the pre-existing rook
  and bishop pedagogy expectation mismatches; no theme/runtime test fails.
- Typecheck: passing.
- Production build: passing (108 static pages generated).
- Coverage invariant: 162 total, 151 connected, 11 excluded, 0 active
  hardcoded or unclassified slots.

Manual smoke used a simulated local EIP-1193 wallet and local PRO response; no
credentials or private data were involved. Temporary overrides were restored to
`inherit` and their generated files were removed afterward.

- Mobile 390 px: `hub.training` and its Coach consumer passed DEFAULT, PRO
  explicit, Inherit, None, and Undo. None preserved the Coach label and emitted
  no empty `img` or `source`.
- Mobile 390 px: `hub.daily-icon`, `shared.lock` (five simultaneous consumers),
  and `hub.bg` resolved their deterministic PRO paths.
- Exercises: the computed wallpaper `background-image` used the deterministic
  PRO AVIF/WebP/PNG image-set.
- Arena: the visible `arena.rival-kairo` consumer used its deterministic PRO
  path. `arena.player-you` is covered by the typed resolver tests but is not
  mounted on the initial Arena selection surface.
- Desktop 1280x900: the restored Hub background computed to its valid default
  image-set inside the unchanged 390 px app frame.
- No inspected surface contained an empty `img src` or `source srcset`.
