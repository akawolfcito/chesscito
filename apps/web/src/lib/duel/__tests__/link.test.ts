import { describe, it, expect } from "vitest";

import { duelShareUrl } from "../link";

const ID = "Ab3-_9xYzQwErTyUiOpAs1";

describe("duelShareUrl", () => {
  /**
   * ⛔ THE RULE THIS FILE EXISTS FOR, half one.
   *
   * The link is built from the duel ID, never from the current URL. After the
   * login round trip the address bar carries `privy_oauth_code` and
   * `privy_oauth_state` — MEASURED on a phone in stage 4 — so a share button
   * that copies `window.location.href` mails the inviter's OAuth code to their
   * friend. The assertion is on the produced string, not on the intent.
   */
  it("never carries anything from the current address bar", () => {
    const dirty = new URL(
      "https://play.chesscito.com/en/arena" +
        "?duel=SOMEONE-ELSES-DUEL" +
        "&privy_oauth_code=leaked-code" +
        "&privy_oauth_state=leaked-state" +
        "&fresh=1",
    );

    const link = duelShareUrl(ID, "en", dirty);

    expect(link).toBe(`https://play.chesscito.com/en/arena?duel=${ID}`);
    expect(link).not.toContain("privy");
    expect(link).not.toContain("leaked");
    expect(link).not.toContain("SOMEONE-ELSES-DUEL");
    expect(link).not.toContain("fresh");
  });

  /**
   * ⛔ Half two: absolute, and on the PLAY host.
   *
   * In `learn` mode the middleware bounces every `/arena` cross-domain to the
   * play host. The query survives that jump — the seat cookie does NOT, because
   * it does not cross domains. A relative link handed to a friend on LEARN
   * therefore lands them somewhere their credential cannot follow.
   */
  it("sends a guest to PLAY even when the inviter is on LEARN", () => {
    const onLearn = new URL("https://learn.chesscito.com/es/hub");

    expect(duelShareUrl(ID, "es", onLearn)).toBe(
      `https://play.chesscito.com/es/arena?duel=${ID}`,
    );
  });

  it("keeps preview links inside preview", () => {
    const onLearnPreview = new URL("https://learn-preview.chesscito.com/en/hub");

    expect(duelShareUrl(ID, "en", onLearnPreview)).toBe(
      `https://preview.chesscito.com/en/arena?duel=${ID}`,
    );
  });

  it("is already absolute when the inviter is on PLAY", () => {
    const onPlay = new URL("https://play.chesscito.com/en/hub");

    expect(duelShareUrl(ID, "en", onPlay)).toBe(
      `https://play.chesscito.com/en/arena?duel=${ID}`,
    );
  });

  /**
   * ⚠️ Dev and the phone tunnel keep their own origin, and that is not a
   * loophole — it is what makes the feature testable at all. Rewriting to
   * `play.chesscito.com` from a `trycloudflare.com` tunnel would hand the
   * founder a link to PRODUCTION every time he tried to test a duel on his
   * phone, which is exactly how a feature gets "verified" against the wrong
   * deployment. There is no cross-domain bounce in dev, so nothing is lost.
   */
  it("stays where it is in dev and behind a tunnel", () => {
    for (const origin of [
      "http://localhost:3002/en/hub",
      "https://something-fwd-maybe.trycloudflare.com/en/hub",
    ]) {
      const link = duelShareUrl(ID, "en", new URL(origin));
      expect(link).toBe(`${new URL(origin).origin}/en/arena?duel=${ID}`);
    }
  });

  it("carries the locale the inviter is reading in", () => {
    const onPlay = new URL("https://play.chesscito.com/es/hub");
    expect(duelShareUrl(ID, "es", onPlay)).toContain("/es/arena");
  });

  /** ⚠️ The id is 128 bits of base64url: `-` and `_` are legal and must not be
   *  percent-escaped into a link that no longer matches the row. */
  it("does not mangle a base64url id", () => {
    const link = duelShareUrl("aB-_cD1234567890123456", "en", new URL("https://play.chesscito.com/"));
    expect(link).toContain("duel=aB-_cD1234567890123456");
  });
});
