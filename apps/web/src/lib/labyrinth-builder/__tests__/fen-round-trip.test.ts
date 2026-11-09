/**
 * AC-1 — the measurement the spec refuses to assert without.
 *
 * `deriveStateFromFen` and `buildFenBlock` are INVERSES: the builder loads a
 * record with the first and re-serializes it with the second on every save. If
 * the pair is not faithful, a load→save with NO edits silently rewrites the
 * level — and the FEN is where the level's meaning lives.
 *
 * This runs the pair over the REAL records, because a hand-made fixture would
 * only prove what I already believed.
 *
 * Spec: docs/specs/2026-07-17-builder-kind-aware.md AC-1 (etapa 1).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFenBlock, deriveStateFromFen } from "@/lib/labyrinth-builder/state";
import type { LabyrinthRecord } from "@/lib/content/catalog";

const LABS = resolve(process.cwd(), "content/labyrinths.json");
const records = JSON.parse(readFileSync(LABS, "utf8")) as LabyrinthRecord[];

/** The FEN placement is what we are testing; `goal` only feeds the `target`
 *  field and never reaches the placement. The targetless games (queens, tour,
 *  promotion-run) have no goal by design — buildFenBlock's guard is now
 *  kind-aware, so `null` passes it for exactly those kinds. */
describe.each(records.map((r) => [r.kind ?? "labyrinth", r.id ?? r.fen, r] as const))(
  "round-trip [%s] %s",
  (kind, _id, rec) => {
    it("derive → buildFenBlock reproduces the FEN", () => {
      const derived = deriveStateFromFen(rec.fen, rec.piece, rec.mover ?? "");
      expect(derived.ok).toBe(true);
      if (!derived.ok) return;

      const rebuilt = buildFenBlock({
        kind,
        piece: rec.piece,
        start: derived.start,
        goal: rec.target ?? null,
        walls: derived.walls,
        enemies: derived.enemies,
        order: rec.order,
      });

      expect(rebuilt.fen).toBe(rec.fen);
    });
  },
);
