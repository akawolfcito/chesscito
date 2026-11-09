import { describe, it, expect } from "vitest";

import { SEAT_COOKIE, readSeatToken, seatCookie, seatCookiePath } from "../http";

const ID = "A".repeat(22);
const TOKEN = "the-seat-credential";

function request(init: { cookie?: string; url?: string } = {}) {
  return new Request(init.url ?? `https://play.chesscito.com/api/duel/${ID}/move`, {
    method: "POST",
    headers: init.cookie ? { cookie: init.cookie } : {},
  });
}

describe("readSeatToken", () => {
  /** ⚠️ The body is the PRIMARY path: the cookie does not survive a jump from
   *  an in-app browser to the system one, nor the cross-domain bounce that
   *  `learn` mode does on `/arena`. */
  it("prefers the credential in the body", () => {
    const token = readSeatToken(request({ cookie: `${SEAT_COOKIE}=from-cookie` }), {
      seatToken: TOKEN,
    });

    expect(token).toBe(TOKEN);
  });

  it("falls back to the cookie when the body has none", () => {
    expect(readSeatToken(request({ cookie: `${SEAT_COOKIE}=${TOKEN}` }), {})).toBe(
      TOKEN,
    );
  });

  it("finds its cookie among others", () => {
    const header = `other=1; ${SEAT_COOKIE}=${TOKEN}; another=2`;
    expect(readSeatToken(request({ cookie: header }), {})).toBe(TOKEN);
  });

  /**
   * ⛔ THE TEST THIS FILE EXISTS FOR. A credential in a URL is a seat given
   * away by accident: it lands in access logs, in `Referer` headers sent to
   * third parties, in browser history, and in every link the player shares.
   * Reading it "for convenience" must fail loudly, so it is asserted as
   * IGNORED rather than merely unimplemented.
   */
  it("never reads the credential from the query string", () => {
    const url = `https://play.chesscito.com/api/duel/${ID}/move?seatToken=${TOKEN}`;

    expect(readSeatToken(request({ url }), {})).toBeNull();
    expect(readSeatToken(request({ url }), undefined)).toBeNull();
  });

  it("treats a blank or malformed credential as none at all", () => {
    expect(readSeatToken(request(), { seatToken: "   " })).toBeNull();
    expect(readSeatToken(request(), { seatToken: 42 })).toBeNull();
    expect(readSeatToken(request(), null)).toBeNull();
    expect(readSeatToken(request({ cookie: `${SEAT_COOKIE}=` }), {})).toBeNull();
    expect(readSeatToken(request({ cookie: "malformed" }), {})).toBeNull();
  });
});

describe("seatCookie", () => {
  /** ⛔ Scoped to the duel: holding two at once must not let one seat shadow
   *  the other, and the browser only offers the cookie whose path matches. */
  it("is scoped to its own duel", () => {
    expect(seatCookie(ID, TOKEN).options.path).toBe(`/api/duel/${ID}`);
    expect(seatCookiePath("B".repeat(22))).not.toBe(seatCookiePath(ID));
  });

  it("is unreadable from script and does not travel cross-site", () => {
    const { options } = seatCookie(ID, TOKEN);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
  });

  /** It only has to outlive one duel: an hour of invitation plus half an hour
   *  a side at the top rung. */
  it("expires within hours, not days", () => {
    expect(seatCookie(ID, TOKEN).options.maxAge).toBe(7200);
  });
});
