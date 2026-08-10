/**
 * Slice 3, stage 4C — the three host assemblers, at the seam that matters.
 *
 * The hook is unit-tested (`lib/scores/__tests__/use-attempt-outbox.test.tsx`):
 * hydration, the FIFO, the single in-flight POST, retries, the terminal split.
 * None of that says the SCREEN hands it the right thing, and that is where the
 * expensive mistakes live — a move count filed as coverage, a ceiling off by
 * one, a completion key that repeats across runs and silently swallows the next
 * attempt.
 *
 * WHY THE BOARDS ARE MOCKED AND NOTHING ELSE IS
 * ---------------------------------------------
 * The rule this stage is built on is "boards report, the host assembles, the
 * hook delivers" — so a board is exactly the seam to stub. Each mock is a
 * button that fires the board's real callback with chosen numbers. Everything
 * downstream of that callback is the true screen: the run keys, the family
 * derivation, the latch, the outbox, the client. Playing a full Knight's Tour
 * through jsdom would test the tour's move generator, which has its own tests
 * and is not what stage 4C changed.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";
import type { Exercise } from "@/lib/game/types";

vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/feature-flags")>();
  return {
    ...actual,
    CHESSCITO_MODE: "learn" as const,
    CHESSCITO_LITE_MODE: true,
    isLearnMode: () => true,
    isPlayMode: () => false,
    isFullMode: () => false,
  };
});

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
  usePathname: () => "/exercises",
  redirect: (path: string) => path,
  getPathname: ({ href }: { href: string }) => href,
}));

const WALLET = "0x1111111111111111111111111111111111111111" as const;

/** A connected wallet, because the outbox refuses to queue without one — the
 *  save path requires it, so such an attempt could never be sent. */
vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: () => ({
      address: WALLET,
      isConnected: true,
      status: "connected" as const,
    }),
    useSignMessage: () => ({ signMessageAsync: vi.fn(async () => "0xsig") }),
  };
});

const postScoreSave = vi.fn(async () => ({
  status: "saved" as const,
  mode: "free" as const,
  quota: {
    wallet: WALLET,
    freeLimit: 100,
    freeUsed: 1,
    freeRemaining: 99,
    requiresPeones: false,
    costPeones: 0,
  },
}));
vi.mock("@/lib/scores/save-client", () => ({
  postScoreSave: (...args: unknown[]) =>
    (postScoreSave as unknown as (...a: unknown[]) => unknown)(...args),
}));

/**
 * The generic board, standing in for both lanes it serves: `onMove` is
 * `handleMove` for an exercise and `handleLabyrinthMove` inside a labyrinth.
 * It reports the TARGET square, which is what a real completion does.
 */
vi.mock("@/components/board", () => ({
  Board: ({
    onMove,
    targetPosition,
  }: {
    onMove?: (p: { file: number; rank: number }, moves: number) => void;
    targetPosition: { file: number; rank: number };
  }) => (
    <button type="button" onClick={() => onMove?.(targetPosition, 2)}>
      mock-complete-board
    </button>
  ),
}));

vi.mock("@/components/exercises/knight-tour-board", () => ({
  KnightTourBoard: ({
    level,
    onComplete,
  }: {
    level: { optimalMoves: number };
    onComplete?: (covered: number, ceiling: number) => void;
  }) => (
    <button
      type="button"
      onClick={() => onComplete?.(3, level.optimalMoves + 1)}
    >
      mock-complete-tour
    </button>
  ),
}));

vi.mock("@/components/exercises/queens-board", () => ({
  QueensBoard: ({
    level,
    onComplete,
  }: {
    level: { optimalMoves: number };
    onComplete?: (covered: number, ceiling: number) => void;
  }) => (
    <button type="button" onClick={() => onComplete?.(2, level.optimalMoves + 1)}>
      mock-complete-queens
    </button>
  ),
}));

vi.mock("@/components/exercises/safe-path-board", () => ({
  SafePathBoard: ({ onComplete }: { onComplete?: (moves: number) => void }) => (
    <button type="button" onClick={() => onComplete?.(7)}>
      mock-complete-safe-path
    </button>
  ),
}));

vi.mock("@/components/exercises/diagonal-run-board", () => ({
  DiagonalRunBoard: ({ onComplete }: { onComplete?: (moves: number) => void }) => (
    <button type="button" onClick={() => onComplete?.(3)}>
      mock-complete-diagonal-run
    </button>
  ),
}));

vi.mock("@/components/exercises/promotion-run-board", () => ({
  PromotionRunBoard: ({ onComplete }: { onComplete?: (moves: number) => void }) => (
    <button type="button" onClick={() => onComplete?.(5)}>
      mock-complete-promotion
    </button>
  ),
}));

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
}
vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);

const { ExercisesScreen } = await import("../exercises-screen");

const ROOK_POOL: Exercise[] = [1, 2, 3, 4].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
}));

const ROOK_LAB: Exercise = {
  id: "t-lab-1",
  startPos: { file: 3, rank: 0 },
  targetPos: { file: 3, rank: 7 },
  optimalMoves: 1,
  obstacles: [],
};

/** `optimalMoves` is the coverage ceiling MINUS the starting piece, which is
 *  the catalogue's convention and the whole reason the +1 exists. */
const ROOK_TOUR: Exercise = {
  id: "t-tour-1",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 7, rank: 7 },
  optimalMoves: 4,
};

const ROOK_PROMOTION: Exercise = {
  id: "t-promo-1",
  startPos: { file: 3, rank: 1 },
  targetPos: { file: 3, rank: 7 },
  optimalMoves: 6,
  mission: { promoteTo: "queen" },
} as Exercise;

/** Queens stores the queens the PLAYER places, so the ceiling is that plus the
 *  one the level starts with — the same `+1` the tour uses. */
const ROOK_QUEENS: Exercise = {
  id: "t-queens-1",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 7, rank: 7 },
  optimalMoves: 3,
};

const ROOK_SAFE_PATH: Exercise = {
  id: "t-safe-1",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 7, rank: 7 },
  optimalMoves: 7,
};

const ROOK_DIAGONAL: Exercise = {
  id: "t-pivot-1",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 3, rank: 3 },
  optimalMoves: 2,
};

type Pools = {
  labyrinths?: Exercise[];
  knightTour?: Exercise[];
  queens?: Exercise[];
  safePath?: Exercise[];
  diagonalRun?: Exercise[];
  promotionRun?: Exercise[];
};

function renderScreen(pools: Pools = {}) {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: pools.labyrinths ?? [] },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
        ...(pools.knightTour
          ? { knightTour: { rook: pools.knightTour } as never }
          : {}),
        ...(pools.queens ? { queens: { rook: pools.queens } as never } : {}),
        ...(pools.safePath ? { safePath: { rook: pools.safePath } as never } : {}),
        ...(pools.diagonalRun
          ? { diagonalRun: { rook: pools.diagonalRun } as never }
          : {}),
        ...(pools.promotionRun
          ? { promotionRun: { rook: pools.promotionRun } as never }
          : {}),
      }}
    >
      <ExercisesScreen />
    </ContentCatalogProvider>,
  );
}

/** Special Training unlocks on 9★ over three exercises, so a test that wants
 *  to reach carril 2 has to arrive with that history — the same seed the
 *  celebration-order suite uses. */
function seedUnlockedTraining() {
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({
      piece: "rook",
      currentId: "t-rook-4",
      stars: { "t-rook-1": 3, "t-rook-2": 3, "t-rook-3": 3 },
    }),
  );
}

/**
 * Enters Special Training the way a player does: path drawer → the node.
 *
 * The node's label is not always "Special Training N": a signature game renders
 * its AUTHORED title (B4.2.3), which for these fixtures resolves through the
 * i18n fallback to something containing the content id. So the caller names
 * what it is looking for.
 */
async function enterTraining(name: string | RegExp = "Special Training 1") {
  fireEvent.click(screen.getByRole("button", { name: "Exercises" }));
  const node = await screen.findByRole("button", { name });
  fireEvent.click(node);
  await screen.findByRole("button", { name: "Exit Training" });
}

/** Every attempt POST the client was asked to make, newest last. */
function attemptCalls(): Array<Record<string, unknown>> {
  return (postScoreSave.mock.calls as unknown as unknown[][])
    .map((c) => (c[0] ?? {}) as Record<string, unknown>)
    .filter((input) => input.attemptId !== undefined);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chesscito:onboarded", "true");
  markMilestonesSeeded();
  postScoreSave.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("assembler 1 — the exercise lane", () => {
  it("reports one attempt, measured in MOVES, with a client-minted id", async () => {
    renderScreen();

    fireEvent.click(await screen.findByText("mock-complete-board"));

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const call = attemptCalls()[0]!;
    expect(call.exerciseId).toBe("t-rook-1");
    expect(call.measurement).toEqual({ kind: "moves", movesUsed: 2 });
    // 32 lowercase hex, minted here. A server-minted id would mean the bundle
    // never sent one and the row is filed `attempt_id_source = 'server'`.
    expect(String(call.attemptId)).toMatch(/^[0-9a-f]{32}$/);
    // D12: the raw number goes up, the star count comes back. Ever sending
    // stars from here would make the client the grader.
    expect(call).not.toHaveProperty("starsEarned");
  });

  it("does not report the same completion twice when the board repeats it", async () => {
    renderScreen();

    const board = await screen.findByText("mock-complete-board");
    fireEvent.click(board);
    fireEvent.click(board);
    fireEvent.click(board);

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    // Give a second emission every chance to show up before declaring one.
    await new Promise((r) => setTimeout(r, 50));
    expect(attemptCalls()).toHaveLength(1);
  });
});

describe("the latch closes per completion, not forever", () => {
  it("emits again for the next exercise, with a different attempt id", async () => {
    // The latch is keyed on `${contentId}:${runKey}`, so moving on is a new key
    // and must produce a new attempt. A latch keyed on anything coarser (the
    // piece, the screen, a boolean) would swallow every attempt after the first.
    renderScreen();

    fireEvent.click(await screen.findByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(1));

    await screen.findByText("Tap to Continue", undefined, { timeout: 2500 });
    fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
    await waitFor(() =>
      expect(screen.queryByText("Tap to Continue")).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(2));

    const [first, second] = attemptCalls();
    expect(first!.exerciseId).not.toBe(second!.exerciseId);
    expect(first!.attemptId).not.toBe(second!.attemptId);
  });
});

describe("assembler 2 — the labyrinth lane", () => {
  it("reports an attempt even though the piece score never moves", async () => {
    // Carril 2 stars go to the daily ledger, never to `pieceStars` — so the
    // total this POST carries is the same one the previous save carried, and
    // the server answers `duplicate`. The attempt row is the point.
    seedUnlockedTraining();
    renderScreen({ labyrinths: [ROOK_LAB] });

    await enterTraining();
    fireEvent.click(await screen.findByText("mock-complete-board"));

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const call = attemptCalls()[0]!;
    expect(call.exerciseId).toBe("t-lab-1");
    expect(call.measurement).toEqual({ kind: "moves", movesUsed: 2 });
  });

  it("emits a SECOND attempt for a replay of the same maze", async () => {
    // This is the run key doing its job, and it is the one property a screen
    // test can prove that a unit test cannot: the assembler has to read the
    // CURRENT keys. `handleLabyrinthMove` is a useCallback that does not list
    // them as deps, so a version that closed over them directly would hand the
    // latch the previous run's key — same key, second run, no attempt, and
    // nothing anywhere would say so.
    seedUnlockedTraining();
    renderScreen({ labyrinths: [ROOK_LAB] });

    await enterTraining();
    fireEvent.click(await screen.findByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(1));

    // Leave and come back: `requestTrainingContent` is the path that rotates
    // the labyrinth run key (`content_started`), same as the overlay's Retry.
    fireEvent.click(screen.getByRole("button", { name: "Exit Training" }));
    await enterTraining();

    fireEvent.click(await screen.findByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(2));

    const [first, second] = attemptCalls();
    expect(second!.exerciseId).toBe("t-lab-1");
    expect(first!.exerciseId).toBe("t-lab-1");
    // Same content, different runs — so two attempts, not one replay.
    expect(first!.attemptId).not.toBe(second!.attemptId);
  });
});

describe("assembler 3 — the coverage lane", () => {
  it("reports COVERAGE against the catalogue ceiling, starless and all", async () => {
    seedUnlockedTraining();
    renderScreen({ knightTour: [ROOK_TOUR] });

    await enterTraining(/t-tour-1/);
    fireEvent.click(await screen.findByText("mock-complete-tour"));

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const call = attemptCalls()[0]!;
    expect(call.exerciseId).toBe("t-tour-1");
    // The tour awards no stars by product decision. It is still an attempt, and
    // the server files it `starless` with a NULL count — a different fact from
    // `ungraded`, and only if the row is written at all.
    expect(call.measurement).toEqual({
      kind: "coverage",
      reached: 3,
      // `optimalMoves + 1`. Off by one here is not a wrong grade: the server
      // re-derives its own ceiling and rejects a mismatch, so every coverage
      // attempt would 400 and be dropped as terminal.
      ceiling: ROOK_TOUR.optimalMoves + 1,
    });
  });
});

describe("the three families that share a handler each get their own case", () => {
  // They route through the two handlers already covered, but the FAMILY is
  // derived per game and decides which run key the completion key carries.
  // Getting one wrong reads someone else's counter: the latch would reopen on
  // an unrelated reset, or stay shut through a real new run.

  it("N-Queens reports coverage against the catalogue ceiling", async () => {
    seedUnlockedTraining();
    renderScreen({ queens: [ROOK_QUEENS] });

    await enterTraining(/t-queens-1/);
    fireEvent.click(await screen.findByText("mock-complete-queens"));

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const call = attemptCalls()[0]!;
    expect(call.exerciseId).toBe("t-queens-1");
    expect(call.measurement).toEqual({
      kind: "coverage",
      reached: 2,
      ceiling: ROOK_QUEENS.optimalMoves + 1,
    });
  });

  it("Safe Path reports MOVES — it is arrival-graded, not coverage", async () => {
    // Its neighbours in the render tree report coverage. Wiring this one to
    // them would feed a move count to a percentage grader: same `number`,
    // opposite meaning, no type error, three stars for everyone.
    seedUnlockedTraining();
    renderScreen({ safePath: [ROOK_SAFE_PATH] });

    await enterTraining("Special Training 1");
    fireEvent.click(await screen.findByText("mock-complete-safe-path"));

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const call = attemptCalls()[0]!;
    expect(call.exerciseId).toBe("t-safe-1");
    expect(call.measurement).toEqual({ kind: "moves", movesUsed: 7 });
  });

  it("Diagonal Run reports MOVES", async () => {
    seedUnlockedTraining();
    renderScreen({ diagonalRun: [ROOK_DIAGONAL] });

    await enterTraining(/t-pivot-1/);
    fireEvent.click(await screen.findByText("mock-complete-diagonal-run"));

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const call = attemptCalls()[0]!;
    expect(call.exerciseId).toBe("t-pivot-1");
    expect(call.measurement).toEqual({ kind: "moves", movesUsed: 3 });
  });
});

describe("the queue is visible, and the retry is the player's (4C-3)", () => {
  const SAVED = {
    status: "saved" as const,
    mode: "free" as const,
    quota: {
      wallet: WALLET,
      freeLimit: 100,
      freeUsed: 1,
      freeRemaining: 99,
      requiresPeones: false,
      costPeones: 0,
    },
  };

  it("parks on a retryable failure and la próxima completación re-envía el MISMO id", async () => {
    // Retryable is "not now", not "no". The attempt keeps its place and its
    // identity, so the server answers it as a REPLAY: it inserts nothing and
    // consumes no budget.
    //
    // ⛔ Esto se probaba tapeando el CTA del banner. El banner se eliminó el
    // 2026-08-09 y con él la única forma de PEDIR el reintento — que costaba
    // una firma de wallet. Lo que queda es el camino que siempre fue gratis y
    // que el jugador no tiene que descubrir: la próxima completación arrastra
    // lo parkeado. El contrato bajo test (mismo attemptId) no cambió; sí el
    // gesto que lo dispara, y ahora el gesto es simplemente seguir jugando.
    postScoreSave.mockImplementationOnce(
      async () => ({ status: "error", reason: "network" }) as never,
    );
    renderScreen();

    fireEvent.click(await screen.findByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const firstId = attemptCalls()[0]!.attemptId;

    // Seguir jugando: eso solo drena la cola.
    postScoreSave.mockImplementationOnce(async () => SAVED as never);
    await screen.findByText("Tap to Continue", undefined, { timeout: 2500 });
    fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
    await waitFor(() =>
      expect(screen.queryByText("Tap to Continue")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("mock-complete-board"));

    await waitFor(() => expect(attemptCalls().length).toBeGreaterThanOrEqual(2));
    // El parkeado sale primero y con su identidad intacta (FIFO).
    expect(attemptCalls()[1]!.attemptId).toBe(firstId);
  });

  it("shows nothing to retry on a terminal rejection, and the next attempt still goes out", async () => {
    // A 400 cannot be fixed by re-sending the same body. Offering RETRY would
    // be a button that always fails; re-queuing it would block everything
    // behind it in the FIFO for the life of the install.
    postScoreSave.mockImplementationOnce(
      async () => ({ status: "invalid", reason: "unknown_exercise" }) as never,
    );
    renderScreen();

    fireEvent.click(await screen.findByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(1));

    // The queue moved on: the next completion is delivered normally.
    postScoreSave.mockImplementationOnce(async () => SAVED as never);
    await screen.findByText("Tap to Continue", undefined, { timeout: 2500 });
    fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
    await waitFor(() =>
      expect(screen.queryByText("Tap to Continue")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("mock-complete-board"));

    await waitFor(() => expect(attemptCalls()).toHaveLength(2));
    expect(attemptCalls()[1]!.exerciseId).toBe("t-rook-2");
  });

  it("no dice NADA mientras una entrega está en vuelo", async () => {
    // Antes acá había una línea discreta ("Saving progress…"). Se eliminó con
    // el banner: el guardado es plomería, y la plomería no se anuncia.
    postScoreSave.mockImplementationOnce(() => new Promise(() => {}) as never);
    renderScreen();

    fireEvent.click(await screen.findByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(1));

    expect(screen.queryByTestId("attempt-save-status")).not.toBeInTheDocument();
  });

  it("survives a reload and re-sends the SAME attempt for the same wallet", async () => {
    // The exposure concentrates exactly here: a snapshot sits in the outbox
    // only while a POST is failing, i.e. when the network is bad, which is
    // when a MiniPay player closes the app. If the reload re-minted, one
    // attempt would become two on a permanent table.
    postScoreSave.mockImplementationOnce(
      async () => ({ status: "error", reason: "network" }) as never,
    );
    renderScreen();

    fireEvent.click(await screen.findByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const pendingId = attemptCalls()[0]!.attemptId;

    // The reload: the tree goes away, localStorage does not.
    cleanup();
    postScoreSave.mockClear();
    renderScreen();

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    expect(attemptCalls()[0]!.attemptId).toBe(pendingId);
  });

  it("says nothing at all while the queue is empty", async () => {
    renderScreen();
    await screen.findByText("mock-complete-board");
    expect(screen.queryByTestId("attempt-save-status")).not.toBeInTheDocument();
  });

  /**
   * El guardado NO tiene superficie en el tablero (2026-08-09).
   *
   * ⚠️ Es un test de AUSENCIA, y la ausencia es lo único que una captura de VR
   * nunca puede afirmar: una foto sin banner y una foto donde el banner no se
   * distingue del fondo son el mismo PNG. Va por DOM o no va.
   *
   * Cubre los tres estados que antes tenían pill —vacía, en vuelo, parkeada—
   * porque el riesgo real no es que alguien reponga el componente a propósito,
   * sino que un merge lo reviva en uno solo de ellos.
   */
  it("no monta ninguna superficie de guardado en NINGÚN estado de la cola", async () => {
    // 1. Cola vacía.
    renderScreen();
    await screen.findByText("mock-complete-board");
    expect(screen.queryByTestId("attempt-save-status")).not.toBeInTheDocument();

    // 2. Entrega en vuelo.
    postScoreSave.mockImplementationOnce(() => new Promise(() => {}) as never);
    fireEvent.click(screen.getByText("mock-complete-board"));
    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    expect(screen.queryByTestId("attempt-save-status")).not.toBeInTheDocument();

    // 3. Cola parkeada tras un fallo retryable — el estado que MÁS ruido hacía:
    //    era el que traía el cartel persistente y su CTA.
    cleanup();
    postScoreSave.mockClear();
    postScoreSave.mockImplementationOnce(
      async () => ({ status: "error", reason: "network" }) as never,
    );
    renderScreen();
    fireEvent.click(await screen.findByText("mock-complete-board"));
    // ⚠️ Sin conteo exacto: al re-montar, la cola de los pasos anteriores
    // rehidrata desde localStorage y suma envíos. Lo que este caso afirma es la
    // AUSENCIA de superficie, no cuántos intentos salieron.
    await waitFor(() => expect(attemptCalls().length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByTestId("attempt-save-status")).not.toBeInTheDocument();
  });
});

describe("the promotion lane grades FAILURES", () => {
  it("sends failures, not the move count every winning run shares", async () => {
    seedUnlockedTraining();
    renderScreen({ promotionRun: [ROOK_PROMOTION] });

    await enterTraining();
    fireEvent.click(await screen.findByText("mock-complete-promotion"));

    // The board only says the pawn reached the last rank; the crown decides
    // whether the run is over.
    // Scoped to the picker on purpose. A bare `/queen/i` over the whole screen
    // is ambiguous: the Special Training lane also renders a Queens node, so
    // the query matched two buttons and RTL refused to guess. Scoping keeps the
    // accessible-name assertion — the crown is still found the way a screen
    // reader would find it — without depending on nothing else ever mentioning
    // a queen.
    const picker = await screen.findByTestId("pr-picker");
    fireEvent.click(within(picker).getByRole("button", { name: /queen/i }));

    await waitFor(() => expect(attemptCalls()).toHaveLength(1));
    const call = attemptCalls()[0]!;
    expect(call.exerciseId).toBe("t-promo-1");
    // A pawn advances one rank per move, so every winning run measures
    // `7 - startRank` — moves would hand three stars to everyone.
    expect(call.measurement).toEqual({ kind: "failures", failures: 0 });
  });
});
