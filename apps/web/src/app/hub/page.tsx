import { PlayHubRoot, type PlayHubInitialAction } from "@/components/play-hub/play-hub-root";
import { HubScaffoldClient } from "@/components/hub/hub-scaffold-client";

type SearchParams = {
  /** Transitional fallback to the legacy `<PlayHubRoot>`. Truthy → legacy. */
  legacy?: string | string[];
  /** Canary flag (kept for backward compat with bookmarks from the
   *  scaffold-as-preview era). Truthy "new" → scaffold (same as default
   *  after the flip). */
  hub?: string | string[];
  /** Legacy seed: pre-select a piece in `<PlayHubRoot>`. Only honored on
   *  the legacy branch — the scaffold has no piece-selection state. */
  piece?: string | string[];
  /** Legacy seed: open a sheet on first render. Honored values:
   *  `shop`, `pro`, `badges`. Other values are ignored. */
  action?: string | string[];
};

const VALID_PIECES = new Set([
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
] as const);
type PieceKey = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";

const VALID_ACTIONS = new Set<PlayHubInitialAction>(["shop", "pro", "badges"]);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `/hub` — canonical play-hub URL.
 *
 * **Default**: renders the redesigned Game Home `<HubScaffoldClient>`
 *   (Story 1.12 final — flag flipped 2026-05-04 after data wiring).
 *
 * **Legacy fallback** (`?legacy=1`): renders the original
 *   `<PlayHubRoot>` so deep links from the scaffold (`&piece=…&action=…`)
 *   land in the heavy on-chain mutation flows that still live there.
 *
 * **Canary alias** (`?hub=new`): kept for backward compat with bookmarks
 *   from the scaffold-as-preview era — same as default.
 *
 * Server component on purpose: reading `searchParams` from props avoids
 * `useSearchParams()` + Suspense overhead.
 */
export default function HubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const legacyFlag = firstParam(searchParams.legacy);
  const isLegacy = legacyFlag === "1" || legacyFlag === "true";

  if (!isLegacy) {
    return <HubScaffoldClient />;
  }

  const piece = firstParam(searchParams.piece);
  const action = firstParam(searchParams.action);

  const initialPiece =
    piece && VALID_PIECES.has(piece as PieceKey) ? (piece as PieceKey) : undefined;
  const initialAction =
    action && VALID_ACTIONS.has(action as PlayHubInitialAction)
      ? (action as PlayHubInitialAction)
      : undefined;

  return <PlayHubRoot initialPiece={initialPiece} initialAction={initialAction} />;
}
