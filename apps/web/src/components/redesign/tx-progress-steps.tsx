"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { track } from "@/lib/telemetry";

/** Canonical step taxonomy. Every tx surface picks a subset of these.
 *  Surface controls the order via the `steps[]` array (this primitive
 *  renders exactly what it receives — no internal trim, no auto-insert).
 *  See spec §0.5 + design notes for the H-3 resolution. */
export type TxStepCode = "prepare" | "sign" | "send" | "wait" | "verify";

/** Telemetry flow tag — kept in the props contract so B2 (post-launch
 *  observability sprint) can wire emit calls without changing adopter
 *  call-sites. Unused in B1; the value is mirrored to `data-flow` on
 *  the root for selector convenience. */
export type TxFlowName =
  | "save-score"
  | "claim-badge"
  | "mint-victory"
  | "shop-buy"
  | "pro-buy";

export type TxStepDescriptor = {
  code: TxStepCode;
  /** Override the default label from TX_PROGRESS_COPY. Rare. */
  label?: string;
  /** Marks the step as "render only when active" (e.g., the slow `prepare`
   *  branch). Not enforced by this primitive — the surface decides whether
   *  to include the step in `steps[]` at all. Field is informational and
   *  reserved for future tooling. */
  optional?: boolean;
};

export type TxProgressStepsProps = {
  variant: "pills" | "toast";
  /** Ordered, fully-trimmed sequence. Surface owns compound-step trim
   *  (e.g., dropping the approve half when allowance is satisfied). */
  steps: TxStepDescriptor[];
  /** Current step (or terminal). Surface-controlled. */
  current: TxStepCode | "done" | "failed";
  /** Surface-supplied error sub-copy for the `failed` terminal. */
  errorMessage?: string;
  /** Pills variant only — short surface title above the row. Toast ignores. */
  title?: string;
  flow: TxFlowName;
};

/** step code → ICU key in TX_PROGRESS_COPY namespace. Module-scope so
 *  the maps are stable across renders; `t()` is invoked at the call site. */
const PILLS_KEY: Record<TxStepCode | "done" | "failed", string> = {
  prepare: "pillsPrepare",
  sign: "pillsSign",
  send: "pillsSend",
  wait: "pillsWait",
  verify: "pillsVerify",
  done: "pillsDone",
  failed: "pillsFailed",
};

const TOAST_KEY: Record<TxStepCode | "done" | "failed", string> = {
  prepare: "toastPrepare",
  sign: "toastSign",
  send: "toastSend",
  wait: "toastWait",
  verify: "toastVerify",
  done: "toastDoneSuccess",
  failed: "toastDoneFailed",
};

/** Hold the done-success terminal for this long before unmounting, so the
 *  user reads the final state. Failed state does NOT auto-unmount — the
 *  surface owns its lifecycle so the retry CTA stays in context. */
const DONE_UNMOUNT_MS = 1500;

/**
 * <TxProgressSteps> — stateless tx phase indicator with two visual variants.
 *
 * - `variant="pills"` renders an ordered row of step nodes for sheets /
 *   overlays that have room (Shop, PRO, Victory).
 * - `variant="toast"` renders a single-line candy banner for inline chrome
 *   (Save, Claim) where the surface can spare only ~40-50px.
 *
 * The primitive does not own the step-transition state machine. The
 * surface drives `current` via its own tx hook (wagmi `writeContractAsync`
 * → broadcast → receipt). On `current="done"` the primitive holds
 * 1500ms then self-unmounts; on `current="failed"` it stays mounted
 * indefinitely so the surface can render its retry UI alongside.
 *
 * ─── Adopter contract (B2 review residue, closed 2026-05-21) ─────────
 *
 * 1. **One instance per tx.** The primitive treats its mount as the tx
 *    boundary: `view`, `step`, `step_duration`, and `done` events are
 *    bookkept per-instance, and `doneFiredRef` latches the terminal
 *    event so a parent re-render at the terminal state can't double-
 *    fire `done`. To start a NEW tx in the same surface, remount via a
 *    `key=` change. Re-using the same instance across flows is an anti-
 *    pattern: the second `done` will be suppressed.
 *
 * 2. **`current` must stay valid mid-flow.** Once mounted, `current`
 *    must remain either a step code present in `steps[]` or one of the
 *    two terminals (`done`, `failed`). If the surface flips `current`
 *    to an invalid value mid-life (e.g., a code not in `steps[]`, non-
 *    terminal), the primitive returns null and drops all subsequent
 *    telemetry — the in-progress step's `step_duration` will NOT be
 *    drained. This is intentional bail-silent behavior; the contract
 *    violation is the surface's bug.
 *
 * 3. **Mount-at-terminal is supported.** A surface may mount the
 *    primitive directly at `current="done"` or `current="failed"` for
 *    crash recovery from a saved-state restore. The impl fires `view` +
 *    `done` and skips `step_duration` (because `prevStepRef === null`).
 *    `total_duration_ms` will be near-zero (mount-to-effect interval).
 *
 * 4. **StrictMode double-invoke is expected in dev.** React 18
 *    StrictMode mounts components, immediately unmounts them, and
 *    mounts them again to surface effect-cleanup bugs. This means
 *    `view` + the initial `step` event fire twice in dev — the server-
 *    side throttle (`/api/telemetry`, 100 events / 5min / event-name)
 *    absorbs the duplicate at scale, and production cold mounts run
 *    StrictMode-free. Behavior is treated as observed-but-acceptable.
 *
 * 5. **Throttle overflow is dropped silently.** Rapid wagmi retry
 *    oscillation could theoretically exceed the 100-events / 5min /
 *    event-name budget on `step` + `step_duration` for a single flow.
 *    Excess events are dropped client-side without instrumentation;
 *    server-side dropped-signal telemetry is a separate future item.
 */
export function TxProgressSteps(props: TxProgressStepsProps) {
  const { variant, current, flow, steps } = props;
  const [unmount, setUnmount] = useState(false);

  // B1 defensive guards lifted out of the JSX so telemetry effects can
  // consume the same `isInvalid` signal (avoids phantom `view` events for
  // primitives that would have returned null at render time).
  const isTerminal = current === "done" || current === "failed";
  const isInvalid =
    steps.length === 0 ||
    (!isTerminal && !steps.some((s) => s.code === current));

  // ─── Telemetry timing anchors (B2) ──────────────────────────────────
  // `performance.now()` is monotonic ms — survives system-clock drift.
  // Refs are stable across renders; the `initialValue` is only used on
  // first render so subsequent re-evaluations are harmless.
  const mountedAtRef = useRef<number>(performance.now());
  const prevStepRef = useRef<TxStepCode | null>(null);
  const prevStepStartedAtRef = useRef<number>(performance.now());
  const doneFiredRef = useRef<boolean>(false);

  // Lock flow + variant at mount so a parent that accidentally mutates
  // them mid-lifecycle (surface bug) cannot produce a mixed-stream of
  // telemetry events. The primitive is per-tx; flow is invariant per
  // primitive instance. B2 review patch (Blind hunter + Edge case
  // hunter overlap).
  const lockedFlowRef = useRef<TxFlowName>(flow);
  const lockedVariantRef = useRef<"pills" | "toast">(variant);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (flow !== lockedFlowRef.current) {
      // eslint-disable-next-line no-console
      console.warn(
        `[TxProgressSteps] flow prop changed from "${lockedFlowRef.current}" to "${flow}" ` +
          `mid-lifecycle. Telemetry stays on the original flow. Remount the primitive (key change) ` +
          `to start a new flow cleanly.`,
      );
    }
  }, [flow]);

  // Done auto-unmount (B1)
  useEffect(() => {
    if (current !== "done") {
      setUnmount(false);
      return;
    }
    const timer = window.setTimeout(() => setUnmount(true), DONE_UNMOUNT_MS);
    return () => window.clearTimeout(timer);
  }, [current]);

  // Telemetry: view event — fires once at mount per primitive lifecycle.
  // Gated by `isInvalid` so guarded-out primitives never emit phantom views.
  useEffect(() => {
    if (isInvalid) return;
    track("tx_progress_view", {
      flow: lockedFlowRef.current,
      variant: lockedVariantRef.current,
    });
    // Intentionally empty deps — mount-only. Locked refs guarantee
    // stability even if parent mutates `flow`/`variant` mid-life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Telemetry: step + step_duration + done. Runs on every `current` change.
  // The `doneFiredRef` latch protects against double-firing done if the
  // parent re-renders at the terminal state.
  useEffect(() => {
    if (isInvalid) return;
    if (doneFiredRef.current) return;

    const now = performance.now();
    const prev = prevStepRef.current;
    const lockedFlow = lockedFlowRef.current;

    if (isTerminal) {
      // Drain duration for the step we're leaving (if any), then fire done.
      if (prev !== null) {
        const duration_ms = Math.round(now - prevStepStartedAtRef.current);
        track("tx_progress_step_duration", {
          flow: lockedFlow,
          step: prev,
          duration_ms,
        });
      }
      const total_duration_ms = Math.round(now - mountedAtRef.current);
      const outcome = current === "done" ? "success" : "failed";
      track("tx_progress_done", {
        flow: lockedFlow,
        outcome,
        total_duration_ms,
      });
      doneFiredRef.current = true;
      return;
    }

    if (prev !== current) {
      // Real transition (including initial null → first step on mount).
      if (prev !== null) {
        const duration_ms = Math.round(now - prevStepStartedAtRef.current);
        track("tx_progress_step_duration", {
          flow: lockedFlow,
          step: prev,
          duration_ms,
        });
      }
      track("tx_progress_step", { flow: lockedFlow, step: current });
      prevStepRef.current = current;
      prevStepStartedAtRef.current = now;
    }
  }, [current, isInvalid, isTerminal]);

  if (unmount) return null;
  if (isInvalid) return null;

  return variant === "pills" ? (
    <PillsVariant {...props} />
  ) : (
    <ToastVariant {...props} />
  );
}

type PillState = "complete" | "active" | "failed" | "future";

function PillsVariant({
  steps,
  current,
  errorMessage,
  title,
  flow,
}: TxProgressStepsProps) {
  const t = useTranslations("TX_PROGRESS_COPY");
  const isFailed = current === "failed";
  const isDone = current === "done";

  // For step codes, active index = position in steps[]. For terminals,
  // we anchor on the last step (failed pinpoints the step that broke;
  // done marks all complete).
  const activeIndex =
    isDone || isFailed
      ? steps.length - 1
      : Math.max(
          0,
          steps.findIndex((s) => s.code === current),
        );

  const subCopy = isFailed
    ? errorMessage ?? t("toastErrorFallback")
    : isDone
      ? t("toastDoneSuccess")
      : t(TOAST_KEY[current]);

  // a11y live-region split: polite root announces step transitions; sibling
  // role="alert" (implicit aria-live=assertive + aria-atomic=true) holds
  // failure copy only when isFailed. Both regions always mounted so screen
  // readers don't drop announcements on aria-live attribute mutation
  // (undefined behavior per ARIA spec — some readers ignore the change).
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        data-component="tx-progress-steps"
        data-flow={flow}
        data-variant="pills"
        className="flex flex-col items-center gap-2 px-4 py-3"
      >
        {title ? (
          <p
            className="text-sm font-bold"
            style={{ color: "rgba(63, 34, 8, 0.95)" }}
          >
            {title}
          </p>
        ) : null}
        <div className="flex items-center gap-1.5" role="list">
          {steps.map((step, idx) => {
            const state: PillState = isDone
              ? "complete"
              : idx < activeIndex
                ? "complete"
                : idx === activeIndex
                  ? isFailed
                    ? "failed"
                    : "active"
                  : "future";
            return (
              <PillNode
                key={step.code}
                step={step}
                state={state}
                isLast={idx === steps.length - 1}
              />
            );
          })}
        </div>
        <p
          className="text-xs"
          style={{
            color: isFailed
              ? "rgba(159, 18, 57, 0.95)"
              : "rgba(110, 65, 15, 0.85)",
          }}
        >
          {subCopy}
        </p>
      </div>
      <div role="alert" data-region="alert-pills" className="sr-only">
        {isFailed ? subCopy : ""}
      </div>
    </>
  );
}

function PillNode({
  step,
  state,
  isLast,
}: {
  step: TxStepDescriptor;
  state: PillState;
  isLast: boolean;
}) {
  const t = useTranslations("TX_PROGRESS_COPY");
  const label = step.label ?? t(PILLS_KEY[step.code]);

  const nodeClass = {
    complete:
      "bg-amber-400 border-amber-500 text-amber-950",
    active:
      "bg-amber-300 border-amber-500 text-amber-950 motion-safe:animate-pulse",
    failed: "bg-rose-200 border-rose-500 text-rose-900",
    future: "bg-transparent border-amber-700/30 text-amber-700/50",
  }[state];

  // Patch from B1 review (Acceptance auditor + Blind hunter):
  //  - Strip aria-label from future-state nodes — they are decorative
  //    until reached; the parent role="status" already announces context.
  //  - Add ", failed" suffix on failed-state for parity with ", complete".
  //  - aria-hidden on future + completed node icons so screen readers
  //    don't double-announce the live region with the muted timeline.
  const ariaLabel =
    state === "complete"
      ? `${label}, complete`
      : state === "failed"
        ? `${label}, failed`
        : state === "active"
          ? label
          : undefined;
  const ariaCurrent = state === "active" ? "step" : undefined;
  const ariaHidden = state === "future" || undefined;

  return (
    <div className="flex flex-col items-center gap-1" role="listitem">
      <span
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        aria-hidden={ariaHidden}
        className={`flex h-6 w-6 items-center justify-center rounded-full border ${nodeClass}`}
      >
        {state === "complete" ? "✓" : state === "failed" ? "!" : null}
      </span>
      <span
        className="text-nano font-extrabold uppercase tracking-wider"
        style={{ color: "rgba(110, 65, 15, 0.95)" }}
      >
        {label}
      </span>
      {!isLast ? (
        <span aria-hidden="true" className="sr-only" />
      ) : null}
    </div>
  );
}

function ToastVariant({
  steps,
  current,
  errorMessage,
  flow,
}: TxProgressStepsProps) {
  const t = useTranslations("TX_PROGRESS_COPY");
  const isFailed = current === "failed";
  const isDone = current === "done";

  const counterIdx =
    isDone || isFailed
      ? steps.length
      : Math.max(1, steps.findIndex((s) => s.code === current) + 1);

  const counterText = t("stepCounter", {
    current: counterIdx,
    total: steps.length,
  });

  const subCopy = isFailed
    ? errorMessage ?? t("toastErrorFallback")
    : isDone
      ? t("toastDoneSuccess")
      : t(TOAST_KEY[current]);

  const ariaLabel = isFailed
    ? `${t("toastDoneFailed")}: ${subCopy}`
    : isDone
      ? subCopy
      : `${subCopy}, ${counterText.toLowerCase()}`;

  const iconGlyph = isFailed ? "!" : isDone ? "✓" : "⏳";

  // a11y live-region split (parity with PillsVariant): polite root announces
  // normal step transitions; sibling role="alert" carries failure copy only
  // on failed state. See PillsVariant comment for rationale.
  const alertAnnouncement = isFailed
    ? `${t("toastDoneFailed")}: ${subCopy}`
    : "";

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
        data-component="tx-progress-steps"
        data-flow={flow}
        data-variant="toast"
        className="inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full px-3 py-2 text-xs font-semibold"
        style={{
          background: isFailed
            ? "rgba(255, 228, 230, 0.85)"
            : "rgba(255, 245, 215, 0.85)",
          color: isFailed
            ? "rgba(159, 18, 57, 0.95)"
            : "rgba(110, 65, 15, 0.95)",
          border: `1px solid ${
            isFailed ? "rgba(159, 18, 57, 0.4)" : "rgba(245, 158, 11, 0.45)"
          }`,
          boxShadow: "0 2px 4px rgba(63, 34, 8, 0.15)",
        }}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {iconGlyph}
        </span>
        {!isDone && !isFailed ? (
          <span className="text-nano font-extrabold uppercase tracking-wider opacity-70">
            {counterText}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{subCopy}</span>
      </div>
      <div role="alert" data-region="alert-toast" className="sr-only">
        {alertAnnouncement}
      </div>
    </>
  );
}
