import type { Exercise, PieceId } from "@/lib/game/types";
import { defineLabyrinth } from "@/lib/game/notation";

function pos(file: number, rank: number) {
  return { file, rank };
}

/* ── TIER CRITERIA (authoring guide, Rotation + Labyrinths cluster) ──
 * Compact rubric for the optional `tier` field. Keep authoring guidance
 * here, not in a long separate doc. Spec: docs/product/chesscito-
 * rotation-and-labyrinths-2026-06-08.md.
 *
 *  easy   — 1–2 optimal moves. Few or zero obstructions. Teaches the
 *           piece's basic movement (and the simplest capture).
 *  medium — 3–5 optimal moves. May include obstacles, detours, or a
 *           controlled capture. Requires a simple plan, not just a
 *           direct line.
 *  hard   — 6+ optimal moves OR several stacked restrictions. Wave 2,
 *           authored later (PENDING per piece until the Hard tier lands).
 *
 * `optimalMoves` is BFS-verified hard-fail (exercises-bfs-verifier.test).
 * --------------------------------------------------------------- */

const ROOK_EXERCISES: Exercise[] = [
  // ── Easy (5/15): basic rook movement + simplest captures ──
  // 1. Mover a lo largo de la fila (horizontal puro)
  {
    id: "rook-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 0),
    optimalMoves: 1,
    tier: "easy",
    objective: "Slide the rook straight along a rank (pure horizontal move).",
    tags: ["straight-line"],
  },
  // 2. Mover a lo largo de la columna (vertical puro)
  {
    id: "rook-2",
    startPos: pos(0, 0),
    targetPos: pos(0, 7),
    optimalMoves: 1,
    tier: "easy",
    objective: "Slide the rook straight along a file (pure vertical move).",
    tags: ["straight-line"],
  },
  // 3. Desde el centro hacia arriba
  {
    id: "rook-3",
    startPos: pos(3, 3),
    targetPos: pos(3, 7),
    optimalMoves: 1,
    tier: "easy",
    objective: "Advance the rook up a file from the centre.",
    tags: ["straight-line"],
  },
  // 4. Captura — esquina a esquina diagonal
  {
    id: "rook-4",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 2,
    isCapture: true,
    tier: "easy",
    objective: "Capture across the board in two straight moves (turn one corner).",
    tags: ["capture", "corner-turn"],
  },
  // 5. Captura — esquina a posición compleja
  {
    id: "rook-5",
    startPos: pos(7, 7),
    targetPos: pos(1, 2),
    optimalMoves: 2,
    isCapture: true,
    tier: "easy",
    objective: "Capture from a corner to an off-line target in two moves.",
    tags: ["capture", "corner-turn"],
  },

  /* ── Medium (5/15): obstacles + detours, 3–4 optimal moves ──────────
   * Rotation + Labyrinths content wave 1 (2026-06-08). All BFS-verified.
   * Obstacles follow the same shipped pattern as king-7 / king-10
   * (friendly blockers in a standard EXERCISES entry — sliding pieces
   * stop one square before a blocker). Hard tier (rook-11..15) PENDING. */

  // 6. Rodear un bloqueo en la fila: a1 → c1 con obstáculo en b1.
  //    Optimal 3. La línea directa está cortada, fuerza subir/cruzar/bajar.
  {
    id: "rook-6",
    startPos: pos(0, 0),
    targetPos: pos(2, 0),
    obstacles: [pos(1, 0)],
    optimalMoves: 3,
    tier: "medium",
    objective: "Route around a single blocker on your rank to reach the square behind it.",
    tags: ["detour", "blocked-rank"],
  },
  // 7. Esquivar un archivo bloqueado: a1 → a3 con obstáculo en a2.
  //    Optimal 3. Mirror vertical de rook-6 (eje de archivo).
  {
    id: "rook-7",
    startPos: pos(0, 0),
    targetPos: pos(0, 2),
    obstacles: [pos(0, 1)],
    optimalMoves: 3,
    tier: "medium",
    objective: "Sidestep off a blocked file, climb, and return to the target.",
    tags: ["detour", "blocked-file"],
  },
  // 8. Casilla central encajonada: d4 → e5 con obstáculos en d5 y e4.
  //    Optimal 4. Los dos accesos cortos (rank + file del target) están
  //    bloqueados; hay que aproximar por el lado abierto.
  {
    id: "rook-8",
    startPos: pos(3, 3),
    targetPos: pos(4, 4),
    obstacles: [pos(3, 4), pos(4, 3)],
    optimalMoves: 4,
    tier: "medium",
    objective: "Approach a boxed-in central square from its open side (four moves).",
    tags: ["detour", "boxed-target"],
  },
  // 9. Captura con desvío: a1 → c3 (captura) con obstáculos en c1 y a3.
  //    Optimal 3. Las dos rutas L de 2 movidas (vía c1 o a3) están
  //    cortadas; la captura sólo se alcanza por el camino largo.
  {
    id: "rook-9",
    startPos: pos(0, 0),
    targetPos: pos(2, 2),
    obstacles: [pos(2, 0), pos(0, 2)],
    optimalMoves: 3,
    isCapture: true,
    tier: "medium",
    objective: "Reach a capture the direct two-move L-paths can't make, using a detour.",
    tags: ["capture", "detour"],
  },
  // 10. Escape de archivo + aproximación lejana: d1 → d5 con muro
  //     {d2, d4, c5, e5}. Optimal 4. El archivo d está bloqueado arriba
  //     (d2) y el target sólo se aproxima desde arriba (d4/c5/e5 cierran
  //     los otros accesos). Síntesis: salir de lado, subir, cruzar, bajar.
  {
    id: "rook-10",
    startPos: pos(3, 0),
    targetPos: pos(3, 4),
    obstacles: [pos(3, 1), pos(3, 3), pos(2, 4), pos(4, 4)],
    optimalMoves: 4,
    tier: "medium",
    objective: "Escape a blocked file and approach the target from the far end (four moves).",
    tags: ["detour", "blocked-file", "rook-lift"],
  },
];

const BISHOP_EXERCISES: Exercise[] = [
  // ── Easy (5/15): basic diagonal movement + same-colour reroute ──
  // 1. Diagonal principal larga (a1→h8)
  {
    id: "bishop-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 1,
    tier: "easy",
    objective: "Slide the bishop along the main diagonal (corner to corner).",
    tags: ["straight-line", "long-diagonal"],
  },
  // 2. Diagonal anti-principal (h1→a8)
  {
    id: "bishop-2",
    startPos: pos(7, 0),
    targetPos: pos(0, 7),
    optimalMoves: 1,
    tier: "easy",
    objective: "Slide the bishop along the anti-diagonal (corner to corner).",
    tags: ["straight-line", "long-diagonal"],
  },
  // 3. Diagonal corta desde el centro
  {
    id: "bishop-3",
    startPos: pos(3, 3),
    targetPos: pos(6, 6),
    optimalMoves: 1,
    tier: "easy",
    objective: "Make a short diagonal step out from the centre.",
    tags: ["straight-line"],
  },
  // 4. Mismo color, distinta diagonal — necesita 2 movimientos
  //    a1(0,0) → g1(6,0): via (3,3)→(6,0) ✓
  {
    id: "bishop-4",
    startPos: pos(0, 0),
    targetPos: pos(6, 0),
    optimalMoves: 2,
    tier: "easy",
    objective: "Reach a same-colour square on another diagonal in two moves.",
    tags: ["pivot"],
  },
  // 5. Mismo color, ruta no obvia
  //    c3(2,2) → g3(6,2): via e5(4,4)→g3 ✓
  {
    id: "bishop-5",
    startPos: pos(2, 2),
    targetPos: pos(6, 2),
    optimalMoves: 2,
    tier: "easy",
    objective: "Find the non-obvious two-move pivot to a same-colour target.",
    tags: ["pivot"],
  },

  /* ── Medium (5/15): blocked pivots + diagonal detours, 3–5 moves ────
   * Rotation + Labyrinths content wave 1 (2026-06-08). All BFS-verified.
   * The bishop never changes square colour, so every start/target pair
   * shares colour and obstacles block the short pivot(s) to force a
   * longer diagonal route. Same shipped obstacle pattern as king-7/10.
   * Hard tier (bishop-11..15) PENDING wave 2. */

  // 6. Pivote bloqueado: b2 → f2 con obstáculo en d4 (el único pivote de
  //    2 movidas). Optimal 3. Fuerza un rodeo diagonal para volver a la fila.
  {
    id: "bishop-6",
    startPos: pos(1, 1),
    targetPos: pos(5, 1),
    obstacles: [pos(3, 3)],
    optimalMoves: 3,
    tier: "medium",
    objective: "Your two-move pivot is blocked, so loop around to land back on the same rank.",
    tags: ["detour", "blocked-diagonal"],
  },
  // 7. Doble pivote bloqueado: c3 → g3 con obstáculos en e1 y e5 (ambos
  //    pivotes de 2 movidas). Optimal 3. Obliga la ruta diagonal larga.
  {
    id: "bishop-7",
    startPos: pos(2, 2),
    targetPos: pos(6, 2),
    obstacles: [pos(4, 0), pos(4, 4)],
    optimalMoves: 3,
    tier: "medium",
    objective: "Both two-move pivots are blocked; take the longer diagonal path across.",
    tags: ["detour", "blocked-diagonal"],
  },
  // 8. Desvío en diagonal larga: a1 → g7 con obstáculo en d4. Optimal 4.
  //    El bloqueo parte la diagonal principal y fuerza tejer alrededor.
  {
    id: "bishop-8",
    startPos: pos(0, 0),
    targetPos: pos(6, 6),
    obstacles: [pos(3, 3)],
    optimalMoves: 4,
    tier: "medium",
    objective: "A blocker sits on your long diagonal; weave around it to the target.",
    tags: ["detour", "long-diagonal"],
  },
  // 9. Captura con desvío: a1 → g7 (captura) con obstáculos en d4 y f6.
  //    Optimal 4. La diagonal recta está amurallada dos veces antes del
  //    target; la captura sólo se alcanza rodeando.
  {
    id: "bishop-9",
    startPos: pos(0, 0),
    targetPos: pos(6, 6),
    obstacles: [pos(3, 3), pos(5, 5)],
    optimalMoves: 4,
    isCapture: true,
    tier: "medium",
    objective: "Reach the capture when the straight diagonal is walled twice.",
    tags: ["capture", "detour"],
  },
  // 10. Muro en la diagonal principal: a1 → h8 con obstáculo en e5.
  //     Optimal 5. La diagonal larga está cortada a la mitad; síntesis
  //     del tier — el rodeo más largo de la ola.
  {
    id: "bishop-10",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    obstacles: [pos(4, 4)],
    optimalMoves: 5,
    tier: "medium",
    objective: "The main diagonal is cut in the middle; find the five-move way around.",
    tags: ["detour", "long-diagonal"],
  },
];

const KNIGHT_EXERCISES: Exercise[] = [
  // ── Easy (4/15): single + double L-jumps. Knight is the first
  //    non-linear piece; these teach the L shape and corner escape. ──
  // 1. Un salto en L desde el centro
  {
    id: "knight-1",
    startPos: pos(3, 3),
    targetPos: pos(4, 5),
    optimalMoves: 1,
    tier: "easy",
    objective: "Make a single L-jump from the centre (the knight's signature move).",
    tags: ["knight-l-shape", "center-control"],
  },
  // 2. Un salto desde esquina
  {
    id: "knight-2",
    startPos: pos(0, 0),
    targetPos: pos(1, 2),
    optimalMoves: 1,
    tier: "easy",
    objective: "Jump out of the corner with one L-move.",
    tags: ["knight-l-shape", "corner-escape"],
  },
  // 3. Un salto horizontal
  {
    id: "knight-3",
    startPos: pos(0, 0),
    targetPos: pos(2, 1),
    optimalMoves: 1,
    tier: "easy",
    objective: "Make the flatter L-jump (two across, one up) from the corner.",
    tags: ["knight-l-shape", "corner-escape"],
  },
  // 4. Dos saltos — no alcanzable en 1
  {
    id: "knight-4",
    startPos: pos(0, 0),
    targetPos: pos(3, 1),
    optimalMoves: 2,
    tier: "easy",
    objective: "Reach a square that needs two L-jumps, not one.",
    tags: ["knight-l-shape"],
  },

  // ── Medium (6/15): 3-5 hop journeys. knight-5 already runs 3 hops, so
  //    it is reclassified Medium (corner to centre). Rotation +
  //    Labyrinths content wave 1 (2026-06-08). All BFS-verified. Knight
  //    needs no walls for multi-hop routes; obstacles appear only where
  //    they teach a visible "hop over the cluster" pattern (knight-8).
  //    Hard tier (knight-11..15) PENDING wave 2.
  // 5. Trayecto desde esquina al centro estratégico (a1 → e4).
  //    Path óptimo (3 hops): a1 → b3 → d2 → e4. BFS-verified 2026-06-05
  //    (Sprint 1 commit 3) — corrige drift previo donde el target era e5
  //    declarado como 3 movimientos pero el mínimo real de caballo a1→e5
  //    es 4. Ajuste de target (Opción B) preserva la promesa pedagógica
  //    "3★ alcanzable en 3 movidas" y mantiene la narrativa "esquina al
  //    centro" — e4 es el square central canónico en teoría de ajedrez,
  //    más limpio que e5 para el lesson final de caballo.
  {
    id: "knight-5",
    startPos: pos(0, 0),
    targetPos: pos(4, 3),
    optimalMoves: 3,
    tier: "medium",
    objective: "Travel from the corner to a central square in three L-jumps.",
    tags: ["corner-escape", "center-control", "knight-l-shape"],
  },
  // 6. L larga al flanco: a1 → g4, 3 saltos. Termina en color opuesto
  //    al de salida (número impar de saltos cambia el color de casilla).
  {
    id: "knight-6",
    startPos: pos(0, 0),
    targetPos: pos(6, 3),
    optimalMoves: 3,
    tier: "medium",
    objective: "Travel a long L-route to the far flank; an odd number of hops flips the square colour.",
    tags: ["knight-l-shape", "long-route"],
  },
  // 7. De borde a borde: b1 → g6, 4 saltos. Cruza el tablero entero.
  {
    id: "knight-7",
    startPos: pos(1, 0),
    targetPos: pos(6, 5),
    optimalMoves: 4,
    tier: "medium",
    objective: "Cross the board edge to edge in four L-jumps.",
    tags: ["knight-l-shape", "long-route"],
  },
  // 8. Saltar el grupo: b2 → d4 con obstáculos en c4, d2, b4, d3. Las
  //    casillas de aterrizaje cercanas al centro están ocupadas; el
  //    caballo salta por encima hasta el cuadro custodiado.
  {
    id: "knight-8",
    startPos: pos(1, 1),
    targetPos: pos(3, 3),
    obstacles: [pos(2, 3), pos(3, 1), pos(1, 3), pos(3, 2)],
    optimalMoves: 4,
    tier: "medium",
    objective: "The landing squares near the centre are occupied; hop the knight over the cluster to the guarded square.",
    tags: ["jump-over", "center-control"],
  },
  // 9. Captura en ruta L: a1 → f6 (captura), 4 saltos. Sale de la esquina
  //    hacia una captura en campo profundo.
  {
    id: "knight-9",
    startPos: pos(0, 0),
    targetPos: pos(5, 5),
    optimalMoves: 4,
    isCapture: true,
    tier: "medium",
    objective: "Ride the L-route from the corner to a capture deep in enemy ground.",
    tags: ["capture", "long-route"],
  },
  // 10. El viaje largo: a8 → h6, 5 saltos. Esquina superior al flanco
  //     opuesto — la ruta más larga de la ola.
  {
    id: "knight-10",
    startPos: pos(0, 7),
    targetPos: pos(7, 5),
    optimalMoves: 5,
    tier: "medium",
    objective: "The long journey: top corner to the far flank in five L-jumps.",
    tags: ["knight-l-shape", "long-route", "corner-escape"],
  },
];

const PAWN_EXERCISES: Exercise[] = [
  // ── Easy (4/15): basic forward advance + basic diagonal capture. The
  //    pawn looks simple but only moves forward and captures diagonally;
  //    these teach those two core rules in one move each. ──
  // 1. Forward one — simplest possible pawn move
  {
    id: "pawn-1",
    startPos: pos(4, 1),
    targetPos: pos(4, 2),
    optimalMoves: 1,
    tier: "easy",
    objective: "Advance the pawn one square forward (its only non-capture move).",
    tags: ["forward-move"],
  },
  // 2. Forward march — advance two from starting rank, then one more
  {
    id: "pawn-2",
    startPos: pos(3, 1),
    targetPos: pos(3, 4),
    optimalMoves: 2,
    tier: "easy",
    objective: "Use the two-square first step, then a single step, to march forward.",
    tags: ["forward-move", "slow-advance"],
  },
  // 3. Diagonal capture — one step diagonally forward
  {
    id: "pawn-3",
    startPos: pos(2, 4),
    targetPos: pos(3, 5),
    optimalMoves: 1,
    isCapture: true,
    tier: "easy",
    objective: "Capture one square diagonally forward (pawns only move sideways to capture).",
    tags: ["diagonal-capture"],
  },
  // 4. Capture decision — must choose diagonal, not forward
  {
    id: "pawn-4",
    startPos: pos(5, 3),
    targetPos: pos(6, 4),
    optimalMoves: 1,
    isCapture: true,
    tier: "easy",
    objective: "Take the diagonal capture rather than advancing straight.",
    tags: ["diagonal-capture", "directional-move"],
  },

  /* ── Medium (6/15): 2-5 move routes. pawn-5 already runs a 3-move
   * advance-then-capture plan, so it is reclassified Medium. The pawn
   * advances slowly, so its difficulty comes from restrictions, not
   * mobility. Rotation + Labyrinths content wave 1 (2026-06-08). All
   * BFS-verified using ONLY the engine's existing rules: forward 1,
   * forward 2 from the starting rank, diagonal capture onto captureTargets
   * or targetPos, and simple obstacles. No en passant, no promotion
   * mechanic, no check rules, no engine changes. Hard tier
   * (pawn-11..15) PENDING wave 2. */
  // 5. Mixed path — advance then capture (forward + forward + diagonal)
  //    d2(3,1) → d4(3,3) fwd2, → d5(3,4) fwd1, → e6(4,5) diagonal capture = 3 moves
  {
    id: "pawn-5",
    startPos: pos(3, 1),
    targetPos: pos(4, 5),
    optimalMoves: 3,
    isCapture: true,
    tier: "medium",
    objective: "Advance twice, then finish with a diagonal capture (a short plan).",
    tags: ["slow-advance", "diagonal-capture", "capture-route"],
  },
  // 6. Marcha lenta a la última fila: a2 → a8, 5 avances (doble paso
  //    inicial + 3). Camino hacia la octava fila, sin coronación real.
  {
    id: "pawn-6",
    startPos: pos(0, 1),
    targetPos: pos(0, 7),
    optimalMoves: 5,
    tier: "medium",
    objective: "March all the way up the file to the last rank (path toward promotion, no promotion mechanic).",
    tags: ["forward-move", "slow-advance", "promotion-path"],
  },
  // 7. Bloqueado de frente, capturar para rodear: e2 → f5 con obstáculo
  //    en e3 (corta el avance) y captureTarget en f3. El peón no puede
  //    avanzar, así que captura en diagonal y luego sigue recto.
  {
    id: "pawn-7",
    startPos: pos(4, 1),
    targetPos: pos(5, 4),
    obstacles: [pos(4, 2)],
    captureTargets: [pos(5, 2)],
    optimalMoves: 3,
    isCapture: true,
    tier: "medium",
    objective: "The square ahead is blocked, so capture diagonally to get around it, then advance.",
    tags: ["blocked-forward", "diagonal-capture", "capture-route"],
  },
  // 8. Ruta de capturas en zigzag: c2 → f5 con captureTargets en d3, e4.
  //    El peón sube cambiando de columna sólo mediante capturas diagonales.
  {
    id: "pawn-8",
    startPos: pos(2, 1),
    targetPos: pos(5, 4),
    captureTargets: [pos(3, 2), pos(4, 3)],
    optimalMoves: 3,
    isCapture: true,
    tier: "medium",
    objective: "Climb by a chain of diagonal captures, changing file each time you take.",
    tags: ["capture-route", "diagonal-capture", "directional-move"],
  },
  // 9. Doble paso + captura: d2 → e5. Avanza dos desde la fila inicial y
  //    remata con una captura diagonal (lectura de dirección del peón).
  {
    id: "pawn-9",
    startPos: pos(3, 1),
    targetPos: pos(4, 4),
    optimalMoves: 2,
    isCapture: true,
    tier: "medium",
    objective: "Take the two-square first step, then capture diagonally to finish.",
    tags: ["slow-advance", "diagonal-capture", "directional-move"],
  },
  // 10. Última fila capturando el bloqueo final: e6 → f8 con obstáculo en
  //     e7 y captureTarget en f7. El avance recto a la octava está cortado;
  //     el peón captura en diagonal y llega a la última fila.
  {
    id: "pawn-10",
    startPos: pos(4, 5),
    targetPos: pos(5, 7),
    obstacles: [pos(4, 6)],
    captureTargets: [pos(5, 6)],
    optimalMoves: 2,
    isCapture: true,
    tier: "medium",
    objective: "The straight path to the last rank is blocked; capture around the final blocker to reach it.",
    tags: ["promotion-path", "blocked-forward", "diagonal-capture"],
  },
];

const QUEEN_EXERCISES: Exercise[] = [
  // ── Easy (5/15): the queen as rook + bishop, simple 1-2 move lines ──
  // 1. Long diagonal (a1→h8)
  {
    id: "queen-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 1,
    tier: "easy",
    objective: "Use the bishop half of the queen: one slide down the long diagonal.",
    tags: ["straight-line", "diagonal-line"],
  },
  // 2. Vertical file (a1→a8)
  {
    id: "queen-2",
    startPos: pos(0, 0),
    targetPos: pos(0, 7),
    optimalMoves: 1,
    tier: "easy",
    objective: "Use the rook half of the queen: one slide up the file.",
    tags: ["straight-line"],
  },
  // 3. Short diagonal (d4→e5)
  {
    id: "queen-3",
    startPos: pos(3, 3),
    targetPos: pos(4, 4),
    optimalMoves: 1,
    tier: "easy",
    objective: "Make a single short diagonal step from the centre.",
    tags: ["diagonal-line"],
  },
  // 4. Horizontal rank (a1→h1)
  {
    id: "queen-4",
    startPos: pos(0, 0),
    targetPos: pos(7, 0),
    optimalMoves: 1,
    tier: "easy",
    objective: "Slide straight across the rank (rook line).",
    tags: ["straight-line"],
  },
  // 5. Two-move path: e4(4,3) → b8(1,7) — not reachable in 1 (no shared rank/file/diagonal)
  {
    id: "queen-5",
    startPos: pos(4, 3),
    targetPos: pos(1, 7),
    optimalMoves: 2,
    tier: "easy",
    objective: "Combine a straight move and a diagonal to reach an off-line square.",
    tags: ["rook-bishop-combo", "pivot"],
  },

  /* ── Medium (5/15): blocked lines force rook+bishop combinations, 3
   * optimal moves. Rotation + Labyrinths content wave 1 (2026-06-08).
   * All BFS-verified. The queen is so mobile that clean, readable mazes
   * top out near 3 moves — denser walls quickly become artificial, so
   * the wave 1 Medium set stays at 3 (still inside the 3-5 band) and
   * leans on the rook+bishop-combo lesson. Same shipped obstacle
   * pattern as king-7/king-10. Hard tier (queen-11..15) PENDING. */

  // 6. Recta y diagonal cortadas: a1 → c1 con obstáculos en b1, b2. El
  //    salto recto (rank) y el diagonal están bloqueados; hay que combinar.
  {
    id: "queen-6",
    startPos: pos(0, 0),
    targetPos: pos(2, 0),
    obstacles: [pos(1, 0), pos(1, 1)],
    optimalMoves: 3,
    tier: "medium",
    objective: "Both the straight and the diagonal shortcut are blocked; combine moves to slip behind the wall.",
    tags: ["rook-bishop-combo", "detour", "blocked-line"],
  },
  // 7. Fila central tapada: d4 → f4 con obstáculos en e4, e3, e5. La
  //    recta está tapada de frente y los pivotes diagonales también.
  {
    id: "queen-7",
    startPos: pos(3, 3),
    targetPos: pos(5, 3),
    obstacles: [pos(4, 3), pos(4, 2), pos(4, 4)],
    optimalMoves: 3,
    tier: "medium",
    objective: "The rank ahead is plugged head-on; loop off the line and rejoin it past the wall.",
    tags: ["straight-line", "detour", "blocked-line"],
  },
  // 8. Diagonal larga + recta: a1 → e5 con obstáculos en d5, e4, d4. El
  //    target está sellado del lado cercano; combinar largo alcance.
  {
    id: "queen-8",
    startPos: pos(0, 0),
    targetPos: pos(4, 4),
    obstacles: [pos(3, 4), pos(4, 3), pos(3, 3)],
    optimalMoves: 3,
    tier: "medium",
    objective: "Ride a long diagonal, then finish straight, to reach a target sealed on its near side.",
    tags: ["rook-bishop-combo", "long-range", "detour"],
  },
  // 9. Corredor de fila: a1 → d1 con obstáculos en b1, b2, c2. La fila
  //    base está tapada; desviar por arriba y volver a bajar.
  {
    id: "queen-9",
    startPos: pos(0, 0),
    targetPos: pos(3, 0),
    obstacles: [pos(1, 0), pos(1, 1), pos(2, 1)],
    optimalMoves: 3,
    tier: "medium",
    objective: "Detour off a blocked rank and come back down to it past the wall.",
    tags: ["straight-line", "detour", "blocked-line"],
  },
  // 10. Captura en la fila trasera: a8 → c8 (captura) con obstáculos en
  //     b8, b7. El deslizamiento directo está amurallado; rodear.
  {
    id: "queen-10",
    startPos: pos(0, 7),
    targetPos: pos(2, 7),
    obstacles: [pos(1, 7), pos(1, 6)],
    optimalMoves: 3,
    isCapture: true,
    tier: "medium",
    objective: "Capture along the back rank when the direct slide is walled (go around).",
    tags: ["capture", "detour", "blocked-line"],
  },
];

const KING_EXERCISES: Exercise[] = [
  /* ── Movement training only — the king as a one-square-any-direction
   * piece. NO check, attacked squares, castling, opposition, or
   * checkmate logic (those are full-chess concepts, not movement
   * training). Tiers assigned by BFS-verified optimalMoves per the
   * shared TIER CRITERIA.
   *
   * ORDER IS POSITIONAL AND FROZEN: PieceProgress.stars maps to this
   * array by index, so existing entries keep their original positions
   * (king-1..7, king-9, king-10) and king-8 is APPENDED last to avoid
   * remapping any live King progress. Do not reorder.
   *
   * Tier mix: 4 Easy (king-1..4), 4 Medium (king-5, king-7, king-10,
   * king-8), 2 Hard (king-6, king-9 — 7-move endurance walks, 6+ band).
   * King therefore already carries 2 Hard; the remaining Hard slots
   * (king-11..15) are PENDING wave 2. */

  // 1. One-square move — simplest king step (forward one). [Easy]
  {
    id: "king-1",
    startPos: pos(4, 0),
    targetPos: pos(4, 1),
    optimalMoves: 1,
    tier: "easy",
    objective: "Take one step straight forward (the king's simplest move).",
    tags: ["one-step", "orthogonal-step"],
  },
  // 2. Safe square — one-square diagonal step, introduces 8-direction reach. [Easy]
  {
    id: "king-2",
    startPos: pos(4, 0),
    targetPos: pos(5, 1),
    optimalMoves: 1,
    tier: "easy",
    objective: "Take one diagonal step; the king reaches all eight neighbours.",
    tags: ["one-step", "diagonal-step"],
  },
  // 3. Avoid danger — walk two squares away from the centre toward the edge. [Easy]
  {
    id: "king-3",
    startPos: pos(3, 3),
    targetPos: pos(1, 5),
    optimalMoves: 2,
    tier: "easy",
    objective: "Walk two single steps from the centre toward the edge.",
    tags: ["one-step", "short-route"],
  },
  // 4. King capture — diagonal one-square capture. [Easy]
  {
    id: "king-4",
    startPos: pos(4, 0),
    targetPos: pos(3, 1),
    optimalMoves: 1,
    isCapture: true,
    tier: "easy",
    objective: "Capture one square diagonally with the king.",
    tags: ["one-step", "diagonal-step"],
  },
  // 5. Reach the shelter — three NE diagonal steps from e5 to h8 corner. [Medium]
  {
    id: "king-5",
    startPos: pos(4, 4),
    targetPos: pos(7, 7),
    optimalMoves: 3,
    tier: "medium",
    objective: "Climb three diagonal steps to the corner shelter.",
    tags: ["diagonal-step", "short-route", "edge-control"],
  },
  // 6. Diagonal noroeste completa: h8 → a1, 7 movimientos. [Hard, 6+ band]
  //    Endurance — el rey atraviesa la diagonal larga sin obstáculos.
  //    Refuerza que cualquier esquina es alcanzable en 7 pasos máximo
  //    desde otra esquina. BFS-verified.
  {
    id: "king-6",
    startPos: pos(7, 7),
    targetPos: pos(0, 0),
    optimalMoves: 7,
    tier: "hard",
    objective: "Endurance walk: cross the full long diagonal, corner to corner, in seven steps.",
    tags: ["diagonal-step", "edge-control"],
  },
  // 7. Detour alrededor de obstáculo lateral: e4 → e8 con obstacle e6. [Medium]
  //    Optimal 4 (chebyshev = 4 sin obstacle; el obstacle no agrega
  //    distancia neta, solo fuerza un cuadro lateral). Path típico:
  //    e4 → f5 → f6 → f7 → e8. BFS-verified.
  {
    id: "king-7",
    startPos: pos(4, 3),
    targetPos: pos(4, 7),
    obstacles: [pos(4, 5)],
    optimalMoves: 4,
    tier: "medium",
    objective: "Detour one square around a blocker to continue straight up.",
    tags: ["orthogonal-step", "detour", "blocked-square"],
  },
  // 9. Antidiagonal completa: a8 → h1, 7 movimientos. [Hard, 6+ band]
  //    Mirror de king-6 — refuerza control de la diagonal SW desde NW.
  //    Sin obstáculos. Pedagogía: cada esquina ↔ esquina en 7 pasos,
  //    independiente de la dirección. BFS-verified.
  {
    id: "king-9",
    startPos: pos(0, 7),
    targetPos: pos(7, 0),
    optimalMoves: 7,
    tier: "hard",
    objective: "Endurance walk: cross the full anti-diagonal, corner to corner, in seven steps.",
    tags: ["diagonal-step", "edge-control"],
  },
  // 10. Muro de obstáculos hacia base rank: e4 → e1 con muro
  //     {e3, e2, d2, f2}. Optimal 4 — los 4 obstacles bloquean los 3
  //     vecinos del target en rank 1 (d2, e2, f2) más e3 directamente
  //     sobre la línea SOUTH. Forza detour completo via d3 → c2 → d1.
  //     Path típico: e4 → d3 → c2 → d1 → e1. Síntesis de king-7 (detour)
  //     + planning de varios cuadros. BFS-verified. [Medium]
  {
    id: "king-10",
    startPos: pos(4, 3),
    targetPos: pos(4, 0),
    obstacles: [pos(4, 2), pos(4, 1), pos(3, 1), pos(5, 1)],
    optimalMoves: 4,
    tier: "medium",
    objective: "Plan a multi-square detour around a wall to reach the back rank.",
    tags: ["orthogonal-step", "detour", "blocked-square"],
  },
  // 8. RESOLVED (was parked) — APPENDED at index 9 to preserve the
  //    positional progress map (do not move into numeric order).
  //    Lectura de diagonal con cuadro bloqueado: a1 → c3 con obstáculo en
  //    b2 — el cuadro diagonal directo está bloqueado, así que el rey lo
  //    rodea (a1 → b1 → c2 → c3, u a1 → a2 → b3 → c3). Optimal 3. Sin
  //    captura: el obstáculo es un bloqueador, nunca una pieza capturable
  //    (resuelve la ambigüedad captureTargets-vs-obstacles que lo tenía
  //    parqueado). BFS-verified. [Medium]
  {
    id: "king-8",
    startPos: pos(0, 0),
    targetPos: pos(2, 2),
    obstacles: [pos(1, 1)],
    optimalMoves: 3,
    tier: "medium",
    objective: "The diagonal square ahead is blocked; step around it to reach the target.",
    tags: ["diagonal-step", "detour", "blocked-square"],
  },
];

/** Pieces with exercises defined and playable */
export const PLAYABLE_PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

export const EXERCISES: Record<PieceId, Exercise[]> = {
  rook:   ROOK_EXERCISES,
  bishop: BISHOP_EXERCISES,
  knight: KNIGHT_EXERCISES,
  pawn:   PAWN_EXERCISES,
  queen:  QUEEN_EXERCISES,
  king:   KING_EXERCISES,
};

export const BADGE_THRESHOLD = 10; // stars; pools vary (5-10 exercises → 15-30★ max per piece)

/**
 * Returns the current pool count for a piece. Per-piece dynamic
 * replacement for the legacy `EXERCISES_PER_PIECE` constant — needed
 * when piece pools diverge from the original 5 (e.g., King senda 5→10
 * planned for Sprint 2-3 of Training Economy Alpha 2026-06-05).
 *
 * Today every piece returns 5 so this is behavior-identical to the
 * deprecated constant. Callsites migrate to `getExerciseCount(piece)`
 * before any pool grows; once all consumers migrate, the deprecated
 * export below is removed.
 */
export function getExerciseCount(piece: PieceId): number {
  return EXERCISES[piece].length;
}

/**
 * @deprecated Use {@link getExerciseCount} for per-piece dynamic count.
 *
 * Kept during Sprint 1 (2026-06-05) for callsites not yet migrated —
 * result-overlay.tsx still imports it for its module-level `MAX_STARS`
 * and the `StarsRow` component. Migration deferred to Sprint 3 when
 * StarsRow takes a `piece` prop. Until then this constant returns 5
 * to keep visual parity with current piece pools.
 */
export const EXERCISES_PER_PIECE = 5;

/* ── L2 Labyrinths (POC) ──────────────────────────────────────────
 * Obstacles are friendly blocker pieces. The player's piece cannot
 * move through them or capture them. The labyrinth forces a non-
 * trivial path between startPos and targetPos. Stars are awarded by
 * how close the player's move count approaches `optimalMoves`:
 *   moves == optimal           → 3 stars
 *   moves <= optimal + 2       → 2 stars
 *   moves <= optimal + 4       → 1 star
 *   else                       → 0 stars (allowed, no fail)
 * --------------------------------------------------------------- */

const ROOK_LABYRINTHS: Exercise[] = [
  {
    id: "rook-lab-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 3,
    obstacles: [
      pos(3, 0), // d1
      pos(3, 7), // d8
      pos(7, 3), // h4
    ],
  },
  {
    id: "rook-lab-2",
    startPos: pos(0, 0),
    targetPos: pos(7, 0),
    optimalMoves: 3,
    obstacles: [
      pos(2, 0), // c1
      pos(5, 0), // f1
      pos(0, 3), // a4
    ],
  },
  defineLabyrinth({
    id: "rook-lab-3",
    start: "a1",
    target: "h8",
    obstacles: ["d1", "a4", "h5"],
    optimalMoves: 3,
  }),
];

const BISHOP_LABYRINTHS: Exercise[] = [
  defineLabyrinth({
    id: "bishop-lab-3",
    start: "c1",
    target: "h6",
    obstacles: ["e3", "g5"],
    optimalMoves: 3,
  }),
  defineLabyrinth({
    id: "bishop-lab-4",
    start: "a1",
    target: "h8",
    obstacles: ["c3", "e5"],
    optimalMoves: 5,
  }),
];

const KNIGHT_LABYRINTHS: Exercise[] = [
  /**
   * knight-lab-1 — "The Clipped Jump"
   * From a1 to e4. c2 blocks the natural first move, forcing the
   * knight out through b3. d4 pinches the centre so the knight
   * must hook around via d2 or c5.
   *
   *  8 . . . . . . . .
   *  7 . . . . . . . .
   *  6 . . . . . . . .
   *  5 . . . . . . . .
   *  4 . . . . X ★ . .
   *  3 . . . . . . . .
   *  2 . . X . . . . .
   *  1 ♘ . . . . . . .
   *    a b c d e f g h
   */
  {
    id: "knight-lab-1",
    startPos: pos(0, 0),
    targetPos: pos(4, 3),
    optimalMoves: 3,
    obstacles: [
      pos(2, 1), // c2
      pos(3, 3), // d4
    ],
  },
  /**
   * knight-lab-2 — "The Zigzag"
   * From a1 to e5. b3 and d3 choke two early squares; c6 blocks
   * the far side. The knight must weave a 4-jump through narrow
   * gaps.
   *
   *  8 . . . . . . . .
   *  7 . . . . . . . .
   *  6 . . X . . . . .
   *  5 . . . . ★ . . .
   *  4 . . . . . . . .
   *  3 . . X . . . . .
   *  2 . . . . . . . .
   *  1 ♘ . . . . . . .
   *    a b c d e f g h
   */
  {
    id: "knight-lab-2",
    startPos: pos(0, 0),
    targetPos: pos(4, 4),
    optimalMoves: 4,
    obstacles: [
      pos(1, 2), // b3
      pos(3, 2), // d3
      pos(2, 5), // c6
    ],
  },
  defineLabyrinth({
    id: "knight-lab-3",
    start: "a1",
    target: "h8",
    obstacles: ["d1", "c5", "g6"],
    optimalMoves: 6,
  }),
  defineLabyrinth({
    id: "knight-lab-4",
    start: "a1",
    target: "f6",
    obstacles: ["c2", "d4", "e3"],
    optimalMoves: 4,
  }),
  defineLabyrinth({
    id: "knight-lab-5",
    start: "b1",
    target: "g7",
    obstacles: ["c4", "e6", "g5"],
    optimalMoves: 5,
  }),
];

const PAWN_LABYRINTHS: Exercise[] = [
  /**
   * pawn-lab-1 — "First Capture" (Easy)
   * Forward path is sealed by d3 (and d4 backs it up so forward-2 from rank 1
   * also fails). The only legal first move is the diagonal capture to e3.
   * After the capture, every subsequent step has exactly one legal move
   * (e3 → e4 → e5), so there is no dead-state branch: a beginner cannot
   * stray off the rails by going forward where a capture was expected.
   *
   *   8 . . . . . . . .
   *   7 . . . . . . . .
   *   6 . . . . . . . .
   *   5 . . . . ★ . . .
   *   4 . . . X . . . .
   *   3 . . . X ✸ . . .
   *   2 . . . ♙ . . . .
   *   1 . . . . . . . .
   *     a b c d e f g h
   */
  defineLabyrinth({
    id: "pawn-lab-1",
    start: "d2",
    target: "e5",
    obstacles: ["d3", "d4"],
    captureTargets: ["e3"],
    isCapture: true,
    optimalMoves: 3,
  }),
  defineLabyrinth({
    id: "pawn-lab-3",
    start: "a2",
    target: "d7",
    obstacles: ["a3", "a4"],
    captureTargets: ["b3", "c4", "d5"],
    isCapture: true,
    optimalMoves: 5,
  }),
  defineLabyrinth({
    id: "pawn-lab-4",
    start: "a2",
    target: "c6",
    obstacles: ["a3"],
    captureTargets: ["b3", "c4"],
    isCapture: true,
    optimalMoves: 4,
  }),
  defineLabyrinth({
    id: "pawn-lab-5",
    start: "g2",
    target: "c7",
    obstacles: ["g3"],
    captureTargets: ["f3", "e4", "d5", "c6"],
    isCapture: true,
    optimalMoves: 5,
  }),
];

const QUEEN_LABYRINTHS: Exercise[] = [
  {
    id: "queen-lab-1",
    startPos: pos(0, 0),
    targetPos: pos(7, 7),
    optimalMoves: 3,
    obstacles: [
      pos(1, 1), // b2
      pos(0, 4), // a5
      pos(7, 3), // h4
    ],
  },
  defineLabyrinth({
    id: "queen-lab-2",
    start: "a1",
    target: "h1",
    obstacles: ["d1", "e2", "d3", "a4", "h4"],
    optimalMoves: 3,
  }),
  defineLabyrinth({
    id: "queen-lab-3",
    start: "d1",
    target: "d8",
    obstacles: ["d3", "d5", "d7"],
    optimalMoves: 3,
  }),
];

const KING_LABYRINTHS: Exercise[] = [
  /**
   * king-lab-1 — "King Shelter I" (Easy)
   * From e1 to the a1 corner shelter. c1 blocks the direct rank-walk,
   * so the king must step one square N and detour via the second rank
   * before returning to a1. Showcases that the king's 8-direction
   * one-square reach lets it sidestep a blocker without losing optimal
   * distance.
   *
   *   8 . . . . . . . .
   *   7 . . . . . . . .
   *   6 . . . . . . . .
   *   5 . . . . . . . .
   *   4 . . . . . . . .
   *   3 . . . . . . . .
   *   2 . . . . . . . .
   *   1 ★ . X . ♔ . . .
   *     a b c d e f g h
   *
   * Threats are NOT modeled in v0.1 — see training-content-v0.1.md §7
   * + §12. Real "avoid danger" mechanics come with attackedSquares in
   * v0.2.
   */
  defineLabyrinth({
    id: "king-lab-1",
    start: "e1",
    target: "a1",
    obstacles: ["c1"],
    optimalMoves: 4,
  }),
];

export const LABYRINTHS: Record<PieceId, Exercise[]> = {
  rook:   ROOK_LABYRINTHS,
  bishop: BISHOP_LABYRINTHS,
  knight: KNIGHT_LABYRINTHS,
  pawn:   PAWN_LABYRINTHS,
  queen:  QUEEN_LABYRINTHS,
  king:   KING_LABYRINTHS,
};

/** Compute stars earned in a labyrinth. */
export function labyrinthStars(moves: number, optimal: number): number {
  if (moves <= optimal) return 3;
  if (moves <= optimal + 2) return 2;
  if (moves <= optimal + 4) return 1;
  return 0;
}
