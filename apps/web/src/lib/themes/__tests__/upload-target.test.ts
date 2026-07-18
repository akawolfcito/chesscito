import { describe, it, expect } from "vitest";
import {
  resolveUploadTarget,
  resolveVariantBasename,
} from "../upload-target";

describe("resolveUploadTarget", () => {
  it("rejects an unknown theme", () => {
    const r = resolveUploadTarget("no-such-theme", "hub.portal", "default");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/theme/i);
  });

  it("rejects an unknown slot key", () => {
    const r = resolveUploadTarget("candy-forest", "hub.nope", "default");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/slot/i);
  });

  it("rejects an invalid variant", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "ultra");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/variant/i);
  });

  it("resolves the default basename from the registry", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "default");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.basename).toBe("/art/hub/portal-chesscito-normal");
  });

  it("resolves the pro basename when the slot declares one", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "pro");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.basename).toBe("/art/hub/portal-chesscito-pro");
  });

  it("never returns a basename outside /art", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "default");
    if (r.ok) expect(r.basename.startsWith("/art/")).toBe(true);
  });
});

describe("resolveVariantBasename", () => {
  it("returns the default basename for variant=default", () => {
    const r = resolveVariantBasename({ default: "/art/x" }, "default");
    expect(r).toEqual({ ok: true, basename: "/art/x" });
  });

  it("returns the pro basename when present", () => {
    const r = resolveVariantBasename({ default: "/art/x", pro: "/art/x-pro" }, "pro");
    expect(r).toEqual({ ok: true, basename: "/art/x-pro" });
  });

  it("refuses a pro upload when the slot ships no pro override", () => {
    // You cannot mint a new variant by upload — that needs a registry
    // edit first. Uploading to an undeclared pro would write a file no
    // slot points at.
    const r = resolveVariantBasename({ default: "/art/x" }, "pro");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/pro/i);
  });

  it("refuses an invalid variant", () => {
    const r = resolveVariantBasename({ default: "/art/x" }, "ultra");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/variant/i);
  });
});
