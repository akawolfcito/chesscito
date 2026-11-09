import { describe, it, expect } from "vitest";

import { reactToApiResult } from "../reaction";
import type { DuelArenaInput } from "../arena-state";
import type { DuelPublic } from "../types";

const duelAt = (version: number) =>
  ({ id: "A".repeat(22), version, status: "active" } as unknown as DuelPublic);

const ON_SCREEN: DuelArenaInput = { status: "loaded", duel: duelAt(2) };

describe("a successful answer", () => {
  it("adopts the duel the server returned", () => {
    const reaction = reactToApiResult(ON_SCREEN, { ok: true, duel: duelAt(3) });

    expect(reaction.next).toEqual({ status: "loaded", duel: duelAt(3) });
    expect(reaction.notice).toBeNull();
    expect(reaction.refetch).toBe(false);
  });

  it("hands up a credential the server just issued", () => {
    const reaction = reactToApiResult(ON_SCREEN, {
      ok: true,
      duel: duelAt(2),
      seatToken: "brand-new",
    });

    expect(reaction.seatToken).toBe("brand-new");
  });
});

describe("⛔ a version-conflict is adopted, never retried", () => {
  /**
   * The route already answers with the real position. Replaying a chess move
   * against a position that changed underneath is how a game gets silently
   * corrupted — and it reads as a bug in the referee, not in the client.
   */
  it("takes the fresh position and asks for nothing more", () => {
    const reaction = reactToApiResult(ON_SCREEN, {
      ok: false,
      error: "version-conflict",
      duel: duelAt(7),
    });

    expect(reaction.next).toEqual({ status: "loaded", duel: duelAt(7) });
    expect(reaction.notice).toBe("version-conflict");
    // ⛔ No refetch either: we already hold the freshest state there is.
    expect(reaction.refetch).toBe(false);
  });

  it("does the same for a duel that expired under us", () => {
    const reaction = reactToApiResult(ON_SCREEN, {
      ok: false,
      error: "expired",
      duel: duelAt(3),
    });

    expect(reaction.next).toEqual({ status: "loaded", duel: duelAt(3) });
    expect(reaction.notice).toBe("expired");
  });
});

describe("⛔ a dead network is re-READ, never re-POSTed", () => {
  /**
   * A request that got no answer MAY HAVE APPLIED. A retry after a silent
   * success plays the move twice, and the second one lands in a position where
   * it might be legal and disastrous. So: keep the screen exactly as it was,
   * claim nothing, and go read.
   */
  it("leaves the position untouched and schedules a read", () => {
    const reaction = reactToApiResult(ON_SCREEN, { ok: false, error: "network" });

    expect(reaction.next).toBe(ON_SCREEN);
    expect(reaction.notice).toBe("network");
    expect(reaction.refetch).toBe(true);
  });

  it("invents nothing even when there was nothing on screen yet", () => {
    const reaction = reactToApiResult({ status: "loading" }, {
      ok: false,
      error: "network",
    });

    expect(reaction.next).toEqual({ status: "loading" });
  });
});

describe("refusals with nothing attached", () => {
  /** An illegal move changed nothing on the server, so there is nothing to go
   *  read. The board on screen is still right. */
  it("keeps the board and does not read again after an illegal move", () => {
    const reaction = reactToApiResult(ON_SCREEN, { ok: false, error: "illegal-move" });

    expect(reaction.next).toBe(ON_SCREEN);
    expect(reaction.notice).toBe("illegal-move");
    expect(reaction.refetch).toBe(false);
  });

  /** ⚠️ These two mean the server knows something we do not — the rival moved,
   *  or somebody sat down — so they ARE worth a read. */
  it("reads again when the server clearly knows more than we do", () => {
    for (const error of ["not-your-turn", "seat-taken"]) {
      expect(reactToApiResult(ON_SCREEN, { ok: false, error }).refetch).toBe(true);
    }
  });

  it("reads `duel-not-active` as the duel having ended", () => {
    const reaction = reactToApiResult(ON_SCREEN, {
      ok: false,
      error: "duel-not-active",
    });

    expect(reaction.notice).toBe("expired");
  });

  it("turns a 404 into a duel that is simply not there", () => {
    for (const error of ["not_found", "404"]) {
      expect(reactToApiResult(ON_SCREEN, { ok: false, error }).next).toEqual({
        status: "missing",
      });
    }
  });

  /** ⚠️ An unknown code must not silently look like success, and must not blank
   *  the board either. */
  it("names an unknown failure without losing the board", () => {
    const reaction = reactToApiResult(ON_SCREEN, { ok: false, error: "internal" });

    expect(reaction.notice).toBe("unavailable");
    expect(reaction.next).toBe(ON_SCREEN);
  });
});
