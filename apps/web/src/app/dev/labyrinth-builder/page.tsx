"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BrickWall,
  CheckCircle2,
  Copy,
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
import { isDirty, type DraftBaseline } from "@/lib/labyrinth-builder/dirty";
import {
  recordDisplayName,
  sortLibrary,
  type LibrarySort,
} from "@/lib/labyrinth-builder/library";
import {
  countByKind,
  groupWarnings,
  warningsAsText,
  WARNING_GUIDANCE,
  type WarningKind,
} from "@/lib/labyrinth-builder/warnings";
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
  IN_FLIGHT_TOAST,
  type PublishResultLike,
  type PublishToast,
} from "@/lib/labyrinth-builder/publish-toast";
import {
  formatPromoteResult,
  type PromoteResultLike,
} from "@/lib/labyrinth-builder/promote-toast";
import {
  clearStoredDraft,
  readStoredDraft,
  storeDraft,
} from "@/lib/labyrinth-builder/draft-restore";
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

/** An action that would THROW AWAY the current draft, parked until the author
 *  says yes. Every one of these used to run immediately and silently. */
type PendingAction =
  | { kind: "edit"; rec: BucketedRecord }
  | { kind: "new" }
  | { kind: "bucket"; to: Bucket };

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

/** Tier badge colours. Green→amber→red reads as difficulty without needing the
 *  word, but the word is there anyway — colour alone is not a label. */
const TIER_BADGE: Record<ExerciseTier, string> = {
  easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  hard: "border-red-500/40 bg-red-500/10 text-red-300",
};

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
  /** The last draft that agreed with disk. Everything that REPLACES the draft
   *  (open another record, New, switch bucket) is measured against this, and
   *  Discard restores it — which is why it holds the whole state, not a hash. */
  const [baseline, setBaseline] = useState<DraftBaseline>(() => ({
    state: emptyState("rook", "exercise"),
    extras: {},
  }));
  /** A draft-destroying action waiting for a yes. `null` = nothing pending. */
  const [pending, setPending] = useState<PendingAction | null>(null);
  /** Opens on `tier` — founder's call, 2026-08-13. The list is where you go to
   *  pick the next board to WRITE, and difficulty is what that choice turns on.
   *  `order` (the real in-game sequence, the view a curriculum is judged in) is
   *  one tap away and stays for that. */
  const [librarySort, setLibrarySort] = useState<LibrarySort>("tier");
  /** The last save's advice lives behind a button now. ⚠️ It used to be a panel
   *  wedged into the panel column, where it pushed a stable layout around on
   *  every save to say something that is advisory in two cases out of three. */
  const [showWarnings, setShowWarnings] = useState(false);
  const [warningFilter, setWarningFilter] = useState<WarningKind | "all">("all");
  const [copied, setCopied] = useState(false);
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
    /* ⚠️ And the DRAFT, for the same reason and the same reload. Without this,
     * Save threw you out of the record you had just saved — blank board, back to
     * the piece picker to hunt for it again — on the most repeated action in the
     * tool (founder, 2026-08-13). */
    const draft = readStoredDraft();
    if (draft) {
      setBucket(draft.bucket);
      setState(draft.state);
      setEditExtras(draft.extras);
      // ⛔ Only a save that LANDED makes the restored draft agree with disk. If
      // it failed, leaving the baseline at empty keeps the draft visibly dirty,
      // so the unsaved-changes guard still protects work that is only in the
      // browser — calling it clean here would hand the next click the right to
      // destroy it.
      setBaseline(
        draft.savedOk
          ? { state: draft.state, extras: draft.extras }
          : { state: emptyState(draft.state.piece, draft.state.kind), extras: {} },
      );
    }
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
    () => sortLibrary(records.filter((r) => r.piece === state.piece), librarySort),
    [records, state.piece, librarySort],
  );

  /** Is there work on screen that disk does not have? */
  const dirty = useMemo(
    () => isDirty(baseline, state, editExtras),
    [baseline, state, editExtras],
  );

  /** Mark the current draft as agreeing with disk. Called on load, on New, on
   *  bucket switch, and after a save that actually landed. */
  const rebaseline = useCallback(
    (next: BuilderState, extras: Record<string, unknown>) => {
      setBaseline({ state: next, extras });
      setPending(null);
    },
    [],
  );

  function update(patch: Partial<BuilderState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function handlePieceChange(piece: PieceId) {
    const next: BuilderState = {
      ...state,
      piece,
      // A threat kind keeps its enemies across a piece swap; elsewhere only a
      // pawn has any (its capture targets).
      enemies: isThreatKind(state.kind) || piece === "pawn" ? state.enemies : [],
    };
    setState(next);
    // ⚠️ The piece picker is ALSO the record list's filter — it is how you browse
    // to another piece's exercises. On a draft with nothing to lose that is
    // navigation, not an edit, so re-baseline instead of raising a false alarm
    // on every click. On a dirty draft it stays an edit, because it is one.
    if (!dirty) rebaseline(next, editExtras);
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

  function doEditRecord(rec: LabyrinthRecord) {
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
    const loaded: BuilderState = {
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
    };
    const extras = extraFields(rec);
    setState(loaded);
    setEditExtras(extras);
    // What just came off disk IS the baseline — an edit is measured from here.
    rebaseline(loaded, extras);
    setTracedPath([]);
    setLoadNote(null);
    /* ⛔ No toast here. It used to say `Editing rook-1` in the status strip,
       which the chip beside +New / Save draft ALREADY says — better placed and
       far more visible (founder, 2026-08-13). Two copies of one fact is one copy
       too many, and the status strip is for things that happened, not for state
       something else is already showing. */
    setToast(null);
    clearStoredToast();
  }

  function doNew() {
    const fresh = emptyState(state.piece, bucket === "exercise" ? "exercise" : "labyrinth");
    setState(fresh);
    setEditExtras({});
    rebaseline(fresh, {});
    setTracedPath([]);
    setLoadNote(null);
    setToast(null);
    clearStoredToast();
    // Also drop any parked restore: this draft was discarded ON PURPOSE, and
    // resurrecting it on the next reload would undo that.
    clearStoredDraft();
  }

  function doBucketChange(next: Bucket) {
    setBucket(next);
    // Switching surfaces discards any in-progress edit so we never save a
    // record into the wrong bucket.
    const fresh = emptyState(state.piece, next === "exercise" ? "exercise" : "labyrinth");
    setState(fresh);
    setEditExtras({});
    rebaseline(fresh, {});
    setTracedPath([]);
    setLoadNote(null);
    setToast(null);
    clearStoredToast();
    // Also drop any parked restore: this draft was discarded ON PURPOSE, and
    // resurrecting it on the next reload would undo that.
    clearStoredDraft();
  }

  /* ── The guard ────────────────────────────────────────────────────────────
     Every action that REPLACES the draft goes through here. On a clean draft
     they run exactly as before; on a dirty one they are parked in `pending`
     and the banner asks. This is the whole fix: these three used to fire
     immediately and the edit was gone with no prompt, no undo and no trace. */

  function requestEdit(rec: BucketedRecord) {
    if (dirty) return setPending({ kind: "edit", rec });
    doEditRecord(rec);
  }

  function requestNew() {
    if (dirty) return setPending({ kind: "new" });
    doNew();
  }

  function requestBucketChange(next: Bucket) {
    if (next === bucket) return;
    if (dirty) return setPending({ kind: "bucket", to: next });
    doBucketChange(next);
  }

  /** Yes — throw the draft away and do the thing. */
  function confirmPending() {
    const action = pending;
    setPending(null);
    if (!action) return;
    if (action.kind === "edit") doEditRecord(action.rec);
    else if (action.kind === "new") doNew();
    else doBucketChange(action.to);
  }

  /** Put the draft back to the last state that agreed with disk. The reason
   *  `baseline` holds the whole state instead of a hash. */
  function handleDiscard() {
    setState(baseline.state);
    setEditExtras(baseline.extras);
    setPending(null);
    setTracedPath([]);
    setLoadNote(null);
  }

  async function handleSave() {
    if (!result.ok || !fenBlock || isSaving || !canWrite) return;
    setIsSaving(true);
    /* ⛔ Park the draft BEFORE the request, not after — this is a RACE, and
       parking it afterwards loses it.
       The server writes content/*.json DURING the fetch, so Next's watcher can
       fire Fast Refresh at any moment from then on: potentially before the
       response is even read on the client. Everything below `await` is code that
       may simply never run. (That is also why the toast, parked one statement
       earlier than the draft was, kept surviving while the draft did not — the
       founder saw exactly that: the message came back, the board did not.)
       `savedOk: false` is the honest value here: nothing has landed yet. If the
       response does arrive it overwrites this with the truth; if the reload wins
       the race, the draft comes back marked as unsaved, which is the safe
       direction — the work is on screen and visibly not on disk. */
    storeDraft({ bucket, state, extras: editExtras, savedOk: false });
    /* ⛔ And the TOAST, for the same race and in the same breath. Parking the
       draft alone left the other half of the bug alive: when the reload won, the
       board came back with no message and no Details chip, so the save looked
       like it had simply done nothing (founder, 2026-08-13). Overwritten by the
       real verdict below if the response arrives in time. */
    storeToast(IN_FLIGHT_TOAST);
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
      // Upgrade the parked draft with the verdict, IF the reload has not already
      // taken the page. Same order as the toast, so neither can win over the
      // other.
      storeDraft({
        bucket,
        state,
        extras: editExtras,
        savedOk: !!data?.baseline?.ok,
      });
      sayPersisted(formatPublishResult(data));
      if (data?.baseline?.ok) {
        // It is on disk now, so this IS the new baseline. ⚠️ Only on a baseline
        // that actually landed: a failed write must leave the draft dirty, or
        // the banner would go quiet on work that is still only in the browser.
        rebaseline(state, editExtras);
        void refreshRecords();
      }
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
      // Enable/Disable writes to disk too, so it triggers the same reload — and
      // it operates on a LIST ROW, never on the draft. Parking the draft
      // unchanged is what stops a toggle from wiping the board you are editing.
      storeDraft({ bucket, state, extras: editExtras, savedOk: !dirty });
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
  /** The last save's advice, tagged by kind. */
  const classifiedWarnings = useMemo(
    () => groupWarnings(toast?.warnings ?? []),
    [toast],
  );
  const warningCounts = useMemo(
    () => countByKind(classifiedWarnings),
    [classifiedWarnings],
  );
  const shownWarnings =
    warningFilter === "all"
      ? classifiedWarnings
      : classifiedWarnings.filter((w) => w.kind === warningFilter);
  /** Is there anything worth opening? Notes, or a write whose full account the
   *  header strip is deliberately not showing. A clean save with nothing to add
   *  still offers it, because "Remember to commit" lives in that account. */
  const hasSaveDetail = classifiedWarnings.length > 0 || !!toast?.summary;
  /** What the draft is called in a sentence: its id, or what it would become. */
  const draftLabel = state.id?.trim() || `a new ${bucket}`;
  /** What the parked action would do, in the same sentence. */
  const pendingLabel =
    pending?.kind === "edit"
      ? `open ${pending.rec.id ?? "that record"}`
      : pending?.kind === "new"
        ? `start a new ${bucket}`
        : pending?.kind === "bucket"
          ? `switch to ${pending.to}`
          : "";
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
            onChange={(v) => requestBucketChange(v as Bucket)}
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
            {/* The dot is the only unsaved-work signal that is ALWAYS on screen:
                the banner lives in a column that scrolls, and the header does
                not. */}
            {state.id ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
                {dirty && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
                  />
                )}
                Editing{" "}
                <span className="font-mono font-semibold text-neutral-100">
                  {state.id}
                </span>
                {dirty && <span className="sr-only">(unsaved changes)</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-neutral-800 px-3 py-1 text-xs text-neutral-500">
                {dirty && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
                  />
                )}
                New {bucket}
                {dirty && <span className="sr-only">(unsaved changes)</span>}
              </span>
            )}
            {/* ── The last save's advice ──────────────────────────────────
                A BUTTON, not a panel. It used to be a block wedged into the
                panel column, which shoved a stable layout around on every save
                — to say something that is advisory in two kinds out of three.
                Now it costs one chip of space until you ask for it, and it goes
                quiet (neutral, no count) when the last save was clean. */}
            {hasSaveDetail && (
              <button
                type="button"
                data-testid="lb-warnings-button"
                onClick={() => setShowWarnings(true)}
                title="What the last save said"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  toast?.kind === "err"
                    ? "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    : classifiedWarnings.length > 0 || toast?.kind === "warn"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {classifiedWarnings.length > 0 ? classifiedWarnings.length : "Details"}
                <span className="sr-only"> from the last save — open</span>
              </button>
            )}
            <button
              type="button"
              onClick={requestNew}
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
            {/* ⚠️ `summary`, not `text`. The full account already runs to two
                sentences when the overlay fails and grows with every extra
                validation error — and this strip sits above a layout the
                founder asked to keep stable. A status line that can grow to
                several lines is the same problem the warnings panel had, one
                surface over. The full text is one click away, in the popup. */}
            {toast && (
              <span className={toastColor}>{toast.summary ?? toast.text}</span>
            )}
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
          {/* ── Unsaved work ──────────────────────────────────────────────
              ⚠️ Before this existed you could open another record on top of an
              edit and it was simply GONE — no prompt, no undo, and nothing on
              screen had ever said work was pending, so there was not even a
              moment where you could have noticed.

              Two states, one place: a standing "unsaved changes" notice with a
              Discard, and — when a draft-destroying action is parked — the same
              strip turned into the question. Deliberately NOT a <Section>: it is
              transient, and a heading here would wedge itself into the panel
              order that panel-order.test.tsx pins. */}
          {dirty && (
            <div
              data-testid="lb-unsaved"
              /* ⚠️ `sticky`, and the background is OPAQUE, both for the same
                 reason: found by using it. Clicking Edit on another row scrolls
                 that row into view, which pushed this strip off the top of the
                 column — so the guard fired, the draft was saved from being
                 destroyed, and on screen absolutely nothing appeared to happen.
                 A question you cannot see is the same as no question. */
              className="sticky top-0 z-10 rounded-xl border border-sky-500/50 bg-sky-950 p-3 text-sm shadow-lg shadow-black/60"
            >
              {pending ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sky-100">
                    Discard unsaved changes in{" "}
                    <span className="font-mono font-semibold">{draftLabel}</span>{" "}
                    and {pendingLabel}?
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={confirmPending}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      Discard and continue
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending(null)}
                      className="rounded-md border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-100 hover:bg-neutral-800"
                    >
                      Keep editing
                    </button>
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sky-100">
                    Unsaved changes in{" "}
                    <span className="font-mono font-semibold">{draftLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    title="Put the draft back to the last state that agreed with disk"
                    className="shrink-0 rounded-md border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-100 hover:bg-neutral-800"
                  >
                    Discard
                  </button>
                </div>
              )}
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
            hint={
              <span className="flex items-center gap-2">
                <span>{enabledCount} enabled</span>
                <Segmented
                  ariaLabel="Sort records"
                  value={librarySort}
                  onChange={(v) => setLibrarySort(v as LibrarySort)}
                  options={[
                    { value: "order", label: "order" },
                    { value: "tier", label: "tier" },
                  ]}
                />
              </span>
            }
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
                      {/* ⚠️ The NAME leads and the id follows. The list used to
                          show `rook-9` alone, which says where a board sits in a
                          file and nothing about what it is — and picking the
                          board you meant is the single most repeated act in this
                          tool. Falls back to the id, because plenty of records
                          genuinely have no description. */}
                      <span className="font-medium text-neutral-100">
                        {recordDisplayName(rec)}
                      </span>
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
                        {kindLabel(recKind)}
                      </span>
                      {/* Named as well as coloured: colour alone is not a label. */}
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          TIER_BADGE[rec.tier ?? "medium"]
                        }`}
                        title={rec.tier ? undefined : "No tier authored — the catalog treats it as medium."}
                      >
                        {rec.tier ?? "medium"}
                        {rec.tier ? "" : "?"}
                      </span>
                      {/* ⚠️ Only when it ADDS something. Today not one authored
                          exercise carries a description, so the name falls back
                          to the id — and printing it again beside itself put
                          `rook-1 … rook-1` on every single row. */}
                      {recordDisplayName(rec) !== rec.id && rec.id ? (
                        <span className="font-mono text-xs text-neutral-500">
                          {rec.id}
                        </span>
                      ) : null}
                      <span className="text-xs text-neutral-500">
                        target{" "}
                        <span className="font-mono text-neutral-300">{rec.target}</span>
                      </span>
                      {/* ⚠️ Says it in WORDS. The row already tinted, but a tint
                          is not a statement — on a list of ten near-identical
                          rows it is easy to believe you are editing the one your
                          cursor is over. The dot repeats the header's unsaved
                          signal right where the decision gets made. */}
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                          {dirty && (
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                          )}
                          Editing
                          {dirty && <span className="sr-only">(unsaved changes)</span>}
                        </span>
                      ) : null}
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
                          onClick={() => requestEdit(rec)}
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

      {/* ── The last save's advice, on demand ─────────────────────────────────
          ⚠️ Filtered by KIND, not by severity, and that is not a style choice:
          this channel contains no errors at all — they block the save and never
          arrive here — so a severity filter would sort one bucket into itself.
          What was missing was never a filter. It was an answer to "what
          treatment does this deserve?", which is why every group leads with its
          treatment and the decorative audit carries its known limit. A warning
          whose standing you cannot look up is a warning you learn to skip, and
          that is exactly what had happened. */}
      {showWarnings && hasSaveDetail && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16"
          onClick={() => setShowWarnings(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Notes from the last save"
            data-testid="lb-warnings-popup"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 p-4">
              <h2 className="text-sm font-semibold text-neutral-100">
                {classifiedWarnings.length > 0
                  ? `${classifiedWarnings.length} note${classifiedWarnings.length === 1 ? "" : "s"} from the last save`
                  : "What the last save said"}
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        warningsAsText(shownWarnings),
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      /* dev tool — a blocked clipboard is not worth an error */
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // The WHOLE toast, not just its notes: you have read it, so
                    // the header strip and the chip both go quiet until the next
                    // save. Clearing only the notes used to leave a "Details"
                    // chip behind, which is not what "dismiss" means.
                    setToast(null);
                    clearStoredToast();
                    setShowWarnings(false);
                  }}
                  className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-400 hover:bg-neutral-800"
                >
                  Dismiss all
                </button>
                <button
                  type="button"
                  onClick={() => setShowWarnings(false)}
                  aria-label="Close"
                  className="rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filter chips. Each carries its count, so a kind with none is
                visibly empty rather than a dead-end click. */}
            <div
              className="flex flex-wrap gap-2 border-b border-neutral-800 px-4 py-3"
              role="group"
              aria-label="Filter notes"
            >
              {(["all", "pacing", "decorative", "other"] as const).map((k) => {
                const n =
                  k === "all" ? classifiedWarnings.length : warningCounts[k];
                if (k !== "all" && n === 0) return null;
                const active = warningFilter === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setWarningFilter(k)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-neutral-100 bg-neutral-100 text-black"
                        : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    {k === "all" ? "All" : WARNING_GUIDANCE[k].label} ({n})
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* The full account, which the header strip deliberately trims to
                  one line. It leads, because when a save goes wrong THIS is what
                  the author needs — the notes are advice, this is what happened. */}
              {toast?.summary && (
                <div
                  data-testid="lb-save-outcome"
                  className="mb-5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
                    What happened
                  </h3>
                  <p
                    data-allow-select="true"
                    className={`mt-1 text-xs leading-relaxed ${toastColor}`}
                  >
                    {toast.text}
                  </p>
                </div>
              )}
              {(["pacing", "decorative", "other"] as WarningKind[]).map((k) => {
                const items = shownWarnings.filter((w) => w.kind === k);
                if (!items.length) return null;
                const guidance = WARNING_GUIDANCE[k];
                return (
                  <div key={k} className="mb-5 last:mb-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
                      {guidance.label}
                    </h3>
                    {/* The answer to "what do I do with this?", which is the one
                        thing the old panel never said. */}
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      {guidance.treatment}
                    </p>
                    {guidance.caveat ? (
                      <p className="mt-1 text-xs leading-relaxed text-amber-400/90">
                        {guidance.caveat}
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-2">
                      {items.map((w, i) => (
                        <li
                          key={`${k}-${i}`}
                          data-allow-select="true"
                          className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 text-xs leading-relaxed text-neutral-300"
                        >
                          {w.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <p className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-500">
              None of these block a save. Pacing warns past a{" "}
              {MAX_DIFFICULTY_STEP}-move step (<code>MAX_DIFFICULTY_STEP</code>,{" "}
              <code>lib/content/pacing.ts</code>) — the threshold is yours to move.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
