import { afterEach, describe, expect, it } from "vitest";
import { getAttribution } from "../attribution";

const KEY = "chesscito:attribution";

function setUrl(search: string) {
  // jsdom lets us rewrite location.search via history.
  window.history.replaceState({}, "", `/${search ? `?${search}` : ""}`);
}

afterEach(() => {
  window.localStorage.clear();
  setUrl("");
});

describe("getAttribution", () => {
  it("defaults to direct with no params and persists first-touch", () => {
    expect(getAttribution()).toEqual({ source: "direct", campaign: null });
    expect(window.localStorage.getItem(KEY)).toBe(
      JSON.stringify({ source: "direct", campaign: null }),
    );
  });

  it("normalizes utm params on first touch", () => {
    setUrl("utm_source=whatsapp&utm_campaign=Launch_2026");
    expect(getAttribution()).toEqual({
      source: "share_whatsapp",
      campaign: "launch_2026",
    });
  });

  it("is first-touch: a later visit with new params keeps the original", () => {
    setUrl("source=minipay");
    getAttribution(); // persists minipay_discovery
    setUrl("source=qr"); // second visit, different param
    expect(getAttribution().source).toBe("minipay_discovery");
  });

  it("collapses unrecognized source to unknown and drops bad campaign", () => {
    setUrl("source=affiliate_x9&campaign=drop%20table");
    expect(getAttribution()).toEqual({ source: "unknown", campaign: null });
  });
});
