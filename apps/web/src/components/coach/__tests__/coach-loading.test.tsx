import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { CoachLoading } from "../coach-loading";

vi.mock("@/components/ui/lottie-animation", () => ({ LottieAnimation: () => null }));
vi.mock("@/components/ui/candy-modal-frame", () => ({ CandyModalFrame: () => null }));

const response = { kind: "full", summary: "Done", mistakes: [], lessons: [], praise: [] };
const ready = () => ({ ok: true, json: async () => ({ status: "ready", response }) });
const pending = () => ({ ok: true, json: async () => ({ status: "pending" }) });
let fetchMock: ReturnType<typeof vi.fn>;
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const props = () => ({ jobId: "job-1", wallet: "wallet-fixture", onReady: vi.fn(), onFailed: vi.fn() });

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn().mockResolvedValue(pending());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Coach job polling", () => {
  it("keeps one request in flight even when the server is slow", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<CoachLoading {...props()} />);
    await advance(12_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("delivers ready once and cancels the deadline", async () => {
    const p = props();
    fetchMock.mockResolvedValue(ready());
    render(<CoachLoading {...p} />);
    await advance(65_000);
    expect(p.onReady).toHaveBeenCalledExactlyOnceWith(response);
    expect(p.onFailed).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("delivers failed once and cancels the deadline", async () => {
    const p = props();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "failed", reason: "Unavailable" }) });
    render(<CoachLoading {...p} />);
    await advance(65_000);
    expect(p.onFailed).toHaveBeenCalledExactlyOnceWith("Unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts on timeout and ignores a late result", async () => {
    const p = props();
    let resolve!: (value: ReturnType<typeof ready>) => void;
    fetchMock.mockImplementation(() => new Promise((r) => { resolve = r; }));
    render(<CoachLoading {...p} />);
    await advance(60_000);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { resolve(ready()); });
    expect(p.onReady).not.toHaveBeenCalled();
    expect(p.onFailed).toHaveBeenCalledExactlyOnceWith("Timed out waiting for coach response");
  });

  it("aborts on unmount and ignores a late result", async () => {
    const p = props();
    let resolve!: (value: ReturnType<typeof ready>) => void;
    fetchMock.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const view = render(<CoachLoading {...p} />);
    await advance(3_000);
    view.unmount();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { resolve(ready()); });
    expect(p.onReady).not.toHaveBeenCalled();
    expect(p.onFailed).not.toHaveBeenCalled();
  });

  it("skips hidden tabs and resumes polling when visible", async () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    render(<CoachLoading {...props()} />);
    await advance(12_000);
    expect(fetchMock).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    await advance(3_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transport and HTTP errors within the existing deadline", async () => {
    const p = props();
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(ready());
    render(<CoachLoading {...p} />);
    await advance(9_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(p.onReady).toHaveBeenCalledExactlyOnceWith(response);
  });
  it("ignores the old job after switching to another job", async () => {
    const p = props();
    let resolveOld!: (value: ReturnType<typeof ready>) => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => { resolveOld = r; })).mockResolvedValue(ready());
    const view = render(<CoachLoading {...p} />);
    await advance(3_000);
    const oldSignal = fetchMock.mock.calls[0][1].signal;
    view.rerender(<CoachLoading {...p} jobId="job-2" />);
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { resolveOld(ready()); });
    expect(p.onReady).not.toHaveBeenCalled();
    await advance(3_000);
    expect(p.onReady).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][0]).toContain("job-2");
  });

  it("does not poll or fail when no asynchronous job was supplied", async () => {
    const p = props();
    render(<CoachLoading {...p} jobId={undefined} />);
    await advance(65_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(p.onFailed).not.toHaveBeenCalled();
  });

});
