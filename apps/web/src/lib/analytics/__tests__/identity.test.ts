import { afterEach, describe, expect, it } from "vitest";
import {
  claimAppOpenedForVisit,
  getAnonymousId,
  getVisitId,
} from "../identity";

const ANON_KEY = "chesscito:analytics-session";
const VISIT_KEY = "chesscito:visit-id";
const APP_OPENED_KEY = "chesscito:app-opened-fired";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("getAnonymousId", () => {
  it("persists a stable id across calls", () => {
    const a = getAnonymousId();
    const b = getAnonymousId();
    expect(a).not.toBe("");
    expect(a).toBe(b);
    expect(window.localStorage.getItem(ANON_KEY)).toBe(a);
  });

  it("reuses the pre-existing session_id value (backward compatible)", () => {
    window.localStorage.setItem(ANON_KEY, "legacyvalue1234");
    expect(getAnonymousId()).toBe("legacyvalue1234");
  });

  it("lives in localStorage, not sessionStorage (persists across visits)", () => {
    const id = getAnonymousId();
    expect(window.sessionStorage.getItem(ANON_KEY)).toBeNull();
    expect(window.localStorage.getItem(ANON_KEY)).toBe(id);
  });
});

describe("getVisitId", () => {
  it("is stable within a visit", () => {
    const a = getVisitId();
    const b = getVisitId();
    expect(a).not.toBe("");
    expect(a).toBe(b);
    expect(window.sessionStorage.getItem(VISIT_KEY)).toBe(a);
  });

  it("lives in sessionStorage so a new visit gets a fresh id", () => {
    const first = getVisitId();
    window.sessionStorage.clear(); // simulate new tab / visit
    const second = getVisitId();
    expect(second).not.toBe(first);
  });

  it("is independent from the anonymous id", () => {
    const anon = getAnonymousId();
    const visit = getVisitId();
    expect(visit).not.toBe(anon);
  });
});

describe("claimAppOpenedForVisit", () => {
  it("returns true exactly once per visit, then false", () => {
    expect(claimAppOpenedForVisit()).toBe(true);
    expect(claimAppOpenedForVisit()).toBe(false);
    expect(claimAppOpenedForVisit()).toBe(false);
    expect(window.sessionStorage.getItem(APP_OPENED_KEY)).toBe("1");
  });

  it("re-arms for a new visit (sessionStorage cleared)", () => {
    expect(claimAppOpenedForVisit()).toBe(true);
    window.sessionStorage.clear();
    expect(claimAppOpenedForVisit()).toBe(true);
  });
});
