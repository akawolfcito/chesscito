"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export type PrimitiveBoundaryErrorContext = {
  primitiveName: string;
  surface?: string;
  atmosphere?: string;
  error: Error;
  stack: string;
};

type Props = {
  /** Required identifier emitted in error reports. Use the primitive's
   *  display name (e.g. "KingdomAnchor"). */
  primitiveName: string;
  /** Optional surface that is composing the primitive (e.g. "play-hub").
   *  Forwarded to onError for grouping in observability. */
  surface?: string;
  /** Optional visual register (e.g. "adventure" / "scholarly"). Forwarded
   *  to onError. */
  atmosphere?: string;
  /** Optional error sink. Wire to Vercel Analytics / Sentry at the surface
   *  level. The boundary intentionally exposes only the structured context
   *  below — no arbitrary child props leak through, so PII can't ride the
   *  error channel. */
  onError?: (context: PrimitiveBoundaryErrorContext) => void;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/** React error boundary for Game Home redesign primitives. A primitive
 *  crash is contained at the boundary and the parent surface keeps
 *  rendering. The fallback uses the warm-paper Scholarly tray so it
 *  reads as quiet, non-alarming. The boundary preserves DOM identity in
 *  the no-error path (children pass through), so existing primitives'
 *  return-null behavior is unaffected.
 *
 *  See `_bmad-output/planning-artifacts/epics.md` Story 1.11. */
export class PrimitiveBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const context: PrimitiveBoundaryErrorContext = {
      primitiveName: this.props.primitiveName,
      surface: this.props.surface,
      atmosphere: this.props.atmosphere,
      error,
      stack: info.componentStack ?? error.stack ?? "",
    };
    this.props.onError?.(context);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="polite"
          className="primitive-boundary-fallback"
          data-primitive={this.props.primitiveName}
        >
          <span className="primitive-boundary-fallback-text">
            Couldn’t load this piece. The rest of the screen is fine.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
