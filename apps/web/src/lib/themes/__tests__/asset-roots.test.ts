import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  APP_ROOT_IDS,
  isAppRoot,
  resolveAppRoot,
} from "../asset-roots";

describe("theme asset app roots", () => {
  it("defaults an undeclared root to the web app", () => {
    expect(resolveAppRoot(undefined)).toBe(process.cwd());
    expect(resolveAppRoot("web")).toBe(process.cwd());
  });

  it("resolves the landing app as a sibling of the web app", () => {
    expect(resolveAppRoot("landing")).toBe(
      path.resolve(process.cwd(), "..", "landing"),
    );
  });

  it("refuses any root that is not on the closed whitelist", () => {
    // A registry typo must never widen the write surface to an arbitrary dir.
    expect(() => resolveAppRoot("../../etc" as never)).toThrow(
      /unknown theme asset root/i,
    );
  });

  it("exposes the whitelist as the single source of valid roots", () => {
    expect([...APP_ROOT_IDS]).toEqual(["web", "landing"]);
    expect(isAppRoot("landing")).toBe(true);
    expect(isAppRoot("desktop")).toBe(false);
  });
});
