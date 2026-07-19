import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { updateRegistrySource } from "../registry-source";

const SOURCE = `
export const THEMES = {
  "candy-forest": {
    assets: {
      "hub.portal": { default: "/art/portal", usedIn: ["Hub"] },
      "arena.frame": { pro: "/art/frame-pro" },
    },
  },
};
`;

describe("updateRegistrySource", () => {
  it("replaces only the requested existing variant initializer", () => {
    const updated = updateRegistrySource(
      SOURCE,
      "candy-forest",
      "hub.portal",
      "default",
      { mode: "none" },
    );
    expect(updated).toContain('default: { mode: "none" }');
    expect(updated).toContain('pro: "/art/frame-pro"');
    expect(updated).toContain('usedIn: ["Hub"]');
  });

  it("adds a missing variant without rewriting the entry", () => {
    const updated = updateRegistrySource(
      SOURCE,
      "candy-forest",
      "hub.portal",
      "pro",
      { mode: "asset", path: "/art/theme-builder/candy-forest/hub/portal/pro" },
    );
    expect(updated).toContain(
      'pro: { mode: "asset", path: "/art/theme-builder/candy-forest/hub/portal/pro" }',
    );
    expect(updated).toContain('default: "/art/portal"');
  });

  it("rejects inherit for DEFAULT", () => {
    expect(() =>
      updateRegistrySource(
        SOURCE,
        "candy-forest",
        "hub.portal",
        "default",
        { mode: "inherit" },
      ),
    ).toThrow(/cannot inherit/i);
  });

  it("locates a real slot in the current registry without writing it", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/themes/theme-registry.ts"),
      "utf8",
    );
    const updated = updateRegistrySource(
      source,
      "candy-forest",
      "arena.avatar-frame-you",
      "default",
      { mode: "none" },
    );
    expect(updated).not.toBe(source);
    expect(updated).toContain('"arena.avatar-frame-you": { default: { mode: "none" },');
  });
});
