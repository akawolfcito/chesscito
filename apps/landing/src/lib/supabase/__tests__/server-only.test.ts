/**
 * Behavioural + source guards for the landing's server-only Supabase client.
 *
 * Two kinds of assertion live here on purpose:
 *
 *  - Behaviour (null without envs, a client with them, the three auth flags
 *    off) — mocked `createClient`, so the arguments themselves are asserted
 *    rather than a client object that would hide them.
 *  - Source text of `server.ts` (the `server-only` import, the absence of a
 *    `NEXT_PUBLIC_` prefix, the absence of any logging) — none of these can be
 *    observed by calling the function, and all three are one careless edit
 *    away from leaking a service role key into the browser bundle.
 *
 * `server-only` has no package to install: Next.js resolves the specifier
 * through its own compiled copy at build time. Under vitest there is nothing
 * to resolve, so it is mocked — same pattern as
 * apps/web/src/app/api/dev/theme-asset/__tests__/route.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClientMock = vi.fn((..._args: unknown[]) => ({ __client: true }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { getSupabaseServer } from "../server";

// vitest runs with the package root as cwd (apps/landing).
const MODULE_PATH = join(process.cwd(), "src/lib/supabase/server.ts");
const MODULE_SOURCE = readFileSync(MODULE_PATH, "utf8");

/**
 * The module's prose deliberately NAMES the things the code must not do —
 * `NEXT_PUBLIC_`, throwing, logging — so that a future reader knows why the
 * constraints exist. Asserting those on the raw text would fail on the
 * documentation instead of on the code, so the code assertions run against a
 * comment-stripped copy. The `import "server-only"` check stays on the raw
 * text: it is a statement, not prose.
 */
const MODULE_CODE = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /(^|[^:])\/\/.*$/gm,
  "$1",
);

// Syntactically plausible, functionally worthless. Never a real credential:
// this string is also what the static-bundle guard searches `.next/static`
// for, so it must stay identical in both places.
const SENTINEL_URL = "https://phase-b-sentinel.supabase.co";
const SENTINEL_KEY = "phase-b-sentinel-service-role-key-not-a-real-credential";

describe("getSupabaseServer", () => {
  const saved = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  beforeEach(() => {
    createClientMock.mockClear();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (saved.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });

  it("returns null when both variables are missing, without throwing", () => {
    expect(() => getSupabaseServer()).not.toThrow();
    expect(getSupabaseServer()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns null when only the URL is present", () => {
    process.env.SUPABASE_URL = SENTINEL_URL;
    expect(getSupabaseServer()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns null when only the key is present", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SENTINEL_KEY;
    expect(getSupabaseServer()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns null when a variable is present but empty", () => {
    process.env.SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = SENTINEL_KEY;
    expect(getSupabaseServer()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("creates a client from the two server-only variables", () => {
    process.env.SUPABASE_URL = SENTINEL_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SENTINEL_KEY;

    const client = getSupabaseServer();

    expect(client).not.toBeNull();
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock.mock.calls[0][0]).toBe(SENTINEL_URL);
    expect(createClientMock.mock.calls[0][1]).toBe(SENTINEL_KEY);
  });

  it("is reusable: each call yields an independent client", () => {
    process.env.SUPABASE_URL = SENTINEL_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SENTINEL_KEY;

    getSupabaseServer();
    getSupabaseServer();

    expect(createClientMock).toHaveBeenCalledTimes(2);
  });

  describe("auth options — all three disabled explicitly", () => {
    const authOptions = () => {
      process.env.SUPABASE_URL = SENTINEL_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = SENTINEL_KEY;
      getSupabaseServer();
      const options = createClientMock.mock.calls[0][2] as {
        auth?: Record<string, unknown>;
      };
      return options.auth ?? {};
    };

    it("persistSession is false", () => {
      expect(authOptions().persistSession).toBe(false);
    });

    it("autoRefreshToken is false", () => {
      expect(authOptions().autoRefreshToken).toBe(false);
    });

    it("detectSessionInUrl is false", () => {
      expect(authOptions().detectSessionInUrl).toBe(false);
    });
  });
});

describe("server.ts source contract", () => {
  it("imports server-only", () => {
    expect(MODULE_SOURCE).toMatch(/^import "server-only";/m);
  });

  it("strips comments without eating the code", () => {
    // Guards the guard: if the stripper ever swallowed the body, every
    // assertion below would pass against an empty string.
    expect(MODULE_CODE).toContain("export function getSupabaseServer");
    expect(MODULE_CODE).toContain("createClient(url, key");
    expect(MODULE_CODE).not.toContain("Port of `apps/web");
  });

  it("reads exactly the two documented variables", () => {
    const reads = [...MODULE_CODE.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(
      (match) => match[1],
    );
    expect(new Set(reads)).toEqual(
      new Set(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]),
    );
  });

  it("never uses a NEXT_PUBLIC_ prefix", () => {
    // A prefixed name is inlined into the browser bundle at build time. This
    // is the single edit that would turn the service role key into a public
    // string, so it is asserted on the module text and not only on behaviour.
    expect(MODULE_CODE).not.toContain("NEXT_PUBLIC_");
  });

  it("does not export any env value", () => {
    const exports = [
      ...MODULE_CODE.matchAll(/^export\s+(?:const|let|var|function)\s+(\w+)/gm),
    ].map((match) => match[1]);
    expect(exports).toEqual(["getSupabaseServer"]);
  });

  it("logs nothing", () => {
    // Not "logs no secret" — logs *nothing*. A console call that prints a
    // redacted value today is one edit away from printing the raw one, and
    // Vercel function logs are retained.
    expect(MODULE_CODE).not.toMatch(/\bconsole\s*\./);
    expect(MODULE_CODE).not.toMatch(/\bprocess\.stdout\b/);
    expect(MODULE_CODE).not.toMatch(/\bprocess\.stderr\b/);
  });

  it("never interpolates a credential, and never throws", () => {
    expect(MODULE_CODE).not.toMatch(/\$\{\s*(url|key)\s*\}/);
    expect(MODULE_CODE).not.toMatch(/\bthrow\b/);
  });

  it("carries no hardcoded URL or key fallback", () => {
    expect(MODULE_CODE).not.toMatch(/https:\/\/[\w-]+\.supabase\.co/);
    expect(MODULE_CODE).not.toMatch(/\beyJ[A-Za-z0-9_-]{10,}/);
  });
});
