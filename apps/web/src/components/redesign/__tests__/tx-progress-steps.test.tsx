import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithIntl as render, screen, act } from "@/test-utils/render-with-intl";

// B2 telemetry mock — hoisted so the primitive's track() calls land here
// instead of the real /api/telemetry fetch. Per established codebase
// pattern (see pro-sheet.test.tsx, hub-scaffold-client.test.tsx, etc).
const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));

import { TxProgressSteps } from "../tx-progress-steps";
import type {
  TxStepDescriptor,
  TxProgressStepsProps,
} from "../tx-progress-steps";

const SAVE_STEPS: TxStepDescriptor[] = [
  { code: "sign" },
  { code: "send" },
  { code: "wait" },
];

const SHOP_STEPS: TxStepDescriptor[] = [
  { code: "sign" },
  { code: "send" },
  { code: "wait" },
  { code: "sign" },
  { code: "send" },
  { code: "wait" },
];

function defaults(
  overrides: Partial<TxProgressStepsProps> = {},
): TxProgressStepsProps {
  return {
    variant: "pills",
    steps: SAVE_STEPS,
    current: "send",
    flow: "save-score",
    ...overrides,
  };
}

describe("TxProgressSteps — pills variant (AC-2.3.1, AC-2.3.3, AC-2.3.7)", () => {
  it("AC-2.3.1: active node has aria-current='step' and the previous node is rendered as complete", () => {
    const { container } = render(<TxProgressSteps {...defaults()} />);
    const root = container.querySelector('[data-variant="pills"]');
    expect(root).not.toBeNull();

    // Active = "send" (index 1)
    const active = container.querySelector('[aria-current="step"]');
    expect(active).not.toBeNull();
    expect(active?.getAttribute("aria-label")).toBe("SEND");

    // Previous step = "sign" should be aria-labeled "SIGN, complete"
    const completeNodes = container.querySelectorAll(
      'span[aria-label$=", complete"]',
    );
    expect(completeNodes.length).toBe(1);
    expect(completeNodes[0]?.getAttribute("aria-label")).toBe(
      "SIGN, complete",
    );
  });

  it("AC-2.3.3: primitive renders steps[] exactly as passed (surface-owned trim) — 6-step Shop sequence stays 6 nodes", () => {
    const { container } = render(
      <TxProgressSteps
        {...defaults({ steps: SHOP_STEPS, current: "sign" })}
      />,
    );
    const listitems = container.querySelectorAll('[role="listitem"]');
    expect(listitems.length).toBe(6);
  });

  it("AC-2.3.7: prepare step is rendered iff included in steps[]", () => {
    // Without prepare — 3 nodes only
    const withoutPrepare = render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "sign" })}
      />,
    );
    expect(
      withoutPrepare.container.querySelectorAll('[role="listitem"]').length,
    ).toBe(3);
    withoutPrepare.unmount();

    // With prepare — 4 nodes
    const withPrepare = render(
      <TxProgressSteps
        {...defaults({
          steps: [{ code: "prepare" }, ...SAVE_STEPS],
          current: "prepare",
        })}
      />,
    );
    const items = withPrepare.container.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(4);
    // Prepare is the active one
    const active = withPrepare.container.querySelector(
      '[aria-current="step"]',
    );
    expect(active?.getAttribute("aria-label")).toBe("PREPARE");
  });
});

describe("TxProgressSteps — toast variant (AC-2.3.2)", () => {
  it("AC-2.3.2: toast renders single-line with counter + sentence-case sub-copy", () => {
    const { container } = render(
      <TxProgressSteps {...defaults({ variant: "toast" })} />,
    );
    const root = container.querySelector('[data-variant="toast"]');
    expect(root).not.toBeNull();

    // Active step = "send" → counter "Step 2 of 3" + sub-copy "Sending transaction…"
    expect(root?.textContent).toContain("Step 2 of 3");
    expect(root?.textContent).toContain("Sending transaction…");
    // aria-label has both
    expect(root?.getAttribute("aria-label")).toContain(
      "Sending transaction…",
    );
    expect(root?.getAttribute("aria-label")).toContain("step 2 of 3");
  });

  it("toast variant uses role='status' with aria-live='polite' on the non-failed path", () => {
    const { container } = render(
      <TxProgressSteps {...defaults({ variant: "toast" })} />,
    );
    const root = container.querySelector('[data-variant="toast"]');
    expect(root?.getAttribute("role")).toBe("status");
    expect(root?.getAttribute("aria-live")).toBe("polite");
  });

  it("toast variant ships a sibling role='alert' region that is empty on the non-failed path (live-region split)", () => {
    // Defer #4 closure (Blind hunter B1 review, 2026-05-20): toggling aria-live
    // on a single node is per-ARIA undefined. Split is two always-mounted
    // regions — polite root + sr-only alert sibling; content gates the alert.
    const { container } = render(
      <TxProgressSteps {...defaults({ variant: "toast" })} />,
    );
    const alertRegion = container.querySelector('[data-region="alert-toast"]');
    expect(alertRegion).not.toBeNull();
    expect(alertRegion?.getAttribute("role")).toBe("alert");
    expect(alertRegion?.textContent).toBe("");
  });

  it("toast container caps width + clips overflow so long sub-copy never blows the 390px viewport", () => {
    // Cluster C SAVE-residue defer #3 (2026-05-20): single-line sub-copy in
    // Spanish / i18n fallbacks could push the toast past ~358px (content
    // area at 390px viewport). The container needs `max-w-full overflow-
    // hidden` so the sub-copy span's `truncate` can kick in.
    const { container } = render(
      <TxProgressSteps {...defaults({ variant: "toast" })} />,
    );
    const root = container.querySelector('[data-variant="toast"]');
    const classes = root?.className.split(/\s+/) ?? [];
    expect(classes).toContain("max-w-full");
    expect(classes).toContain("overflow-hidden");
  });

  it("toast sub-copy span truncates instead of wrapping (min-w-0 + truncate)", () => {
    // The sub-copy is the last `<span>` inside the toast root and holds
    // either the active step label or the success / failure message.
    // `truncate` (overflow-hidden + text-overflow-ellipsis + nowrap) keeps
    // it on one line; `min-w-0` lets it shrink inside the flex container.
    const { container } = render(
      <TxProgressSteps {...defaults({ variant: "toast" })} />,
    );
    const root = container.querySelector('[data-variant="toast"]');
    const spans = Array.from(root?.querySelectorAll(":scope > span") ?? []);
    const subCopySpan = spans[spans.length - 1] as HTMLElement | undefined;
    const classes = subCopySpan?.className.split(/\s+/) ?? [];
    expect(classes).toContain("truncate");
    expect(classes).toContain("min-w-0");
  });
});

describe("TxProgressSteps — failed state (AC-2.3.4, AC-2.3.5 failed branch)", () => {
  // Defensive: ensure fake timers from any failing assertion above don't
  // leak into sibling tests (Edge case hunter patch from B1 review).
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-2.3.4: failed state shows '!' on the active node, no retry button rendered", () => {
    const { container } = render(
      <TxProgressSteps
        {...defaults({ current: "failed", errorMessage: "User rejected" })}
      />,
    );
    // No <button> anywhere in the primitive — retry is surface-owned
    expect(container.querySelector("button")).toBeNull();
    // Sub-copy reads the supplied errorMessage
    expect(container.textContent).toContain("User rejected");
    // Failed node aria-label carries ", failed" suffix for parity with
    // ", complete" on done nodes (Acceptance auditor patch).
    const failedNode = container.querySelector('span[aria-label$=", failed"]');
    expect(failedNode).not.toBeNull();
  });

  it("AC-2.3.5 failed: primitive stays mounted indefinitely on failed (no auto-unmount)", async () => {
    vi.useFakeTimers();
    const { container } = render(
      <TxProgressSteps {...defaults({ current: "failed" })} />,
    );
    // Advance past the DONE_UNMOUNT_MS window — failed should NOT unmount
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.querySelector('[data-variant="pills"]')).not.toBeNull();
  });

  it("failed state surfaces a sibling role='alert' region with failure copy on both variants (live-region split)", () => {
    // Defer #4 closure (Blind hunter B1 review, 2026-05-20): instead of
    // toggling aria-live on the visible root (per ARIA spec undefined and
    // dropped by some screen readers), the primitive mounts a permanent
    // sr-only role="alert" sibling per variant. Polite root stays polite on
    // all paths; the alert region holds failure copy only when failed.
    const pills = render(
      <TxProgressSteps
        {...defaults({ current: "failed", errorMessage: "User rejected" })}
      />,
    );
    // Visible polite root never escalates
    expect(
      pills.container
        .querySelector('[data-variant="pills"]')
        ?.getAttribute("aria-live"),
    ).toBe("polite");
    const pillsAlert = pills.container.querySelector(
      '[data-region="alert-pills"]',
    );
    expect(pillsAlert?.getAttribute("role")).toBe("alert");
    expect(pillsAlert?.textContent).toContain("User rejected");
    pills.unmount();

    const toast = render(
      <TxProgressSteps
        {...defaults({
          variant: "toast",
          current: "failed",
          errorMessage: "User rejected",
        })}
      />,
    );
    expect(
      toast.container
        .querySelector('[data-variant="toast"]')
        ?.getAttribute("aria-live"),
    ).toBe("polite");
    const toastAlert = toast.container.querySelector(
      '[data-region="alert-toast"]',
    );
    expect(toastAlert?.getAttribute("role")).toBe("alert");
    expect(toastAlert?.textContent).toContain("User rejected");
  });

  it("pills variant ships a sibling role='alert' region that is empty on the non-failed path (live-region split)", () => {
    // Sibling test to the toast equivalent — both variants must mount an
    // always-present sr-only alert region; non-failed states keep it empty so
    // screen readers stay silent until a real failure announcement lands.
    const { container } = render(
      <TxProgressSteps {...defaults({ current: "send" })} />,
    );
    const alertRegion = container.querySelector('[data-region="alert-pills"]');
    expect(alertRegion).not.toBeNull();
    expect(alertRegion?.getAttribute("role")).toBe("alert");
    expect(alertRegion?.textContent).toBe("");
  });
});

describe("TxProgressSteps — done success auto-unmount (AC-2.3.5 success branch)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-2.3.5 success: primitive unmounts after 1500ms hold when current='done'", async () => {
    const { container, rerender } = render(
      <TxProgressSteps {...defaults({ current: "wait" })} />,
    );
    // Pre-transition: still mounted
    expect(container.querySelector('[data-variant="pills"]')).not.toBeNull();

    // Surface transitions current to "done"
    rerender(<TxProgressSteps {...defaults({ current: "done" })} />);

    // Still mounted just after transition (within hold window)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('[data-variant="pills"]')).not.toBeNull();

    // Past 1500ms — unmounts (returns null)
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(container.querySelector('[data-variant="pills"]')).toBeNull();
  });

  it("done success in toast variant also auto-unmounts after 1500ms", async () => {
    const { container, rerender } = render(
      <TxProgressSteps
        {...defaults({ variant: "toast", current: "wait" })}
      />,
    );
    rerender(
      <TxProgressSteps
        {...defaults({ variant: "toast", current: "done" })}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(container.querySelector('[data-variant="toast"]')).toBeNull();
  });
});

describe("TxProgressSteps — flow telemetry context (B2 surface)", () => {
  it("flow prop mirrors to data-flow attribute on root (pills + toast)", () => {
    const pills = render(
      <TxProgressSteps {...defaults({ flow: "shop-buy" })} />,
    );
    expect(
      pills.container
        .querySelector('[data-variant="pills"]')
        ?.getAttribute("data-flow"),
    ).toBe("shop-buy");
    pills.unmount();

    const toast = render(
      <TxProgressSteps
        {...defaults({ variant: "toast", flow: "mint-victory" })}
      />,
    );
    expect(
      toast.container
        .querySelector('[data-variant="toast"]')
        ?.getAttribute("data-flow"),
    ).toBe("mint-victory");
  });

  it("data-component='tx-progress-steps' lives on the root for sibling selector consistency", () => {
    const { container } = render(<TxProgressSteps {...defaults()} />);
    expect(
      container.querySelector('[data-component="tx-progress-steps"]'),
    ).not.toBeNull();
  });
});

describe("TxProgressSteps — telemetry (AC-2.3.6)", () => {
  beforeEach(() => {
    trackMock.mockClear();
  });

  it("view event fires once on mount with {flow, variant}", () => {
    render(<TxProgressSteps {...defaults({ flow: "save-score" })} />);
    const viewCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_view",
    );
    expect(viewCalls.length).toBe(1);
    expect(viewCalls[0]?.[1]).toEqual({ flow: "save-score", variant: "pills" });
  });

  it("initial step event fires on mount for the starting step", () => {
    render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "sign", flow: "save-score" })}
      />,
    );
    const stepCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_step",
    );
    expect(stepCalls.length).toBe(1);
    expect(stepCalls[0]?.[1]).toEqual({ flow: "save-score", step: "sign" });
    // No step_duration on initial mount (prev was null)
    const durationCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_step_duration",
    );
    expect(durationCalls.length).toBe(0);
  });

  it("step transition fires step_duration for prior step + step for new step", () => {
    const { rerender } = render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "sign" })}
      />,
    );
    trackMock.mockClear();

    rerender(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "send" })}
      />,
    );

    const calls = trackMock.mock.calls;
    const durationCall = calls.find(
      (c) => c[0] === "tx_progress_step_duration",
    );
    const stepCall = calls.find((c) => c[0] === "tx_progress_step");

    expect(durationCall?.[1]).toMatchObject({
      flow: "save-score",
      step: "sign",
    });
    expect(durationCall?.[1].duration_ms).toBeGreaterThanOrEqual(0);
    expect(stepCall?.[1]).toEqual({ flow: "save-score", step: "send" });
  });

  it("transition to done fires step_duration + done with outcome:success + positive total_duration_ms", () => {
    const { rerender } = render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "wait" })}
      />,
    );
    trackMock.mockClear();

    rerender(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "done" })}
      />,
    );

    const durationCall = trackMock.mock.calls.find(
      (c) => c[0] === "tx_progress_step_duration",
    );
    const doneCall = trackMock.mock.calls.find(
      (c) => c[0] === "tx_progress_done",
    );

    expect(durationCall?.[1]).toMatchObject({ step: "wait" });
    expect(doneCall?.[1]).toMatchObject({
      flow: "save-score",
      outcome: "success",
    });
    expect(doneCall?.[1].total_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("transition to failed fires done with outcome:failed", () => {
    const { rerender } = render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "send" })}
      />,
    );
    trackMock.mockClear();

    rerender(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "failed" })}
      />,
    );

    const doneCall = trackMock.mock.calls.find(
      (c) => c[0] === "tx_progress_done",
    );
    expect(doneCall?.[1]).toMatchObject({
      flow: "save-score",
      outcome: "failed",
    });
  });

  it("re-render with same current does NOT fire step or step_duration", () => {
    const { rerender } = render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "sign" })}
      />,
    );
    trackMock.mockClear();

    rerender(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "sign" })}
      />,
    );

    const stepCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_step",
    );
    const durationCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_step_duration",
    );
    expect(stepCalls.length).toBe(0);
    expect(durationCalls.length).toBe(0);
  });

  it("defensive guard (current not in steps[]) suppresses ALL telemetry events", () => {
    render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "verify" })}
      />,
    );
    expect(trackMock.mock.calls.length).toBe(0);
  });

  it("flow prop drift mid-lifecycle: telemetry stays locked to the original flow (B2 review patch)", () => {
    // Surface bug simulation: parent mutates `flow` prop without remount.
    // Telemetry must NOT split into a mixed-flow event stream.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = render(
      <TxProgressSteps
        {...defaults({ flow: "save-score", current: "sign" })}
      />,
    );
    trackMock.mockClear();

    rerender(
      <TxProgressSteps
        {...defaults({ flow: "shop-buy", current: "send" })}
      />,
    );

    // Step event uses the ORIGINAL flow, not the new one
    const stepCall = trackMock.mock.calls.find(
      (c) => c[0] === "tx_progress_step",
    );
    expect(stepCall?.[1]).toEqual({ flow: "save-score", step: "send" });

    // Dev-mode warn fires so the surface bug is noisy in dev (silent in prod)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[TxProgressSteps] flow prop changed from "save-score" to "shop-buy"',
      ),
    );

    warnSpy.mockRestore();
  });

  it("done event fires at most once even on terminal re-render", () => {
    const { rerender } = render(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "wait" })}
      />,
    );
    rerender(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "done" })}
      />,
    );
    trackMock.mockClear();

    // Parent re-renders again with same terminal state (e.g., props
    // identity changed but `current` value same)
    rerender(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "done" })}
      />,
    );

    const doneCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_done",
    );
    expect(doneCalls.length).toBe(0);
  });

  // ─── B2 review residue (closed 2026-05-21) ──────────────────────────

  it("mount-at-terminal: current='done' on initial render fires view + done, skips step_duration (B2 edge #3)", () => {
    // Crash-recovery shape: surface restores a finished tx from saved
    // state and mounts the primitive directly at the terminal. Impl
    // contract: view + done fire (no `step`, no `step_duration` because
    // `prevStepRef` is null at first effect tick).
    render(
      <TxProgressSteps {...defaults({ steps: SAVE_STEPS, current: "done" })} />,
    );

    const viewCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_view",
    );
    expect(viewCalls.length).toBe(1);

    const stepCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_step",
    );
    expect(stepCalls.length).toBe(0);

    const durationCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_step_duration",
    );
    expect(durationCalls.length).toBe(0);

    const doneCalls = trackMock.mock.calls.filter(
      (c) => c[0] === "tx_progress_done",
    );
    expect(doneCalls.length).toBe(1);
    expect(doneCalls[0][1]).toMatchObject({
      flow: "save-score",
      outcome: "success",
    });
    expect(doneCalls[0][1].total_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("isInvalid flips true mid-flow: primitive bails silently, no step_duration drain (B2 edge #4)", () => {
    // Surface contract violation: starts valid, re-renders with a
    // `current` code that isn't in `steps[]` (non-terminal). The
    // primitive returns null and stops emitting; the in-flight step's
    // `step_duration` is intentionally NOT drained — closing it would
    // need an `abandoned-flow` telemetry signal which is out of scope.
    const { container, rerender } = render(
      <TxProgressSteps {...defaults({ steps: SAVE_STEPS, current: "sign" })} />,
    );
    // Sanity: visible on first render
    expect(container.querySelector('[data-variant="pills"]')).not.toBeNull();
    trackMock.mockClear();

    rerender(
      <TxProgressSteps
        {...defaults({ steps: SAVE_STEPS, current: "verify" })}
      />,
    );

    // Component returns null — no visible variant root
    expect(container.querySelector('[data-variant="pills"]')).toBeNull();
    // And no telemetry leaks (no phantom step, no abandoned step_duration)
    expect(trackMock.mock.calls.length).toBe(0);
  });
});

describe("TxProgressSteps — defensive guards (B1 review patches)", () => {
  it("returns null for empty steps[] (would otherwise crash toast counter)", () => {
    const { container } = render(
      <TxProgressSteps {...defaults({ steps: [], current: "sign" })} />,
    );
    expect(
      container.querySelector('[data-component="tx-progress-steps"]'),
    ).toBeNull();
  });

  it("returns null when current is a step code not present in steps[]", () => {
    const { container } = render(
      <TxProgressSteps {...defaults({ steps: SAVE_STEPS, current: "verify" })} />,
    );
    expect(
      container.querySelector('[data-component="tx-progress-steps"]'),
    ).toBeNull();
  });

  it("still renders for terminal current values (done/failed) even if step code semantics moot", () => {
    const { container } = render(
      <TxProgressSteps {...defaults({ steps: SAVE_STEPS, current: "done" })} />,
    );
    expect(
      container.querySelector('[data-component="tx-progress-steps"]'),
    ).not.toBeNull();
  });
});
