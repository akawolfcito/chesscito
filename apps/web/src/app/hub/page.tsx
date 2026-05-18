import { redirect } from "next/navigation";
import { HubScaffoldClient } from "@/components/hub/hub-scaffold-client";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

type SearchParams = {
  /** Legacy bookmark redirect. `?legacy=1` used to render the
   *  exercise-gameplay surface inline; that surface now lives at
   *  `/exercises`. We honor the truthy flag for backward compat with
   *  external bookmarks (Discord shares, share-card images, etc.). */
  legacy?: string | string[];
  /** Legacy bookmark redirect: pre-select a piece. Only honored
   *  alongside `?legacy=1`. Forwarded to `/exercises?piece=`. */
  piece?: string | string[];
  /** Legacy bookmark redirect: open a sheet on first render. Only
   *  honored alongside `?legacy=1`. `trophies` redirects to its own
   *  page; `shop`/`pro`/`badges` become `/hub?sheet=...`. */
  action?: string | string[];
  /** Scaffold sheet deep link. `shop`, `pro`, and `badges` open
   *  in-place after the client hydrates. Unknown values are ignored. */
  sheet?: string | string[];
};

type HubInitialSheet = "shop" | "pro" | "badges";

function pieceHasExercises(piece: string): piece is PieceId {
  const exercises = (EXERCISES as Record<string, unknown[] | undefined>)[piece];
  return Array.isArray(exercises) && exercises.length > 0;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseInitialSheet(value: string | undefined): HubInitialSheet | undefined {
  return value === "shop" || value === "pro" || value === "badges"
    ? value
    : undefined;
}

/**
 * `/hub` — kingdom launcher (scaffold).
 *
 * Renders `<HubScaffoldClient>` (HUD + reward column + primary play CTA
 * into `/arena`, plus a "Practice Pieces" tile into `/exercises`).
 *
 * Backward-compat redirects (server-side) for `?legacy=1` bookmarks:
 *   - `?legacy=1&piece=<rook|bishop|knight|pawn>` → `/exercises?piece=…`
 *   - `?legacy=1&action=trophies`                  → `/trophies`
 *   - `?legacy=1&action=shop|pro|badges`           → `/hub?sheet=…`
 *   - `?legacy=1` (any other shape)                → `/exercises`
 *
 * The `redirect()` helper from `next/navigation` requires a literal
 * URL string, so query params are constructed explicitly.
 */
export default function HubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const legacyFlag = firstParam(searchParams.legacy);
  const isLegacy = legacyFlag === "1" || legacyFlag === "true";

  if (isLegacy) {
    const action = firstParam(searchParams.action);

    if (action === "trophies") {
      redirect("/trophies");
    }

    const actionSheet = parseInitialSheet(action);
    if (actionSheet) {
      redirect(`/hub?sheet=${actionSheet}`);
    }

    const piece = firstParam(searchParams.piece);
    const params = new URLSearchParams();
    if (piece && pieceHasExercises(piece)) {
      params.set("piece", piece);
    }
    const qs = params.toString();
    redirect(`/exercises${qs ? `?${qs}` : ""}`);
  }

  const initialSheet = parseInitialSheet(firstParam(searchParams.sheet));

  return <HubScaffoldClient initialSheet={initialSheet} />;
}
