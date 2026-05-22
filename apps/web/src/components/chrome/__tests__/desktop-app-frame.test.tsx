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

  it("does NOT match informational pages", () => {
    expect(isAppRoute("/about")).toBe(false);
    expect(isAppRoute("/support")).toBe(false);
    expect(isAppRoute("/terms")).toBe(false);
    expect(isAppRoute("/privacy")).toBe(false);
    expect(isAppRoute("/why")).toBe(false);
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
  });
});
