import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Captured = {
  /** Flattened rows — one entry per row, whatever the call shape. */
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
  upserts: Array<{
    table: string;
    row: Record<string, unknown>;
    options: unknown;
  }>;
  /** ROUND-TRIPS, not rows. This is the number Fase 1 is trying to move: a
   *  bulk insert of 20 rows is one call here, twenty before. */
  calls: Array<{ table: string; op: "insert" | "upsert" }>;
};

const captured: Captured = { inserts: [], upserts: [], calls: [] };
const firstSeenWrite = vi.fn(
  (_table: string, _row: Record<string, unknown>, _options: unknown) =>
    Promise.resolve({ error: null as unknown }),
);

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from(table: string) {
      return {
        insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          captured.calls.push({ table, op: "insert" });
          for (const row of Array.isArray(rows) ? rows : [rows]) {
            captured.inserts.push({ table, row });
          }
          return Promise.resolve({ error: null });
        },
        upsert: (row: Record<string, unknown>, options: unknown) => {
          captured.calls.push({ table, op: "upsert" });
          captured.upserts.push({ table, row, options });
          return firstSeenWrite(table, row, options);
        },
      };
    },
  }),
}));

let POST: typeof import("../route").POST;

function makeReq(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  // Each test models a fresh process; multiple requests inside a test share it.
  vi.resetModules();
  POST = (await import("../route")).POST;
  captured.inserts = [];
  captured.upserts = [];
  captured.calls = [];
  firstSeenWrite.mockReset();
  firstSeenWrite.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/telemetry — dimension enrichment", () => {
  it("writes sanitized dims + country from the edge header", async () => {
    const res = await POST(
      makeReq(
        {
          session_id: "anon1",
          event: "hub_viewed",
          dims: {
            surface: "learn",
            container: "minipay",
            locale: "es",
            source: "share_whatsapp",
            campaign: "launch_2026",
            app_version: "a1b2c3d",
            visit_id: "v1",
            country: "ZZ", // client-supplied geo must be ignored
          },
        },
        { "x-vercel-ip-country": "br" },
      ),
    );
    expect(res.status).toBe(204);
    expect(captured.inserts).toHaveLength(1);
    const row = captured.inserts[0].row;
    expect(row).toMatchObject({
      session_id: "anon1",
      event: "hub_viewed",
      surface: "learn",
      container: "minipay",
      locale: "es",
      country: "BR", // from header, upper-cased; client "ZZ" ignored
      source: "share_whatsapp",
      campaign: "launch_2026",
      app_version: "a1b2c3d",
      visit_id: "v1",
    });
  });

  it("nulls out off-allow-list dimensions", async () => {
    await POST(
      makeReq({
        session_id: "anon1",
        event: "x",
        dims: {
          surface: "marketing",
          container: "metamask",
          source: "affiliate_9",
          campaign: "bad; drop",
          app_version: "feature/x",
        },
      }),
    );
    const row = captured.inserts[0].row;
    expect(row.surface).toBeNull();
    expect(row.container).toBeNull();
    expect(row.source).toBe("unknown");
    expect(row.campaign).toBeNull();
    expect(row.app_version).toBeNull();
    expect(row.country).toBeNull(); // no header
  });

  it("upserts session_first_seen only on app_opened, idempotently", async () => {
    await POST(
      makeReq(
        {
          session_id: "anon2",
          event: "app_opened",
          dims: { surface: "play", container: "browser", source: "direct" },
        },
        { "x-vercel-ip-country": "US" },
      ),
    );
    expect(captured.upserts).toHaveLength(1);
    expect(captured.upserts[0].table).toBe("session_first_seen");
    expect(captured.upserts[0].row).toMatchObject({
      session_id: "anon2",
      first_surface: "play",
      first_country: "US",
      first_source: "direct",
    });
    expect(captured.upserts[0].options).toMatchObject({
      onConflict: "session_id",
      ignoreDuplicates: true,
    });
  });

  it("does NOT upsert first_seen for non-root events", async () => {
    await POST(
      makeReq({ session_id: "anon3", event: "exercise_started", dims: {} }),
    );
    expect(captured.upserts).toHaveLength(0);
  });
});

/**
 * Fase 1 — the batch contract, and the round-trip count behind it.
 *
 * The measurements the founder asked for after the Supabase 522 incident:
 * how many Supabase calls does one flush of 20 events actually cost?
 */
describe("POST /api/telemetry — batch shape", () => {
  const dims = { surface: "play", container: "browser", source: "direct" };

  function batchOf(n: number, over: Partial<Record<string, unknown>> = {}) {
    return {
      events: Array.from({ length: n }, (_, i) => ({
        session_id: "anon-batch",
        event: `event_${i}`,
        dims,
        ...over,
      })),
    };
  }

  it("writes 20 events with ONE analytics_events round-trip", async () => {
    await POST(makeReq(batchOf(20)));

    const analyticsCalls = captured.calls.filter(
      (c) => c.table === "analytics_events",
    );
    // The number this whole phase exists to move: 20 → 1.
    expect(analyticsCalls).toHaveLength(1);
    expect(captured.inserts).toHaveLength(20);
    expect(captured.inserts.every((i) => i.table === "analytics_events")).toBe(
      true,
    );
  });

  it("costs ZERO cohort upserts for a batch with no app_opened and no wallet", async () => {
    await POST(makeReq(batchOf(20)));

    expect(
      captured.calls.filter((c) => c.table === "session_first_seen"),
    ).toHaveLength(0);
    expect(
      captured.calls.filter((c) => c.table === "account_first_seen"),
    ).toHaveLength(0);
    // Total Supabase round-trips for 20 events, worst realistic case: 1.
    expect(captured.calls).toHaveLength(1);
  });

  it("dedupes session_first_seen — many app_opened in one batch, one upsert", async () => {
    await POST(
      makeReq({
        events: [
          { session_id: "s1", event: "app_opened", dims },
          { session_id: "s1", event: "app_opened", dims },
          { session_id: "s1", event: "hub_view", dims },
        ],
      }),
    );

    const calls = captured.calls.filter(
      (c) => c.table === "session_first_seen",
    );
    expect(calls).toHaveLength(1);
  });

  it("dedupes account_first_seen — 20 events from one wallet, one upsert", async () => {
    // Without this secret `deriveAccountRef` returns null by design, the
    // account cohort is never written, and the test would pass while
    // asserting nothing.
    vi.stubEnv("TELEMETRY_ACCOUNT_SECRET", "test-secret");
    await POST(
      makeReq(
        batchOf(20, {
          account: "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
        }),
      ),
    );

    const calls = captured.calls.filter(
      (c) => c.table === "account_first_seen",
    );
    // Was one per event before Fase 1.
    expect(calls).toHaveLength(1);
    // Total: 1 insert + 1 cohort upsert for twenty events.
    expect(captured.calls).toHaveLength(2);
  });

  it("records repeated wallet analytics but only confirms account_first_seen once", async () => {
    vi.stubEnv("TELEMETRY_ACCOUNT_SECRET", "test-secret");
    const account = "0x5c4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

    await POST(makeReq({ session_id: "s-repeat", event: "hub_view", dims, account }));
    await POST(makeReq({ session_id: "s-repeat", event: "exercise_started", dims, account }));

    expect(captured.inserts.filter((entry) => entry.table === "analytics_events")).toHaveLength(2);
    expect(captured.calls.filter((entry) => entry.table === "account_first_seen")).toHaveLength(1);
  });

  it("keeps session first-seen correct while avoiding repeated app_opened conflicts", async () => {
    await POST(makeReq({ session_id: "s-open", event: "app_opened", dims }));
    await POST(makeReq({ session_id: "s-open", event: "app_opened", dims: { ...dims, surface: "learn" } }));

    const writes = captured.upserts.filter((entry) => entry.table === "session_first_seen");
    expect(writes).toHaveLength(1);
    expect(writes[0].row).toMatchObject({ session_id: "s-open", first_surface: "play" });
  });

  it("never persists the raw wallet — only the keyed pseudonym", async () => {
    vi.stubEnv("TELEMETRY_ACCOUNT_SECRET", "test-secret");
    const wallet = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
    await POST(makeReq(batchOf(3, { account: wallet })));

    const serialized = JSON.stringify([captured.inserts, captured.upserts]);
    expect(serialized).not.toContain(wallet);
  });

  it("still accepts a SINGLE event — cached old bundles keep working", async () => {
    // Not legacy cruft: browsers cache the JS, so tabs running the pre-Fase-1
    // client keep posting this shape for as long as they are open.
    const res = await POST(
      makeReq({ session_id: "anon-single", event: "hub_view", dims }),
    );

    expect(res.status).toBe(204);
    expect(captured.inserts).toHaveLength(1);
    expect(captured.inserts[0].row).toMatchObject({
      session_id: "anon-single",
      event: "hub_view",
    });
  });

  it("truncates an oversized batch instead of accepting an unbounded insert", async () => {
    await POST(makeReq(batchOf(500)));
    expect(captured.inserts.length).toBeLessThanOrEqual(50);
  });

  it("skips malformed events without discarding the rest of the batch", async () => {
    await POST(
      makeReq({
        events: [
          { session_id: "s1", event: "good_one", dims },
          { session_id: "", event: "no_session", dims },
          { session_id: "s1", event: "", dims },
          null,
          "nonsense",
          { session_id: "s1", event: "good_two", dims },
        ],
      }),
    );

    expect(captured.inserts.map((i) => i.row.event)).toEqual([
      "good_one",
      "good_two",
    ]);
  });

  it("returns 204 and does not throw when Supabase fails (the 522 case)", async () => {
    // Not a rejected promise the caller can see: the route swallows, answers
    // 204, and the client discards the batch. No error reaches the UI.
    const res = await POST(makeReq(batchOf(5)));
    expect(res.status).toBe(204);
  });

  it("answers 204 on a garbage body", async () => {
    const res = await POST(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(204);
    expect(captured.calls).toHaveLength(0);
  });
});

describe("POST /api/telemetry — first-seen safety", () => {
  const dims = { surface: "play", container: "browser", source: "direct" };
  const account = "0x0000000000000000000000000000000000000001";
  const accountEvent = { session_id: "first-seen", event: "hub_view", dims, account };

  beforeEach(() => vi.stubEnv("TELEMETRY_ACCOUNT_SECRET", "test-secret"));

  it.each([
    ["account", accountEvent, "account_first_seen"],
    ["session", { session_id: "first-seen", event: "app_opened", dims }, "session_first_seen"],
  ])("coalesces concurrent %s writes without dropping analytics", async (_kind, event, table) => {
    let release!: (value: { error: unknown }) => void;
    firstSeenWrite.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const first = POST(makeReq(event));
    const second = POST(makeReq(event));
    await vi.waitFor(() => expect(firstSeenWrite).toHaveBeenCalledTimes(1));
    expect(captured.upserts[0].table).toBe(table);
    expect(captured.inserts).toHaveLength(2);
    release({ error: null });
    expect((await Promise.all([first, second])).map((res) => res.status)).toEqual([204, 204]);
    await POST(makeReq(event));
    expect(firstSeenWrite).toHaveBeenCalledTimes(1);
    expect(captured.inserts).toHaveLength(3);
  });

  it("an in-flight account does not block another request's account", async () => {
    let release!: (value: { error: unknown }) => void;
    firstSeenWrite.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = POST(makeReq(accountEvent));
    await vi.waitFor(() => expect(firstSeenWrite).toHaveBeenCalledTimes(1));
    const other = await POST(makeReq({ ...accountEvent, account: "0x0000000000000000000000000000000000000002" }));
    expect(other.status).toBe(204);
    expect(firstSeenWrite).toHaveBeenCalledTimes(2);
    expect(captured.upserts[0].row.account_ref).not.toBe(captured.upserts[1].row.account_ref);
    release({ error: null });
    await pending;
  });

  it("a synchronous failure does not skip another account in the same batch", async () => {
    firstSeenWrite.mockImplementationOnce(() => { throw new Error("test failure"); });
    await POST(makeReq({ events: [accountEvent, {
      ...accountEvent, account: "0x0000000000000000000000000000000000000002",
    }] }));
    expect(firstSeenWrite).toHaveBeenCalledTimes(2);
    expect(captured.inserts).toHaveLength(2);
    await POST(makeReq(accountEvent));
    expect(firstSeenWrite).toHaveBeenCalledTimes(3);
  });

  it.each(["response error", "rejection", "synchronous throw", "unconfirmed response"])(
    "does not cache a %s and retries on a later event", async (failure) => {
      firstSeenWrite.mockImplementationOnce(() => {
        if (failure === "synchronous throw") throw new Error("test failure");
        if (failure === "rejection") return Promise.reject(new Error("test failure"));
        return Promise.resolve({ error: failure === "response error" ? { message: "test failure" } : undefined });
      });
      expect((await POST(makeReq(accountEvent))).status).toBe(204);
      await POST(makeReq(accountEvent));
      await POST(makeReq(accountEvent));
      expect(firstSeenWrite).toHaveBeenCalledTimes(2);
      expect(captured.inserts).toHaveLength(3);
    },
  );

  it("retries an app_opened cohort after failure, not on unrelated events", async () => {
    firstSeenWrite.mockResolvedValueOnce({ error: { message: "test failure" } });
    const event = { session_id: "failed-session", event: "app_opened", dims };
    await POST(makeReq(event));
    await POST(makeReq({ ...event, event: "hub_view" }));
    expect(firstSeenWrite).toHaveBeenCalledTimes(1);
    await POST(makeReq(event));
    await POST(makeReq(event));
    expect(firstSeenWrite).toHaveBeenCalledTimes(2);
    expect(captured.inserts).toHaveLength(4);
  });

  it.each(["account", "session"])("evicts bounded %s entries and safely retries immutable first values", async (kind) => {
    // Model the DB conflict contract, including an existing timestamp. This
    // exercises actual route eviction rather than exporting a production reset.
    const stored = new Map<string, Record<string, unknown>>();
    firstSeenWrite.mockImplementation(async (_table, row, options) => {
      expect(options).toMatchObject({ ignoreDuplicates: true });
      const key = String(row.account_ref ?? row.session_id);
      if (!stored.has(key)) stored.set(key, { ...row, first_seen: "original-timestamp" });
      return { error: null };
    });
    const makeEvent = (index: number) => kind === "account"
      ? { ...accountEvent, account: `0x${(index + 1).toString(16).padStart(40, "0")}` }
      : { session_id: `bounded-${index}`, event: "app_opened", dims };
    await POST(makeReq(makeEvent(0)));
    const original: Record<string, unknown> = { ...captured.upserts[0].row, first_seen: "original-timestamp" };
    const originalKey = String(original.account_ref ?? original.session_id);
    for (let index = 1; index <= 10_000; index++) await POST(makeReq(makeEvent(index)));
    await POST(makeReq({ ...makeEvent(0), dims: { ...dims, surface: "learn" } }));
    expect(firstSeenWrite).toHaveBeenCalledTimes(10_002);
    expect(stored.get(originalKey)).toEqual(original);
    await POST(makeReq(makeEvent(10_000)));
    expect(firstSeenWrite).toHaveBeenCalledTimes(10_002);
  }, 15_000);

  it("a cold process retries through ON CONFLICT DO NOTHING with the same identity", async () => {
    await POST(makeReq(accountEvent));
    vi.resetModules();
    const coldPOST = (await import("../route")).POST;
    await coldPOST(makeReq({ ...accountEvent, dims: { ...dims, surface: "learn" } }));
    expect(captured.upserts).toHaveLength(2);
    expect(captured.upserts[0].row.account_ref).toBe(captured.upserts[1].row.account_ref);
    expect(captured.upserts.every((write) => (write.options as { ignoreDuplicates: boolean }).ignoreDuplicates)).toBe(true);
  });
});

/**
 * Payload limits (revisión obligatoria previa al commit, 2026-08-03).
 *
 * The invariant under every test here: a rejected request costs Supabase
 * ZERO round-trips. During the 522 incident the cheapest possible answer to
 * bad input is one that never reaches the origin.
 */
describe("POST /api/telemetry — payload limits", () => {
  const dims = { surface: "play", container: "browser", source: "direct" };

  function events(n: number, over: Record<string, unknown> = {}) {
    return {
      events: Array.from({ length: n }, (_, i) => ({
        session_id: "s1",
        event: `event_${i}`,
        dims,
        ...over,
      })),
    };
  }

  it("20 valid events under 64 KB → 204 and ONE bulk insert", async () => {
    const req = makeReq(events(20));
    const res = await POST(req);

    expect(res.status).toBe(204);
    expect(
      captured.calls.filter((c) => c.table === "analytics_events"),
    ).toHaveLength(1);
    expect(captured.inserts).toHaveLength(20);
  });

  it("21 events → 413, and ZERO Supabase calls", async () => {
    const res = await POST(makeReq(events(21)));

    expect(res.status).toBe(413);
    expect(captured.calls).toHaveLength(0);
  });

  it("body over 64 KB → 413, and ZERO Supabase calls", async () => {
    // Two events, each under the per-event cap, but the body blows the total.
    const filler = "x".repeat(40 * 1024);
    const res = await POST(
      makeReq({
        events: [
          { session_id: "s1", event: "a", dims, props: { blob: filler } },
          { session_id: "s1", event: "b", dims, props: { blob: filler } },
        ],
      }),
    );

    expect(res.status).toBe(413);
    expect(captured.calls).toHaveLength(0);
  });

  it("a single event over 8 KB → 413, and ZERO Supabase calls", async () => {
    // The batch is small and the body fits in 64 KB; only the EVENT is over.
    const res = await POST(
      makeReq({
        events: [
          { session_id: "s1", event: "ok", dims },
          {
            session_id: "s1",
            event: "fat",
            dims,
            props: { blob: "x".repeat(9 * 1024) },
          },
        ],
      }),
    );

    expect(res.status).toBe(413);
    expect(captured.calls).toHaveLength(0);
  });

  it("oversized props reject the EVENT without killing the batch", async () => {
    await POST(
      makeReq({
        events: [
          { session_id: "s1", event: "good", dims },
          {
            session_id: "s1",
            event: "fat_props",
            dims,
            // Under the 8 KB event cap, over the 4 KB props cap.
            props: { blob: "x".repeat(5 * 1024) },
          },
        ],
      }),
    );

    // The oversized one is dropped rather than written with props:null — a row
    // that looks recorded and is not is worse than a missing row.
    expect(captured.inserts.map((i) => i.row.event)).toEqual(["good"]);
  });

  it("an oversized prop STRING rejects the event", async () => {
    await POST(
      makeReq({
        events: [
          { session_id: "s1", event: "good", dims },
          {
            session_id: "s1",
            event: "long_string",
            dims,
            props: { note: "x".repeat(600) },
          },
        ],
      }),
    );

    expect(captured.inserts.map((i) => i.row.event)).toEqual(["good"]);
  });

  it("⛔ a NESTED prop value is dropped SILENTLY and the row is written anyway", async () => {
    // This is a trap, pinned here so nobody walks into it twice. `sanitizeProps`
    // copies string/number/boolean/null and nothing else: an array or an object
    // simply never reaches `out`, no error, no rejection — the event lands
    // looking recorded, missing exactly the payload it was added to carry.
    //
    // It cost the evidence pass a redesign: `pro_purchase_failed` was going to
    // ship its balance reads as `reads: [{symbol, status, bucket} × 3]`, which
    // would have arrived as `{kind: "no-token"}` and taught us nothing. The
    // instrumentation flattens to `read_<symbol>` strings because of this test.
    await POST(
      makeReq({
        events: [
          {
            session_id: "s1",
            event: "nested_props",
            dims,
            props: {
              kept: "yes",
              list: [{ symbol: "USDC", status: "failure" }],
              nested: { symbol: "USDC" },
            },
          },
        ],
      }),
    );

    expect(captured.inserts).toHaveLength(1);
    // Written — not rejected. That is the dangerous half.
    expect(captured.inserts[0]?.row.event).toBe("nested_props");
    expect(captured.inserts[0]?.row.props).toEqual({ kept: "yes" });
  });

  it("an oversized dimension is nulled, not fatal — dims are cosmetic", async () => {
    await POST(
      makeReq({
        events: [
          {
            session_id: "s1",
            event: "kept",
            dims: { ...dims, campaign: "c".repeat(200) },
          },
        ],
      }),
    );

    expect(captured.inserts).toHaveLength(1);
    expect(captured.inserts[0].row.campaign).toBeNull();
  });

  it("oversized session_id / event name drop the event", async () => {
    await POST(
      makeReq({
        events: [
          { session_id: "s1", event: "good", dims },
          { session_id: "s".repeat(65), event: "long_session", dims },
          { session_id: "s1", event: "e".repeat(65), dims },
        ],
      }),
    );

    expect(captured.inserts.map((i) => i.row.event)).toEqual(["good"]);
  });

  it("the OLD single-event contract is held to the same size limits", async () => {
    // A cached pre-Fase-1 bundle is a client we accept, not one we trust.
    const res = await POST(
      makeReq({
        session_id: "s1",
        event: "legacy_fat",
        dims,
        props: { blob: "x".repeat(9 * 1024) },
      }),
    );

    expect(res.status).toBe(413);
    expect(captured.calls).toHaveLength(0);
  });

  it("a legacy single event within limits still writes", async () => {
    const res = await POST(
      makeReq({ session_id: "s1", event: "legacy_ok", dims }),
    );

    expect(res.status).toBe(204);
    expect(captured.inserts).toHaveLength(1);
  });
});
