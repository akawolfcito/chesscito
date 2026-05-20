import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

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

  it("failed state escalates aria-live to assertive on both variants", () => {
    const pills = render(
      <TxProgressSteps {...defaults({ current: "failed" })} />,
    );
    expect(
      pills.container
        .querySelector('[data-variant="pills"]')
        ?.getAttribute("aria-live"),
    ).toBe("assertive");
    pills.unmount();

    const toast = render(
      <TxProgressSteps
        {...defaults({ variant: "toast", current: "failed" })}
      />,
    );
    expect(
      toast.container
        .querySelector('[data-variant="toast"]')
        ?.getAttribute("aria-live"),
    ).toBe("assertive");
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
