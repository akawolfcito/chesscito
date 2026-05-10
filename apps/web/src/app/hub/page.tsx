import { redirect } from "next/navigation";
import { HubScaffoldClient } from "@/components/hub/hub-scaffold-client";
import { HubScaffoldV2Client } from "@/components/hub/hub-scaffold-v2-client";
import { HUB_V2_DEFAULT, resolveHubVariant } from "@/lib/feature-flags";
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
   *  page; `shop`/`pro`/`badges` lose their sheet-open intent and
   *  land on `/hub` (sheets remain reachable via dock + chips).
   *  Documented as known regression in 2026-05-09 spec. */
  action?: string | string[];
  /** Hub redesign canary flag. `?hub=v2` renders the V2 scaffold while
   *  the production default remains V1 until Phase 8 promotion. */
  hub?: string | string[];
};

function pieceHasExercises(piece: string): piece is PieceId {
  const exercises = (EXERCISES as Record<string, unknown[] | undefined>)[piece];
  return Array.isArray(exercises) && exercises.length > 0;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * `/hub` — kingdom launcher (scaffold).
 *
 * Default: renders `<HubScaffoldClient>` (HUD + reward column + primary
 * play CTA into `/arena`, plus a "Practice Pieces" tile into
 * `/exercises`).
 *
 * Backward-compat redirects (server-side) for `?legacy=1` bookmarks:
 *   - `?legacy=1&piece=<rook|bishop|knight|pawn>` → `/exercises?piece=…`
 *   - `?legacy=1&action=trophies`                  → `/trophies`
 *   - `?legacy=1&action=shop|pro|badges`           → `/hub` (intent dropped)
 *   - `?legacy=1` (any other shape)                → `/exercises`
 *
 * Canary flag:
 *   - `?hub=v2` renders `<HubScaffoldV2Client />`
 *   - `?hub=v1` forces `<HubScaffoldClient />` once the default flips
 *   - no query follows `HUB_V2_DEFAULT`
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

    if (action === "shop" || action === "pro" || action === "badges") {
      // Sheet-open intent is dropped — sheets are reachable from the
      // scaffold UI. Documented as a known regression (small audience,
      // pre-prod).
      redirect("/hub");
    }

    const piece = firstParam(searchParams.piece);
    const params = new URLSearchParams();
    if (piece && pieceHasExercises(piece)) {
      params.set("piece", piece);
    }
    const qs = params.toString();
    redirect(`/exercises${qs ? `?${qs}` : ""}`);
  }

  return resolveHubVariant(searchParams, HUB_V2_DEFAULT) === "v2" ? (
    <HubScaffoldV2Client />
  ) : (
    <HubScaffoldClient />
  );
}
