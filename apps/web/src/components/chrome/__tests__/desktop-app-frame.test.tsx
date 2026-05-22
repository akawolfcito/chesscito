import { describe, expect, it } from "vitest";
import { isAppRoute } from "../desktop-app-frame";

describe("isAppRoute", () => {
  it("matches the six app-route prefixes exactly", () => {
    expect(isAppRoute("/hub")).toBe(true);
    expect(isAppRoute("/exercises")).toBe(true);
    expect(isAppRoute("/arena")).toBe(true);
    expect(isAppRoute("/coach")).toBe(true);
    expect(isAppRoute("/trophies")).toBe(true);
    expect(isAppRoute("/victory")).toBe(true);
  });

  it("matches deep subpaths under app prefixes", () => {
    expect(isAppRoute("/coach/history")).toBe(true);
    expect(isAppRoute("/victory/0x123abc")).toBe(true);
    expect(isAppRoute("/exercises/rook")).toBe(true);
  });

  it("does NOT match the landing root", () => {
    expect(isAppRoute("/")).toBe(false);
  });

  it("does NOT match the share landing pages", () => {
    expect(isAppRoute("/share")).toBe(false);
    expect(isAppRoute("/share/score")).toBe(false);
    expect(isAppRoute("/share/badge")).toBe(false);
    expect(isAppRoute("/share/daily")).toBe(false);
    expect(isAppRoute("/share/endgame")).toBe(false);
  });

  it("matches informational pages (framed for landing → hub continuity)", () => {
    expect(isAppRoute("/about")).toBe(true);
    expect(isAppRoute("/support")).toBe(true);
    expect(isAppRoute("/terms")).toBe(true);
    expect(isAppRoute("/privacy")).toBe(true);
    expect(isAppRoute("/why")).toBe(true);
  });

  it("does NOT match dev fixture routes", () => {
    expect(isAppRoute("/dev")).toBe(false);
    expect(isAppRoute("/dev/persist-overlay")).toBe(false);
    expect(isAppRoute("/dev/tx-progress")).toBe(false);
  });

  it("does NOT match prefix-collisions (e.g. /hubcap, /arenas-extended)", () => {
    expect(isAppRoute("/hubcap")).toBe(false);
    expect(isAppRoute("/arenas-extended")).toBe(false);
    expect(isAppRoute("/exercise")).toBe(false);
    expect(isAppRoute("/victorious")).toBe(false);
    // Informational route prefix-collisions
    expect(isAppRoute("/aboutme")).toBe(false);
    expect(isAppRoute("/supporter")).toBe(false);
    expect(isAppRoute("/whymyword")).toBe(false);
    expect(isAppRoute("/termsheet")).toBe(false);
    expect(isAppRoute("/privacypolicy")).toBe(false);
  });
});
