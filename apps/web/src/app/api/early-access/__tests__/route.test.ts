/**
 * POST /api/early-access/request — the intake queue for Chesscito Web keys.
 *
 * The property under test throughout: this route RECORDS, it does not GRANT.
 * Privy's allowlist is what grants, so the worst a successful call achieves is
 * a `waiting` row in a list the founder reads by hand.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enforceRateLimitMock = vi.fn();
const getSupabaseServerMock = vi.fn();
const upsertMock = vi.fn();
const selectMock = vi.fn();

vi.mock("@/lib/server/demo-signing", () => ({
  enforceEarlyAccessRateLimit: (...args: unknown[]) =>
    enforceRateLimitMock(...args),
  getRequestIp: () => "203.0.113.7",
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => getSupabaseServerMock(),
}));

vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { POST } from "@/app/api/early-access/request/route";

const ORIGIN = "https://learn.chesscito.com";

/** A Supabase double whose `upsert().select()` resolves to `rows`. */
function supabaseReturning(rows: Array<{ email: string }> | null, error: unknown = null) {
  selectMock.mockResolvedValue({ data: rows, error });
  upsertMock.mockReturnValue({ select: selectMock });
  return { from: () => ({ upsert: upsertMock }) };
}

function post(body: unknown, headers: Record<string, string> = { origin: ORIGIN }) {
  return POST(
    new Request("https://learn.chesscito.com/api/early-access/request", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  vi.stubEnv("NEXT_PUBLIC_CHESSCITO_MODE", "learn");
  enforceRateLimitMock.mockResolvedValue(undefined);
  getSupabaseServerMock.mockReturnValue(supabaseReturning([{ email: "ana@example.com" }]));
});

describe("happy path", () => {
  it("records a first request as `created`", async () => {
    const res = await post({ email: "ana@example.com" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, outcome: "created" });
  });

  it("writes exactly one row, with status left to the column default", async () => {
    await post({ email: "ana@example.com" });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [row, options] = upsertMock.mock.calls[0];
    expect(row).toEqual({
      email: "ana@example.com",
      surface: "learn",
      source: null,
    });
    // The route must never name a status. `allowlisted` records an action taken
    // in Privy; a request handler has no business asserting it happened.
    expect(row).not.toHaveProperty("status");
    expect(options).toEqual({ onConflict: "email", ignoreDuplicates: true });
  });

  it("normalizes the email server-side before it becomes the key", async () => {
    await post({ email: "  Ana@Example.COM  " });

    expect(upsertMock.mock.calls[0][0].email).toBe("ana@example.com");
  });

  it("is idempotent: a duplicate reports `already-requested` and adds no row", async () => {
    getSupabaseServerMock.mockReturnValue(supabaseReturning([]));

    const res = await post({ email: "ana@example.com" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      outcome: "already-requested",
    });
    // `ignoreDuplicates` is what makes this true at the database, so
    // `requested_at` keeps naming when they FIRST asked — the queue order.
    expect(upsertMock.mock.calls[0][1].ignoreDuplicates).toBe(true);
  });
});

describe("the client cannot choose what gets written", () => {
  it("ignores a status supplied in the body", async () => {
    await post({ email: "ana@example.com", status: "allowlisted" });

    expect(upsertMock.mock.calls[0][0]).not.toHaveProperty("status");
  });

  it("ignores a surface supplied in the body and uses the deployment's", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_MODE", "learn");

    await post({ email: "ana@example.com", surface: "play" });

    expect(upsertMock.mock.calls[0][0].surface).toBe("learn");
  });

  it("re-sanitizes source through the existing allow-list", async () => {
    await post({ email: "ana@example.com", source: "'; drop table --" });

    // Present but unrecognized collapses to the bounded `unknown`, never the
    // raw string: one free-form value must not become a new dimension.
    expect(upsertMock.mock.calls[0][0].source).toBe("unknown");
  });

  it("keeps a canonical source", async () => {
    await post({ email: "ana@example.com", source: "web_early_access" });

    expect(upsertMock.mock.calls[0][0].source).toBe("web_early_access");
  });

  it("records an unattributable request as null rather than a default", async () => {
    await post({ email: "ana@example.com", source: "" });

    expect(upsertMock.mock.calls[0][0].source).toBeNull();
  });
});

describe("malformed input fails safely", () => {
  it.each([
    ["a missing email", {}],
    ["a non-string email", { email: 42 }],
    ["a malformed email", { email: "anaexample.com" }],
    ["an array body", []],
    ["a null body", null],
  ])("rejects %s with 400 and writes nothing", async (_label, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_email" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON at all", async () => {
    const res = await post("not json{{");

    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("perimeter", () => {
  it("rejects a mismatched origin", async () => {
    const res = await post({ email: "ana@example.com" }, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "forbidden" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects a header-less caller — stricter than the score route, by design", async () => {
    // No MiniPay WebView reaches this route (the Early Access screen only
    // exists in the Privy branch), and there is no signature to fall back on,
    // so a curl with no Origin has nothing legitimate to be.
    const res = await post({ email: "ana@example.com" }, {});

    expect(res.status).toBe(403);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("allows an unconfigured allow-list (local dev)", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    const res = await post({ email: "ana@example.com" });

    expect(res.status).toBe(200);
  });

  it("maps a rate-limit overflow to 429 and writes nothing", async () => {
    enforceRateLimitMock.mockRejectedValue(new Error("Rate limit exceeded"));

    const res = await post({ email: "ana@example.com" });

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: "rate_limited" });
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("degradation", () => {
  it("503s when no database is configured", async () => {
    getSupabaseServerMock.mockReturnValue(null);

    const res = await post({ email: "ana@example.com" });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "unavailable" });
  });

  it("503s when the write fails — never reports a lost request as saved", async () => {
    getSupabaseServerMock.mockReturnValue(
      supabaseReturning(null, { message: "boom" }),
    );

    const res = await post({ email: "ana@example.com" });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "unavailable" });
  });
});
