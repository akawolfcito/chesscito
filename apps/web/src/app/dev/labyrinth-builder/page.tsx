"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";
import {
  buildFenBlock,
  deriveStateFromFen,
  emptyState,
  type AuthoredEnemy,
  type BuilderState,
} from "@/lib/labyrinth-builder/state";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import { validateBuilder } from "@/lib/labyrinth-builder/validate";
import {
  formatPublishResult,
  type PublishResultLike,
} from "@/lib/labyrinth-builder/publish-toast";
import {
  formatPromoteResult,
  type PromoteResultLike,
} from "@/lib/labyrinth-builder/promote-toast";
import type { ContentStage } from "@/lib/content/overlay-types";
import {
  parseFenBoard,
  posToSquare,
  squareToPos,
} from "@/lib/game/fen-puzzle";
import {
  GENERATED_EXERCISES,
  GENERATED_LABYRINTHS,
} from "@/lib/game/generated/puzzles.generated";
import type { BoardPosition, ExerciseTier, PieceId } from "@/lib/game/types";
import { THEME_CONFIG } from "@/lib/theme";
import { GameBoard as ProceduralBoard } from "@/lib/game/game-board";

export const dynamic = "force-dynamic";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

// Real in-game sprites so the builder previews puzzles on a board that matches
// /exercises. White pieces; star marks the goal (same as board.tsx).
const PIECE_SRC: Record<PieceId, string> = {
  rook: `${THEME_CONFIG.piecesBase}/w-rook.png`,
  bishop: `${THEME_CONFIG.piecesBase}/w-bishop.png`,
  knight: `${THEME_CONFIG.piecesBase}/w-knight.png`,
  pawn: `${THEME_CONFIG.piecesBase}/w-pawn.png`,
  queen: `${THEME_CONFIG.piecesBase}/w-queen.png`,
  king: `${THEME_CONFIG.piecesBase}/w-king.png`,
};
const STAR_SRC = "/art/redesign/icons/star.png";

// Per-cell marker overlays drawn on the textured ProceduralBoard cells. All are
// pointer-events:none so taps pass through to the cell button (brush logic).
const CELL_OVERLAY: Record<string, CSSProperties> = {
  wall: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "12%",
    pointerEvents: "none",
  },
  capture: {
    position: "absolute",
    left: "16%",
    top: "16%",
    width: "68%",
    height: "68%",
    borderRadius: "50%",
    border: "3px solid rgba(248, 113, 113, 0.95)",
    boxShadow: "0 0 8px rgba(248,113,113,0.7)",
    pointerEvents: "none",
  },
  sprite: {
    position: "absolute",
    left: "9%",
    top: "9%",
    width: "82%",
    height: "82%",
    objectFit: "contain",
    pointerEvents: "none",
  },
  star: {
    position: "absolute",
    left: "18%",
    top: "18%",
    width: "64%",
    height: "64%",
    objectFit: "contain",
    pointerEvents: "none",
  },
  dot: {
    position: "absolute",
    left: "39%",
    top: "39%",
    width: "22%",
    height: "22%",
    borderRadius: "50%",
    background: "rgba(125, 211, 252, 0.95)",
    boxShadow: "0 0 4px rgba(56,189,248,0.8)",
    pointerEvents: "none",
  },
  trace: {
    position: "absolute",
    top: "2px",
    right: "3px",
    fontSize: "0.55rem",
    fontWeight: 800,
    lineHeight: 1,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
    pointerEvents: "none",
  },
};

type Brush = "start" | "goal" | "wall" | "capture" | "trace";
type Kind = "exercise" | "labyrinth";

// Fields the builder UI cannot (yet) express but that live on a record. We
// carry them through verbatim on an EDIT so a read-modify-write never drops
// exercise-only data (tier, tags, …).
const BUILDER_FIELDS = new Set([
  "id",
  "kind",
  "piece",
  "fen",
  "target",
  "mover",
  "order",
  "explanation",
  "tier",
  "tags",
]);

const TIERS: ExerciseTier[] = ["easy", "medium", "hard"];
function extraFields(rec: LabyrinthRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!BUILDER_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function posKey(p: BoardPosition): string {
  return posToSquare(p);
}

// `deriveStateFromFen` used to live here, unexported — which is exactly why the
// round-trip against `buildFenBlock` went untested, and why the enemy type could
// be lost for this long without anyone noticing. It now lives next to its
// inverse in lib/labyrinth-builder/state.ts, where the pair is tested as one.

export default function LabyrinthBuilderPage() {
  if (!isDevSurfaceEnabled()) notFound();

  const [kind, setKind] = useState<Kind>("exercise");
  const [state, setState] = useState<BuilderState>(() => emptyState("rook"));
  // Exercise-only (or otherwise non-UI) fields of the record being edited, so
  // a save round-trips them instead of dropping them.
  const [editExtras, setEditExtras] = useState<Record<string, unknown>>({});
  const [brush, setBrush] = useState<Brush>("start");
  const [tracedPath, setTracedPath] = useState<string[]>([]);
  const [fenInput, setFenInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [moverInput, setMoverInput] = useState("");
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [records, setRecords] = useState<LabyrinthRecord[]>([]);
  const [toast, setToast] = useState<{
    kind: "ok" | "warn" | "err";
    text: string;
  } | null>(null);
  /** Debounce: block re-entrant Save while a publish round-trip is in flight
   *  (a double-click would otherwise race two read-modify-write passes). */
  const [isSaving, setIsSaving] = useState(false);
  /** Target stage for the "Set stage" control (content-staging-model). */
  const [stageTarget, setStageTarget] = useState<ContentStage>("published");
  /** Can the SERVER write content/*.json? Only it knows: this is a client
   *  component, so process.env.VERCEL is invisible here. On a deploy the fs is
   *  read-only → the builder loads and validates, but Save is off (behavior 15).
   *  Starts true so local (the only place Save works) never flashes disabled. */
  const [canWrite, setCanWrite] = useState(true);

  const refreshRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/dev/labyrinth?kind=${kind}`);
      const data = (await res.json()) as {
        ok?: boolean;
        records?: LabyrinthRecord[];
        canWrite?: boolean;
      };
      if (data?.ok && Array.isArray(data.records)) setRecords(data.records);
      if (typeof data?.canWrite === "boolean") setCanWrite(data.canWrite);
    } catch {
      /* dev-only tool — silently ignore fetch failures */
    }
  }, [kind]);

  useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  const result = useMemo(
    () => validateBuilder(state, tracedPath.length ? tracedPath : undefined),
    [state, tracedPath],
  );

  const fenBlock = useMemo(() => {
    try {
      return buildFenBlock(state);
    } catch {
      return null;
    }
  }, [state]);

  const pathSquares = useMemo(
    () => new Set(result.path.map((p) => posKey(p))),
    [result.path],
  );
  const traceIndex = useMemo(() => {
    const m = new Map<string, number>();
    tracedPath.forEach((sq, i) => m.set(sq, i + 1));
    return m;
  }, [tracedPath]);

  const pieceRecords = useMemo(
    () =>
      records
        .filter((r) => r.piece === state.piece)
        // Show the real in-game sequence: authored order, id as tie-break.
        .sort(
          (a, b) =>
            a.order - b.order || (a.id ?? "").localeCompare(b.id ?? ""),
        ),
    [records, state.piece],
  );

  function update(patch: Partial<BuilderState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function handlePieceChange(piece: PieceId) {
    setState((prev) => ({
      ...prev,
      piece,
      enemies: piece === "pawn" ? prev.enemies : [],
    }));
    if (brush === "capture" && piece !== "pawn") setBrush("start");
  }

  function toggleIn(list: string[], sq: string): string[] {
    return list.includes(sq) ? list.filter((x) => x !== sq) : [...list, sq];
  }

  function toggleEnemy(list: AuthoredEnemy[], sq: string, piece: PieceId): AuthoredEnemy[] {
    return list.some((e) => e.square === sq)
      ? list.filter((e) => e.square !== sq)
      : [...list, { square: sq, piece }];
  }

  function handleCell(sq: string) {
    switch (brush) {
      case "start":
        update({ start: state.start === sq ? null : sq });
        break;
      case "goal":
        update({ goal: state.goal === sq ? null : sq });
        break;
      case "wall":
        update({ walls: toggleIn(state.walls, sq) });
        break;
      case "capture":
        // The capture brush still paints a black PAWN — the only enemy the
        // builder can express today. A TYPED brush (safe-path's knights, rooks…)
        // is etapa 7; what changed here is that the type now SURVIVES a save.
        if (state.piece === "pawn") update({ enemies: toggleEnemy(state.enemies, sq, "pawn") });
        break;
      case "trace":
        setTracedPath((prev) =>
          prev.length && prev[prev.length - 1] === sq
            ? prev.slice(0, -1)
            : [...prev, sq],
        );
        break;
    }
  }

  function handleLoadFromFen() {
    setLoadNote(null);
    const fen = fenInput.trim();
    const target = targetInput.trim();
    if (!fen) {
      setLoadNote("Enter a FEN placement first.");
      return;
    }
    const derived = deriveStateFromFen(fen, state.piece, moverInput);
    if (!derived.ok) {
      setLoadNote(derived.error);
      return;
    }
    const piece = state.piece;
    setState((prev) => ({
      ...prev,
      start: derived.start,
      goal: target || prev.goal,
      walls: derived.walls,
      enemies: piece === "pawn" ? derived.enemies : [],
    }));
    setTracedPath([]);
    const notes = [...derived.notes];
    if (!target) notes.push("no target given — kept previous goal");
    setLoadNote(
      `Loaded: start=${derived.start}, ${derived.walls.length} wall(s)` +
        (notes.length ? ` — ${notes.join("; ")}` : ""),
    );
  }

  function handleEditRecord(rec: LabyrinthRecord) {
    const derived = deriveStateFromFen(rec.fen, rec.piece, rec.mover ?? "");
    if (!derived.ok) {
      setToast({ kind: "err", text: `Cannot edit ${rec.id ?? "record"}: ${derived.error}` });
      return;
    }
    setState({
      piece: rec.piece,
      start: derived.start,
      // A knight-tour record carries no target — it has no goal square to load.
      goal: rec.target ?? null,
      walls: derived.walls,
      // ⚠️ Still drops a non-pawn's enemies, which DESTROYS a safe-path level on
      // load (its knight is the game). Deliberately unchanged here: this stage
      // only makes the type survive. The policy is kind-aware in etapa 2.
      enemies: rec.piece === "pawn" ? derived.enemies : [],
      order: rec.order,
      explanation: rec.explanation,
      tier: rec.tier,
      tags: rec.tags,
      id: rec.id,
    });
    setEditExtras(extraFields(rec));
    setTracedPath([]);
    setLoadNote(null);
    setToast({ kind: "ok", text: `Editing ${rec.id ?? "(no id)"}` });
  }

  function handleNew() {
    setState(emptyState(state.piece));
    setEditExtras({});
    setTracedPath([]);
    setLoadNote(null);
    setToast(null);
  }

  function handleKindChange(next: Kind) {
    if (next === kind) return;
    setKind(next);
    // Switching surfaces discards any in-progress edit so we never save a
    // record into the wrong bucket.
    setState(emptyState(state.piece));
    setEditExtras({});
    setTracedPath([]);
    setLoadNote(null);
    setToast(null);
  }

  async function handleSave() {
    if (!result.ok || !fenBlock || isSaving || !canWrite) return;
    setIsSaving(true);
    try {
      // "Todo en 1": the publish proxy writes the baseline content/*.json AND
      // writes the overlay at stage='draft' in one call (the ADMIN_TOKEN stays
      // server-side). A draft is NOT live to players — promote it to publish.
      // Returns a partial-aware { ok, baseline, overlay }.
      const res = await fetch("/api/dev/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          record: {
            // Preserved exercise-only / unknown fields (tier, tags, …) first,
            // so an edit never drops them; explicit fields below win.
            ...editExtras,
            id: state.id || undefined,
            piece: state.piece,
            ...fenBlock,
            explanation: state.explanation || undefined,
            tier: state.tier || undefined,
            tags: state.tags && state.tags.length ? state.tags : undefined,
            order: state.order,
          },
        }),
      });
      const data = (await res.json()) as PublishResultLike;
      setToast(formatPublishResult(data));
      if (data?.baseline?.ok) void refreshRecords();
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    } finally {
      setIsSaving(false);
    }
  }

  // Set the current record's stage (content-staging-model). Save lands content
  // at `draft`; this moves it to the chosen stage — the route auto-detects the
  // current version, so you just pick the target. Goes through the dev proxy so
  // the ADMIN_TOKEN stays server-side. draft (local) / preview
  // (preview.chesscito.com) / published (chesscito.com).
  async function handleSetStage(to: ContentStage) {
    const id = state.id?.trim();
    if (!id) {
      setToast({ kind: "err", text: "Load or enter a record id first." });
      return;
    }
    try {
      const res = await fetch("/api/dev/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id, to }),
      });
      const data = (await res.json()) as PromoteResultLike;
      setToast(formatPromoteResult(data, id));
      void refreshRecords();
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    }
  }

  // Soft-delete toggle: flips a record's `disabled` flag via the normal Save
  // path (no destructive removal). A disabled record stays in content/*.json
  // for re-enabling but is excluded from the generated catalog. Operates on
  // the list row directly so it never disturbs the current edit.
  async function handleToggleDisabled(rec: LabyrinthRecord) {
    try {
      // Toggle through the publish proxy so the enable/disable also lands in the
      // draft overlay (baseline + overlay), same "todo en 1" path as Save.
      const res = await fetch("/api/dev/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, record: { ...rec, disabled: !rec.disabled } }),
      });
      const data = (await res.json()) as PublishResultLike;
      if (!data?.baseline?.ok) {
        setToast(formatPublishResult(data));
        return;
      }
      const verb = rec.disabled ? "enabled" : "disabled";
      const id = rec.id ?? "record";
      setToast(
        data.overlay?.ok
          ? { kind: "ok", text: `${id} ${verb} as draft. Promote to publish. Remember to commit content/*.json.` }
          : {
              kind: "warn",
              text: `${id} ${verb} in baseline; draft overlay update failed: ${(data.overlay?.errors ?? ["unknown"]).join("; ")}. Remember to commit content/*.json.`,
            },
      );
      void refreshRecords();
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    }
  }

  const generatedByKind =
    kind === "exercise" ? GENERATED_EXERCISES : GENERATED_LABYRINTHS;
  const existing = generatedByKind[state.piece] ?? [];

  return (
    <main className="min-h-screen bg-black p-4 text-neutral-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
        {/* ── Board column ── */}
        <section className="flex flex-col gap-3">
          <h1 className="text-lg font-bold tracking-tight text-neutral-100">
            {kind === "exercise" ? "Exercise" : "Labyrinth"} Builder{" "}
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              dev
            </span>
          </h1>

          {/* Kind toggle — same editor authors both surfaces. */}
          <div className="flex gap-2" role="group" aria-label="Puzzle kind">
            {(["exercise", "labyrinth"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKindChange(k)}
                className={`rounded px-3 py-1 text-sm capitalize transition-colors ${
                  kind === k
                    ? "bg-neutral-100 font-semibold text-black"
                    : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <ProceduralBoard
            onCellClick={(_file, _rank, sq) => handleCell(sq)}
            renderCell={(_file, _rank, sq) => {
              const isStart = state.start === sq;
              const isGoal = state.goal === sq;
              const isWall = state.walls.includes(sq);
              const isCapture = state.enemies.some((e) => e.square === sq);
              const inPath = pathSquares.has(sq);
              const traceOrder = traceIndex.get(sq);
              return (
                <>
                  {isWall && !isStart && !isGoal && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/art/labyrinths/wall.png" alt="" style={CELL_OVERLAY.wall} />
                  )}
                  {isCapture && !isStart && (
                    <span style={CELL_OVERLAY.capture} />
                  )}
                  {isStart ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={PIECE_SRC[state.piece]} alt="" style={CELL_OVERLAY.sprite} />
                  ) : isGoal ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={STAR_SRC} alt="" style={CELL_OVERLAY.star} />
                  ) : null}
                  {inPath && !isStart && !isGoal && !isWall && (
                    <span style={CELL_OVERLAY.dot} />
                  )}
                  {traceOrder !== undefined && (
                    <span style={CELL_OVERLAY.trace}>{traceOrder}</span>
                  )}
                </>
              );
            }}
          />

          {/* Brushes */}
          <div className="flex flex-wrap gap-2">
            {(["start", "goal", "wall", "capture", "trace"] as Brush[]).map((b) => {
              const disabled = b === "capture" && state.piece !== "pawn";
              if (disabled) return null;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrush(b)}
                  className={`rounded px-3 py-1 text-sm capitalize ${
                    brush === b
                      ? "bg-neutral-100 text-black"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {b}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTracedPath([])}
              className="rounded bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700"
            >
              clear trace
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            piece=start · ★=goal · dark tile=wall · red ring=capture · blue
            dot=BFS path · number=traced order
          </p>
        </section>

        {/* ── Controls column ── */}
        <section className="flex flex-1 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              <span className="text-neutral-400">Piece</span>
              <select
                value={state.piece}
                onChange={(e) => handlePieceChange(e.target.value as PieceId)}
                className="rounded bg-neutral-800 px-2 py-1"
              >
                {PIECES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-neutral-400">Order</span>
              <input
                type="number"
                value={state.order}
                onChange={(e) => update({ order: Number(e.target.value) || 0 })}
                className="rounded bg-neutral-800 px-2 py-1"
              />
            </label>
            <label className="col-span-2 flex flex-col text-sm">
              <span className="text-neutral-400">id (optional)</span>
              <input
                type="text"
                value={state.id ?? ""}
                onChange={(e) => update({ id: e.target.value || undefined })}
                placeholder="auto if blank"
                className="rounded bg-neutral-800 px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-neutral-400">tier</span>
              <select
                value={state.tier ?? "medium"}
                onChange={(e) =>
                  update({ tier: e.target.value as ExerciseTier })
                }
                className="rounded bg-neutral-800 px-2 py-1 capitalize"
              >
                {TIERS.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-neutral-400">tags (comma-sep)</span>
              <input
                type="text"
                value={(state.tags ?? []).join(", ")}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  update({ tags: tags.length ? tags : undefined });
                }}
                placeholder="straight-line"
                className="rounded bg-neutral-800 px-2 py-1"
              />
            </label>
            <label className="col-span-2 flex flex-col text-sm">
              <span className="text-neutral-400">
                description (shown in-game)
              </span>
              <input
                type="text"
                value={state.explanation ?? ""}
                onChange={(e) =>
                  update({ explanation: e.target.value || undefined })
                }
                placeholder={
                  kind === "exercise"
                    ? "e.g. Move your Rook straight to h8"
                    : undefined
                }
                className="rounded bg-neutral-800 px-2 py-1"
              />
              {kind === "exercise" && !state.explanation ? (
                <span className="mt-1 text-xs text-amber-400/80">
                  Empty → shows the generic “Exercise N” label in-game.
                </span>
              ) : null}
            </label>
          </div>

          {/* Validation */}
          <div className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Optimal moves</span>
              <span className="font-mono text-base">
                {result.optimalMoves ?? "—"}
              </span>
            </div>
            {result.errors.map((e, i) => (
              <p key={`e-${i}`} className="mt-1 text-red-400">
                ✗ {e}
              </p>
            ))}
            {result.warnings.map((w, i) => (
              <p key={`w-${i}`} className="mt-1 text-amber-400">
                ⚠ {w}
              </p>
            ))}
          </div>

          {/* Edit-mode banner */}
          {state.id ? (
            <div className="flex items-center justify-between rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
              <span className="text-neutral-300">
                Editing <span className="font-mono font-semibold text-neutral-100">{state.id}</span>
              </span>
              <button
                type="button"
                onClick={handleNew}
                title={`Start a fresh ${kind} (discard current edit)`}
                className="rounded bg-neutral-700 px-3 py-1 text-xs hover:bg-neutral-600"
              >
                + New {kind}
              </button>
            </div>
          ) : null}

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!result.ok || isSaving || !canWrite}
              title={
                canWrite
                  ? undefined
                  : "Baseline write is local-only: this deploy's filesystem is read-only."
              }
              className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500"
            >
              {isSaving ? "Saving draft…" : "Save draft"}
            </button>
            {/* Says WHY, instead of letting the founder press a dead button. The
                probes are useful on preview; Save can never be. */}
            {!canWrite && (
              <span className="text-xs text-amber-400" data-testid="lb-readonly-note">
                Read-only here — baseline write is local-only.
              </span>
            )}
            {toast && (
              <span
                className={
                  toast.kind === "ok"
                    ? "text-emerald-400"
                    : toast.kind === "warn"
                      ? "text-amber-400"
                      : "text-red-400"
                }
              >
                {toast.text}
              </span>
            )}
          </div>

          {/* Set the current record's stage. Save lands it at draft; pick where
              it should live and "Set stage" moves it there (the route detects the
              current version automatically). draft = localhost · preview =
              preview.chesscito.com · published = chesscito.com (players). */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-neutral-400">
              Stage {state.id ? `for ${state.id}` : "(load a record)"} →
            </span>
            <select
              value={stageTarget}
              onChange={(e) => setStageTarget(e.target.value as ContentStage)}
              disabled={!state.id}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 disabled:text-neutral-600"
            >
              <option value="draft">draft (localhost)</option>
              <option value="preview">preview (preview.chesscito.com)</option>
              <option value="published">published (chesscito.com)</option>
            </select>
            <button
              type="button"
              onClick={() => handleSetStage(stageTarget)}
              disabled={!state.id}
              className="rounded border border-neutral-700 px-3 py-1 font-semibold text-neutral-100 transition-colors hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
            >
              Set stage
            </button>
          </div>

          {/* Export (read-only FEN block) */}
          <div className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <p className="mb-1 font-semibold text-neutral-300">Export (copy)</p>
            {fenBlock ? (
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-neutral-200" data-allow-select="true">
{`fen=${fenBlock.fen}
target=${fenBlock.target}
mover=${fenBlock.mover}`}
              </pre>
            ) : (
              <p className="text-neutral-500">Set start + goal to generate FEN.</p>
            )}
          </div>

          {/* Import (best-effort) */}
          <div className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <p className="mb-2 font-semibold text-neutral-300">
              Load from FEN (best-effort)
            </p>
            <label className="mb-2 flex flex-col">
              <span className="text-neutral-400">FEN</span>
              <textarea
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                rows={2}
                placeholder="8/8/8/8/8/8/8/R7 w - - 0 1"
                className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs"
                data-allow-select="true"
              />
            </label>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col">
                <span className="text-neutral-400">target</span>
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="e4"
                  className="rounded bg-neutral-800 px-2 py-1"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-neutral-400">mover (optional)</span>
                <input
                  type="text"
                  value={moverInput}
                  onChange={(e) => setMoverInput(e.target.value)}
                  placeholder="a1"
                  className="rounded bg-neutral-800 px-2 py-1"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleLoadFromFen}
              className="rounded bg-neutral-700 px-3 py-1 text-sm hover:bg-neutral-600"
            >
              Load
            </button>
            {loadNote && <p className="mt-2 text-neutral-400">{loadNote}</p>}
          </div>

          {/* Existing labyrinths — load one to edit */}
          <div className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <p className="mb-2 font-semibold text-neutral-300">
              Existing {state.piece} {kind === "exercise" ? "exercises" : "labyrinths"} (load to edit)
            </p>
            {pieceRecords.length ? (
              <ul className="flex flex-col gap-1">
                {pieceRecords.map((rec, i) => {
                  const active = !!rec.id && rec.id === state.id;
                  const isDisabled = !!rec.disabled;
                  return (
                    <li
                      key={rec.id ?? `${rec.piece}-${rec.order}-${i}`}
                      className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${
                        active ? "bg-neutral-800" : "bg-neutral-900/60"
                      } ${isDisabled ? "opacity-50" : ""}`}
                    >
                      <span className="truncate font-mono text-xs text-neutral-300">
                        {rec.id ?? "(no id)"} · target {rec.target} · order {rec.order}
                        {isDisabled ? (
                          <span className="ml-1 rounded bg-amber-900/70 px-1 text-amber-300">
                            disabled
                          </span>
                        ) : null}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleDisabled(rec)}
                          title={
                            isDisabled
                              ? "Re-enable (show in-game again)"
                              : "Soft-delete (hide from the game, keep the record)"
                          }
                          className={`rounded px-2 py-0.5 text-xs font-semibold text-white ${
                            isDisabled
                              ? "bg-emerald-600 hover:bg-emerald-500"
                              : "bg-amber-700 hover:bg-amber-600"
                          }`}
                        >
                          {isDisabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditRecord(rec)}
                          className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-neutral-100 hover:bg-neutral-700"
                        >
                          Edit
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-neutral-500">None saved for this piece yet.</p>
            )}
          </div>

          {/* Generated catalog reference */}
          <div className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
            <p className="mb-1 font-semibold text-neutral-300">
              Generated {state.piece} catalog (pick a non-colliding order)
            </p>
            {existing.length ? (
              <ul className="font-mono text-xs text-neutral-400">
                {existing.map((e) => (
                  <li key={e.id}>
                    {e.id} (opt {e.optimalMoves})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-500">None yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
