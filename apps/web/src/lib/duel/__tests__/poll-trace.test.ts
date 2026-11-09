import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

import { duelArenaState, shouldPoll } from "../arena-state";
import { toPublic } from "../lifecycle";
import { createDuel, joinDuel, playMove, resignDuel } from "../operations";
import { hashSeatToken } from "../seat-token";
import type { Duel } from "../types";

/**
 * ⛔ EL TRACE OPERATIVO DEL POLL, como prueba y no como nota suelta.
 *
 * Lo que este archivo fija es el TAMAÑO de lo que viaja en cada poll y el
 * hecho de que el poll SE DETIENE en los dos estados terminales. Las otras
 * mediciones del trace (queries, writes, Redis, analytics, logs) son de la
 * ruta y viven en `docs/audits/2026-08-15-duel-poll-trace.md` con su evidencia
 * por inspección; ésta es la mitad que un test puede sostener solo.
 *
 * ⚠️ El número importante que sale de acá: la respuesta CRECE con la partida,
 * porque `moves` viaja entero en cada poll. No es un defecto — el cliente lo
 * necesita para dibujar la estela y para la repetición triple — pero es el
 * único componente del costo que no es constante, y conviene tenerlo medido
 * antes de congelar en vez de descubrirlo con una partida larga.
 */

const NOON = Date.parse("2026-08-15T12:00:00.000Z");

function invitation(): Duel {
  return createDuel({
    id: "A".repeat(22),
    seat: "w",
    tokenHash: hashSeatToken("white"),
    minutes: 10,
    displayName: "Ana",
    invitedBy: null,
    now: NOON,
  });
}

function game(): Duel {
  const joined = joinDuel({
    duel: invitation(),
    tokenHash: hashSeatToken("black"),
    displayName: "Beto",
    presentedToken: null,
    now: NOON,
  });
  if (!joined.ok) throw new Error("fixture");
  return joined.duel;
}

/** A real game of `plies` half-moves, played legally. */
function played(plies: number): Duel {
  let duel = game();
  const board = new Chess();
  for (let i = 0; i < plies; i += 1) {
    const legal = board.moves();
    if (legal.length === 0) break;
    const san = legal[i % legal.length];
    board.move(san);
    const result = playMove({
      duel,
      token: i % 2 === 0 ? "white" : "black",
      san,
      version: duel.version,
      now: NOON + (i + 1) * 1000,
    });
    if (!result.ok) break;
    duel = result.duel;
  }
  return duel;
}

function payloadBytes(duel: Duel): number {
  return Buffer.byteLength(JSON.stringify(toPublic(duel, "w")), "utf8");
}

describe("what one poll answers with", () => {
  it("stays small for a fresh duel", () => {
    // Recorded 2026-08-15. The ceiling is generous on purpose: it is a
    // regression alarm, not a target.
    expect(payloadBytes(game())).toBeLessThan(1_200);
  });

  /**
   * ⚠️ THE ONE COMPONENT OF THE COST THAT IS NOT CONSTANT. `moves` travels in
   * full on every poll, so a long game answers with a bigger body than an
   * opening. Measured rather than guessed, so the freeze knows its envelope.
   */
  it("grows with the game, and stays well under a modest ceiling", () => {
    const sizes = [0, 20, 40, 80].map((plies) => payloadBytes(played(plies)));

    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    }
    // 80 plies is a long duel, and still far under anything that would matter
    // at a 1.2s-to-3s cadence.
    expect(sizes[sizes.length - 1]).toBeLessThan(4_000);
  });
});

describe("the poll stops where it must", () => {
  /**
   * ⛔ FREEZE CRITERION. A poll that keeps running on a settled duel is both
   * waste and a promise to the reader that something might still change.
   */
  it("stops on both terminal states", () => {
    const finished = resignDuel({ duel: game(), token: "white", version: 2, now: NOON });
    if (!finished.ok) throw new Error("fixture");

    const settled = [
      toPublic(finished.duel, "w"),
      toPublic({ ...invitation(), status: "expired" }, "w"),
    ];

    for (const duel of settled) {
      expect(shouldPoll(duelArenaState({ status: "loaded", duel }))).toBe(false);
    }
  });

  it("keeps polling while there is something left to learn", () => {
    for (const duel of [toPublic(invitation(), "w"), toPublic(game(), "w")]) {
      expect(shouldPoll(duelArenaState({ status: "loaded", duel }))).toBe(true);
    }
  });

  /** Nothing to poll before the first answer, or when the duel is not there. */
  it("does not poll a duel it has not read yet", () => {
    expect(shouldPoll(duelArenaState({ status: "loading" }))).toBe(false);
    expect(shouldPoll(duelArenaState({ status: "missing" }))).toBe(false);
  });
});
