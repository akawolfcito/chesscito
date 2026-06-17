"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import {
  buildFenBlock,
  emptyState,
  type BuilderState,
} from "@/lib/labyrinth-builder/state";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import { validateBuilder } from "@/lib/labyrinth-builder/validate";
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

export const dynamic = "force-dynamic";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
// Ranks 8 (top) → 1 (bottom) so a1 renders bottom-left.
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

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

type FenLoadResult =
  | { ok: true; start: string; walls: string[]; captures: string[]; notes: string[] }
  | { ok: false; error: string };

/**
 * Shared FEN → builder-state derivation used by both "Load from FEN" and
 * "Edit existing". Resolves the mover square (explicit or the sole white piece
 * of `piece` type), then maps remaining whites → walls and blacks → captures.
 */
function deriveStateFromFen(
  fen: string,
  piece: PieceId,
  mover: string,
): FenLoadResult {
  let board: ReturnType<typeof parseFenBoard>;
  try {
    board = parseFenBoard(fen);
  } catch (e) {
    return { ok: false, error: `FEN parse error: ${(e as Error).message}` };
  }

  let moverSq = mover.trim();
  if (moverSq) {
    const p = board.get(moverSq);
    if (!p || p.color !== "w" || p.type !== piece) {
      return { ok: false, error: `mover ${moverSq} is not a white ${piece} in this FEN.` };
    }
  } else {
    const matches = [...board.entries()].filter(
      ([, p]) => p.color === "w" && p.type === piece,
    );
    if (matches.length === 1) {
      moverSq = matches[0][0];
    } else if (matches.length === 0) {
      return { ok: false, error: `No white ${piece} found — set mover or change piece.` };
    } else {
      return { ok: false, error: `Ambiguous: ${matches.length} white ${piece}s — set mover.` };
    }
  }

  const walls: string[] = [];
  const captures: string[] = [];
  for (const [sq, p] of board) {
    if (sq === moverSq) continue;
    if (p.color === "w") walls.push(sq);
    else captures.push(sq); // black squares → captures (pawn only downstream)
  }

  const notes: string[] = [];
  if (piece !== "pawn" && captures.length)
    notes.push(`${captures.length} black square(s) ignored (captures only for pawn)`);

  return { ok: true, start: moverSq, walls, captures, notes };
}

export default function LabyrinthBuilderPage() {
  if (process.env.NODE_ENV === "production") notFound();

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
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const refreshRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/dev/labyrinth?kind=${kind}`);
      const data = (await res.json()) as { ok?: boolean; records?: LabyrinthRecord[] };
      if (data?.ok && Array.isArray(data.records)) setRecords(data.records);
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
      captures: piece === "pawn" ? prev.captures : [],
    }));
    if (brush === "capture" && piece !== "pawn") setBrush("start");
  }

  function toggleIn(list: string[], sq: string): string[] {
    return list.includes(sq) ? list.filter((x) => x !== sq) : [...list, sq];
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
        if (state.piece === "pawn") update({ captures: toggleIn(state.captures, sq) });
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
      captures: piece === "pawn" ? derived.captures : [],
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
      goal: rec.target,
      walls: derived.walls,
      captures: rec.piece === "pawn" ? derived.captures : [],
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
    if (!result.ok || !fenBlock) return;
    try {
      const res = await fetch("/api/dev/labyrinth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Preserved exercise-only / unknown fields (tier, tags, …) first, so
          // an edit never drops them; explicit fields below win on conflict.
          ...editExtras,
          kind,
          id: state.id || undefined,
          piece: state.piece,
          ...fenBlock,
          explanation: state.explanation || undefined,
          tier: state.tier || undefined,
          tags: state.tags && state.tags.length ? state.tags : undefined,
          order: state.order,
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setToast({ kind: "ok", text: "Saved — reload /exercises to see it" });
        void refreshRecords();
      } else {
        const errs = Array.isArray(data?.errors)
          ? data.errors.join("; ")
          : "Save failed";
        setToast({ kind: "err", text: errs });
      }
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    }
  }

  const generatedByKind =
    kind === "exercise" ? GENERATED_EXERCISES : GENERATED_LABYRINTHS;
  const existing = generatedByKind[state.piece] ?? [];

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
        {/* ── Board column ── */}
        <section className="flex flex-col gap-3">
          <h1 className="text-lg font-bold">
            {kind === "exercise" ? "Exercise" : "Labyrinth"} Builder (dev)
          </h1>

          {/* Kind toggle — same editor authors both surfaces. */}
          <div className="flex gap-2" role="group" aria-label="Puzzle kind">
            {(["exercise", "labyrinth"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKindChange(k)}
                className={`rounded px-3 py-1 text-sm capitalize ${
                  kind === k
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="inline-grid grid-cols-[1.25rem_repeat(8,2.5rem)] gap-0">
            {/* file labels (top) */}
            <div />
            {FILES.map((f) => (
              <div
                key={`top-${f}`}
                className="flex h-5 items-center justify-center text-xs text-slate-400"
              >
                {f}
              </div>
            ))}
            {RANKS.map((rank) => (
              <RankRow
                key={`r-${rank}`}
                rank={rank}
                state={state}
                pathSquares={pathSquares}
                traceIndex={traceIndex}
                onCell={handleCell}
              />
            ))}
          </div>

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
                      ? "bg-sky-500 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {b}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTracedPath([])}
              className="rounded bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700"
            >
              clear trace
            </button>
          </div>
          <p className="text-xs text-slate-500">
            green=start · amber★=goal · slate=wall · red=capture · dot=BFS path ·
            number=traced order
          </p>
        </section>

        {/* ── Controls column ── */}
        <section className="flex flex-1 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-sm">
              <span className="text-slate-400">Piece</span>
              <select
                value={state.piece}
                onChange={(e) => handlePieceChange(e.target.value as PieceId)}
                className="rounded bg-slate-800 px-2 py-1"
              >
                {PIECES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-400">Order</span>
              <input
                type="number"
                value={state.order}
                onChange={(e) => update({ order: Number(e.target.value) || 0 })}
                className="rounded bg-slate-800 px-2 py-1"
              />
            </label>
            <label className="col-span-2 flex flex-col text-sm">
              <span className="text-slate-400">id (optional)</span>
              <input
                type="text"
                value={state.id ?? ""}
                onChange={(e) => update({ id: e.target.value || undefined })}
                placeholder="auto if blank"
                className="rounded bg-slate-800 px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-400">tier</span>
              <select
                value={state.tier ?? "medium"}
                onChange={(e) =>
                  update({ tier: e.target.value as ExerciseTier })
                }
                className="rounded bg-slate-800 px-2 py-1 capitalize"
              >
                {TIERS.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-400">tags (comma-sep)</span>
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
                className="rounded bg-slate-800 px-2 py-1"
              />
            </label>
            <label className="col-span-2 flex flex-col text-sm">
              <span className="text-slate-400">
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
                className="rounded bg-slate-800 px-2 py-1"
              />
              {kind === "exercise" && !state.explanation ? (
                <span className="mt-1 text-xs text-amber-400/80">
                  Empty → shows the generic “Exercise N” label in-game.
                </span>
              ) : null}
            </label>
          </div>

          {/* Validation */}
          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Optimal moves</span>
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
            <div className="flex items-center justify-between rounded border border-sky-700 bg-sky-950/60 px-3 py-2 text-sm">
              <span className="text-sky-300">
                Editing <span className="font-mono font-semibold">{state.id}</span>
              </span>
              <button
                type="button"
                onClick={handleNew}
                title={`Start a fresh ${kind} (discard current edit)`}
                className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
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
              disabled={!result.ok}
              className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              Save
            </button>
            {toast && (
              <span
                className={
                  toast.kind === "ok" ? "text-emerald-400" : "text-red-400"
                }
              >
                {toast.text}
              </span>
            )}
          </div>

          {/* Export (read-only FEN block) */}
          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <p className="mb-1 font-semibold text-slate-300">Export (copy)</p>
            {fenBlock ? (
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-slate-200" data-allow-select="true">
{`fen=${fenBlock.fen}
target=${fenBlock.target}
mover=${fenBlock.mover}`}
              </pre>
            ) : (
              <p className="text-slate-500">Set start + goal to generate FEN.</p>
            )}
          </div>

          {/* Import (best-effort) */}
          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <p className="mb-2 font-semibold text-slate-300">
              Load from FEN (best-effort)
            </p>
            <label className="mb-2 flex flex-col">
              <span className="text-slate-400">FEN</span>
              <textarea
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                rows={2}
                placeholder="8/8/8/8/8/8/8/R7 w - - 0 1"
                className="rounded bg-slate-800 px-2 py-1 font-mono text-xs"
                data-allow-select="true"
              />
            </label>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col">
                <span className="text-slate-400">target</span>
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="e4"
                  className="rounded bg-slate-800 px-2 py-1"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-slate-400">mover (optional)</span>
                <input
                  type="text"
                  value={moverInput}
                  onChange={(e) => setMoverInput(e.target.value)}
                  placeholder="a1"
                  className="rounded bg-slate-800 px-2 py-1"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleLoadFromFen}
              className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
            >
              Load
            </button>
            {loadNote && <p className="mt-2 text-slate-400">{loadNote}</p>}
          </div>

          {/* Existing labyrinths — load one to edit */}
          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <p className="mb-2 font-semibold text-slate-300">
              Existing {state.piece} {kind === "exercise" ? "exercises" : "labyrinths"} (load to edit)
            </p>
            {pieceRecords.length ? (
              <ul className="flex flex-col gap-1">
                {pieceRecords.map((rec, i) => {
                  const active = !!rec.id && rec.id === state.id;
                  return (
                    <li
                      key={rec.id ?? `${rec.piece}-${rec.order}-${i}`}
                      className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${
                        active ? "bg-sky-950/60" : "bg-slate-800/60"
                      }`}
                    >
                      <span className="truncate font-mono text-xs text-slate-300">
                        {rec.id ?? "(no id)"} · target {rec.target} · order {rec.order}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEditRecord(rec)}
                        className="shrink-0 rounded bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-sky-500"
                      >
                        Edit
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-500">None saved for this piece yet.</p>
            )}
          </div>

          {/* Generated catalog reference */}
          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <p className="mb-1 font-semibold text-slate-300">
              Generated {state.piece} catalog (pick a non-colliding order)
            </p>
            {existing.length ? (
              <ul className="font-mono text-xs text-slate-400">
                {existing.map((e) => (
                  <li key={e.id}>
                    {e.id} (opt {e.optimalMoves})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">None yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function RankRow({
  rank,
  state,
  pathSquares,
  traceIndex,
  onCell,
}: {
  rank: number;
  state: BuilderState;
  pathSquares: Set<string>;
  traceIndex: Map<string, number>;
  onCell: (sq: string) => void;
}) {
  return (
    <>
      <div className="flex w-5 items-center justify-center text-xs text-slate-400">
        {rank}
      </div>
      {FILES.map((f) => {
        const sq = `${f}${rank}`;
        const isStart = state.start === sq;
        const isGoal = state.goal === sq;
        const isWall = state.walls.includes(sq);
        const isCapture = state.captures.includes(sq);
        const inPath = pathSquares.has(sq);
        const traceOrder = traceIndex.get(sq);
        // Checker background for empty squares.
        const fileIdx = f.charCodeAt(0) - 97;
        const isDark = (fileIdx + rank) % 2 === 0;

        let bg = isDark ? "bg-slate-800/60" : "bg-slate-700/40";
        if (isWall) bg = "bg-slate-500";
        if (isCapture) bg = "bg-red-600";
        if (isGoal) bg = "bg-amber-500";
        if (isStart) bg = "bg-emerald-500";

        return (
          <button
            key={sq}
            type="button"
            onClick={() => onCell(sq)}
            className={`relative flex h-10 w-10 items-center justify-center border border-slate-900 text-sm font-bold ${bg}`}
            title={sq}
          >
            {isStart && "●"}
            {isGoal && !isStart && "★"}
            {inPath && !isStart && !isGoal && (
              <span className="absolute h-2 w-2 rounded-full bg-sky-300" />
            )}
            {traceOrder !== undefined && (
              <span className="absolute right-0.5 top-0.5 text-[9px] leading-none text-white/90">
                {traceOrder}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
