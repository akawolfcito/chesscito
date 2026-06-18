/**
 * content-staging-model — pure stage helpers (no DB, no React).
 *
 * Each deployment has a `CONTENT_STAGE` maturity floor (the minimum maturity it
 * displays); `CONTENT_STAGE` replaces the old on/off `CONTENT_OVERLAY_ENABLED`
 * flag. With it unset/invalid the read path serves baseline-only (kill-switch).
 *
 * Two-version model: a puzzle id may hold one row per stage (a live `published`
 * + an in-progress `draft`). `resolveVisibleRows` collapses the rows an env can
 * see to ONE per id — the freshest version that has reached this env.
 */
import { STAGE_RANK, type ContentOverlayRow, type ContentStage } from "./overlay-types";

const STAGES: ContentStage[] = ["draft", "preview", "published"]; // rank-ascending

/** Stages an env at `floor` displays: the floor and everything above it. */
export function visibleStages(floor: ContentStage): ContentStage[] {
  return STAGES.filter((s) => STAGE_RANK[s] >= STAGE_RANK[floor]);
}

/** The maturity floor this deployment displays, from `CONTENT_STAGE`. Returns
 *  null when unset or invalid → the read path serves baseline-only. */
export function envStageFloor(): ContentStage | null {
  const value = process.env.CONTENT_STAGE;
  if (value === "draft" || value === "preview" || value === "published") {
    return value;
  }
  if (value) {
    // Loud signal: a typo here silently drops ALL overlay content on this env.
    console.warn(`[content-stage] invalid CONTENT_STAGE="${value}" → baseline-only`);
  }
  return null;
}

/**
 * Collapse overlay rows to ONE per (kind,id) for an env at `floor`: among the
 * rows that have reached this env (stage-rank ≥ floor), the freshest (LOWEST
 * stage-rank). Rows below the floor are invisible (a draft never leaks to prod).
 */
export function resolveVisibleRows(
  rows: ContentOverlayRow[],
  floor: ContentStage,
): ContentOverlayRow[] {
  const floorRank = STAGE_RANK[floor];
  const best = new Map<string, ContentOverlayRow>();
  for (const row of rows) {
    if (STAGE_RANK[row.stage] < floorRank) continue; // too immature for this env
    const key = `${row.kind}:${row.id}`;
    const current = best.get(key);
    if (!current || STAGE_RANK[row.stage] < STAGE_RANK[current.stage]) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}
