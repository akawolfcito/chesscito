/**
 * The denominator of the login budget.
 *
 * The property under test throughout: this module answers "how many accounts
 * arrived through the browser" or it answers NOTHING — and `null` is a real
 * answer, not an error to swallow into a zero. A failed count that returned 0
 * would read as "the pool is empty" and open the door at exactly the moment we
 * cannot see how full it is.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseServerMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => getSupabaseServerMock(),
}));

import { countBrowserAccounts } from "@/lib/access/browser-accounts";

/** A Supabase double whose head-count query resolves to `{ count, error }`. */
function supabaseCounting(result: { count: number | null; error?: unknown }) {
  const eq = vi.fn().mockResolvedValue({ count: result.count, error: result.error ?? null });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from }, from, select, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countBrowserAccounts", () => {
  it("returns the exact count of browser-container accounts", async () => {
    getSupabaseServerMock.mockReturnValue(supabaseCounting({ count: 37 }).client);

    await expect(countBrowserAccounts()).resolves.toBe(37);
  });

  it("counts with a HEAD query, so no rows travel", async () => {
    const double = supabaseCounting({ count: 5 });
    getSupabaseServerMock.mockReturnValue(double.client);

    await countBrowserAccounts();

    expect(double.from).toHaveBeenCalledWith("account_first_seen");
    const [, options] = double.select.mock.calls[0];
    expect(options).toEqual({ count: "exact", head: true });
  });

  it("filters to the browser container and nothing else", async () => {
    // ⛔ MiniPay does not pass through Privy and does not spend a MAU. Counting
    // it would put 5,851 accounts against a 460 budget and close a door that
    // nothing was pushing on.
    const double = supabaseCounting({ count: 5 });
    getSupabaseServerMock.mockReturnValue(double.client);

    await countBrowserAccounts();

    expect(double.eq).toHaveBeenCalledWith("first_container", "browser");
  });

  it("returns null when there is no database configured", async () => {
    getSupabaseServerMock.mockReturnValue(null);

    await expect(countBrowserAccounts()).resolves.toBeNull();
  });

  it("returns null when the query errors", async () => {
    getSupabaseServerMock.mockReturnValue(
      supabaseCounting({ count: null, error: { message: "boom" } }).client,
    );

    await expect(countBrowserAccounts()).resolves.toBeNull();
  });

  it("returns null when the query rejects", async () => {
    const eq = vi.fn().mockRejectedValue(new Error("network"));
    getSupabaseServerMock.mockReturnValue({
      from: () => ({ select: () => ({ eq }) }),
    });

    await expect(countBrowserAccounts()).resolves.toBeNull();
  });

  it("returns null when the driver answers without a count", async () => {
    // PostgREST reports the count in a header. A response that arrives without
    // one is not a zero — it is an unanswered question.
    getSupabaseServerMock.mockReturnValue(supabaseCounting({ count: null }).client);

    await expect(countBrowserAccounts()).resolves.toBeNull();
  });
});
