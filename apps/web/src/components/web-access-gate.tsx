"use client";

import { usePrivy, useLogin } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { DesktopAppFrame } from "@/components/chrome/desktop-app-frame";
import { EarlyAccessRequest } from "@/components/early-access-request";
import { trackWebAccess, WEB_ACCESS_EVENTS } from "@/lib/wallet/web-access-analytics";
import {
  EARLY_ACCESS_COPY,
  resolveWebAccessSurface,
  WEB_ACCESS_COPY,
  type ProductSurface,
} from "@/lib/wallet/web-access-copy";
import {
  deriveWebAccessState,
  isUserDismissedLogin,
} from "@/lib/wallet/web-access-state";

/** Where the error escape hatches lead. The discovery app lives on the apex;
 *  MiniPay bypasses the gate entirely, so its link re-enters that flow. */
const DISCOVERY_URL = "https://chesscito.com";
const MINIPAY_URL = "https://www.opera.com/products/minipay";

/**
 * Mandatory access gate for the web (Privy) branch. Renders productive
 * `children` ONLY once Privy reports an authenticated session AND wagmi exposes
 * an embedded-wallet address. Every other state is a shell, the gate, or an
 * interstitial — there is no `Continue as Guest`.
 *
 * MiniPay never mounts this: the wallet branch resolver keeps MiniPay on the
 * `injected` tree, so this component is unreachable from that environment.
 *
 * `surface` is derived from the build mode (`CHESSCITO_MODE`), never from the
 * hostname — Learn and Play are separate deploys of the same app and differ
 * only in one copy line.
 */
export function WebAccessGate({
  children,
  surface = resolveWebAccessSurface(),
}: {
  children: ReactNode;
  surface?: ProductSurface;
}) {
  const { ready, authenticated } = usePrivy();
  const { address } = useAccount();
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState(false);
  /** Whether the visitor asked to see the Early Access intake.
   *
   *  A view toggle, NOT a sixth access state: it changes which of OUR screens a
   *  visitor is looking at while they remain `unauthenticated`, and it decides
   *  nothing about access. Keeping it out of `deriveWebAccessState` is what
   *  stops that reducer — the one thing standing between a web user and the
   *  product — from growing a branch that has no bearing on access. */
  const [requestingAccess, setRequestingAccess] = useState(false);

  const { login } = useLogin({
    onComplete: () => {
      setAuthenticating(false);
      setError(false);
    },
    onError: (code) => {
      setAuthenticating(false);
      // Closing the modal is a decision, not a failure: it returns the player
      // to the gate they came from, with the CTA armed. Only genuine failures
      // earn the error screen and its escape hatches.
      setError(!isUserDismissedLogin(code));
    },
  });

  const walletReady = Boolean(address);
  const state = deriveWebAccessState({
    ready,
    authenticated,
    walletReady,
    authenticating,
    error,
  });

  // Analytics. `login_succeeded` is a genuine transition (false→true this
  // session), so its ref seeds from the mount value: a restored session that is
  // already authenticated did not just log in. `gate_viewed`, `wallet_ready`
  // and `login_failed` are milestones reported once regardless of mount, so
  // their refs seed from false. Names and payload live in the analytics module,
  // which is PII-free by construction.
  const gateViewed = useRef(false);
  const wasAuthenticated = useRef(authenticated);
  const walletReadyReported = useRef(false);
  const failureReported = useRef(false);

  useEffect(() => {
    if (state === "unauthenticated" && !gateViewed.current) {
      gateViewed.current = true;
      trackWebAccess(WEB_ACCESS_EVENTS.gateViewed, surface);
    }
    if (authenticated && !wasAuthenticated.current) {
      trackWebAccess(WEB_ACCESS_EVENTS.loginSucceeded, surface);
    }
    wasAuthenticated.current = authenticated;
    if (walletReady && !walletReadyReported.current) {
      walletReadyReported.current = true;
      trackWebAccess(WEB_ACCESS_EVENTS.walletReady, surface);
    }
    if (state === "error" && !failureReported.current) {
      failureReported.current = true;
      trackWebAccess(WEB_ACCESS_EVENTS.loginFailed, surface);
    }
    if (state !== "error") {
      failureReported.current = false;
    }
  }, [state, authenticated, walletReady, surface]);

  function startLogin() {
    setError(false);
    setAuthenticating(true);
    trackWebAccess(WEB_ACCESS_EVENTS.loginStarted, surface);
    login();
  }

  if (state === "wallet-ready") {
    return <>{children}</>;
  }

  // Everything below is a screen of OURS, not productive app content, and each
  // one wears the same desktop phone-bezel the app wears. Without this the gate
  // was the single full-bleed surface of the product on desktop web: the layout
  // frames `children` (`layout.tsx`), and these screens render INSTEAD of them,
  // so they landed outside the frame. Below 768px `DesktopAppFrame` collapses to
  // a pass-through, so MiniPay and mobile web are byte-for-byte unchanged.
  if (state === "environment-loading") {
    return (
      <DesktopAppFrame>
        <div
          data-web-access="environment-loading"
          data-surface={surface}
          className="web-access-screen web-access-screen--centered"
          aria-busy="true"
        />
      </DesktopAppFrame>
    );
  }

  if (state === "wallet-pending") {
    return (
      <DesktopAppFrame>
        <div
          data-web-access="wallet-pending"
          data-surface={surface}
          role="status"
          className="web-access-screen web-access-screen--centered"
        >
          <div className="web-access-copy">
            <p className="web-access-lede">{WEB_ACCESS_COPY.preparing}</p>
          </div>
        </div>
      </DesktopAppFrame>
    );
  }

  if (state === "error") {
    return (
      <DesktopAppFrame>
        {/* Same two-block layout as the gate, not a centered stack: the actions
            belong at the thumb, and centering them dropped three controls onto
            the wolf's face where none of them could be read (founder smoke,
            2026-07-27). Sharing the layout also means gate → error moves
            nothing on screen. */}
        <div
          data-web-access="error"
          data-surface={surface}
          role="alert"
          className="web-access-screen web-access-screen--gate"
        >
          <div className="web-access-copy">
            <p className="web-access-lede">{WEB_ACCESS_COPY.error.title}</p>
          </div>
          <div className="web-access-actions">
            <button type="button" className="web-access-cta" onClick={startLogin}>
              {WEB_ACCESS_COPY.error.retry}
            </button>
            {/* Cream, not glass: the secondary skin the rest of the app uses.
                A translucent white ghost over bright art is not a button. */}
            <a
              href={MINIPAY_URL}
              className="web-access-cta web-access-cta--cream"
            >
              {WEB_ACCESS_COPY.error.openMiniPay}
            </a>
            <a href={DISCOVERY_URL} className="web-access-note web-access-link">
              {WEB_ACCESS_COPY.error.backToDiscovery}
            </a>
          </div>
        </div>
      </DesktopAppFrame>
    );
  }

  // The Early Access intake. Reachable ONLY from `unauthenticated`: once a
  // login is in flight or a session exists, asking for a key is not the
  // question on screen. It renders in place of the gate, inside the same frame,
  // and touches no Privy hook (see `early-access-request.tsx`).
  if (state === "unauthenticated" && requestingAccess) {
    return (
      <DesktopAppFrame>
        <EarlyAccessRequest
          surface={surface}
          onBack={() => setRequestingAccess(false)}
        />
      </DesktopAppFrame>
    );
  }

  // `unauthenticated` / `authenticating` — the gate itself.
  return (
    <DesktopAppFrame>
      <div
        data-web-access={state}
        data-surface={surface}
        className="web-access-screen web-access-screen--gate"
      >
        {/* Two blocks, not one stack: the copy rides under the wordmark the
            wallpaper already paints, and the action stays thumb-anchored at the
            bottom, leaving the art's subject uncovered in between. */}
        <div className="web-access-copy">
          <h1 className="web-access-headline">{WEB_ACCESS_COPY.headline}</h1>
          <p className="web-access-lede">{WEB_ACCESS_COPY.lede}</p>
          <p className="web-access-body">
            {WEB_ACCESS_COPY.body.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </div>
        <div className="web-access-actions">
          <button
            type="button"
            className="web-access-cta"
            onClick={startLogin}
            disabled={authenticating}
          >
            {WEB_ACCESS_COPY.cta}
          </button>
          <p className="web-access-note">{WEB_ACCESS_COPY.note}</p>
          {/* Secondary and BELOW the CTA on purpose. A player who already has a
              key must keep seeing the screen they have always seen, so this is
              a link rather than a permanent email field competing with ENTER.
              It is also the reason the intake works whether or not the Privy
              allowlist is on: it never depends on a login being refused. */}
          <button
            type="button"
            className="web-access-note web-access-link"
            onClick={() => setRequestingAccess(true)}
          >
            {EARLY_ACCESS_COPY.requestLink}
          </button>
          {/* No `Continue as Guest`: web access is mandatory by product decision. */}
        </div>
      </div>
    </DesktopAppFrame>
  );
}
