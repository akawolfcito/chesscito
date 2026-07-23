import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Captured = {
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
  upserts: Array<{
    table: string;
    row: Record<string, unknown>;
    options: unknown;
  }>;
};

const captured: Captured = { inserts: [], upserts: [] };

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from(table: string) {
      return {
        insert: (row: Record<string, unknown>) => {
          captured.inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
        upsert: (row: Record<string, unknown>, options: unknown) => {
          captured.upserts.push({ table, row, options });
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

import { POST } from "../route";

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

beforeEach(() => {
  captured.inserts = [];
  captured.upserts = [];
});

afterEach(() => {
  vi.clearAllMocks();
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
