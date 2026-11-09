import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

vi.mock("@/lib/scores/session-client", () => ({
  ensureScoreSession: async ({ signMessage }: { signMessage: (args: { message: string }) => Promise<unknown> }) => {
    try { await signMessage({ message: "Test game session" }); return { ok: true, session: { token: "a".repeat(64) } }; }
    catch { return { ok: false }; }
  },
}));
const wallet = vi.hoisted(() => ({ address: undefined as `0x${string}` | undefined, chainId: 42220 }));
const sign = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: () => ({ ...wallet }), useSignMessage: () => ({ signMessageAsync: sign }),
}));
import { useCoachJobAccess, useCoachRequestAccess } from "../use-coach-request-access";
import { clearCoachJobAccess } from "../coach-request-access";

const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const gameId = crypto.randomUUID();
const jobId = crypto.randomUUID();
const init = () => ({ method: "POST", body: JSON.stringify({ walletAddress: account.address, gameId }) });
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  clearCoachJobAccess(); sign.mockReset();
  wallet.address = account.address; wallet.chainId = 42220;
  sign.mockImplementation(async ({ message }: { message: string }) => account.signMessage({ message }));
  fetchMock = vi.fn<typeof fetch>(async () => Response.json({ jobId }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { clearCoachJobAccess(); vi.unstubAllGlobals(); });

describe("Coach wallet identity lifecycle", () => {
  it("never signs on mount; explicit analysis permits polling without another signature", async () => {
    const { result } = renderHook(() => ({ request: useCoachRequestAccess(), headers: useCoachJobAccess(account.address) }));
    expect(sign).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await result.current.request("/api/coach/analyze", init()); });
    expect(result.current.headers(jobId)).not.toBeNull();
    expect(sign).toHaveBeenCalledTimes(1);
  });
  it.each(["wallet", "chain", "round_trip", "unmount"])("does not send a delayed proof after %s changes", async (scenario) => {
    let finish!: () => void;
    sign.mockImplementation(() => new Promise<`0x${string}`>((resolve) => { finish = () => resolve(`0x${"1".repeat(130)}`); }));
    const { result, rerender, unmount } = renderHook(() => useCoachRequestAccess());
    let pending!: Promise<Response>;
    act(() => { pending = result.current("/api/coach/analyze", init()); });
    // Attach rejection handling before resolving the delayed signer.
    const rejected = expect(pending).rejects.toThrow("coach_request_cancelled");
    if (scenario === "unmount") unmount();
    else {
      if (scenario === "chain") wallet.chainId = 1;
      else wallet.address = other.address;
      rerender();
      if (scenario === "round_trip") { wallet.address = account.address; rerender(); }
    }
    await act(async () => { finish(); await rejected; });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reads public polling status without a signature", () => {
    const { result } = renderHook(() => useCoachJobAccess(account.address));
    expect(result.current(jobId)).toEqual({});
    expect(sign).not.toHaveBeenCalled();
  });
});
