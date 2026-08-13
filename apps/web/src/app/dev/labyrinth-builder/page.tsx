"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BrickWall,
  CheckCircle2,
  Crown,
  Download,
  Eye,
  Flag,
  Footprints,
  Grid2x2,
  Pencil,
  Plus,
  Save,
  Skull,
  Star,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";
import {
  buildFenBlock,
  buildSaveRecord,
  deriveStateFromFen,
  emptyState,
  exportBlock,
  extraFields,
  type AuthoredEnemy,
  type BuilderState,
} from "@/lib/labyrinth-builder/state";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";
// `import type` ONLY: baseline-write imports node:fs, and this is a client
// component. The type is erased at compile time, so nothing follows it into the
// browser bundle.
import type { BucketedRecord } from "@/lib/content/baseline-write";
import { validateBuilder } from "@/lib/labyrinth-builder/validate";
import {
  isKindEditable,
  kindLabel,
  isTargetlessKind,
  isThreatKind,
  watchedSquares,
  KIND_CAPABILITY,
} from "@/lib/labyrinth-builder/authoring";
import { PROMOTABLE_PIECES } from "@/lib/game/promotion-run";
import { BuilderPreview, isPreviewable } from "@/components/dev/builder-preview";
import {
  Field,
  Legend,
  Mono,
  Section,
  Segmented,
  devInputClass,
} from "@/components/dev/ui";
import {
  clearStoredToast,
  formatPublishResult,
  readStoredToast,
  storeToast,
  type PublishResultLike,
  type PublishToast,
} from "@/lib/labyrinth-builder/publish-toast";
import {
  formatPromoteResult,
  type PromoteResultLike,
} from "@/lib/labyrinth-builder/promote-toast";
import type { ContentStage } from "@/lib/content/overlay-types";
// The constant only — importing lint.ts here would drag the BFS solver and the
// FEN mapper toward the client bundle just to print a number.
import { MAX_DIFFICULTY_STEP } from "@/lib/content/pacing";
import { posToSquare } from "@/lib/game/fen-puzzle";
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

// Black sprites for enemies, so a threat's TYPE is visible on the paint board —
// a knight and a rook watch very different squares.
const ENEMY_SRC: Record<PieceId, string> = {
  rook: `${THEME_CONFIG.piecesBase}/b-rook.png`,
  bishop: `${THEME_CONFIG.piecesBase}/b-bishop.png`,
  knight: `${THEME_CONFIG.piecesBase}/b-knight.png`,
  pawn: `${THEME_CONFIG.piecesBase}/b-pawn.png`,
  queen: `${THEME_CONFIG.piecesBase}/b-queen.png`,
  king: `${THEME_CONFIG.piecesBase}/b-king.png`,
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
  // A translucent red wash over a square an enemy watches — the SAME set the
  // game computes (attackedSquares). Threat kinds only; drawn UNDER the sprites.
  watched: {
    position: "absolute",
    inset: 0,
    background: "rgba(248, 113, 113, 0.22)",
    borderRadius: "12%",
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

/** `star` paints the EXTRA goals of a Star Sweep (the ones after `goal`), so the
 *  first star stays the `goal` brush and `target === targets[0]` holds by
 *  construction rather than by a rule someone has to remember. */
type Brush = "start" | "goal" | "star" | "wall" | "capture" | "trace";
/** WHICH FILE the record lives in. Not the game — that is the record's `kind`. */
type Bucket = "exercise" | "labyrinth";

/** Icons for the tool palette. `capture` is the enemy brush; `trace` walks a
 *  route by hand. Decoration only — the written label under each icon is what
 *  names the tool, so nothing here has to be guessed from a glyph. */
const BRUSH_ICON: Record<Brush, LucideIcon> = {
  start: Crown,
  goal: Flag,
  star: Star,
  wall: BrickWall,
  capture: Skull,
  trace: Footprints,
};

const TIERS: ExerciseTier[] = ["easy", "medium", "hard"];

/** The colour key under the board. Matches the CELL_OVERLAY values above. */
const BOARD_LEGEND = [
  { swatch: "bg-neutral-700", label: "Wall" },
  { swatch: "bg-red-400/40 ring-2 ring-inset ring-red-400/80", label: "Enemy / watched" },
  { swatch: "bg-amber-400", label: "Star / goal" },
  { swatch: "bg-sky-300", label: "BFS path" },
];

function posKey(p: BoardPosition): string {
  return posToSquare(p);
}

// `deriveStateFromFen` used to live here, unexported — which is exactly why the
// round-trip against `buildFenBlock` went untested, and why the enemy type could
// be lost for this long without anyone noticing. It now lives next to its
// inverse in lib/labyrinth-builder/state.ts, where the pair is tested as one.

export default function LabyrinthBuilderPage() {
  if (!isDevSurfaceEnabled()) notFound();

  const [bucket, setBucket] = useState<Bucket>("exercise");
  const [state, setState] = useState<BuilderState>(() => emptyState("rook", "exercise"));
  // Exercise-only (or otherwise non-UI) fields of the record being edited, so
  // a save round-trips them instead of dropping them.
  const [editExtras, setEditExtras] = useState<Record<string, unknown>>({});
  const [brush, setBrush] = useState<Brush>("start");
  /** Paint = author the position; Preview = play the real board on the draft.
   *  Only one board is mounted at a time (behavior 11). */
  const [mode, setMode] = useState<"paint" | "preview">("paint");
  /** Which black piece the enemy brush paints on a threat kind (safe-path,
   *  promotion-run). Ignored elsewhere — the pawn's captures stay pawns. */
  const [enemyPiece, setEnemyPiece] = useState<PieceId>("knight");
  const [tracedPath, setTracedPath] = useState<string[]>([]);
  const [fenInput, setFenInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [moverInput, setMoverInput] = useState("");
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [records, setRecords] = useState<BucketedRecord[]>([]);
  // The shared PublishToast rather than a structural copy of it: the local
  // duplicate silently dropped `warnings` when the mapper started carrying
  // them, which is exactly how they went unread in the first place.
  const [toast, setToast] = useState<PublishToast | null>(null);
  /* ⚠️ Saving RELOADS this page: it writes content/*.json and the generated
   * catalog module, both inside the tree Next dev watches, so Fast Refresh wipes
   * the state above. The verdict — including every save-time linter warning —
   * was computed, rendered and destroyed in the same beat, and the only way to
   * read it was to photograph the screen before it vanished (founder, 2026-08-12).
   * So the toast is parked before the write and picked up on the way back in. */
  useEffect(() => {
    const restored = readStoredToast();
    if (restored) setToast(restored);
  }, []);
  /** Ad-hoc status line (loaded a record, bad id, network threw…). Only the
   *  catalog linter produces warnings, and it only runs on Save, so everything
   *  else reports an empty list rather than leaving the field undefined —
   *  which is what let these go unrendered before. */
  const say = (kind: PublishToast["kind"], text: string) =>
    setToast({ kind, text, warnings: [] });
  /** Set a toast that must SURVIVE the reload the save triggers. Only the write
   *  paths use it; `say` is for messages whose cause did not touch disk. */
  const sayPersisted = (next: PublishToast) => {
    setToast(next);
    storeToast(next);
  };
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
      const res = await fetch(`/api/dev/labyrinth?bucket=${bucket}`);
      const data = (await res.json()) as {
        ok?: boolean;
        records?: BucketedRecord[];
        canWrite?: boolean;
      };
      if (data?.ok && Array.isArray(data.records)) setRecords(data.records);
      if (typeof data?.canWrite === "boolean") setCanWrite(data.canWrite);
    } catch {
      /* dev-only tool — silently ignore fetch failures */
    }
  }, [bucket]);

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
  // The squares the enemies watch, for the authoring overlay (AC-9). Empty for
  // non-threat kinds, so the wash only appears where it means something.
  const watched = useMemo(() => watchedSquares(state), [state]);

  // Preview is offered only for a VALID draft of a kind with a standalone board
  // (behavior 13: never mount a board on a broken level). `showPreview` falls
  // back to paint the instant the draft breaks or the kind stops qualifying.
  const canPreview = result.ok && !!result.preview && isPreviewable(state.kind);
  const showPreview = mode === "preview" && canPreview;
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
      // A threat kind keeps its enemies across a piece swap; elsewhere only a
      // pawn has any (its capture targets).
      enemies: isThreatKind(prev.kind) || piece === "pawn" ? prev.enemies : [],
    }));
    if (brush === "capture" && piece !== "pawn" && !isThreatKind(state.kind)) setBrush("start");
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
      case "star":
        // The main goal is already star #1. Silently adding a duplicate would
        // land on the validator's "'targets' repeats a square", which is a true
        // message about a mistake the UI could simply not allow.
        if (sq === state.goal) {
          say("warn", `${sq} is already the first star — paint the others elsewhere.`);
          break;
        }
        update({ extraGoals: toggleIn(state.extraGoals ?? [], sq) });
        break;
      case "wall":
        update({ walls: toggleIn(state.walls, sq) });
        break;
      case "capture":
        // Threat kinds paint the SELECTED black piece (safe-path's knight, a
        // promotion-run's rook…); a pawn exercise still paints its pawn captures.
        if (isThreatKind(state.kind)) {
          update({ enemies: toggleEnemy(state.enemies, sq, enemyPiece) });
        } else if (state.piece === "pawn") {
          update({ enemies: toggleEnemy(state.enemies, sq, "pawn") });
        }
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
      // A FEN carries no stars, and this is a NEW position: keeping the previous
      // ones would leave them pointing at squares of the board that just got
      // replaced — stars nobody placed, on a level nobody authored.
      extraGoals: [],
      walls: derived.walls,
      enemies: isThreatKind(prev.kind) || piece === "pawn" ? derived.enemies : [],
    }));
    setTracedPath([]);
    const notes = [...derived.notes];
    if (!target) notes.push("no target given — kept previous goal");
    if (state.extraGoals?.length) notes.push("sweep stars cleared (a FEN carries none)");
    setLoadNote(
      `Loaded: start=${derived.start}, ${derived.walls.length} wall(s)` +
        (notes.length ? ` — ${notes.join("; ")}` : ""),
    );
  }

  function handleEditRecord(rec: LabyrinthRecord) {
    const recKind = rec.kind ?? (bucket === "exercise" ? "exercise" : "labyrinth");
    // Behavior 12 — a game the builder cannot safely edit yet stays closed. Today
    // that is Safe Path: loading it would drop the typed threats that ARE the
    // level. The list already blocks the Edit button; this refuses the call too.
    if (!isKindEditable(recKind)) {
      say(
        "warn",
        `${kindLabel(recKind)} is not editable in the builder yet — loading it would drop its threats. Coming in a later stage.`,
      );
      return;
    }
    const derived = deriveStateFromFen(rec.fen, rec.piece, rec.mover ?? "");
    if (!derived.ok) {
      say("err", `Cannot edit ${rec.id ?? "record"}: ${derived.error}`);
      return;
    }
    setState({
      // The record's real kind rides the state now, so the live validator judges
      // it as the game it is (recKind above defaults an absent kind to the bucket).
      kind: recKind,
      piece: rec.piece,
      start: derived.start,
      // A knight-tour record carries no target — it has no goal square to load.
      goal: rec.target ?? null,
      // The sweep's other stars. `targets[0]` is `target`, already loaded above,
      // so re-adding it here would paint a duplicate the validator then refuses.
      extraGoals: rec.targets?.slice(1) ?? [],
      walls: derived.walls,
      // A threat kind KEEPS its typed enemies (the knight that IS a safe-path
      // level); a pawn keeps its capture targets. This is the load that used to
      // drop safe-path's threats on the floor — the whole point of the redesign.
      enemies: isThreatKind(recKind) || rec.piece === "pawn" ? derived.enemies : [],
      promoteTo: rec.promoteTo,
      order: rec.order,
      explanation: rec.explanation,
      tier: rec.tier,
      tags: rec.tags,
      // The authoring-only teaching guide, so the founder reads (and can edit)
      // what this level is meant to teach instead of it hiding in editExtras.
      principle: rec.principle,
      learningObjective: rec.learningObjective,
      id: rec.id,
    });
    setEditExtras(extraFields(rec));
    setTracedPath([]);
    setLoadNote(null);
    say("ok", `Editing ${rec.id ?? "(no id)"}`);
  }

  function handleNew() {
    setState(emptyState(state.piece, bucket === "exercise" ? "exercise" : "labyrinth"));
    setEditExtras({});
    setTracedPath([]);
    setLoadNote(null);
    setToast(null);
    clearStoredToast();
  }

  function handleBucketChange(next: Bucket) {
    if (next === bucket) return;
    setBucket(next);
    // Switching surfaces discards any in-progress edit so we never save a
    // record into the wrong bucket.
    setState(emptyState(state.piece, next === "exercise" ? "exercise" : "labyrinth"));
    setEditExtras({});
    setTracedPath([]);
    setLoadNote(null);
    setToast(null);
    clearStoredToast();
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
        // ⚠️ Assembled in lib/labyrinth-builder/state.ts, not inline here: which
        // fields the UI OWNS (they win over the loaded copy) and which merely
        // ride `editExtras` verbatim is a rule with silent failure modes in both
        // directions, and inline it was untestable.
        body: JSON.stringify({
          bucket,
          record: buildSaveRecord(state, editExtras, fenBlock),
        }),
      });
      const data = (await res.json()) as PublishResultLike;
      sayPersisted(formatPublishResult(data));
      if (data?.baseline?.ok) void refreshRecords();
    } catch (e) {
      say("err", (e as Error).message);
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
      say("err", "Load or enter a record id first.");
      return;
    }
    try {
      const res = await fetch("/api/dev/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket, id, to }),
      });
      const data = (await res.json()) as PromoteResultLike;
      setToast(formatPromoteResult(data, id));
      void refreshRecords();
    } catch (e) {
      say("err", (e as Error).message);
    }
  }

  // Soft-delete toggle: flips a record's `disabled` flag via the normal Save
  // path (no destructive removal). A disabled record stays in content/*.json
  // for re-enabling but is excluded from the generated catalog. Operates on
  // the list row directly so it never disturbs the current edit.
  async function handleToggleDisabled(rec: BucketedRecord) {
    try {
      // Toggle through the publish proxy so the enable/disable also lands in the
      // draft overlay (baseline + overlay), same "todo en 1" path as Save.
      // The whole record rides along, `kind` included, so disabling a signature
      // game no longer demotes it to a labyrinth on the way out (AC-6). The
      // read-time `bucket` tag goes too; writeBaselineRecord strips it.
      const res = await fetch("/api/dev/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket, record: { ...rec, disabled: !rec.disabled } }),
      });
      const data = (await res.json()) as PublishResultLike;
      if (!data?.baseline?.ok) {
        sayPersisted(formatPublishResult(data));
        return;
      }
      const verb = rec.disabled ? "enabled" : "disabled";
      const id = rec.id ?? "record";
      setToast(
        data.overlay?.ok
          ? { kind: "ok", text: `${id} ${verb} as draft. Promote to publish. Remember to commit content/*.json.`, warnings: data.baseline.warnings ?? [] }
          : {
              kind: "warn",
              text: `${id} ${verb} in baseline; draft overlay update failed: ${(data.overlay?.errors ?? ["unknown"]).join("; ")}. Remember to commit content/*.json.`,
              warnings: data.baseline.warnings ?? [],
            },
      );
      void refreshRecords();
    } catch (e) {
      say("err", (e as Error).message);
    }
  }

  const generatedByBucket =
    bucket === "exercise" ? GENERATED_EXERCISES : GENERATED_LABYRINTHS;
  const existing = generatedByBucket[state.piece] ?? [];
  const bucketNoun = bucket === "exercise" ? "exercises" : "labyrinths";
  const enabledCount = pieceRecords.filter((r) => !r.disabled).length;
  const toastColor =
    toast?.kind === "ok"
      ? "text-emerald-400"
      : toast?.kind === "warn"
        ? "text-amber-400"
        : "text-red-400";

  return (
    /* ⚠️ The page itself NEVER scrolls: `h-screen` + `overflow-hidden`, with the
       header pinned as a flex row that cannot shrink and each column owning its
       own scrollbar below `lg`. That is deliberate and it is what the founder
       actually works in — the panel column is scrolled constantly, the board
       column is not (everything on it fits), and a shared page scroll drags the
       board away while you are reading a panel, then drags the panels away when
       you go back to paint. `min-h-0` on the tracks is what lets a grid child
       scroll at all: without it a flex/grid item floors at its content height
       and the overflow silently escapes to the page. */
    <main className="flex h-screen flex-col overflow-hidden bg-black text-neutral-100">
      {/* ── Top bar: what record am I on, and the two verbs that act on it ──
          `shrink-0`, not `sticky`: it is a flex row outside the scroll
          containers, so it is always on screen by construction rather than by
          a scroll position that a nested overflow could break. */}
      <header className="shrink-0 border-b border-neutral-800 bg-black/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Grid2x2 className="h-4 w-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight text-neutral-100">
                {bucket === "exercise" ? "Exercise" : "Labyrinth"} Builder
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-neutral-500">
                dev
              </p>
            </div>
          </div>

          {/* Bucket toggle — same editor authors both files. */}
          <Segmented
            ariaLabel="Content bucket"
            value={bucket}
            onChange={(v) => handleBucketChange(v as Bucket)}
            options={[
              { value: "exercise", label: "Exercise" },
              { value: "labyrinth", label: "Labyrinth" },
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Which record the board belongs to. It used to live halfway down
                the controls column, where it scrolled out of sight — and the
                one thing you must never be unsure of while painting is WHICH
                record you are painting. */}
            {state.id ? (
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
                Editing{" "}
                <span className="font-mono font-semibold text-neutral-100">
                  {state.id}
                </span>
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-neutral-800 px-3 py-1 text-xs text-neutral-500">
                New {bucket}
              </span>
            )}
            <button
              type="button"
              onClick={handleNew}
              title={`Start a fresh ${bucket} (discard current edit)`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> New
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!result.ok || isSaving || !canWrite}
              title={
                canWrite
                  ? undefined
                  : "Baseline write is local-only: this deploy's filesystem is read-only."
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              {isSaving ? "Saving draft…" : "Save draft"}
            </button>
          </div>
        </div>

        {/* Status line, full width under the bar: the toast plus the reason Save
            is off where it is off. Says WHY, instead of letting the founder
            press a dead button — the probes are useful on preview; Save can
            never be. */}
        {(toast || !canWrite) && (
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 pb-2 text-xs">
            {!canWrite && (
              <span className="text-amber-400" data-testid="lb-readonly-note">
                Read-only here — baseline write is local-only.
              </span>
            )}
            {toast && <span className={toastColor}>{toast.text}</span>}
          </div>
        )}
      </header>

      {/* ⚠️ 26rem is not a guess: `GameBoard` caps itself at its default
          `maxWidth` of 23.5rem, so the board is the SAME size it has always
          been and a wider column would only add dead air (the old 35rem column
          did exactly that). Widening the board means passing `maxWidth`, not
          widening this track. */}
      <div className="mx-auto grid w-full min-h-0 max-w-[1500px] flex-1 grid-cols-1 gap-5 overflow-y-auto px-4 lg:grid-cols-[26rem_1fr] lg:overflow-hidden">
        {/* ── Board column. Its OWN scroll: on a short viewport the tool palette
            and the verdict still have somewhere to go, without ever moving the
            panel column. In practice it rarely scrolls — everything fits. ── */}
        <aside className="flex flex-col gap-3 py-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              {/* Paint = author the position; Preview = play the real board. */}
              <Segmented
                ariaLabel="Board mode"
                value={showPreview ? "preview" : "paint"}
                onChange={(v) => setMode(v as "paint" | "preview")}
                options={[
                  { value: "paint", label: "Paint", icon: Pencil },
                  {
                    value: "preview",
                    label: "Preview",
                    icon: Eye,
                    disabled: !canPreview,
                    title: canPreview
                      ? undefined
                      : "Preview needs a valid draft of a game with its own board (queens, tour, diagonal-run, promotion-run, safe-path).",
                  },
                ]}
              />
              {!showPreview && (
                <button
                  type="button"
                  onClick={() => setTracedPath([])}
                  className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                >
                  clear trace
                </button>
              )}
            </div>

            {showPreview && result.preview ? (
              <BuilderPreview exercise={result.preview} kind={state.kind} />
            ) : (
              <>
                {/* ⛔ The REAL game board, untouched. Every overlay below is the
                    same one the player sees; nothing here is a drawing of a
                    board, and it must not become one. */}
                <ProceduralBoard
                  onCellClick={(_file, _rank, sq) => handleCell(sq)}
                  renderCell={(_file, _rank, sq) => {
                    const isStart = state.start === sq;
                    const isGoal = state.goal === sq;
                    // The extra stars of a sweep. Numbered from 2 because the goal is
                    // star 1 — an unnumbered field of identical stars would hide WHICH
                    // one is `targets[0]`, and that one is the only one whose position
                    // in the list means anything (it must be the cheap star).
                    const extraStar = (state.extraGoals ?? []).indexOf(sq);
                    const isExtraStar = extraStar >= 0;
                    const isWall = state.walls.includes(sq);
                    const enemy = state.enemies.find((e) => e.square === sq);
                    const isCapture = !!enemy;
                    const inPath = pathSquares.has(sq);
                    const traceOrder = traceIndex.get(sq);
                    const isWatched = watched.has(sq);
                    return (
                      <>
                        {isWatched && !isStart && !isCapture && (
                          <span style={CELL_OVERLAY.watched} />
                        )}
                        {isWall && !isStart && !isGoal && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src="/art/labyrinths/wall.png" alt="" style={CELL_OVERLAY.wall} />
                        )}
                        {enemy && !isStart && (
                          <>
                            <span style={CELL_OVERLAY.capture} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ENEMY_SRC[enemy.piece]} alt="" style={CELL_OVERLAY.sprite} />
                          </>
                        )}
                        {isStart ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={PIECE_SRC[state.piece]} alt="" style={CELL_OVERLAY.sprite} />
                        ) : isGoal || isExtraStar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={STAR_SRC} alt="" style={CELL_OVERLAY.star} />
                        ) : null}
                        {/* Only numbered once it IS a sweep: a lone "1" on a plain
                            one-goal board would announce a mechanic that is not on. */}
                        {(state.extraGoals?.length ?? 0) > 0 && (isGoal || isExtraStar) && (
                          <span style={CELL_OVERLAY.trace}>
                            {isGoal ? 1 : extraStar + 2}
                          </span>
                        )}
                        {inPath && !isStart && !isGoal && !isExtraStar && !isWall && (
                          <span style={CELL_OVERLAY.dot} />
                        )}
                        {traceOrder !== undefined && (
                          <span style={CELL_OVERLAY.trace}>{traceOrder}</span>
                        )}
                      </>
                    );
                  }}
                />

                {/* Tools */}
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                    Tools
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["start", "goal", "star", "wall", "capture", "trace"] as Brush[]).map((b) => {
                      const disabled =
                        // The enemy brush is for a pawn's captures OR a threat kind's
                        // typed pieces; hidden for the kinds that have neither.
                        (b === "capture" && state.piece !== "pawn" && !isThreatKind(state.kind)) ||
                        // The targetless kinds (queens, knight-tour, promotion-run) have
                        // no goal square to paint — hide the brush so it can't be set.
                        (b === "goal" && isTargetlessKind(state.kind)) ||
                        // Sweeps run in exercises and labyrinths. The five signature
                        // games each have their own solver answering their own question,
                        // and the pawn has no sweep solver at all — it never retreats, so
                        // its legs are not independent and the pairwise sum is not the
                        // optimum. Both are refused by the validator; hiding the brush
                        // means the author never paints a board bound for a 400.
                        (b === "star" &&
                          ((state.kind !== "exercise" && state.kind !== "labyrinth") ||
                            state.piece === "pawn"));
                      if (disabled) return null;
                      const label = b === "capture" && isThreatKind(state.kind) ? "enemy" : b;
                      const Icon = BRUSH_ICON[b];
                      const active = brush === b;
                      return (
                        <button
                          key={b}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setBrush(b)}
                          className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs capitalize transition-colors ${
                            active
                              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                              : "border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-100"
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isThreatKind(state.kind) ? (
                  <div
                    className="mt-3 flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Enemy piece"
                  >
                    <span className="text-xs text-neutral-500">enemy:</span>
                    {KIND_CAPABILITY[state.kind].enemyPieces.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setEnemyPiece(p);
                          setBrush("capture");
                        }}
                        className={`rounded px-2 py-1 text-xs capitalize ${
                          enemyPiece === p
                            ? "bg-neutral-100 text-black"
                            : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : null}

                <Legend items={BOARD_LEGEND} className="mt-4" />
                <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                  piece=start · ★=goal · ★2…★5=sweep stars (★1 is the goal, and it
                  must be the CHEAP one) · dark tile=wall · red ring/black
                  piece=enemy · red wash=watched by an enemy · blue dot=BFS path ·
                  number=traced order
                </p>
              </>
            )}
          </div>

          {/* Validation — now directly under the board it judges. It used to sit
              in the far column, so the answer to "is this level legal?" was
              nowhere near the squares that decide it. */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                {(state.extraGoals?.length ?? 0) > 0
                  ? `Optimal moves (best order, ${(state.extraGoals?.length ?? 0) + 1} stars)`
                  : "Optimal moves"}
              </span>
              <span className="font-mono text-base text-neutral-100">
                {result.optimalMoves ?? "—"}
              </span>
            </div>
            {/* Naming what the number measures, because it changes meaning under
                the author's hands: on a sweep it is the cheapest ORDER over every
                star, not the route to the goal — and the board deliberately
                stops drawing a path, so there is nothing on screen to read it
                off. An unexplained number that jumped is read as a bug. */}
            {(state.extraGoals?.length ?? 0) > 0 && result.ok ? (
              <p className="mt-1 text-xs text-neutral-500">
                The cheapest order that collects all of them. No path is drawn: the
                BFS route would only reach ★1.
              </p>
            ) : null}
            {result.ok && !result.errors.length && !result.warnings.length ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> Ready
                to save.
              </p>
            ) : null}
            {result.errors.map((e, i) => (
              <p key={`e-${i}`} className="mt-1 flex items-start gap-1.5 text-xs text-red-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {e}
              </p>
            ))}
            {result.warnings.map((w, i) => (
              <p key={`w-${i}`} className="mt-1 flex items-start gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
              </p>
            ))}
          </div>
        </aside>

        {/* ── Panel column, ordered by how often the author touches it ──
            The loop is: pick a piece → open one of its records. Those two are
            first and adjacent. Everything below is used a handful of times a
            month and used to sit ABOVE the record list, which put the most
            frequent action at the bottom of the longest scroll. The order is
            pinned by __tests__/panel-order.test.tsx — nothing else can see it. */}
        <div className="flex flex-col gap-5 py-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {/* Save-time linter warnings — deliberately NOT part of the toast.
              These arrive from the catalog linter on Save (curve pacing,
              duplicate positions, decorative obstacles…), and the founder
              could never read them: the save triggers refreshRecords() and
              the line was gone before it registered. Worse, the mapper used
              to drop them entirely, so the ones that mattered most never
              rendered at all.

              This panel is durable on purpose: it holds the LAST save's
              warnings until the next Save replaces them, or until dismissed
              by hand. A warning nobody can finish reading is the same as no
              warning, and the whole point of choosing WARNING over ERROR for
              the difficulty curve was that the author would actually see it.

              ⚠️ Not a <Section>: it is transient, and a heading here would
              wedge itself into the panel order the test pins. */}
          {toast && toast.warnings.length > 0 && (
            <div
              data-testid="lb-save-warnings"
              className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-amber-300">
                  {toast.warnings.length} warning
                  {toast.warnings.length === 1 ? "" : "s"} from the last save
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setToast({ ...toast, warnings: [] });
                    clearStoredToast();
                  }}
                  className="shrink-0 text-xs text-neutral-400 underline hover:text-neutral-200"
                >
                  dismiss
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {toast.warnings.map((w, i) => (
                  <li key={`sw-${i}`} className="text-amber-400">
                    ⚠ {w}
                  </li>
                ))}
              </ul>
              {/* Names the knob so the panel is closed over itself. Every
                  warning already carries what it found and what to do about
                  it; the one thing it could not say without repeating itself
                  on every line is that the threshold is yours to move. Without
                  this the author has to remember where it lives, which is the
                  failure this whole panel exists to prevent. */}
              <p className="mt-2 text-xs text-neutral-400">
                These never block a save — they are advice, and you are the one
                who decides. Pacing warns past a {MAX_DIFFICULTY_STEP}-move step
                (<code>MAX_DIFFICULTY_STEP</code>, <code>lib/content/pacing.ts</code>).
              </p>
            </div>
          )}

          {/* ── 1. Pick a piece. Step one of every edit. ── */}
          <Section title="Piece">
            <Segmented
              ariaLabel="Piece"
              value={state.piece}
              onChange={(v) => handlePieceChange(v as PieceId)}
              options={PIECES.map((p) => ({ value: p, label: p }))}
              className="flex-wrap"
            />
          </Section>

          {/* ── 2. That piece's records. Step two, and the reason the piece
              picker sits directly above it. ── */}
          <Section
            title={`Existing ${state.piece} ${bucketNoun}`}
            hint={`${enabledCount} enabled`}
          >
            {pieceRecords.length ? (
              <ul className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
                {pieceRecords.map((rec, i) => {
                  const active = !!rec.id && rec.id === state.id;
                  const isDisabled = !!rec.disabled;
                  const recKind = rec.kind ?? (bucket === "exercise" ? "exercise" : "labyrinth");
                  const editable = isKindEditable(recKind);
                  return (
                    <li
                      key={rec.id ?? `${rec.piece}-${rec.order}-${i}`}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm ${
                        active ? "bg-emerald-500/10" : "bg-neutral-950/40"
                      } ${isDisabled ? "opacity-50" : ""}`}
                    >
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
                        {kindLabel(recKind)}
                      </span>
                      <span className="font-mono text-xs text-neutral-100">
                        {rec.id ?? "(no id)"}
                      </span>
                      <span className="text-xs text-neutral-500">
                        target{" "}
                        <span className="font-mono text-neutral-300">{rec.target}</span>
                      </span>
                      {isDisabled ? (
                        <span className="rounded bg-amber-900/70 px-1.5 py-0.5 text-[11px] text-amber-300">
                          disabled
                        </span>
                      ) : null}
                      <span className="ml-auto text-[11px] text-neutral-500">
                        order {rec.order}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleDisabled(rec)}
                        title={
                          isDisabled
                            ? "Re-enable (show in-game again)"
                            : "Soft-delete (hide from the game, keep the record)"
                        }
                        className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                          isDisabled
                            ? "text-emerald-400 hover:bg-emerald-500/10"
                            : "text-amber-400 hover:bg-amber-500/10"
                        }`}
                      >
                        {isDisabled ? "Enable" : "Disable"}
                      </button>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => handleEditRecord(rec)}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] font-semibold text-neutral-100 hover:bg-neutral-800"
                        >
                          <Pencil className="h-3 w-3" aria-hidden /> Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={`${kindLabel(recKind)} editing lands in a later stage — loading it now would drop its threats.`}
                          className="cursor-not-allowed rounded-md border border-neutral-800 px-2 py-1 text-[11px] font-semibold text-neutral-600"
                        >
                          Locked
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">
                None saved for this piece yet.
              </p>
            )}
          </Section>

          {/* ── 3. Everything below is rare. Order among them barely matters;
              what matters is that none of it precedes the two panels above. ── */}
          <Section title="Identity">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Order" hint="Position within the piece's sequence.">
                <input
                  type="number"
                  value={state.order}
                  onChange={(e) => update({ order: Number(e.target.value) || 0 })}
                  className={devInputClass}
                />
              </Field>
              <Field label="id" hint="Leave blank to auto-generate.">
                <input
                  type="text"
                  value={state.id ?? ""}
                  onChange={(e) => update({ id: e.target.value || undefined })}
                  placeholder="auto if blank"
                  className={`${devInputClass} font-mono`}
                />
              </Field>
              <Field label="tier">
                <select
                  value={state.tier ?? "medium"}
                  onChange={(e) => update({ tier: e.target.value as ExerciseTier })}
                  className={`${devInputClass} capitalize`}
                >
                  {TIERS.map((tr) => (
                    <option key={tr} value={tr}>
                      {tr}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="tags" hint="Comma-separated.">
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
                  className={devInputClass}
                />
              </Field>
              {state.kind === "promotion-run" ? (
                <Field
                  label="promote to"
                  hint="Win condition — the pawn must crown this."
                  className="sm:col-span-2"
                >
                  <select
                    value={state.promoteTo ?? ""}
                    onChange={(e) =>
                      update({ promoteTo: (e.target.value || undefined) as PieceId | undefined })
                    }
                    className={`${devInputClass} capitalize`}
                  >
                    <option value="">— choose a piece —</option>
                    {PROMOTABLE_PIECES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field
                label="description"
                hint={
                  bucket === "exercise" && !state.explanation ? (
                    <span className="text-amber-400/80">
                      Empty → shows the generic “Exercise N” label in-game.
                    </span>
                  ) : (
                    "Shown in-game."
                  )
                }
                className="sm:col-span-2"
              >
                <input
                  type="text"
                  value={state.explanation ?? ""}
                  onChange={(e) => update({ explanation: e.target.value || undefined })}
                  placeholder={
                    bucket === "exercise"
                      ? "e.g. Move your Rook straight to h8"
                      : undefined
                  }
                  className={devInputClass}
                />
              </Field>
            </div>
          </Section>

          {/* Teaching guide — authoring-only pedagogy the player never sees.
              It answers "what is this level meant to teach?" so the founder can
              review and improve every exercise/game. Pre-filled on Edit; saved
              on Save. `principle` is a stable one-lesson slug; learningObjective
              is the plain-language takeaway. */}
          <Section
            title="Teaching guide"
            hint="authoring only — never shown to players"
          >
            <div className="flex flex-col gap-4">
              <Field
                label="learning objective"
                hint="What the player should walk away knowing."
              >
                <textarea
                  value={state.learningObjective ?? ""}
                  onChange={(e) =>
                    update({ learningObjective: e.target.value || undefined })
                  }
                  rows={2}
                  placeholder="e.g. The rook travels any distance along one rank."
                  className={devInputClass}
                  data-allow-select="true"
                />
              </Field>
              <Field label="principle" hint="One-lesson slug.">
                <input
                  type="text"
                  value={state.principle ?? ""}
                  onChange={(e) => update({ principle: e.target.value || undefined })}
                  placeholder="e.g. rank-movement"
                  className={`${devInputClass} font-mono`}
                />
              </Field>
              {!state.learningObjective && !state.principle ? (
                <p className="text-xs text-sky-400/70">
                  No teaching guide authored yet — write what this{" "}
                  {bucket === "exercise" ? "exercise" : "game"} is meant to teach.
                </p>
              ) : null}
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Set the current record's stage. Save lands it at draft; pick where
                it should live and "Set stage" moves it there (the route detects the
                current version automatically). draft = localhost · preview =
                preview.chesscito.com · published = chesscito.com (players). */}
            <Section title="Stage" hint={state.id ?? "load a record"}>
              <div className="flex items-end gap-2">
                <Field label="Publish stage" className="flex-1">
                  <select
                    value={stageTarget}
                    onChange={(e) => setStageTarget(e.target.value as ContentStage)}
                    disabled={!state.id}
                    className={`${devInputClass} disabled:text-neutral-600`}
                  >
                    <option value="draft">draft (localhost)</option>
                    <option value="preview">preview (preview.chesscito.com)</option>
                    <option value="published">published (chesscito.com)</option>
                  </select>
                </Field>
                <button
                  type="button"
                  onClick={() => handleSetStage(stageTarget)}
                  disabled={!state.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
                >
                  <Upload className="h-4 w-4" aria-hidden /> Set stage
                </button>
              </div>
            </Section>

            <Section title="Export" hint="copy">
              {fenBlock ? (
                <Mono>{exportBlock(state, fenBlock)}</Mono>
              ) : (
                <p className="text-sm text-neutral-500">
                  Set start + goal to generate FEN.
                </p>
              )}
            </Section>
          </div>

          <Section title="Load from FEN" hint="best-effort import">
            <div className="flex flex-col gap-3">
              <Field label="FEN">
                <textarea
                  value={fenInput}
                  onChange={(e) => setFenInput(e.target.value)}
                  rows={2}
                  placeholder="8/8/8/8/8/8/8/R7 w - - 0 1"
                  className={`${devInputClass} font-mono text-xs`}
                  data-allow-select="true"
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="target">
                  <input
                    type="text"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="e4"
                    className={devInputClass}
                  />
                </Field>
                <Field label="mover" hint="Optional.">
                  <input
                    type="text"
                    value={moverInput}
                    onChange={(e) => setMoverInput(e.target.value)}
                    placeholder="a1"
                    className={devInputClass}
                  />
                </Field>
                <button
                  type="button"
                  onClick={handleLoadFromFen}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 px-4 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
                >
                  <Download className="h-4 w-4" aria-hidden /> Load
                </button>
              </div>
              {loadNote && <p className="text-xs text-neutral-400">{loadNote}</p>}
            </div>
          </Section>

          <Section
            title={`Generated ${state.piece} catalog`}
            hint="pick a non-colliding order"
          >
            {existing.length ? (
              <ul className="font-mono text-xs text-neutral-500">
                {existing.map((e) => (
                  <li key={e.id}>
                    {e.id} (opt {e.optimalMoves})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">None yet.</p>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}
