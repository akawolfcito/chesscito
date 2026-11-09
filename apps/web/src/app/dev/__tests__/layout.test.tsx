/**
 * The /dev subtree gate.
 *
 * ⚠️ Why the layout and not (only) the pages: 19 of the /dev pages are
 * `"use client"`, and Next inlines ONLY `NODE_ENV` and `NEXT_PUBLIC_*` into the
 * browser bundle — `process.env.VERCEL_ENV` is `undefined` there. A gate inside a
 * client component is therefore SSR-only in practice. This layout is a SERVER
 * component and the de-facto root of every /dev route, so the gate here is the
 * one that actually holds — and a new probe cannot forget to add it.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("../globals.css", () => ({}));

import DevLayout from "../layout";

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("/dev layout gate", () => {
  it("404s the whole subtree in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => DevLayout({ children: null })).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders on preview, where NODE_ENV reads production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => DevLayout({ children: null })).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders locally", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(() => DevLayout({ children: null })).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
