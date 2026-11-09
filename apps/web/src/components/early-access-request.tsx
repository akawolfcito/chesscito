"use client";

import { useEffect, useRef, useState } from "react";

import { getAttribution } from "@/lib/analytics/attribution";
import { normalizeEarlyAccessEmail } from "@/lib/early-access/request";
import {
  EARLY_ACCESS_EVENTS,
  trackEarlyAccess,
} from "@/lib/wallet/web-access-analytics";
import {
  EARLY_ACCESS_COPY,
  type ProductSurface,
} from "@/lib/wallet/web-access-copy";

/**
 * The Early Access intake screen (design 2026-08-10 §B2).
 *
 * ⚠️ NO PRIVY IS TOUCHED ANYWHERE IN THIS FILE, AND THAT IS THE WHOLE POINT.
 *
 * A Privy login creates a session, a session is a MAU, and the Core plan is
 * free only to 499 of them. Asking for a key therefore has to cost nothing:
 * this screen collects an address, posts it to our own route, and shows a
 * confirmation. It never calls `login()`, never mounts a Privy hook, and never
 * needs an identity — which is also why it can sit in front of the gate rather
 * than behind it.
 *
 * Nothing here grants access either. The row it creates is a queue entry; the
 * allowlist in the Privy dashboard is what actually admits somebody
 * (`lib/early-access/request.ts`).
 */

type View =
  | { kind: "form"; error: "invalid" | "failed" | null; submitting: boolean }
  | { kind: "sent" };

const INITIAL: View = { kind: "form", error: null, submitting: false };

export function EarlyAccessRequest({
  surface,
  onBack,
}: {
  surface: ProductSurface;
  onBack: () => void;
}) {
  const [view, setView] = useState<View>(INITIAL);
  const [email, setEmail] = useState("");

  // Reported once per mount. The screen is reached by an explicit tap, so a
  // second view means a second decision to come back — worth counting, but not
  // once per keystroke.
  const viewReported = useRef(false);
  useEffect(() => {
    if (viewReported.current) return;
    viewReported.current = true;
    trackEarlyAccess(EARLY_ACCESS_EVENTS.requestViewed, surface);
  }, [surface]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (view.kind !== "form" || view.submitting) return;

    // The SAME normalizer the route runs, for instant feedback on a typo. It is
    // a courtesy, not a control: the server normalizes and validates again, and
    // that copy is the one that decides what gets stored.
    const normalized = normalizeEarlyAccessEmail(email);
    if (!normalized) {
      setView({ kind: "form", error: "invalid", submitting: false });
      return;
    }

    setView({ kind: "form", error: null, submitting: true });

    try {
      const response = await fetch("/api/early-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `source` reuses the existing first-touch attribution rather than
        // inventing a second one. The server re-sanitizes it through the same
        // allow-list, so this is a hint, never a value we trust.
        body: JSON.stringify({
          email: normalized,
          source: getAttribution().source,
        }),
      });

      if (!response.ok) {
        setView({ kind: "form", error: "failed", submitting: false });
        return;
      }

      const body = (await response.json()) as { outcome?: string };
      // `created` vs `already-requested` separates "25 people asked" from
      // "9 people asked, some twice". The player sees the identical screen for
      // both: being told "you already asked" helps nobody.
      trackEarlyAccess(
        EARLY_ACCESS_EVENTS.requested,
        surface,
        body.outcome === "already-requested" ? "already-requested" : "created",
      );
      setView({ kind: "sent" });
    } catch {
      setView({ kind: "form", error: "failed", submitting: false });
    }
  }

  if (view.kind === "sent") {
    return (
      <div
        data-web-access="early-access-waiting"
        data-surface={surface}
        role="status"
        className="web-access-screen web-access-screen--gate"
      >
        <div className="web-access-copy">
          <h1 className="web-access-headline">{EARLY_ACCESS_COPY.waiting.title}</h1>
          <p className="web-access-body">{EARLY_ACCESS_COPY.waiting.body}</p>
        </div>
        <div className="web-access-actions">
          {/* No second REQUEST MY KEY: the request is saved, and offering to
              send it again would suggest the first one did not land. */}
          <button
            type="button"
            className="web-access-cta web-access-cta--cream"
            onClick={onBack}
          >
            {EARLY_ACCESS_COPY.waiting.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-web-access="early-access-request"
      data-surface={surface}
      className="web-access-screen web-access-screen--gate"
    >
      <div className="web-access-copy">
        <h1 className="web-access-headline">{EARLY_ACCESS_COPY.request.title}</h1>
        <p className="web-access-body">{EARLY_ACCESS_COPY.request.body}</p>
      </div>
      {/* Same two-block layout as the gate, so moving between them shifts
          nothing on screen. */}
      <form className="web-access-actions" onSubmit={submit} noValidate>
        <label className="web-access-label" htmlFor="early-access-email">
          {EARLY_ACCESS_COPY.request.emailLabel}
        </label>
        <input
          id="early-access-email"
          className="web-access-input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={EARLY_ACCESS_COPY.request.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={view.submitting}
          aria-invalid={view.error === "invalid"}
          aria-describedby={view.error ? "early-access-error" : undefined}
        />
        {view.error ? (
          <p id="early-access-error" role="alert" className="web-access-error">
            {view.error === "invalid"
              ? EARLY_ACCESS_COPY.request.invalid
              : EARLY_ACCESS_COPY.request.failed}
          </p>
        ) : null}
        <button type="submit" className="web-access-cta" disabled={view.submitting}>
          {EARLY_ACCESS_COPY.request.cta}
        </button>
        <p className="web-access-note">{EARLY_ACCESS_COPY.request.note}</p>
        <button
          type="button"
          className="web-access-note web-access-link"
          onClick={onBack}
        >
          {EARLY_ACCESS_COPY.request.back}
        </button>
      </form>
    </div>
  );
}
